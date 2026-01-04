'use client';
import '../../App.css';
import "../../globals.scss";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import mqtt, { MqttClient } from 'mqtt';
import { Train } from '../../../lib/types';
import TrainStationStops from './components/TrainStationStops';
import HighlightedStationPanel from './components/HighlightedStationPanel';
import NavBar from '@/app/components/site/navbar';
import Footer from '@/app/components/site/footer';
import { getTranslatedStationNameWithFallback } from '@/lib/stationUtils';
import { useTrainPosition } from '@/lib/useTrainPosition';

/**
 * Digitraffic MQTT WebSocket endpoint for train data
 */
const DIGITRAFFIC_MQTT_URL = 'wss://rata.digitraffic.fi:443/mqtt';

//path for this page /train/${train.departureDate}-${train.trainNumber}-${(origin station) stationData.uicCode}-${(origin station) stopIndex (e.g. if the train stops twice at one station, the second stop at that station makes this stopIndex = 1 and the first = 0)}${(the user's wanted destination will be highlighted) selectedDestination ? "-" + selectedDestination.uicCode : ""}`
//api for train data https://rata.digitraffic.fi/api/v1/trains/${train.departureDate}/${train.trainNumber} you can see a sample response with https://rata.digitraffic.fi/api/v1/trains/2017-01-01/1

interface TrainPageParams {
    trainId: string;
    [key: string]: string | string[] | undefined;
}

interface ParsedTrainId {
    departureDate: string;
    trainNumber: string;
    originStationUic: string;
    originStopIndex: string;
    selectedDestinationUic?: string;
}

export default function TrainPage() {
    const params = useParams<TrainPageParams>();
    const t = useTranslations('train');
    const locale = useLocale();
    const [train, setTrain] = useState<Train | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [parsedParams, setParsedParams] = useState<ParsedTrainId | null>(null);
    const [hasSm2Wagon, setHasSm2Wagon] = useState(false);
    const mqttClientRef = useRef<MqttClient | null>(null);

    // Use train position hook for realtime GPS tracking
    const trainPosition = useTrainPosition(
        parsedParams?.trainNumber ?? null,
        parsedParams?.departureDate ?? null,
        train?.commuterLineID ?? null
    );

    /**
     * Connect to Digitraffic MQTT broker for train data updates
     * Topic format: trains/<departure_date>/<train_number>/<train-category>/<train-type>/<operator>/<commuter-line>/<running-currently>/<timetable-type>
     */
    const connectMqtt = useCallback(() => {
        if (!parsedParams || mqttClientRef.current) return;

        try {
            const client = mqtt.connect(DIGITRAFFIC_MQTT_URL, {
                protocolVersion: 4,
                clean: true,
                connectTimeout: 10000,
                reconnectPeriod: 5000,
            });

            mqttClientRef.current = client;

            client.on('connect', () => {
                console.log('[Train MQTT] Connected to Digitraffic');

                // Subscribe to train data updates
                // Using wildcards for optional fields to catch all updates for this train
                // Topic: trains/<departure_date>/<train_number>/#
                const topic = `trains/${parsedParams.departureDate}/${parsedParams.trainNumber}/#`;

                client.subscribe(topic, { qos: 0 }, (err) => {
                    if (err) {
                        console.error('[Train MQTT] Subscribe error:', err);
                    } else {
                        console.log('[Train MQTT] Subscribed to:', topic);
                    }
                });
            });

            client.on('message', (topic, message) => {
                try {
                    const trainData: Train = JSON.parse(message.toString());

                    if (trainData && trainData.trainNumber) {
                        console.log('[Train MQTT] Received train update');
                        setTrain(trainData);
                    }
                } catch (err) {
                    console.error('[Train MQTT] Message parse error:', err);
                }
            });

            client.on('error', (err) => {
                console.error('[Train MQTT] Error:', err);
            });

            client.on('close', () => {
                console.log('[Train MQTT] Connection closed');
            });

        } catch (err) {
            console.error('[Train MQTT] Connection error:', err);
        }
    }, [parsedParams]);

    /**
     * Cleanup function to disconnect MQTT client
     */
    const cleanupMqtt = useCallback(() => {
        if (mqttClientRef.current) {
            mqttClientRef.current.end(true);
            mqttClientRef.current = null;
        }
    }, []);

    // Parse the trainId parameter
    useEffect(() => {
        if (!params?.trainId) return;

        const trainIdStr = Array.isArray(params.trainId) ? params.trainId[0] : params.trainId;
        const parts = trainIdStr.split('-');

        if (parts.length >= 4) {
            const parsed: ParsedTrainId = {
                departureDate: parts[0] + "-" + parts[1] + "-" + parts[2],
                trainNumber: parts[3],
                originStationUic: parts[4],
                originStopIndex: parts[5],
                selectedDestinationUic: parts.length > 6 ? parts[6] : undefined
            };
            setParsedParams(parsed);
        } else {
            setError('Invalid train ID format');
            setLoading(false);
        }
    }, [params?.trainId]);

    // Fetch train data once on initial load, then use WebSocket for updates
    useEffect(() => {
        if (!parsedParams) return;

        const fetchTrainData = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/trains/${parsedParams.departureDate}/${parsedParams.trainNumber}`
                );

                if (!response.ok) {
                    throw new Error(`Failed to fetch train data: ${response.status}`);
                }

                const trainData: Train[] = await response.json();

                if (trainData && trainData.length > 0) {
                    setTrain(trainData[0]);
                } else {
                    setError('Train not found');
                }
            } catch (err) {
                console.error('Error fetching train data:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch train data');
            } finally {
                setLoading(false);
            }
        };

        fetchTrainData();
    }, [parsedParams]);

    // Fetch composition data to check for Sm2 wagons
    useEffect(() => {
        if (!parsedParams) return;

        const fetchComposition = async () => {
            try {
                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/compositions/${parsedParams.departureDate}/${parsedParams.trainNumber}`
                );

                if (response.ok) {
                    const data = await response.json();
                    // Check if any journey section has a wagon with wagonType "Sm2"
                    const hasSm2 = data.journeySections?.some((section: { wagons?: { wagonType: string }[] }) =>
                        section.wagons?.some((wagon: { wagonType: string }) => wagon.wagonType === 'Sm2')
                    );
                    setHasSm2Wagon(hasSm2);
                }
            } catch (err) {
                console.error('Error fetching composition:', err);
            }
        };

        fetchComposition();
    }, [parsedParams]);

    // Connect to WebSocket for real-time train data updates after initial data is loaded
    useEffect(() => {
        if (!parsedParams || !train) return;

        connectMqtt();

        return cleanupMqtt;
    }, [parsedParams, train, connectMqtt, cleanupMqtt]);

    if (loading) {
        return (
            <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <NavBar />
                <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>

                </section>
                <Footer />
            </div>
        );
    }

    if (error) {
        return (
            <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <NavBar />
                <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                    <div className="container">
                        <div className="has-text-centered">
                            <span className="icon is-large has-text-danger">
                                <i className="fas fa-exclamation-triangle fa-2x"></i>
                            </span>
                            <p className="title is-5 mt-4 has-text-danger">{t('error')}</p>
                            <p className="subtitle is-6">{error}</p>
                        </div>
                    </div>
                </section>
                <Footer />
            </div>
        );
    }

    if (!train || !parsedParams) {
        return (
            <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <NavBar />
                <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                    <div className="container">
                        <div className="has-text-centered">
                            <span className="icon is-large has-text-warning">
                                <i className="fas fa-train fa-2x"></i>
                            </span>
                            <p className="title is-5 mt-4">{t('notFound')}</p>
                            <p className="subtitle is-6">{t('notFoundMessage')}</p>
                        </div>
                    </div>
                </section>
                <Footer />
            </div>
        );
    }
    const delayed = train?.timeTableRows?.filter(row => !row.actualTime && row.type == "ARRIVAL" && !row.cancelled && row.trainStopping)[0]?.differenceInMinutes || train?.timeTableRows[train.timeTableRows.length - 1]?.differenceInMinutes || 0;
    const journeyEnded = !!train?.timeTableRows[train.timeTableRows.length - 1].actualTime;
    const journeyStarted = train.runningCurrently || !!train.timeTableRows[0].actualTime;
    return (

        <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
            <NavBar />
            <section className="section is-fullheight has-text-left" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <div className="container">
                    {/* Train Header Information */}
                    {/* <Link className="button is-ghost mb-4 pl-0" href={"/station/" + parsedParams.originStationUic}>
                        <span className="icon is-small">
                            <i className="fas fa-chevron-left"></i>
                        </span>
                        <span>{t('timetables', { station: getTranslatedStationNameWithFallback(Number(parsedParams.originStationUic), locale, "Unknown Station") })}</span>
                    </Link> */}
                    <div className="columns mt-1">
                        <div className="column">
                            <div className="is-flex is-align-items-center">
                                {train.commuterLineID ?
                                    ["A", "E", "L", "U", "Y", "I", "P", "K"].includes(train.commuterLineID) ?
                                        <span className="tag is-primary is-large has-text-weight-bold" style={{ marginRight: '0.5rem', backgroundColor: "#8d3889", width: "40px" }}>
                                            {train.commuterLineID}
                                        </span>
                                        :
                                        <span className="tag is-primary is-large has-text-weight-bold" style={{ marginRight: '0.5rem', width: "40px" }}>
                                            {train.commuterLineID}
                                        </span>

                                    :
                                    <span className="tag is-primary is-large p-2" style={{ marginRight: '0.5rem' }}>
                                        {train.trainType} {train.trainNumber}
                                    </span>
                                }
                                <span className="title is-3">
                                    {getTranslatedStationNameWithFallback(train.timeTableRows[train.timeTableRows.length - 1].stationUICCode, locale, train.timeTableRows[train.timeTableRows.length - 1].stationName)}
                                    {hasSm2Wagon && (
                                        <>
                                            <span className="icon ml-3 is-size-6">
                                                <i className="fa-solid fa-stairs"></i>
                                            </span>
                                            <span className="icon ml-1 is-size-4">
                                                <i className="fa-solid fa-train"></i>
                                            </span>
                                        </>
                                    )}
                                </span>

                            </div>
                            <p className="subtitle is-6 mt-2">
                                {parsedParams.departureDate}
                            </p>
                        </div>
                        <div className="column is-4">
                            <hr className="is-hidden-tablet is-invisible" />
                            <nav className="level is-mobile">
                                <div className="level-item has-text-centered">
                                    <div>
                                        <p className="heading">{journeyEnded ? t('ended') : (!journeyStarted ? t('not_active') : t('running'))}</p>
                                        <p className="title is-size-5 has-text-weight-normal">{train.cancelled ? <span>{t('cancelled')}</span> : delayed > 0 ? <span>{t('delayed')} {delayed} min</span> : <span>{t('on_time')}</span>}</p>
                                    </div>
                                </div>
                                {(journeyStarted && !journeyEnded) && (
                                    <div className="level-item has-text-centered">
                                        <div>
                                            <p className="heading">{t('speed')}</p>
                                            <p className="title is-size-5 has-text-weight-normal">
                                                {trainPosition.speed !== null ? `${trainPosition.speed} km/h` : '-'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </nav>
                            <hr className="is-hidden-tablet is-invisible" />
                        </div>
                    </div>

                    {/* Train Station Stops */}
                    <div className="columns mt-6 is-reversed-on-mobile">
                        <div className="column">
                            <TrainStationStops
                                train={train}
                                originStationUic={parseInt(parsedParams.originStationUic)}
                                originStopIndex={parseInt(parsedParams.originStopIndex)}
                                selectedDestinationUic={parsedParams.selectedDestinationUic ? parseInt(parsedParams.selectedDestinationUic) : undefined}
                            />
                        </div>
                        <div className="column">
                            <HighlightedStationPanel
                                train={train}
                                highlightedStationUic={parseInt(parsedParams.originStationUic)}
                                stopIndex={parseInt(parsedParams.originStopIndex)}
                            />
                        </div>
                    </div>


                    {/* Debug Section - Realtime Position Data */}
                    <div className="box mt-6" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                        <h3 className="title is-5">
                            <span className="icon-text">
                                <span className="icon">
                                    <i className="fas fa-bug"></i>
                                </span>
                                <span>Debug - Realtime Position</span>
                            </span>
                        </h3>
                        <div className="content">
                            <table className="table is-narrow is-fullwidth" style={{ backgroundColor: 'transparent' }}>
                                <tbody>
                                    <tr>
                                        <td><strong>Data Source</strong></td>
                                        <td>
                                            {trainPosition.source ? (
                                                <span className={`tag ${trainPosition.source === 'HSL' ? 'is-success' : 'is-info'}`}>
                                                    {trainPosition.source}
                                                </span>
                                            ) : (
                                                <span className="tag is-warning">Connecting...</span>
                                            )}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>Latitude</strong></td>
                                        <td>{trainPosition.latitude !== null ? trainPosition.latitude.toFixed(6) : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Longitude</strong></td>
                                        <td>{trainPosition.longitude !== null ? trainPosition.longitude.toFixed(6) : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Speed</strong></td>
                                        <td>{trainPosition.speed !== null ? `${trainPosition.speed} km/h` : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Heading</strong></td>
                                        <td>{trainPosition.heading !== null ? `${trainPosition.heading}°` : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Last Update</strong></td>
                                        <td>
                                            {trainPosition.timestamp ? (
                                                new Date(trainPosition.timestamp).toLocaleTimeString()
                                            ) : '-'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>Train Number</strong></td>
                                        <td>{parsedParams.trainNumber}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Commuter Line</strong></td>
                                        <td>{train.commuterLineID || 'N/A (Long-distance)'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </section>

            <Footer />
        </div>
    );
}
