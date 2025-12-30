'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';

interface HighlightedStationPanelProps {
    train: Train;
    highlightedStationUic: number;
    stopIndex: number;
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
    stopIndex
}: HighlightedStationPanelProps) {
    const locale = useLocale();
    const t = useTranslations('train');

    // Find the station stop data for the highlighted station
    const stationData = findStationStopData(train, highlightedStationUic, stopIndex);

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

    return (
        <div className="box is-shadowless" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
            {/* Station Name Header */}
            <div className="has-text-centered mb-4">
                <span className="icon-text is-justify-content-center">
                    <span className="title is-4">{stationName}</span>
                </span>
                <p className="is-size-7 has-text-grey mt-1">
                    {isPassed ? t('station_passed') : (isFirstStation ? t('departure_station') : (isLastStation ? t('arrival_station') : t('station_upcoming')))}
                </p>
            </div>

            {/* Cancelled indicator */}
            {(arrivalRow?.cancelled || departureRow?.cancelled) && (
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
                {arrivalRow && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('arrival')}</p>
                        <p className={`is-size-5 has-text-weight-bold`}>
                            {formatTime(getBestTime(arrivalRow))}
                        </p>
                        {arrivalRow.scheduledTime !== getBestTime(arrivalRow) && (
                            <span className="is-size-7 has-text-grey">
                                <s>{formatTime(arrivalRow.scheduledTime)}</s>
                            </span>
                        )}
                        {arrivalDelay !== null && arrivalDelay !== 0 && (
                            <span className={`ml-2 is-size-7 ${arrivalDelay > 0 ? 'has-text-danger' : 'has-text-success'}`}>
                                {arrivalDelay > 0 ? '+' : ''}{arrivalDelay} min
                            </span>
                        )}
                    </div>
                )}

                {/* Departure Time */}
                {departureRow && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('departure')}</p>
                        <p className={`is-size-5 has-text-weight-bold`}>
                            {formatTime(getBestTime(departureRow))}
                        </p>
                        {departureRow.scheduledTime !== getBestTime(departureRow) && (
                            <span className="is-size-7 has-text-grey">
                                <s>{formatTime(departureRow.scheduledTime)}</s>
                            </span>
                        )}
                        {departureDelay !== null && departureDelay !== 0 && (
                            <span className={`ml-2 is-size-7 ${departureDelay > 0 ? 'has-text-danger' : 'has-text-success'}`}>
                                {departureDelay > 0 ? '+' : ''}{departureDelay} min
                            </span>
                        )}
                    </div>
                )}

                {/* Track */}
                {track && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('track')}</p>
                        <p className="is-size-5 has-text-weight-bold">{track}</p>
                    </div>
                )}

                {/* Stop Duration - only show if 2 minutes or more */}
                {arrivalRow && departureRow && getStopDurationMinutes(arrivalRow.scheduledTime, departureRow.scheduledTime) >= 2 && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('stop_duration')}</p>
                        <p className="is-size-5 has-text-weight-bold">
                            {calculateStopDuration(arrivalRow.scheduledTime, departureRow.scheduledTime)}
                        </p>
                    </div>
                )}
            </div>
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
