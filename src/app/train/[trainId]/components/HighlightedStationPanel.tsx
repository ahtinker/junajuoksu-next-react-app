'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';

interface HighlightedStationPanelProps {
    train: Train;
    highlightedStationUic: number;
    stopIndex: number;
    selectedDestinationUic?: number;
}

interface StationStopData {
    arrivalRow?: TimeTableRow;
    departureRow?: TimeTableRow;
}

/**
 * Formats a time string to HH:MM:SS format
 */
function formatTime(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Calculates the delay in minutes between scheduled and actual/estimated time
 */
function getDelayMinutes(row: TimeTableRow | undefined): number | null {
    if (!row) return null;
    return row.differenceInMinutes ?? null;
}

/**
 * Gets the best available time (actual > liveEstimate > scheduled)
 */
function getBestTime(row: TimeTableRow | undefined): string | undefined {
    if (!row) return undefined;
    return row.actualTime || row.liveEstimateTime || row.scheduledTime;
}

/**
 * Determines if the train has passed this station
 */
function hasPassedStation(departureRow: TimeTableRow | undefined, arrivalRow: TimeTableRow | undefined): boolean {
    if (departureRow?.actualTime) return true;
    if (!departureRow && arrivalRow?.actualTime) return true;
    return false;
}

export default function HighlightedStationPanel({
    train,
    highlightedStationUic,
    stopIndex,
    selectedDestinationUic
}: HighlightedStationPanelProps) {
    const locale = useLocale();
    const t = useTranslations('train');
    
    // Tab state: 'departure' or 'destination'
    const [activeTab, setActiveTab] = useState<'departure' | 'destination'>('departure');

    // Count total stops at this station
    const getTotalStopsAtStation = (stationUic: number): number => {
        let count = 0;
        for (const row of train.timeTableRows) {
            if (row.stationUICCode === stationUic && row.trainStopping && row.type === 'DEPARTURE') {
                count++;
            }
        }
        // If no departures found, check for arrival-only (last station)
        if (count === 0) {
            for (const row of train.timeTableRows) {
                if (row.stationUICCode === stationUic && row.trainStopping && row.type === 'ARRIVAL') {
                    count++;
                }
            }
        }
        return count;
    };

    // Find the destination stop index (first stop at selectedDestinationUic after the origin)
    const findDestinationStopIndex = (): number => {
        if (!selectedDestinationUic) return 0;
        
        let foundOrigin = false;
        let stopCount = 0;
        
        for (let i = 0; i < train.timeTableRows.length; i++) {
            const row = train.timeTableRows[i];
            
            // Track when we pass the origin
            if (row.stationUICCode === highlightedStationUic && row.trainStopping) {
                if (row.type === 'DEPARTURE') {
                    if (stopCount === stopIndex) {
                        foundOrigin = true;
                    }
                    stopCount++;
                }
            }
            
            // After origin, find first stop at destination
            if (foundOrigin && row.stationUICCode === selectedDestinationUic && row.trainStopping) {
                // Count which stop this is at the destination station
                let destStopIndex = 0;
                for (let j = 0; j < i; j++) {
                    if (train.timeTableRows[j].stationUICCode === selectedDestinationUic && 
                        train.timeTableRows[j].trainStopping && 
                        train.timeTableRows[j].type === 'DEPARTURE') {
                        destStopIndex++;
                    }
                }
                return destStopIndex;
            }
        }
        return 0;
    };

    const totalStopsAtOrigin = getTotalStopsAtStation(highlightedStationUic);
    const totalStopsAtDestination = selectedDestinationUic ? getTotalStopsAtStation(selectedDestinationUic) : 0;
    const destinationStopIndex = findDestinationStopIndex();

    // Find the station stop data for the highlighted station (departure)
    const stationData = findStationStopData(train, highlightedStationUic, stopIndex);
    
    // Find the station stop data for the destination station
    const destinationData = selectedDestinationUic 
        ? findStationStopData(train, selectedDestinationUic, destinationStopIndex) 
        : null;

    if (!stationData.arrivalRow && !stationData.departureRow) {
        return (
            <div className="box has-text-centered" style={{ backgroundColor: 'var(--bulma-background)' }}>
                <span className="icon has-text-grey is-large">
                    <i className="fas fa-info-circle fa-2x"></i>
                </span>
                <p className="has-text-grey mt-2">{t('station_not_found')}</p>
            </div>
        );
    }

    // Departure station data
    const arrivalRow = stationData.arrivalRow;
    const departureRow = stationData.departureRow;
    const primaryRow = arrivalRow || departureRow;

    const stationName = getTranslatedStationNameWithFallback(
        highlightedStationUic,
        locale,
        primaryRow?.stationName || 'Unknown'
    );

    const isPassed = hasPassedStation(departureRow, arrivalRow);
    const isFirstStation = !arrivalRow && !!departureRow;
    const isLastStation = !!arrivalRow && !departureRow;

    const arrivalDelay = getDelayMinutes(arrivalRow);
    const departureDelay = getDelayMinutes(departureRow);

    const track = departureRow?.commercialTrack || arrivalRow?.commercialTrack;

    // Destination station data
    const destArrivalRow = destinationData?.arrivalRow;
    const destDepartureRow = destinationData?.departureRow;
    const destPrimaryRow = destArrivalRow || destDepartureRow;

    const destStationName = selectedDestinationUic ? getTranslatedStationNameWithFallback(
        selectedDestinationUic,
        locale,
        destPrimaryRow?.stationName || 'Unknown'
    ) : '';

    const destIsPassed = hasPassedStation(destDepartureRow, destArrivalRow);
    const destIsLastStation = !!destArrivalRow && !destDepartureRow;

    const destArrivalDelay = getDelayMinutes(destArrivalRow);
    const destDepartureDelay = getDelayMinutes(destDepartureRow);

    const destTrack = destDepartureRow?.commercialTrack || destArrivalRow?.commercialTrack;

    // Render station info panel content
    const renderStationContent = (
        isDestination: boolean,
        name: string,
        arrival: TimeTableRow | undefined,
        departure: TimeTableRow | undefined,
        passed: boolean,
        firstStation: boolean,
        lastStation: boolean,
        arrDelay: number | null,
        depDelay: number | null,
        stationTrack: string | undefined,
        totalStops: number,
        currentStopIndex: number
    ) => (
        <>
            {/* Station Name Header */}
            <div className="has-text-centered mb-4">
                <p className="is-size-7 has-text-grey mb-1">
                    {isDestination ? t('destination_stop') : t('departure_stop')}
                </p>
                <span className="icon-text is-justify-content-center">
                    <span className="title is-4">{name}</span>
                </span>
                {totalStops > 1 && (
                    <p className="is-size-7 has-text-grey mt-1">
                        {t('stop_number', { current: currentStopIndex + 1, total: totalStops })}
                    </p>
                )}
                <p className="is-size-7 has-text-grey mt-1">
                    {passed ? t('station_passed') : (firstStation ? t('departure_station') : (lastStation ? t('arrival_station') : t('station_upcoming')))}
                </p>
            </div>

            {/* Cancelled indicator */}
            {(arrival?.cancelled || departure?.cancelled) && (
                <div className="notification is-danger is-light has-text-centered mb-4">
                    <span className="icon-text is-justify-content-center">
                        <span className="icon">
                            <i className="fas fa-times-circle"></i>
                        </span>
                        <span className="has-text-weight-bold">{t('cancelled')}</span>
                    </span>
                </div>
            )}

            {/* Inline Layout */}
            <div className="is-flex is-flex-wrap-wrap is-justify-content-center is-align-items-center" style={{ gap: '2.5rem' }}>
                {/* Arrival Time */}
                {arrival && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('arrival')}</p>
                        <p className={`is-size-5 has-text-weight-bold`}>
                            {formatTime(getBestTime(arrival))}
                        </p>
                        {arrival.scheduledTime !== getBestTime(arrival) && (
                            <span className="is-size-7 has-text-grey">
                                <s>{formatTime(arrival.scheduledTime)}</s>
                            </span>
                        )}
                        {arrDelay !== null && arrDelay !== 0 && (
                            <span className={`ml-2 is-size-7 ${arrDelay > 0 ? 'has-text-danger' : 'has-text-success'}`}>
                                {arrDelay > 0 ? '+' : ''}{arrDelay} min
                            </span>
                        )}
                    </div>
                )}

                {/* Departure Time */}
                {departure && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('departure')}</p>
                        <p className={`is-size-5 has-text-weight-bold`}>
                            {formatTime(getBestTime(departure))}
                        </p>
                        {departure.scheduledTime !== getBestTime(departure) && (
                            <span className="is-size-7 has-text-grey">
                                <s>{formatTime(departure.scheduledTime)}</s>
                            </span>
                        )}
                        {depDelay !== null && depDelay !== 0 && (
                            <span className={`ml-2 is-size-7 ${depDelay > 0 ? 'has-text-danger' : 'has-text-success'}`}>
                                {depDelay > 0 ? '+' : ''}{depDelay} min
                            </span>
                        )}
                    </div>
                )}

                {/* Track */}
                {stationTrack && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('track')}</p>
                        <p className="is-size-5 has-text-weight-bold">{stationTrack}</p>
                    </div>
                )}

                {/* Stop Duration - only show if 2 minutes or more */}
                {arrival && departure && getStopDurationMinutes(arrival.scheduledTime, departure.scheduledTime) >= 2 && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('stop_duration')}</p>
                        <p className="is-size-5 has-text-weight-bold">
                            {calculateStopDuration(arrival.scheduledTime, departure.scheduledTime)}
                        </p>
                    </div>
                )}
                <button className="button is-fullwidth is-primary">
                    {t('verify_passenger')}
                </button>
            </div>
        </>
    );

    return (
        <div className="box is-shadowless" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
            {/* Tabs - only show if destination is selected */}
            {selectedDestinationUic && destinationData && (destArrivalRow || destDepartureRow) && (
                <div className="tabs is-centered is-boxed mb-4" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                    <ul>
                        <li className={activeTab === 'departure' ? 'is-active' : ''}>
                            <a onClick={() => setActiveTab('departure')}>
                                <span className="icon is-small">
                                    <i className="fas fa-sign-out-alt"></i>
                                </span>
                                <span>{stationName}</span>
                            </a>
                        </li>
                        <li className={activeTab === 'destination' ? 'is-active' : ''}>
                            <a onClick={() => setActiveTab('destination')}>
                                <span className="icon is-small">
                                    <i className="fas fa-flag-checkered"></i>
                                </span>
                                <span>{destStationName}</span>
                            </a>
                        </li>
                    </ul>
                </div>
            )}

            {/* Content based on active tab */}
            {activeTab === 'departure' ? (
                renderStationContent(
                    false,
                    stationName,
                    arrivalRow,
                    departureRow,
                    isPassed,
                    isFirstStation,
                    isLastStation,
                    arrivalDelay,
                    departureDelay,
                    track,
                    totalStopsAtOrigin,
                    stopIndex
                )
            ) : selectedDestinationUic && destinationData && (destArrivalRow || destDepartureRow) ? (
                renderStationContent(
                    true,
                    destStationName,
                    destArrivalRow,
                    destDepartureRow,
                    destIsPassed,
                    false,
                    destIsLastStation,
                    destArrivalDelay,
                    destDepartureDelay,
                    destTrack,
                    totalStopsAtDestination,
                    destinationStopIndex
                )
            ) : (
                renderStationContent(
                    false,
                    stationName,
                    arrivalRow,
                    departureRow,
                    isPassed,
                    isFirstStation,
                    isLastStation,
                    arrivalDelay,
                    departureDelay,
                    track,
                    totalStopsAtOrigin,
                    stopIndex
                )
            )}
        </div>
    );
}

/**
 * Finds the arrival and departure rows for a specific station stop
 */
function findStationStopData(train: Train, stationUic: number, stopIndex: number): StationStopData {
    const rows = train.timeTableRows;
    let currentStopIndex = 0;
    let arrivalRow: TimeTableRow | undefined;
    let departureRow: TimeTableRow | undefined;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (row.stationUICCode === stationUic && row.trainStopping) {
            if (row.type === 'ARRIVAL') {
                // Check if we're at the right stop index
                if (currentStopIndex === stopIndex) {
                    arrivalRow = row;
                    // Look for the corresponding departure
                    if (i + 1 < rows.length &&
                        rows[i + 1].stationUICCode === stationUic &&
                        rows[i + 1].type === 'DEPARTURE' &&
                        rows[i + 1].trainStopping) {
                        departureRow = rows[i + 1];
                    }
                    break;
                }
            } else if (row.type === 'DEPARTURE') {
                // First station case - only departure, no arrival
                if (i === 0 || (rows[i - 1]?.stationUICCode !== stationUic)) {
                    if (currentStopIndex === stopIndex) {
                        departureRow = row;
                        break;
                    }
                }
                // Increment stop index after processing a complete stop
                currentStopIndex++;
            }
        }
    }

    // Handle edge case: first station (only departure)
    if (!arrivalRow && !departureRow && stopIndex === 0) {
        const firstRow = rows.find(r => r.stationUICCode === stationUic && r.trainStopping);
        if (firstRow?.type === 'DEPARTURE') {
            departureRow = firstRow;
        } else if (firstRow?.type === 'ARRIVAL') {
            arrivalRow = firstRow;
            const nextIndex = rows.indexOf(firstRow) + 1;
            if (nextIndex < rows.length &&
                rows[nextIndex].stationUICCode === stationUic &&
                rows[nextIndex].type === 'DEPARTURE' &&
                rows[nextIndex].trainStopping) {
                departureRow = rows[nextIndex];
            }
        }
    }

    return { arrivalRow, departureRow };
}

/**
 * Gets the stop duration in minutes (for conditional rendering)
 */
function getStopDurationMinutes(arrivalTime: string, departureTime: string): number {
    const arrival = new Date(arrivalTime);
    const departure = new Date(departureTime);
    const diffMs = departure.getTime() - arrival.getTime();
    return Math.round(diffMs / 60000);
}

/**
 * Calculates the stop duration between arrival and departure
 */
function calculateStopDuration(arrivalTime: string, departureTime: string): string {
    const diffMinutes = getStopDurationMinutes(arrivalTime, departureTime);

    if (diffMinutes < 60) {
        return `${diffMinutes} min`;
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}min`;
}
