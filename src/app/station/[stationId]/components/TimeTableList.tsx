'use client';

interface StationData {
    uicCode: number;
    shortCode: string;
    name: string;
    translatedName: string;
}

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import styles from './StationTimetables.module.css';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';

interface TimetableListProps {
    stationData: StationData,
    hideTop?: boolean
    classNames?: string
}

export default function TimetableList({ stationData, hideTop = false, classNames = '' }: TimetableListProps) {
    const t = useTranslations();
    const locale = useLocale();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [timetables, setTimetables] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Helper function to create a unique key for each train stop
    const getTrainKey = useCallback((train: Train, stopIndex: number = 0) => {
        return `${train.trainNumber}-${train.departureDate}-${stopIndex}`;
    }, []);

    // Helper function to get all stops at the current station for a train
    const getStationStops = useCallback((train: Train) => {
        const stops: Array<{
            arrivalRow?: TimeTableRow,
            departureRow?: TimeTableRow,
            stopIndex: number
        }> = [];

        // Group timetable rows by their order/index to identify separate stops
        const stationRows = train.timeTableRows
            .map((row, index) => ({ ...row, originalIndex: index }))
            .filter(row => row.stationShortCode === stationData.shortCode);

        // Find pairs of arrival/departure or standalone arrivals/departures
        let currentStop: { arrivalRow?: TimeTableRow, departureRow?: TimeTableRow } = {};
        let stopIndex = 0;

        for (const row of stationRows) {
            if (row.type === 'ARRIVAL') {
                // If we already have an arrival for current stop, start a new stop
                if (currentStop.arrivalRow) {
                    if (currentStop.arrivalRow || currentStop.departureRow) {
                        stops.push({ ...currentStop, stopIndex });
                        stopIndex++;
                    }
                    currentStop = { arrivalRow: row };
                } else {
                    currentStop.arrivalRow = row;
                }
            } else if (row.type === 'DEPARTURE') {
                currentStop.departureRow = row;
                // Complete the current stop
                stops.push({ ...currentStop, stopIndex });
                stopIndex++;
                currentStop = {};
            }
        }

        // Add any remaining stop
        if (currentStop.arrivalRow || currentStop.departureRow) {
            stops.push({ ...currentStop, stopIndex });
        }

        return stops;
    }, [stationData.shortCode]);

    // Helper function to compare if two train stops are the same with same data
    const areTrainStopsEqual = useCallback((stop1: any, stop2: any) => {
        if (!stop1 || !stop2) return false;

        const getData = (stop: any) => ({
            cancelled: stop.train.cancelled,
            arrivalTime: stop.arrivalRow?.liveEstimateTime || stop.arrivalRow?.scheduledTime,
            departureTime: stop.departureRow?.liveEstimateTime || stop.departureRow?.scheduledTime,
            arrivalTrack: stop.arrivalRow?.commercialTrack,
            departureTrack: stop.departureRow?.commercialTrack,
        });

        return JSON.stringify(getData(stop1)) === JSON.stringify(getData(stop2));
    }, []);

    // Smart update function that handles multiple stops per train
    const updateTimetables = useCallback((newStops: any[]) => {
        setTimetables(currentStops => {
            if (!Array.isArray(currentStops)) {
                return newStops;
            }

            // Create maps for comparison
            const currentStopsMap = new Map(currentStops.map(stop => [getTrainKey(stop.train, stop.stopIndex), stop]));
            const newStopsMap = new Map(newStops.map(stop => [getTrainKey(stop.train, stop.stopIndex), stop]));

            const currentKeys = new Set(currentStopsMap.keys());
            const newKeys = new Set(newStopsMap.keys());

            // Check if stops are the same and data hasn't changed
            if (currentKeys.size === newKeys.size && 
                [...currentKeys].every(key => newKeys.has(key))) {

                const hasChanges = newStops.some(newStop => {
                    const currentStop = currentStopsMap.get(getTrainKey(newStop.train, newStop.stopIndex));
                    return !currentStop || !areTrainStopsEqual(currentStop, newStop);
                });

                if (!hasChanges) {
                    return currentStops;
                }
            }

            return newStops;
        });
    }, [getTrainKey, areTrainStopsEqual]);

    // Helper function to format time
    const formatTime = (dateTimeString: string) => {
        const date = new Date(dateTimeString);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}.${minutes}.${seconds}`;
    };

    // Helper function to get destination station name
    const getDestinationName = (train: Train): string => {
        // Find the last station in the timetable
        const lastRow = train.timeTableRows[train.timeTableRows.length - 1];
        if (lastRow) {
            return getTranslatedStationNameWithFallback(
                lastRow.stationUICCode,
                locale,
                lastRow.stationShortCode
            );
        }
        return 'Unknown';
    };

    // Helper function to get origin station name
    const getOriginName = (train: Train): string => {
        // Find the first station in the timetable
        const firstRow = train.timeTableRows[0];
        if (firstRow) {
            return getTranslatedStationNameWithFallback(
                firstRow.stationUICCode,
                locale,
                firstRow.stationShortCode
            );
        }
        return 'Unknown';
    };

    useEffect(() => {
        const fetchTimetables = async (isInitialLoad = false) => {
            // Only show loading indicator for initial load
            if (isInitialLoad) {
                setIsLoading(true);
            }
            setError(null);
            try {
                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/live-trains/station/${stationData.shortCode}?arrived_trains=10&arriving_trains=100&departed_trains=10&departing_trains=100&include_nonstopping=false`
                );
                const data = await response.json();

                // Create a flat list of all valid train stops
                const allStops = data.flatMap((train: Train) => {
                    const stops = getStationStops(train);
                    return stops
                        .filter(stop => {
                            const { arrivalRow, departureRow } = stop;

                            // Check if this is a commercial stop
                            const isCommercialStop = (arrivalRow && arrivalRow.trainStopping) || (departureRow && departureRow.trainStopping);
                            if (!isCommercialStop) return false;

                            // Check if it's a passenger train
                            const isPassengerTrain = train.trainCategory === 'Commuter' || train.trainCategory === 'Long-distance';
                            if (!isPassengerTrain) return false;

                            // Check if stop is in the future
                            const currentTime = new Date();
                            if (departureRow) {
                                const departureTime = new Date(departureRow.liveEstimateTime || departureRow.scheduledTime);
                                return departureTime.getTime() > currentTime.getTime();
                            }
                            if (arrivalRow && !departureRow) {
                                const arrivalTime = new Date(arrivalRow.liveEstimateTime || arrivalRow.scheduledTime);
                                return arrivalTime.getTime() > currentTime.getTime();
                            }
                            return false;
                        })
                        .map(stop => ({ ...stop, train }));
                });

                // Sort stops by time
                const sortedStops = allStops.sort((a: any, b: any) => {
                    const getStopTime = (stop: any) => {
                        const { arrivalRow, departureRow } = stop;
                        if (arrivalRow && departureRow) {
                            return new Date(departureRow.liveEstimateTime || departureRow.scheduledTime);
                        }
                        if (departureRow) {
                            return new Date(departureRow.liveEstimateTime || departureRow.scheduledTime);
                        }
                        if (arrivalRow) {
                            return new Date(arrivalRow.liveEstimateTime || arrivalRow.scheduledTime);
                        }
                        return new Date(0);
                    };

                    const timeA = getStopTime(a);
                    const timeB = getStopTime(b);
                    return timeA.getTime() - timeB.getTime();
                });

                // Convert back to trains format, preserving the sorted order and multiple stops
                const trainsWithStops = sortedStops.reduce((acc: any[], stop: any) => {
                    const existingTrainIndex = acc.findIndex(item =>
                        item.train.trainNumber === stop.train.trainNumber &&
                        item.train.departureDate === stop.train.departureDate &&
                        item.stopIndex === stop.stopIndex
                    );

                    if (existingTrainIndex === -1) {
                        acc.push({
                            train: stop.train,
                            arrivalRow: stop.arrivalRow,
                            departureRow: stop.departureRow,
                            stopIndex: stop.stopIndex
                        });
                    }
                    return acc;
                }, []);

                updateTimetables(trainsWithStops);
            } catch {
                setError('Failed to fetch timetables');
            } finally {
                setIsLoading(false);
            }
        };

        // Initial fetch
        fetchTimetables(true);

        // Set up interval to fetch every 5 seconds
        const interval = setInterval(fetchTimetables, 5000);

        return () => clearInterval(interval);
    }, [stationData.shortCode, updateTimetables]);

    useEffect(() => {
        setIsLoading(true);
    }, [stationData.shortCode]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 100);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollButton(window.scrollY > 100);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <article className={"panel themebackground is-primary " + classNames}>
            <div className={`${styles['mobile-border']}`} style={hideTop ? { position: 'sticky', top: 0, zIndex: 1 } : { position: 'sticky', top: 0, zIndex: 1, border: 'solid var(--bulma-scheme-main)' }}>
                <div className={`panel-heading level is-mobile mb-0 py-2 ${styles['tablet-primary-background']} `}>
                    <div className="level-left has-text-left is-block py-2">
                        <div className={`title is-4 has-text-left m-0 has-text-light ${styles['tablet-primary-background']}`}>
                            {currentTime.toLocaleTimeString()}
                        </div>
                    </div>

                    {showScrollButton && (
                        <p className="level-right">
                            <button className={`button is-primary ${styles['tablet-primary-background']}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                                <span className="icon">
                                    <i className="fas fa-chevron-up"></i>
                                </span>
                                <span>{t("timetables.up")}</span>
                            </button>
                        </p>
                    )}
                </div>
            </div>
            {isLoading && (
                <div className="panel-block">
                    <span className="panel-icon">
                        <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    </span>
                    Loading timetables...
                </div>
            )}
            {error && (
                <div className="panel-block">
                    <span className="panel-icon">
                        <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    </span>
                    {error}
                </div>
            )}
            {Array.isArray(timetables) && timetables.map((trainStop: any) => {
                const { train, arrivalRow, departureRow, stopIndex } = trainStop;
                const trainKey = getTrainKey(train, stopIndex);

                if (!arrivalRow && !departureRow) {
                    return null;
                }

                const destination = getDestinationName(train);
                const origin = getOriginName(train);

                // Check if train will stop at Lentoasema (LEN) after the current station
                const willStopAtAirportAfterCurrentStation = (() => {
                    // Find the current station's position in the timetable
                    const currentStationRows = train.timeTableRows
                        .map((row: TimeTableRow, index: number) => ({ ...row, originalIndex: index }))
                        .filter((row: any) => row.stationShortCode === stationData.shortCode);

                    if (currentStationRows.length === 0) return false;

                    // Get the last occurrence of current station (in case train stops multiple times)
                    const lastCurrentStationIndex = currentStationRows[currentStationRows.length - 1].originalIndex;

                    // Check if LEN appears after the current station
                    return train.timeTableRows.some((row: TimeTableRow, index: number) =>
                        index > lastCurrentStationIndex &&
                        row.stationShortCode === 'LEN' &&
                        row.trainStopping
                    );
                })();

                const formatRow = (row: TimeTableRow) => {
                    const scheduledTime = formatTime(row.scheduledTime);
                    const liveTime = row.liveEstimateTime ? formatTime(row.liveEstimateTime) : null;
                    const hasScheduleChange = liveTime && liveTime !== scheduledTime;
                    return { scheduledTime, liveTime, hasScheduleChange, track: row.commercialTrack };
                };

                const arrivalInfo = arrivalRow ? formatRow(arrivalRow) : null;
                const departureInfo = departureRow ? formatRow(departureRow) : null;

                const getEta = () => {
                    if (arrivalRow) {
                        const time = new Date(arrivalRow.liveEstimateTime || arrivalRow.scheduledTime).getTime();
                        const diff = Math.round((time - currentTime.getTime()) / 60000);
                        if (diff >= 0) {
                            return `${diff} min`;
                        }
                    }
                    return null;
                }

                const getEtd = () => {
                    if (departureRow) {
                        const time = new Date(departureRow.liveEstimateTime || departureRow.scheduledTime).getTime();
                        const diff = Math.round((time - currentTime.getTime()) / 60000);
                        if (diff >= 0) {
                            return `${diff} min`;
                        }
                    }
                    return null;
                }

                return (
                    <div className="panel-block pt-4 my-0" key={trainKey} style={{ display: 'block', marginBottom: '1rem' }}>
                        <div className="columns is-0">
                            <div className="column is-5 pb-4">
                                {/* Top part */}
                                <div className="level is-mobile">
                                    <div className="level-left">
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {train.commuterLineID ?
                                                ["A", "E", "L", "U", "Y", "I", "P", "K"].includes(train.commuterLineID) ?
                                                    <span className="tag is-primary is-large has-text-weight-bold" style={{ marginRight: '1rem', backgroundColor: "#8d3889", width: "40px" }}>
                                                        {train.commuterLineID}
                                                    </span>
                                                    :
                                                    <span className="tag is-primary is-large has-text-weight-bold" style={{ marginRight: '1rem', width: "40px" }}>
                                                        {train.commuterLineID}
                                                    </span>
                                                :
                                                <span className="tag is-primary is-large p-2" style={{ marginRight: '1rem' }}>
                                                    {train.trainType} {train.trainNumber}
                                                </span>
                                            }
                                            <div className="has-text-left">
                                                <p className="title is-5">
                                                    {willStopAtAirportAfterCurrentStation && (
                                                        <span className="icon mr-2">
                                                            <i className="fas fa-plane-departure" aria-hidden="true"></i>
                                                        </span>
                                                    )}
                                                    {destination}
                                                </p>
                                                <p className="subtitle is-6">
                                                    {train.cancelled ? (
                                                        <span style={{ color: 'var(--bulma-danger)' }}>
                                                            {t('timetables.cancelled')}
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {arrivalRow && departureRow && `${t('timetables.stopsAt')} ${stationData.translatedName || stationData.name}`}
                                                            {arrivalRow && !departureRow && `${t('timetables.arrivesTo')} ${stationData.translatedName || stationData.name}`}
                                                            {!arrivalRow && departureRow && `${t('timetables.departsFrom')} ${stationData.translatedName || stationData.name}`}
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="level-right">
                                        {train.cancelled && (
                                            <span className="tag is-danger">{t('timetables.cancelled')}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="column">
                                {/* Bottom part */}
                                <div className="">
                                    <div className="columns is-mobile has-text-centered">
                                        <div className="mr-4">
                                            <span className="label m-0">{t('timetables.track')}</span>
                                            <span className="is-size-5 has-text-weight-bold">{(arrivalInfo?.track || departureInfo?.track) || '-'}</span>
                                        </div>
                                        {arrivalInfo && (
                                            <div className="mr-4">
                                                <span className="label m-0">{t('timetables.arrivesAt')}</span>
                                                <div className="is-size-5 has-text-weight-bold" style={{ color: arrivalInfo.hasScheduleChange ? 'var(--bulma-danger)' : 'inherit' }}>
                                                    {arrivalInfo.liveTime || arrivalInfo.scheduledTime}
                                                </div>
                                                {arrivalInfo.liveTime && arrivalInfo.liveTime !== arrivalInfo.scheduledTime && (
                                                    <div className="subtitle is-7" style={{ textDecoration: 'line-through' }}>
                                                        ({arrivalInfo.scheduledTime})
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {departureInfo && (
                                            <div className="mr-4">
                                                <span className="label m-0">{t('timetables.departsAt')}</span>
                                                <div className="is-size-5 has-text-weight-bold" style={{ color: departureInfo.hasScheduleChange ? 'var(--bulma-danger)' : 'inherit' }}>
                                                    {departureInfo.liveTime || departureInfo.scheduledTime}
                                                </div>
                                                {departureInfo.liveTime && departureInfo.liveTime !== departureInfo.scheduledTime && (
                                                    <div className="subtitle is-7" style={{ textDecoration: 'line-through' }}>
                                                        ({departureInfo.scheduledTime})
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {arrivalInfo && !departureInfo && (
                                            <div className="">
                                                <span className="label m-0">{t('timetables.timeToArrival')}</span>
                                                <div className="is-size-5 has-text-weight-bold">{getEta()}</div>
                                            </div>
                                        )}

                                        {departureInfo && !arrivalInfo && (
                                            <div className="">
                                                <span className="label m-0">{t('timetables.timeToDeparture')}</span>
                                                <div className="is-size-5 has-text-weight-bold">{getEtd()}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>



                    </div>
                );
            })}
        </article>
    );
}
