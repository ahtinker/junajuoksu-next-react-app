"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { TVDisplayParams } from '../page';
import { Train } from '../../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../../lib/stationUtils';

interface StationData {
    uicCode: number;
    shortCode: string;
    name: string;
}

interface TVTimetableDisplayProps {
    stationData: StationData;
    displayParams: TVDisplayParams;
    currentLanguage: 'fi' | 'sv' | 'en';
    onStationNameClick: () => void;
}

interface DisplayTrain {
    trainId: string;
    commuterLineId?: string;
    trainType: string;
    trainNumber: number;
    scheduledTime: Date;
    liveEstimateTime?: Date;
    track?: string;
    destination: string;
    destinationUicCode: number;
    isCancelled: boolean;
    isArrival: boolean;
    differenceInMinutes: number;
}

// Translations for the TV display
const translations = {
    fi: {
        departures: 'Lähtevät junat',
        arrivals: 'Saapuvat junat',
        allTrains: 'Kaikki junat',
        toAirport: 'Lentoasemalle',
        longDistance: 'Kaukojunat',
        commuter: 'Lähijunat',
        cancelled: 'PERUTTU',
        track: 'Raide',
        train: 'Juna',
        time: 'Aika',
        destination: 'Määränpää',
        min: 'min',
        now: 'Nyt'
    },
    sv: {
        departures: 'Avgående tåg',
        arrivals: 'Ankommande tåg',
        allTrains: 'Alla tåg',
        toAirport: 'Till flygplatsen',
        longDistance: 'Fjärrtåg',
        commuter: 'Närtåg',
        cancelled: 'INSTÄLLT',
        track: 'Spår',
        train: 'Tåg',
        time: 'Tid',
        destination: 'Destination',
        min: 'min',
        now: 'Nu'
    },
    en: {
        departures: 'Departing trains',
        arrivals: 'Arriving trains',
        allTrains: 'All trains',
        toAirport: 'To Airport',
        longDistance: 'Long-distance trains',
        commuter: 'Commuter trains',
        cancelled: 'CANCELLED',
        track: 'Track',
        train: 'Train',
        time: 'Time',
        destination: 'Destination',
        min: 'min',
        now: 'Now'
    }
};

// Airport station short code
const AIRPORT_SHORT_CODE = 'LEN';

export default function TVTimetableDisplay({
    stationData,
    displayParams,
    currentLanguage,
    onStationNameClick
}: TVTimetableDisplayProps) {
    const [trains, setTrains] = useState<DisplayTrain[]>([]);
    const [destinationName, setDestinationName] = useState<string>('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const displayUpdateRef = useRef<NodeJS.Timeout | null>(null);
    const [stationsMetadata, setStationsMetadata] = useState<Map<string, { uicCode: number; name: string }>>(new Map());

    const t = translations[currentLanguage];

    // Fetch stations metadata once for destination name lookup
    useEffect(() => {
        const fetchStations = async () => {
            try {
                const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations');
                const stations = await response.json();
                const stationMap = new Map<string, { uicCode: number; name: string }>();

                stations.forEach((station: { stationShortCode: string; stationUICCode: number; stationName: string }) => {
                    stationMap.set(station.stationShortCode, {
                        uicCode: station.stationUICCode,
                        name: station.stationName
                    });
                });

                setStationsMetadata(stationMap);
            } catch (err) {
                console.error('Failed to fetch stations metadata:', err);
            }
        };

        fetchStations();
    }, []);

    // Resolve destination name
    useEffect(() => {
        if (displayParams.destination && stationsMetadata.size > 0) {
            const destStation = stationsMetadata.get(displayParams.destination.toUpperCase());
            if (destStation) {
                setDestinationName(getTranslatedStationNameWithFallback(destStation.uicCode, currentLanguage, displayParams.destination));
            }
        } else {
            setDestinationName('');
        }
    }, [displayParams.destination, stationsMetadata, currentLanguage]);

    // Build the info text shown at top-left
    const infoText = useMemo(() => {
        const parts: string[] = [];

        // Display mode
        if (displayParams.displayMode === 'arrivals') {
            parts.push(t.arrivals);
        } else {
            parts.push(t.departures);
        }

        // Train type
        if (displayParams.trainType === 'commuter') {
            parts.push(`(${t.commuter})`);
        } else if (displayParams.trainType === 'long-distance') {
            parts.push(`(${t.longDistance})`);
        }

        // Destination filter
        if (destinationName) {
            parts.push(`→ ${destinationName}`);
        }

        return parts.join(' ');
    }, [displayParams, destinationName, t]);

    // Fetch train data
    const fetchTrainData = useCallback(async () => {
        try {
            // Determine which train categories to fetch based on trainType param
            let trainCategories = 'Commuter,Long-distance';
            if (displayParams.trainType === 'commuter') {
                trainCategories = 'Commuter';
            } else if (displayParams.trainType === 'long-distance') {
                trainCategories = 'Long-distance';
            }

            // Build API URL - fetch up to 12 hours of data
            const url = `https://rata.digitraffic.fi/api/v1/live-trains/station/${stationData.shortCode}?minutes_before_departure=720&minutes_after_departure=5&minutes_before_arrival=720&minutes_after_arrival=0&departing_trains=100&arriving_trains=100&include_nonstopping=false&train_categories=${trainCategories}`;

            const response = await fetch(url);
            const data: Train[] = await response.json();

            const now = new Date();
            const twelveHoursLater = new Date(now.getTime() + 12 * 60 * 60 * 1000);

            const processedTrains: DisplayTrain[] = [];

            data.forEach((train) => {
                // Find relevant rows for this station
                const stationRows = train.timeTableRows.filter(
                    (row) => row.stationShortCode === stationData.shortCode && row.trainStopping
                );

                stationRows.forEach((row) => {
                    const scheduledTime = new Date(row.scheduledTime);
                    const liveTime = row.liveEstimateTime ? new Date(row.liveEstimateTime) : undefined;
                    const relevantTime = liveTime || scheduledTime;

                    // Filter by time window (only future trains up to 12 hours)
                    if (relevantTime < now || relevantTime > twelveHoursLater) return;

                    // Filter by display mode
                    const isArrival = row.type === 'ARRIVAL';
                    if (displayParams.displayMode === 'departures' && isArrival) return;
                    if (displayParams.displayMode === 'arrivals' && !isArrival) return;

                    // Filter by track
                    if (displayParams.track && row.commercialTrack !== displayParams.track) return;

                    // Find destination (last station in route) or airport if passing through
                    let destination = '';
                    let destinationUicCode = 0;

                    // Get the row index for this specific row
                    const rowIndex = train.timeTableRows.findIndex(r => r === row);

                    // Check if train passes through destination station AFTER current station
                    if (displayParams.destination) {
                        const destinationShortCode = displayParams.destination.toUpperCase();
                        const passesDestination = train.timeTableRows.some(
                            (r, idx) => idx > rowIndex &&
                                r.stationShortCode === destinationShortCode &&
                                r.trainStopping
                        );

                        if (!passesDestination) return; // Filter out trains not going to destination

                        // Use the destination as the display destination
                        const destStation = stationsMetadata.get(destinationShortCode);
                        if (destStation) {
                            destination = getTranslatedStationNameWithFallback(destStation.uicCode, currentLanguage, destinationShortCode);
                            destinationUicCode = destStation.uicCode;
                        }
                    } else {
                        // Check if train goes to airport
                        const airportIndex = train.timeTableRows.findIndex(
                            (r, idx) => idx > rowIndex &&
                                r.stationShortCode === AIRPORT_SHORT_CODE &&
                                r.trainStopping
                        );

                        if (airportIndex !== -1) {
                            // Train passes through airport - show airport as destination
                            const airportStation = stationsMetadata.get(AIRPORT_SHORT_CODE);
                            if (airportStation) {
                                destination = getTranslatedStationNameWithFallback(airportStation.uicCode, currentLanguage, AIRPORT_SHORT_CODE);
                                destinationUicCode = airportStation.uicCode;
                            }
                        } else {
                            // Use the actual final destination
                            const lastRow = train.timeTableRows[train.timeTableRows.length - 1];
                            if (lastRow) {
                                destination = getTranslatedStationNameWithFallback(lastRow.stationUICCode, currentLanguage, lastRow.stationShortCode);
                                destinationUicCode = lastRow.stationUICCode;
                            }
                        }
                    }

                    // Calculate difference in minutes
                    const diffMs = liveTime ? (liveTime.getTime() - scheduledTime.getTime()) : 0;
                    const differenceInMinutes = Math.round(diffMs / 60000);

                    processedTrains.push({
                        trainId: `${train.trainNumber}-${train.departureDate}-${row.type}-${row.scheduledTime}`,
                        commuterLineId: train.commuterLineID,
                        trainType: train.trainType,
                        trainNumber: train.trainNumber,
                        scheduledTime,
                        liveEstimateTime: liveTime,
                        track: row.commercialTrack,
                        destination,
                        destinationUicCode,
                        isCancelled: train.cancelled || row.cancelled,
                        isArrival,
                        differenceInMinutes
                    });
                });
            });

            // Sort by scheduled time
            processedTrains.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

            setTrains(processedTrains);
        } catch (err) {
            console.error('Failed to fetch train data:', err);
        }
    }, [stationData.shortCode, displayParams, stationsMetadata, currentLanguage]);

    // Fetch data every 1 minute
    useEffect(() => {
        fetchTrainData();

        fetchIntervalRef.current = setInterval(fetchTrainData, 60000); // 1 minute

        return () => {
            if (fetchIntervalRef.current) {
                clearInterval(fetchIntervalRef.current);
            }
        };
    }, [fetchTrainData]);

    // Update display every 10 seconds
    useEffect(() => {
        const updateDisplay = () => {
            setCurrentTime(new Date());
        };

        updateDisplay();
        displayUpdateRef.current = setInterval(updateDisplay, 10000); // 10 seconds

        return () => {
            if (displayUpdateRef.current) {
                clearInterval(displayUpdateRef.current);
            }
        };
    }, []);

    // Format time as HH:mm
    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    };

    // Format time display - show minutes if within 10 minutes
    const formatTimeDisplay = (train: DisplayTrain): string => {
        const relevantTime = train.liveEstimateTime || train.scheduledTime;
        const diffMs = relevantTime.getTime() - currentTime.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);

        // Show "Now" if within 1 minute
        if (diffMinutes <= 0) {
            return t.now;
        }

        // Show minutes if within 10 minutes and no delay shown
        if (diffMinutes <= 10 && train.differenceInMinutes <= 1) {
            return `${diffMinutes} ${t.min}`;
        }

        // Otherwise show HH:mm
        return formatTime(train.scheduledTime);
    };

    // Check if live time should be shown (difference > 1 minute)
    const shouldShowLiveTime = (train: DisplayTrain): boolean => {
        return train.differenceInMinutes > 1 && !train.isCancelled;
    };

    // Get station display name
    const stationDisplayName = getTranslatedStationNameWithFallback(stationData.uicCode, currentLanguage, stationData.shortCode);

    // Build station name with track if filtered
    const stationNameWithTrack = displayParams.track 
        ? `${stationDisplayName} – ${t.track} ${displayParams.track}`
        : stationDisplayName;

    return (
        <div className="tv-timetable-container">
            {/* Header */}
            <header className="tv-header">
                <div className="tv-header-left">
                    <h1
                        className="tv-station-name"
                        onClick={onStationNameClick}
                        style={{ cursor: 'pointer' }}
                    >
                        {stationNameWithTrack}
                    </h1>
                    <p className="tv-info-text">{infoText}</p>
                </div>
                <div className="tv-header-right">
                    <div className="tv-logo-container">
                        <Image
                            src="/junajuoksu-logo.png"
                            alt="Junajuoksu"
                            width={48}
                            height={48}
                            className="tv-logo"
                        />
                        <span className="tv-domain">junajuoksu.fi</span>
                    </div>
                    <span className="tv-current-time">{formatTime(currentTime)}</span>
                </div>
            </header>

            {/* Timetable */}
            <div className="tv-timetable">
                {/* Table header */}
                <div className="tv-table-header">
                    <div className="tv-col-train">{t.train}</div>
                    <div className="tv-col-time">{t.time}</div>
                    <div className="tv-col-delay"></div>
                    <div className="tv-col-track">{t.track}</div>
                    <div className="tv-col-destination">{t.destination}</div>
                    <div className="tv-col-status"></div>
                </div>

                {/* Train rows */}
                <div className="tv-table-body">
                    {trains.length === 0 ? (
                        <div className="tv-no-trains">
                            <p>No trains scheduled</p>
                        </div>
                    ) : (
                        trains.map((train) => (
                            <div
                                key={train.trainId}
                                className={`tv-train-row ${train.isCancelled ? 'tv-cancelled' : ''}`}
                            >
                                {/* Train ID */}
                                <div className="tv-col-train">
                                    <span className={`tv-train-id ${train.commuterLineId ? 'tv-commuter-line' : ''}`}>
                                        {train.commuterLineId || `${train.trainType} ${train.trainNumber}`}
                                    </span>
                                </div>

                                {/* Scheduled Time */}
                                <div className="tv-col-time">
                                    <span className="tv-scheduled-time">
                                        {formatTimeDisplay(train)}
                                    </span>
                                </div>

                                {/* Live/Delay Time */}
                                <div className="tv-col-delay">
                                    {shouldShowLiveTime(train) && train.liveEstimateTime && (
                                        <span className="tv-live-time">
                                            {formatTime(train.liveEstimateTime)}
                                        </span>
                                    )}
                                </div>

                                {/* Track */}
                                <div className="tv-col-track">
                                    <span className="tv-track">{train.track || '-'}</span>
                                </div>

                                {/* Destination */}
                                <div className="tv-col-destination">
                                    <span className="tv-destination">{train.destination}</span>
                                </div>

                                {/* Status (Cancelled) */}
                                <div className="tv-col-status">
                                    {train.isCancelled && (
                                        <span className="tv-status-cancelled">{t.cancelled}</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
