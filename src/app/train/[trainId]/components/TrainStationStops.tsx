'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import styles from './TrainStationStops.module.css';

interface TrainStationStopsProps {
    train: Train;
    originStationUic: number;
    originStopIndex: number;
    selectedDestinationUic?: number;
}

interface StationStop {
    uicCode: number;
    shortCode: string;
    arrivalRow?: TimeTableRow;
    departureRow?: TimeTableRow;
    stopIndex: number;
    isOrigin: boolean;
    isDestination: boolean;
    isPassed: boolean;
    isUpcoming: boolean;
}

export default function TrainStationStops({
    train,
    originStationUic,
    originStopIndex,
    selectedDestinationUic
}: TrainStationStopsProps) {
    const locale = useLocale();
    const t = useTranslations();

    // Process timetable rows to create station stops
    const processStationStops = (): StationStop[] => {
        const stationStops: { [key: string]: StationStop } = {};
        const stationSequence: { [uicCode: number]: number } = {}; // Track how many times we've seen each station

        // Find the origin stop to determine what's passed vs upcoming
        let originStopTime: Date | null = null;
        const originRows = train.timeTableRows.filter(row =>
            row.stationUICCode === originStationUic && row.trainStopping
        );

        if (originRows.length > originStopIndex) {
            const originRow = originRows[originStopIndex];
            const timeToUse = originRow.liveEstimateTime || originRow.actualTime || originRow.scheduledTime;
            originStopTime = new Date(timeToUse);
        }

        train.timeTableRows.forEach((row) => {
            if (!row.trainStopping) return;

            // Initialize or increment the sequence counter for this station
            if (!stationSequence[row.stationUICCode]) {
                stationSequence[row.stationUICCode] = 0;
            }

            // For arrival rows, we don't increment yet - we wait for the departure
            // For departure rows, we increment the sequence
            const currentStopIndex = stationSequence[row.stationUICCode];
            if (row.type === 'DEPARTURE') {
                stationSequence[row.stationUICCode]++;
            }

            // Create unique key that includes the stop sequence
            const key = `${row.stationUICCode}-${currentStopIndex}`;

            if (!stationStops[key]) {
                stationStops[key] = {
                    uicCode: row.stationUICCode,
                    shortCode: row.stationShortCode,
                    stopIndex: currentStopIndex,
                    isOrigin: false,
                    isDestination: false,
                    isPassed: false,
                    isUpcoming: false
                };
            }

            if (row.type === 'ARRIVAL') {
                stationStops[key].arrivalRow = row;
            } else if (row.type === 'DEPARTURE') {
                stationStops[key].departureRow = row;
            }

            // Determine if this is the origin station
            if (row.stationUICCode === originStationUic && currentStopIndex === originStopIndex) {
                stationStops[key].isOrigin = true;
            }

            // Check if this is the selected destination
            if (selectedDestinationUic && row.stationUICCode === selectedDestinationUic) {
                stationStops[key].isDestination = true;
            }

            // Determine if passed or upcoming based on origin stop time
            if (originStopTime) {
                const timeToUse = row.liveEstimateTime || row.actualTime || row.scheduledTime;
                const stopTime = new Date(timeToUse);

                if (row.actualTime) {
                    stationStops[key].isPassed = true;
                } else if (stopTime > originStopTime) {
                    stationStops[key].isUpcoming = true;
                }
            }
        });

        // Convert to array and sort by schedule
        return Object.values(stationStops).sort((a, b) => {
            const timeA = a.departureRow?.scheduledTime || a.arrivalRow?.scheduledTime || '';
            const timeB = b.departureRow?.scheduledTime || b.arrivalRow?.scheduledTime || '';
            return timeA.localeCompare(timeB);
        });
    };

    const formatTime = (timeString?: string): string => {
        if (!timeString) return '--:--:--';
        const date = new Date(timeString);
        return date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    const formatDelaySeconds = (delaySeconds: number): string => {
        if (delaySeconds === 0) return '';

        const isEarly = delaySeconds < 0;
        const absSeconds = Math.abs(delaySeconds);

        if (absSeconds < 60) {
            // Less than a minute - show seconds
            return `${isEarly ? '-' : '+'}${absSeconds}s`;
        } else if (absSeconds < 3600) {
            // Less than an hour - show minutes and seconds
            const minutes = Math.floor(absSeconds / 60);
            const seconds = absSeconds % 60;
            return seconds > 0
                ? `${isEarly ? '-' : '+'}${minutes}m ${seconds}s`
                : `${isEarly ? '-' : '+'}${minutes}m`;
        } else {
            // An hour or more - show hours, minutes, and seconds
            const hours = Math.floor(absSeconds / 3600);
            const minutes = Math.floor((absSeconds % 3600) / 60);
            const seconds = absSeconds % 60;

            let result = `${isEarly ? '-' : '+'}${hours}h`;
            if (minutes > 0) result += ` ${minutes}m`;
            if (seconds > 0) result += ` ${seconds}s`;
            return result;
        }
    };

    const formatTimeWithDelay = (row?: TimeTableRow): {
        time: string;
        scheduledTime: string;
        actualTime: string | null;
        liveTime: string | null;
        isDelayed: boolean;
        delay: number;
        delaySeconds: number;
        isCancelled: boolean;
    } => {
        if (!row) return {
            time: '--:--:--',
            scheduledTime: '--:--:--',
            actualTime: null,
            liveTime: null,
            isDelayed: false,
            delay: 0,
            delaySeconds: 0,
            isCancelled: false
        };

        const scheduledTime = formatTime(row.scheduledTime);
        const actualTime = row.actualTime ? formatTime(row.actualTime) : null;
        const liveTime = row.liveEstimateTime ? formatTime(row.liveEstimateTime) : null;

        const displayTime = actualTime || liveTime || scheduledTime;
        const isCancelled = row.cancelled;

        // Calculate delay based on actual time difference
        let delaySeconds = 0;
        let isDelayed = false;

        if (actualTime || liveTime) {
            const scheduledDate = new Date(row.scheduledTime);
            const actualDate = new Date(row.actualTime || row.liveEstimateTime!);

            // Calculate difference in seconds
            delaySeconds = Math.floor((actualDate.getTime() - scheduledDate.getTime()) / 1000);
            isDelayed = delaySeconds > 0;
        }

        // Convert seconds to minutes for backward compatibility
        const delay = Math.floor(delaySeconds / 60);

        return {
            time: displayTime,
            scheduledTime,
            actualTime,
            liveTime,
            isDelayed,
            delay,
            delaySeconds,
            isCancelled
        };
    };

    // Process station stops data
    const stationStops = processStationStops();

    // Create easily accessible data structures
    const stationStopsData = stationStops.map((stop) => {
        const arrivalInfo = formatTimeWithDelay(stop.arrivalRow);
        const departureInfo = formatTimeWithDelay(stop.departureRow);
        const stationName = getTranslatedStationNameWithFallback(
            stop.uicCode,
            locale,
            stop.shortCode
        );

        return {
            // Station basic info
            uicCode: stop.uicCode,
            shortCode: stop.shortCode,
            stationName,
            stopIndex: stop.stopIndex,

            // Station status flags
            isOrigin: stop.isOrigin,
            isDestination: stop.isDestination,
            isPassed: stop.isPassed,
            isUpcoming: stop.isUpcoming,

            // Arrival data
            arrival: {
                ...arrivalInfo,
                track: stop.arrivalRow?.commercialTrack,
                rawRow: stop.arrivalRow,
                delayFormatted: formatDelaySeconds(arrivalInfo.delaySeconds)
            },

            // Departure data
            departure: {
                ...departureInfo,
                track: stop.departureRow?.commercialTrack,
                rawRow: stop.departureRow,
                delayFormatted: formatDelaySeconds(departureInfo.delaySeconds)
            },

            // Helper flags
            hasArrival: !!stop.arrivalRow,
            hasDeparture: !!stop.departureRow,
            isTerminal: !!stop.arrivalRow && !stop.departureRow,
            isStarting: !stop.arrivalRow && !!stop.departureRow
        };
    });

    // Summary constants
    const totalStations = stationStops.length;
    const originStation = stationStopsData.find(stop => stop.isOrigin);
    const destinationStation = stationStopsData.find(stop => stop.isDestination);
    const passedStations = stationStopsData.filter(stop => stop.isPassed);
    const upcomingStations = stationStopsData.filter(stop => stop.isUpcoming);

    // Time-related constants
    const journeyStartTime = originStation?.departure.scheduledTime;
    const journeyEndTime = destinationStation?.arrival.scheduledTime || stationStopsData[stationStopsData.length - 1]?.arrival.scheduledTime;

    // Status constants
    const hasDelays = stationStopsData.some(stop => stop.arrival.isDelayed || stop.departure.isDelayed);
    const hasCancellations = stationStopsData.some(stop => stop.arrival.isCancelled || stop.departure.isCancelled);
    const maxDelaySeconds = Math.max(
        ...stationStopsData.map(stop => Math.max(
            Math.abs(stop.arrival.delaySeconds),
            Math.abs(stop.departure.delaySeconds)
        ))
    );
    const maxDelay = Math.floor(maxDelaySeconds / 60); // Legacy minutes for compatibility
    const maxDelayFormatted = formatDelaySeconds(maxDelaySeconds);

    return (
        <div>
            <div className="columns">
                <div className="column">
                    {stationStopsData.map((stop) => (
                        <div key={`${stop.uicCode}-${stop.stopIndex}`} className={`box is-shadowless ${styles["station-stop"]} ${stop.isOrigin ? 'is-origin' : ''} ${stop.isDestination ? 'is-destination' : ''}`}>
                            <div className="columns is-desktop">
                                <div className="column is-5-tablet is-5-desktop is-6-widescreen">
                                    <span className="station-name title is-5 mb-1 has-text-weight-bold" style={stop.isPassed ? { color: "var(--bulma-text-weak)" } : {}}>
                                        {stop.stationName}
                                    </span>
                                </div>
                                <div className="column">
                                    <div className="columns is-mobile is-8">
                                        <div className={"column is-narrow " + (!stop.hasArrival ? "is-hidden" : "")}>
                                            <div className="title is-5 mb-1 has-text-weight-semibold">
                                                {t('train.arrives')}
                                            </div>
                                            {stop.hasArrival && (
                                                <div>
                                                    <div className={`${stop.arrival.delaySeconds > 0 ? 'has-text-danger' : stop.arrival.delaySeconds < 0 ? 'has-text-success' : ''}`}>
                                                        {stop.arrival.time}
                                                    </div>
                                                    <div className={`is-size-7 ${stop.arrival.delaySeconds > 0 || stop.arrival.delaySeconds < 0 ? '' : 'is-hidden'}`}>
                                                        ({stop.arrival.scheduledTime}) {stop.arrival.delayFormatted}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className={"column " + (!stop.hasDeparture ? "is-hidden" : "")}>
                                            <div className="title is-5 mb-1 has-text-weight-semibold">
                                                {t('train.departs')}
                                            </div>
                                            {stop.hasDeparture && (
                                                <div>
                                                    <div className={`${stop.departure.delaySeconds > 0 ? 'has-text-danger' : stop.departure.delaySeconds < 0 ? 'has-text-success' : ''}`}>
                                                        {stop.departure.time}
                                                    </div>
                                                    <div className={`is-size-7 ${stop.departure.delaySeconds > 0 || stop.departure.delaySeconds < 0 ? '' : 'is-hidden'}`}>
                                                        ({stop.departure.scheduledTime}) {stop.departure.delayFormatted}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="column">
                    {/* TODO: Implement frontend using the following data structures */}
                    <div className="notification is-warning">
                        <div className='title is-5'>Debugger</div >
                        <p>Total stations: {totalStations}</p>
                        <p>Has delays: {hasDelays ? 'Yes' : 'No'}</p>
                        <p>Max delay: {maxDelayFormatted || 'None'}</p>

                        {/* Debug info - remove when implementing actual UI */}
                        <details>
                            <summary>Debug: Available data structures</summary>
                            <pre style={{ fontSize: '12px', maxHeight: '300px', overflow: 'auto' }}>
                                {JSON.stringify({
                                    stationStopsData: stationStopsData,
                                    summary: {
                                        totalStations,
                                        originStation: originStation ? `${originStation.stationName} (${originStation.shortCode})` : null,
                                        destinationStation: destinationStation ? `${destinationStation.stationName} (${destinationStation.shortCode})` : null,
                                        journeyStartTime,
                                        journeyEndTime,
                                        hasDelays,
                                        hasCancellations,
                                        maxDelay,
                                        passedStationsCount: passedStations.length,
                                        upcomingStationsCount: upcomingStations.length
                                    }
                                }, null, 2)}
                            </pre>
                        </details>
                    </div>
                </div>
            </div>

        </div>
    );
}
