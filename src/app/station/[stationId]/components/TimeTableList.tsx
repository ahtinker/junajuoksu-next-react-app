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
    const [timetables, setTimetables] = useState<Train[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Helper function to create a unique key for each train
    const getTrainKey = useCallback((train: Train) => {
        return `${train.trainNumber}-${train.departureDate}`;
    }, []);

    // Helper function to compare if two trains are the same with same data
    const areTrainsEqual = useCallback((train1: Train, train2: Train) => {
        if (getTrainKey(train1) !== getTrainKey(train2)) return false;

        // Compare relevant fields that might change
        const getRelevantData = (train: Train) => {
            const arrivalRow = train.timeTableRows.find(
                row => row.stationShortCode === stationData.shortCode && row.type === 'ARRIVAL'
            );
            const departureRow = train.timeTableRows.find(
                row => row.stationShortCode === stationData.shortCode && row.type === 'DEPARTURE'
            );

            return {
                cancelled: train.cancelled,
                arrivalTime: arrivalRow?.liveEstimateTime || arrivalRow?.scheduledTime,
                departureTime: departureRow?.liveEstimateTime || departureRow?.scheduledTime,
                arrivalTrack: arrivalRow?.commercialTrack,
                departureTrack: departureRow?.commercialTrack,
            };
        };

        const data1 = getRelevantData(train1);
        const data2 = getRelevantData(train2);

        return JSON.stringify(data1) === JSON.stringify(data2);
    }, [stationData.shortCode, getTrainKey]);

    // Smart update function that only changes what's necessary
    const updateTimetables = useCallback((newTrains: Train[]) => {
        setTimetables(currentTrains => {
            // Create maps for quick lookup
            const currentTrainsMap = new Map(currentTrains.map(train => [getTrainKey(train), train]));
            const newTrainsMap = new Map(newTrains.map(train => [getTrainKey(train), train]));

            // Check if we need to update at all
            const currentKeys = new Set(currentTrainsMap.keys());
            const newKeys = new Set(newTrainsMap.keys());

            // If the keys are the same, check if any data has changed
            if (currentKeys.size === newKeys.size &&
                [...currentKeys].every(key => newKeys.has(key))) {

                // Check if any train data has actually changed
                const hasChanges = newTrains.some(newTrain => {
                    const currentTrain = currentTrainsMap.get(getTrainKey(newTrain));
                    return !currentTrain || !areTrainsEqual(currentTrain, newTrain);
                });

                if (!hasChanges) {
                    // No changes detected, return current trains to prevent re-render
                    return currentTrains;
                }
            }

            // Return new trains if there are actual changes
            return newTrains;
        });
    }, [getTrainKey, areTrainsEqual]);

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
                    `https://rata.digitraffic.fi/api/v1/live-trains/station/${stationData.shortCode}?arrived_trains=10&arriving_trains=50&departed_trains=10&departing_trains=50&include_nonstopping=false`
                );
                const data = await response.json();

                // Sort timetables by arrival/departure time
                const sortedData = data.sort((a: Train, b: Train) => {
                    const getStationTime = (train: Train) => {
                        const arrivalRow = train.timeTableRows.find(
                            row => row.stationShortCode === stationData.shortCode && row.type === 'ARRIVAL'
                        );
                        const departureRow = train.timeTableRows.find(
                            row => row.stationShortCode === stationData.shortCode && row.type === 'DEPARTURE'
                        );

                        // If both arrival and departure exist, use departure time
                        if (arrivalRow && departureRow) {
                            return new Date(departureRow.liveEstimateTime || departureRow.scheduledTime);
                        }
                        // If only departure exists, use departure time
                        if (departureRow) {
                            return new Date(departureRow.liveEstimateTime || departureRow.scheduledTime);
                        }
                        // If only arrival exists, use arrival time
                        if (arrivalRow) {
                            return new Date(arrivalRow.liveEstimateTime || arrivalRow.scheduledTime);
                        }
                        // Fallback (shouldn't happen due to filtering)
                        return new Date(0);
                    };

                    const timeA = getStationTime(a);
                    const timeB = getStationTime(b);

                    return timeA.getTime() - timeB.getTime();
                });

                // Filter out trains that have already departed or ended their journey
                const currentTime = new Date();
                const filteredData = sortedData.filter((train: Train) => {
                    const arrivalRow = train.timeTableRows.find(
                        row => row.stationShortCode === stationData.shortCode && row.type === 'ARRIVAL'
                    );
                    const departureRow = train.timeTableRows.find(
                        row => row.stationShortCode === stationData.shortCode && row.type === 'DEPARTURE'
                    );

                    // Check if this is a commercial stop - if neither arrival nor departure is stopping, hide the train
                    const isCommercialStop = (arrivalRow && arrivalRow.trainStopping) || (departureRow && departureRow.trainStopping);
                    if (!isCommercialStop) {
                        return false;
                    }

                    const isPassengerTrain = train.trainCategory === 'Commuter' || train.trainCategory === 'Long-distance';
                    if (!isPassengerTrain) {
                        return false;
                    }
                    // If train has departure, check if it hasn't departed yet
                    if (departureRow) {
                        const departureTime = new Date(departureRow.liveEstimateTime || departureRow.scheduledTime);
                        return departureTime.getTime() > currentTime.getTime();
                    }

                    // If train only has arrival (ends journey at station), check if it hasn't arrived yet
                    if (arrivalRow && !departureRow) {
                        const arrivalTime = new Date(arrivalRow.liveEstimateTime || arrivalRow.scheduledTime);
                        return arrivalTime.getTime() > currentTime.getTime();
                    }

                    return false;
                });
                updateTimetables(filteredData);
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
            {timetables.map(train => {
                const trainKey = getTrainKey(train);
                const arrivalRow = train.timeTableRows.find(
                    row => row.stationShortCode === stationData.shortCode && row.type === 'ARRIVAL'
                );
                const departureRow = train.timeTableRows.find(
                    row => row.stationShortCode === stationData.shortCode && row.type === 'DEPARTURE'
                );

                if (!arrivalRow && !departureRow) {
                    return null;
                }

                const destination = getDestinationName(train);
                const origin = getOriginName(train);

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
                        if (diff > 0) {
                            return `${diff} min`;
                        }
                    }
                    return null;
                }

                const getEtd = () => {
                    if (departureRow) {
                        const time = new Date(departureRow.liveEstimateTime || departureRow.scheduledTime).getTime();
                        const diff = Math.round((time - currentTime.getTime()) / 60000);
                        if (diff > 0) {
                            return `${diff} min`;
                        }
                    }
                    return null;
                }

                return (
                    <div className="panel-block pt-4 my-0" key={trainKey} style={{ display: 'block', marginBottom: '1rem' }}>
                        {/* Top part */}
                        <div className="level is-mobile">
                            <div className="level-left">
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {train.commuterLineID ?
                                        ["A", "E", "L", "U", "Y", "I", "P", "K"].includes(train.commuterLineID) ?
                                            <span className="tag is-primary is-large" style={{ marginRight: '1rem', backgroundColor: "#8d3889" }}>
                                                {train.commuterLineID}
                                            </span>
                                            :
                                            <span className="tag is-primary is-large" style={{ marginRight: '1rem' }}>
                                                {train.commuterLineID}
                                            </span>
                                        :
                                        <span className="tag is-primary is-large p-2" style={{ marginRight: '1rem' }}>
                                            {train.trainType} {train.trainNumber}
                                        </span>
                                    }
                                    <div className="has-text-left">
                                        <p className="title is-5">{destination}</p>
                                        <p className="subtitle is-6">
                                            {train.departureDate}/{train.trainNumber}
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

                        {/* Bottom part */}
                        <div className="ml-3 my-4">
                            <div className="columns is-mobile">
                                <div className="mr-4">
                                    <p className="heading">{t('timetables.track')}</p>
                                    <p className="title is-5">{(arrivalInfo?.track || departureInfo?.track) || '-'}</p>
                                </div>
                                {arrivalInfo && (
                                    <div className="mr-4">
                                        <p className="heading">{t('timetables.arrivesAt')}</p>
                                        <p className="title is-5" style={{ color: arrivalInfo.hasScheduleChange ? 'var(--bulma-danger)' : 'inherit' }}>
                                            {arrivalInfo.liveTime || arrivalInfo.scheduledTime}
                                        </p>
                                        {arrivalInfo.liveTime && arrivalInfo.liveTime !== arrivalInfo.scheduledTime && (
                                            <p className="subtitle is-7" style={{ textDecoration: 'line-through' }}>
                                                ({arrivalInfo.scheduledTime})
                                            </p>
                                        )}
                                    </div>
                                )}
                                {departureInfo && (
                                    <div className="mr-4">
                                        <p className="heading">{t('timetables.departsAt')}</p>
                                        <p className="title is-5" style={{ color: departureInfo.hasScheduleChange ? 'var(--bulma-danger)' : 'inherit' }}>
                                            {departureInfo.liveTime || departureInfo.scheduledTime}
                                        </p>
                                        {departureInfo.liveTime && departureInfo.liveTime !== departureInfo.scheduledTime && (
                                            <p className="subtitle is-7" style={{ textDecoration: 'line-through' }}>
                                                ({departureInfo.scheduledTime})
                                            </p>
                                        )}
                                    </div>
                                )}

                                {arrivalInfo && !departureInfo && (
                                    <div className="">
                                        <p className="heading">{t('timetables.timeToArrival')}</p>
                                        <p className="title is-5">{getEta()}</p>
                                    </div>
                                )}

                                {departureInfo && !arrivalInfo && (
                                    <div className="">
                                        <p className="heading">{t('timetables.timeToDeparture')}</p>
                                        <p className="title is-5">{getEtd()}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </article>
    );
}
