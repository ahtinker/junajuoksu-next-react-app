'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';

/**
 * Train position data returned by the hook
 */
export interface TrainPosition {
    latitude: number | null;
    longitude: number | null;
    speed: number | null; // km/h
    timestamp: string | null;
    source: 'HSL' | 'VR' | null;
    heading?: number | null;
}

/**
 * HSL commuter line IDs that may have HSL data available
 * These trains operate inside and/or outside HSL area
 */
const HSL_COMMUTER_LINES = ['R', 'D', 'T', 'Z', 'H', 'A', 'E', 'I', 'K', 'L', 'N', 'P', 'U', 'Y'];

/**
 * Timeout in ms to wait for HSL data before also connecting to VR
 */
const HSL_TIMEOUT_MS = 5000;

/**
 * HSL MQTT WebSocket endpoint
 */
const HSL_MQTT_URL = 'wss://mqtt.hsl.fi:443/';

/**
 * VR/Digitraffic MQTT WebSocket endpoint
 */
const VR_MQTT_URL = 'wss://rata.digitraffic.fi:443/mqtt';

interface HslVehiclePosition {
    VP?: {
        jrn: string | number;
        lat: number | null;
        long: number | null;
        spd: number | null; // m/s
        hdg: number | null;
        tst: string;
        veh: number;
        oper: number;
        route: string;
        desi: string;
        dir: string;
        start: string;
        oday: string;
    };
}

interface VrTrainLocation {
    trainNumber: number;
    departureDate: string;
    timestamp: string;
    location: {
        type: string;
        coordinates: [number, number]; // [longitude, latitude]
    };
    speed: number; // km/h
    accuracy?: number;
}

/**
 * Hook to get realtime train position using MQTT WebSockets
 * 
 * For HSL commuter trains (R, D, T, Z, H, etc.), it first tries HSL data.
 * If no HSL data within 5 seconds, it also connects to VR/Digitraffic.
 * HSL data is preferred as it updates more frequently (once per second).
 * 
 * For non-commuter trains (IC, S, etc.), it only uses VR/Digitraffic.
 * 
 * @param trainNumber - The train number
 * @param departureDate - The departure date (YYYY-MM-DD)
 * @param commuterLineId - Optional commuter line ID (R, D, T, etc.)
 * @returns TrainPosition object with lat, long, speed, timestamp, and source
 */
export function useTrainPosition(
    trainNumber: number | string | null,
    departureDate: string | null,
    commuterLineId?: string | null
): TrainPosition {
    const [position, setPosition] = useState<TrainPosition>({
        latitude: null,
        longitude: null,
        speed: null,
        timestamp: null,
        source: null,
        heading: null,
    });

    const hslClientRef = useRef<MqttClient | null>(null);
    const vrClientRef = useRef<MqttClient | null>(null);
    const hslReceivedRef = useRef<boolean>(false);
    const hslTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isCommuterTrain = commuterLineId && HSL_COMMUTER_LINES.includes(commuterLineId.toUpperCase());

    /**
     * Connect to HSL MQTT broker for commuter train positions
     */
    const connectHsl = useCallback(() => {
        if (!trainNumber || !commuterLineId || hslClientRef.current) return;

        try {
            const client = mqtt.connect(HSL_MQTT_URL, {
                protocolVersion: 4,
                clean: true,
                connectTimeout: 10000,
                reconnectPeriod: 5000,
            });

            hslClientRef.current = client;

            client.on('connect', () => {
                console.log('[HSL MQTT] Connected');

                // Subscribe to train position updates
                // Topic format: /hfp/v2/journey/ongoing/vp/train/0090/{vehicle_number}/...
                // operator_id 90 is VR Oy (operates trains)
                // We use wildcards to catch all trains on this route
                const topic = `/hfp/v2/journey/ongoing/vp/train/0090/+/+/+/+/+/#`;

                client.subscribe(topic, { qos: 0 }, (err) => {
                    if (err) {
                        console.error('[HSL MQTT] Subscribe error:', err);
                    } else {
                        console.log('[HSL MQTT] Subscribed to:', topic);
                    }
                });
            });

            client.on('message', (topic, message) => {
                try {
                    const data: HslVehiclePosition = JSON.parse(message.toString());

                    if (data.VP) {
                        // Check if this message is for our train
                        // HSL uses route like "3001R" for R train
                        const vp = data.VP;
                        // Extract train identifier from the route or destination
                        // The desi field contains the line identifier like "R", "D", etc.
                        if (vp.desi && vp.desi.toUpperCase() === commuterLineId?.toUpperCase() && vp.jrn == trainNumber) {
                            // Additional check: match by start time from topic or infer from oday
                            if (vp.lat !== null && vp.long !== null) {
                                hslReceivedRef.current = true;

                                // Convert speed from m/s to km/h
                                const speedKmh = vp.spd !== null ? vp.spd * 3.6 : 0;

                                setPosition({
                                    latitude: vp.lat,
                                    longitude: vp.long,
                                    speed: Math.round(speedKmh),
                                    timestamp: vp.tst,
                                    source: 'HSL',
                                    heading: vp.hdg,
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error('[HSL MQTT] Message parse error:', err);
                }
            });

            client.on('error', (err) => {
                console.error('[HSL MQTT] Error:', err);
            });

            client.on('close', () => {
                console.log('[HSL MQTT] Connection closed');
            });

        } catch (err) {
            console.error('[HSL MQTT] Connection error:', err);
        }
    }, [trainNumber, commuterLineId]);

    /**
     * Connect to VR/Digitraffic MQTT broker for train GPS positions
     */
    const connectVr = useCallback(() => {
        if (!trainNumber || !departureDate || vrClientRef.current) return;

        try {
            const client = mqtt.connect(VR_MQTT_URL, {
                protocolVersion: 4,
                clean: true,
                connectTimeout: 10000,
                reconnectPeriod: 5000,
            });

            vrClientRef.current = client;

            client.on('connect', () => {
                console.log('[VR MQTT] Connected');

                // Topic format: train-locations/<departure_date>/<train_number>
                // Using wildcards to catch updates for any date (handles midnight crossover)
                const topic = `train-locations/+/${trainNumber}`;

                client.subscribe(topic, { qos: 0 }, (err) => {
                    if (err) {
                        console.error('[VR MQTT] Subscribe error:', err);
                    } else {
                        console.log('[VR MQTT] Subscribed to:', topic);
                    }
                });
            });

            client.on('message', (topic, message) => {
                try {
                    const data: VrTrainLocation = JSON.parse(message.toString());

                    if (data.location && data.location.coordinates) {
                        const [longitude, latitude] = data.location.coordinates;

                        setPosition((prev) => {
                            // Don't overwrite newer HSL data
                            if (prev.source === 'HSL' && prev.timestamp) {
                                const prevTime = new Date(prev.timestamp).getTime();
                                const newTime = new Date(data.timestamp).getTime();
                                // Only use VR data if it's newer or HSL data is older than 3 seconds
                                const now = Date.now();
                                const hslAge = now - prevTime;

                                if (prevTime > newTime && hslAge < 3000) {
                                    return prev;
                                }
                            }

                            return {
                                latitude,
                                longitude,
                                speed: Math.round(data.speed), // Already in km/h
                                timestamp: data.timestamp,
                                source: 'VR',
                                heading: null,
                            };
                        });
                    }
                } catch (err) {
                    console.error('[VR MQTT] Message parse error:', err);
                }
            });

            client.on('error', (err) => {
                console.error('[VR MQTT] Error:', err);
            });

            client.on('close', () => {
                console.log('[VR MQTT] Connection closed');
            });

        } catch (err) {
            console.error('[VR MQTT] Connection error:', err);
        }
    }, [trainNumber, departureDate]);

    /**
     * Cleanup function to disconnect all MQTT clients
     */
    const cleanup = useCallback(() => {
        if (hslTimeoutRef.current) {
            clearTimeout(hslTimeoutRef.current);
            hslTimeoutRef.current = null;
        }

        if (hslClientRef.current) {
            hslClientRef.current.end(true);
            hslClientRef.current = null;
        }

        if (vrClientRef.current) {
            vrClientRef.current.end(true);
            vrClientRef.current = null;
        }

        hslReceivedRef.current = false;
    }, []);

    useEffect(() => {
        if (!trainNumber || !departureDate) {
            cleanup();
            return;
        }

        // Reset state
        setPosition({
            latitude: null,
            longitude: null,
            speed: null,
            timestamp: null,
            source: null,
            heading: null,
        });
        hslReceivedRef.current = false;

        if (isCommuterTrain) {
            // For commuter trains, try HSL first
            connectHsl();

            // Set timeout to also connect to VR if no HSL data received
            hslTimeoutRef.current = setTimeout(() => {
                if (!hslReceivedRef.current) {
                    console.log('[Train Position] No HSL data within timeout, also connecting to VR');
                    connectVr();
                }
            }, HSL_TIMEOUT_MS);
        } else {
            // For non-commuter trains, only use VR
            connectVr();
        }

        return cleanup;
    }, [trainNumber, departureDate, isCommuterTrain, connectHsl, connectVr, cleanup]);

    return position;
}

export default useTrainPosition;
