'use client';

interface StationData {
    uicCode: number;
    shortCode: string;
    name: string;
    translatedName: string;
}

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './StationTimetables.module.css';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getStationGrammarForms, getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';

interface TrainStop {
    arrivalRow?: TimeTableRow;
    departureRow?: TimeTableRow;
    stopIndex: number;
    train: Train;
}

interface StationStop {
    arrivalRow?: TimeTableRow;
    departureRow?: TimeTableRow;
    stopIndex: number;
}

interface FormattedTimeInfo {
    scheduledTime: string;
    liveTime: string | null;
    hasScheduleChange: boolean;
    track?: string;
}

interface TimetableListProps {
    stationData: StationData,
    hideTop?: boolean
    classNames?: string
    selectedDateTime?: Date
    isRealtime?: boolean
    selectedDestination?: {
        uicCode: number;
        shortCode: string;
        name: string;
        translatedName: string;
    } | null
}

type TabType = 'all' | 'arrivals' | 'departures';

export default function TimetableList({ stationData, hideTop = false, classNames = '', selectedDateTime, isRealtime = true, selectedDestination }: TimetableListProps) {
    const t = useTranslations();
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [timetables, setTimetables] = useState<TrainStop[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize activeTab from URL parameter, but allow local state to override
    const getInitialTab = useCallback((): TabType => {
        const showParam = searchParams.get('show');
        if (showParam === 'arrivals' || showParam === 'departures') {
            return showParam;
        }
        return 'all';
    }, [searchParams]);

    // Use local state for instant updates, sync with URL afterwards
    const [activeTab, setActiveTab] = useState<TabType>(() => getInitialTab());

    // Function to handle tab change - instant UI update, async URL update
    const handleTabChange = useCallback((newTab: TabType) => {
        // Update state immediately for instant UI response
        setActiveTab(newTab);

        // Update URL asynchronously to avoid blocking the UI
        setTimeout(() => {
            const currentParams = new URLSearchParams(searchParams.toString());

            if (newTab === 'all') {
                currentParams.delete('show');
            } else {
                currentParams.set('show', newTab);
            }

            const newUrl = currentParams.toString()
                ? `${window.location.pathname}?${currentParams.toString()}`
                : window.location.pathname;

            // Use replace instead of push to avoid history pollution
            router.replace(newUrl, { scroll: false });
        }, 0);
    }, [router, searchParams]);

    // Helper function to create a unique key for each train stop
    const getTrainKey = useCallback((train: Train, stopIndex: number = 0) => {
        return `${train.trainNumber}-${train.departureDate}-${stopIndex}`;
    }, []);

    // Helper function to check if train stops at destination after current station
    const doesTrainStopAtDestinationAfterCurrentStation = useCallback((train: Train, currentStopIndex: number) => {
        if (!selectedDestination) return true; // If no destination selected, show all trains

        // Find the current station stop that corresponds to this trainStop
        const currentStationRows = train.timeTableRows
            .map((row: TimeTableRow, index: number) => ({ ...row, originalIndex: index }))
            .filter((row: TimeTableRow & { originalIndex: number }) => row.stationShortCode === stationData.shortCode);

        if (currentStationRows.length === 0) return false;

        // Find the specific stop index for this trainStop (similar to airport logic)
        let targetStationIndex = -1;

        if (currentStopIndex < currentStationRows.length) {
            targetStationIndex = currentStationRows[currentStopIndex].originalIndex;
        }

        if (targetStationIndex === -1) return false;

        // Check if destination station appears after this specific stop at the current station
        return train.timeTableRows.some((row: TimeTableRow, index: number) =>
            index > targetStationIndex &&
            row.stationUICCode === selectedDestination.uicCode &&
            row.trainStopping
        );
    }, [selectedDestination, stationData.shortCode]);

    // Helper function to get all stops at the current station for a train
    const getStationStops = useCallback((train: Train) => {
        const stops: StationStop[] = [];

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
    const areTrainStopsEqual = useCallback((stop1: TrainStop, stop2: TrainStop) => {
        if (!stop1 || !stop2) return false;

        const getData = (stop: TrainStop) => ({
            cancelled: stop.train.cancelled,
            arrivalTime: stop.arrivalRow?.liveEstimateTime || stop.arrivalRow?.scheduledTime,
            departureTime: stop.departureRow?.liveEstimateTime || stop.departureRow?.scheduledTime,
            arrivalTrack: stop.arrivalRow?.commercialTrack,
            departureTrack: stop.departureRow?.commercialTrack,
        });

        return JSON.stringify(getData(stop1)) === JSON.stringify(getData(stop2));
    }, []);

    // Smart update function that handles multiple stops per train
    const updateTimetables = useCallback((newStops: TrainStop[]) => {
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

    // Helper function to filter timetables based on active tab
    const getFilteredTimetables = useCallback(() => {
        let filtered;
        if (activeTab === 'arrivals') {
            filtered = timetables.filter(trainStop => trainStop.arrivalRow);
        } else if (activeTab === 'departures') {
            filtered = timetables.filter(trainStop => trainStop.departureRow);
        } else {
            filtered = timetables; // 'all' tab shows everything
        }

        // Limit to 50 trains maximum
        return filtered.slice(0, 50);
    }, [timetables, activeTab]);

    const filteredTimetables = getFilteredTimetables();

    // Sync activeTab with URL changes (for browser back/forward navigation)
    useEffect(() => {
        const urlTab = getInitialTab();
        setActiveTab(urlTab);
    }, [getInitialTab]);

    useEffect(() => {
        const fetchTimetables = async (isInitialLoad = false) => {
            // Only show loading indicator for initial load
            if (isInitialLoad) {
                setIsLoading(true);
            }
            setError(null);
            try {
                let data;

                // Check if we're fetching for a specific date/time or current time
                if (isRealtime) {
                // Use existing real-time API for current time
                    const response = await fetch(
                        `https://rata.digitraffic.fi/api/v1/live-trains/station/${stationData.shortCode}?arrived_trains=10&arriving_trains=300&departed_trains=10&departing_trains=300&include_nonstopping=false&train_categories=Commuter,Long-distance`
                    );
                    data = await response.json();
                } else {
                    // Use GraphQL API for specific dates
                    const targetDate = selectedDateTime || new Date();
                    const currentDate = targetDate.toISOString().split('T')[0];

                    // Calculate previous and next dates
                    const previousDate = new Date(targetDate);
                    previousDate.setDate(previousDate.getDate() - 1);
                    const prevDateStr = previousDate.toISOString().split('T')[0];

                    const nextDate = new Date(targetDate);
                    nextDate.setDate(nextDate.getDate() + 1);
                    const nextDateStr = nextDate.toISOString().split('T')[0];

                    const graphqlQuery = {
                        query: `{
currentDate: trainsByDepartureDate(departureDate: "${currentDate}", where: {timeTableRows: {contains: {station: {shortCode: {equals: "${stationData.shortCode}"}}}}}) {
    trainNumber
    departureDate
    commuterLineid
    cancelled
    deleted
    trainType {
        name
        trainCategory {
            name
        }
    }
    timeTableRows(where: {trainStopping: {equals: true}}) {
        actualTime
        scheduledTime
        liveEstimateTime
        commercialStop
        trainStopping
        type
        cancelled
        commercialTrack
        differenceInMinutes
        station {
            name
            shortCode
            uicCode
        }
    }
}
previousDate: trainsByDepartureDate(departureDate: "${prevDateStr}", where: {timeTableRows: {contains: {station: {shortCode: {equals: "${stationData.shortCode}"}}}}}) {
    trainNumber
    departureDate
    commuterLineid
    cancelled
    deleted
    trainType {
        name
        trainCategory {
            name
        }
    }
    timeTableRows(where: {trainStopping: {equals: true}}) {
        actualTime
        scheduledTime
        liveEstimateTime
        commercialStop
        trainStopping
        type
        cancelled
        commercialTrack
        differenceInMinutes
        station {
            name
            shortCode
            uicCode
        }
    }
}
nextDate: trainsByDepartureDate(departureDate: "${nextDateStr}", where: {timeTableRows: {contains: {station: {shortCode: {equals: "${stationData.shortCode}"}}}}}) {
    trainNumber
    departureDate
    commuterLineid
    cancelled
    deleted
    trainType {
        name
        trainCategory {
            name
        }
    }
    timeTableRows(where: {trainStopping: {equals: true}}) {
        actualTime
        scheduledTime
        liveEstimateTime
        commercialStop
        trainStopping
        type
        cancelled
        commercialTrack
        differenceInMinutes
        station {
            name
            shortCode
            uicCode
        }
    }
}
}`
                    };

                    const response = await fetch("https://rata.digitraffic.fi/api/v2/graphql/graphql", {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept-Encoding': 'gzip'
                        },
                        body: JSON.stringify(graphqlQuery)
                    });

                    const graphqlResponse = await response.json();

                    // Combine all three dates into a single array
                    const allTrains = [
                        ...(graphqlResponse.data.previousDate || []),
                        ...(graphqlResponse.data.currentDate || []),
                        ...(graphqlResponse.data.nextDate || [])
                    ];

                    // Transform GraphQL response to match the existing API format
                    data = allTrains.map((train: {
                        trainNumber: number;
                        departureDate: string;
                        commuterLineid?: string;
                        cancelled: boolean;
                        deleted: boolean;
                        trainType?: {
                            name: string;
                            trainCategory?: {
                                name: string;
                            };
                        };
                        trainCategory?: string;
                        timeTableRows: Array<{
                            actualTime?: string;
                            scheduledTime: string;
                            liveEstimateTime?: string;
                            commercialStop: boolean;
                            trainStopping: boolean;
                            type: string;
                            cancelled: boolean;
                            commercialTrack?: string;
                            differenceInMinutes?: number;
                            station?: {
                                shortCode: string;
                                uicCode: number;
                            };
                        }>;
                    }) => ({
                        trainNumber: train.trainNumber,
                        departureDate: train.departureDate,
                        commuterLineID: train.commuterLineid,
                        cancelled: train.cancelled,
                        deleted: train.deleted,
                        trainCategory: train.trainType?.trainCategory?.name || train.trainCategory,
                        trainType: train.trainType?.name || train.trainType,
                        timeTableRows: train.timeTableRows.map((row: {
                            actualTime?: string;
                            scheduledTime: string;
                            liveEstimateTime?: string;
                            commercialStop: boolean;
                            trainStopping: boolean;
                            type: string;
                            cancelled: boolean;
                            commercialTrack?: string;
                            differenceInMinutes?: number;
                            station?: {
                                shortCode: string;
                                uicCode: number;
                            };
                        }) => ({
                            actualTime: row.actualTime,
                            scheduledTime: row.scheduledTime,
                            liveEstimateTime: row.liveEstimateTime,
                            commercialStop: row.commercialStop,
                            trainStopping: row.trainStopping,
                            type: row.type,
                            cancelled: row.cancelled,
                            commercialTrack: row.commercialTrack,
                            differenceInMinutes: row.differenceInMinutes,
                            stationShortCode: row.station?.shortCode || '',
                            stationUICCode: row.station?.uicCode || 0
                        }))
                    }));
                }

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

                            if (train.commuterLineID == "V") {
                                return false; // Skip V trains (Staff transport trains)
                            }

                            if (train.deleted) {
                                return false; // Skip deleted trains
                            }

                            // Check if stop is in the future relative to selected time
                            const referenceTime = selectedDateTime || new Date();
                            if (departureRow) {
                                const departureTime = new Date(departureRow.actualTime || departureRow.liveEstimateTime || departureRow.scheduledTime);
                                if (departureTime.getTime() <= referenceTime.getTime()) return false;
                            } else if (arrivalRow && !departureRow) {
                                const arrivalTime = new Date(arrivalRow.actualTime || arrivalRow.liveEstimateTime || arrivalRow.scheduledTime);
                                if (arrivalTime.getTime() <= referenceTime.getTime()) return false;
                            } else {
                                return false;
                            }

                            // Check if train stops at selected destination after current station
                            if (!doesTrainStopAtDestinationAfterCurrentStation(train, stop.stopIndex)) {
                                return false;
                            }

                            return true;
                        })
                        .map(stop => ({ ...stop, train }));
                });

                // Sort stops by time
                const sortedStops = allStops.sort((a: TrainStop, b: TrainStop) => {
                    const getStopTime = (stop: TrainStop) => {
                        const { arrivalRow, departureRow } = stop;
                        if (arrivalRow && departureRow) {
                            return new Date(departureRow.actualTime || departureRow.liveEstimateTime || departureRow.scheduledTime);
                        }
                        if (departureRow) {
                            return new Date(departureRow.actualTime || departureRow.liveEstimateTime || departureRow.scheduledTime);
                        }
                        if (arrivalRow) {
                            return new Date(arrivalRow.actualTime || arrivalRow.liveEstimateTime || arrivalRow.scheduledTime);
                        }
                        return new Date(0);
                    };

                    const timeA = getStopTime(a);
                    const timeB = getStopTime(b);
                    return timeA.getTime() - timeB.getTime();
                });

                // Convert back to trains format, preserving the sorted order and multiple stops
                const trainsWithStops = sortedStops.reduce((acc: TrainStop[], stop: TrainStop) => {
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

        // Set up interval to fetch every 5 seconds only for realtime data
        let interval: NodeJS.Timeout | null = null;

        if (isRealtime) {
            interval = setInterval(fetchTimetables, 10000);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [stationData.shortCode, updateTimetables, getStationStops, selectedDateTime, isRealtime, selectedDestination, doesTrainStopAtDestinationAfterCurrentStation]); // Add selectedDestination and the callback

    // Separate effect for handling loading state when station changes
    useEffect(() => {
        setIsLoading(true);
    }, [stationData.shortCode, selectedDateTime]); // Add selectedDateTime here too

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

    if (filteredTimetables.length === 0 && !isLoading && !error) {
        setError(t('timetables.notfound'));
    }

    return (
        <article className={"panel is-primary is-shadowless " + classNames} style={{ marginTop: "-2px" }}>
            <div className={`${styles['mobile-border']}`} style={hideTop ? { position: 'sticky', top: 0, zIndex: 1 } : { position: 'sticky', top: 0, zIndex: 1, border: 'solid var(--bulma-scheme-main' }}>
                <div className={`panel-heading level is-mobile mb-0 py-2 ${styles['tablet-primary-background']} `}>
                    <div className="level-left has-text-left is-block py-2">
                        <div className={`title is-4 has-text-left m-0  ${isRealtime ? styles['tablet-primary-background'] : "has-text-primary-70"}`}>
                            {isRealtime ? currentTime.toLocaleTimeString() : selectedDateTime?.toLocaleTimeString("fi-FI", {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
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
            <p className="panel-tabs is-left themebackground mb-0">
                <a
                    className={activeTab === 'all' ? 'is-active' : ''}
                    onClick={() => handleTabChange('all')}
                    style={{ cursor: 'pointer' }}
                >
                    {t('timetables.all')}
                </a>
                <a
                    className={activeTab === 'arrivals' ? 'is-active' : ''}
                    onClick={() => handleTabChange('arrivals')}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="icon">
                        <i className="fas fa-arrow-right-to-bracket"></i>
                    </span>
                    {t('timetables.arrivals')}
                </a>
                <a
                    className={activeTab === 'departures' ? 'is-active' : ''}
                    onClick={() => handleTabChange('departures')}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="icon">
                        <i className="fas fa-arrow-right-from-bracket"></i>
                    </span>
                    {t('timetables.departures')}
                </a>
            </p>
            {isLoading && (
                <div className="panel-block themebackground ">
                    <span className="panel-icon">
                        <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    </span>
                    {t('timetables.loading')}
                </div>
            )}
            {error && (
                <div className="panel-block themebackground ">
                    <span className="panel-icon">
                        <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    </span>
                    {error}
                </div>
            )}
            {!isLoading && Array.isArray(filteredTimetables) && filteredTimetables.map((trainStop: TrainStop, index: number) => {
                const { train, arrivalRow, departureRow, stopIndex } = trainStop;
                const trainKey = getTrainKey(train, stopIndex);

                if (!arrivalRow && !departureRow) {
                    return null;
                }

                // Get the date for this train stop
                const getStopDate = (stop: TrainStop) => {
                    const { arrivalRow, departureRow } = stop;
                    if (departureRow) {
                        return new Date(departureRow.actualTime || departureRow.liveEstimateTime || departureRow.scheduledTime);
                    }
                    if (arrivalRow) {
                        return new Date(arrivalRow.actualTime || arrivalRow.liveEstimateTime || arrivalRow.scheduledTime);
                    }
                    return new Date();
                };

                const currentStopDate = getStopDate(trainStop);
                const currentStopDateString = currentStopDate.toDateString();

                // Check if this is the first train of a new date
                const isFirstTrainOfDate = index === 0 ||
                    (index > 0 && getStopDate(filteredTimetables[index - 1]).toDateString() !== currentStopDateString);

                // Check if the date is different from today
                const today = new Date();
                const isToday = currentStopDate.toDateString() === today.toDateString();

                // Check if the date is tomorrow
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const isTomorrow = currentStopDate.toDateString() === tomorrow.toDateString();

                // Show date header for first train of each new date
                // Include today's header if it's not the very first train or if there are multiple days
                // But don't show today's header if we're in realtime mode
                const shouldShowDateHeader = isFirstTrainOfDate && (
                    !isToday || // Always show for non-today dates
                    (!isRealtime && ( // Only show today's header if not in realtime mode
                        index > 0 || // Show today's header if there are previous trains from other days
                        filteredTimetables.some((_, i) => i > index && getStopDate(filteredTimetables[i]).toDateString() !== currentStopDateString) // Show today's header if there are future trains from other days
                    ))
                );

                const dateHeader = shouldShowDateHeader ? (
                    <div key={`date-header-${currentStopDateString}`} className="themebackground has-text-centered" style={{
                        backgroundColor: 'var(--bulma-scheme-main-ter)',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        padding: '0.75rem'
                    }}>
                        <span className="has-text-primary">
                            {isToday ?
                                t('timetables.dateTimeDrawer.today') :
                                isTomorrow ?
                                    t('timetables.tomorrow') :
                                    currentStopDate.toLocaleDateString(locale, {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })
                            }
                        </span>
                    </div>
                ) : null;

                const destination = getDestinationName(train);

                // Check if train will stop at Lentoasema (LEN) after the current station
                const willStopAtAirportAfterCurrentStation = (() => {
                    // Find the current station stop that corresponds to this trainStop
                    const currentStationRows = train.timeTableRows
                        .map((row: TimeTableRow, index: number) => ({ ...row, originalIndex: index }))
                        .filter((row: TimeTableRow & { originalIndex: number }) => row.stationShortCode === stationData.shortCode);

                    if (currentStationRows.length === 0) return false;

                    // Find the specific stop index for this trainStop
                    let targetStationIndex = -1;

                    // Match the current trainStop with the correct station occurrence
                    if (arrivalRow || departureRow) {
                        const targetRow = arrivalRow || departureRow;
                        if (targetRow) {
                            targetStationIndex = currentStationRows.findIndex(row =>
                                row.scheduledTime === targetRow.scheduledTime &&
                                row.type === targetRow.type
                            );

                            if (targetStationIndex !== -1) {
                                targetStationIndex = currentStationRows[targetStationIndex].originalIndex;
                            }
                        }
                    }

                    if (targetStationIndex === -1) return false;

                    // Check if LEN appears after this specific stop at the current station
                    return train.timeTableRows.some((row: TimeTableRow, index: number) =>
                        index > targetStationIndex &&
                        row.stationShortCode === 'LEN' &&
                        row.trainStopping
                    );
                })();

                const formatRow = (row: TimeTableRow): FormattedTimeInfo => {
                    const scheduledTime = formatTime(row.scheduledTime);
                    // Priority: actualTime (observed) > liveEstimateTime (prognosis) > scheduledTime (original)
                    const liveTime = row.actualTime ? formatTime(row.actualTime) :
                        (row.liveEstimateTime ? formatTime(row.liveEstimateTime) : null);
                    const hasScheduleChange = !!(liveTime && liveTime !== scheduledTime);
                    return { scheduledTime, liveTime, hasScheduleChange, track: row.commercialTrack };
                };

                const arrivalInfo = arrivalRow ? formatRow(arrivalRow) : null;
                const departureInfo = departureRow ? formatRow(departureRow) : null;

                // Determine what information to show based on active tab
                const showArrivalInfo = activeTab !== 'departures' && arrivalInfo;
                const showDepartureInfo = activeTab !== 'arrivals' && departureInfo;

                const getEta = () => {
                    if (arrivalRow) {
                        const time = new Date(arrivalRow.liveEstimateTime || arrivalRow.scheduledTime).getTime();
                        const diff = Math.round((time - currentTime.getTime()) / 60000);
                        if (diff >= 0) {
                            if (diff >= 60) {
                                const hours = Math.floor(diff / 60);
                                const minutes = diff % 60;
                                return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
                            }
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
                            if (diff >= 60) {
                                const hours = Math.floor(diff / 60);
                                const minutes = diff % 60;
                                return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
                            }
                            return `${diff} min`;
                        }
                    }
                    return null;
                }

                const startStation = train.timeTableRows.filter(row => row.stationShortCode === "LEN")[0] || train.timeTableRows[0];

                return (
                    <div key={trainKey} className="panel-block themebackground pt-0 my-0" style={{ display: 'block', marginBottom: '1rem' }}>
                        {dateHeader}
                        <div className="columns is-0 pt-4 is-desktop">
                            <div className="column pb-4">
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
                                                    {activeTab === 'arrivals' ? (
                                                        t("timetables.grammarFrom") + " " + getStationGrammarForms(startStation.stationUICCode, locale)?.elative || stationData.translatedName || stationData.name
                                                    ) : destination}
                                                </p>
                                                <p className="subtitle is-6">
                                                    {train.cancelled ? (
                                                        <span style={{ color: 'var(--bulma-danger)' }} className="is-size-5 has-text-weight-bold">
                                                            {t('timetables.cancelled')}
                                                        </span>
                                                    ) : (
                                                        <>
                                                                {activeTab === 'all' && arrivalRow && departureRow && `${t('timetables.stopsAt')} ${getStationGrammarForms(stationData.uicCode, locale)?.inessive || stationData.translatedName || stationData.name}`}
                                                                {(activeTab === 'all' || activeTab === 'arrivals') && arrivalRow && !departureRow && `${t('timetables.arrivesTo')} ${getStationGrammarForms(stationData.uicCode, locale)?.illative || stationData.translatedName || stationData.name}`}
                                                                {(activeTab === 'all' || activeTab === 'departures') && !arrivalRow && departureRow && `${t('timetables.departsFrom')} ${getStationGrammarForms(stationData.uicCode, locale)?.elative || stationData.translatedName || stationData.name}`}
                                                                {activeTab === 'arrivals' && arrivalRow && departureRow && `${t('timetables.arrivesTo')} ${getStationGrammarForms(stationData.uicCode, locale)?.illative || stationData.translatedName || stationData.name}`}
                                                                {activeTab === 'departures' && arrivalRow && departureRow && `${t('timetables.departsFrom')} ${getStationGrammarForms(stationData.uicCode, locale)?.elative || stationData.translatedName || stationData.name}`}
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
                            <div className="column is-narrow">
                                {/* Bottom part */}
                                <div className="">
                                    <div className="columns is-mobile has-text-left">
                                        <div className="mr-4 has-text-centered">
                                            <span className="label m-0">{t('timetables.track')}</span>
                                            <span className="is-size-6 has-text-weight-bold">{(showArrivalInfo && showArrivalInfo.track) || (showDepartureInfo && showDepartureInfo.track) || '-'}</span>
                                        </div>
                                        {showArrivalInfo && (
                                            <div className="mr-4">
                                                <span className="label m-0">{t('timetables.arrivesAt')}</span>
                                                <div className="is-size-6" style={{ color: showArrivalInfo.hasScheduleChange ? 'var(--bulma-danger)' : 'inherit' }}>
                                                    {showArrivalInfo.liveTime || showArrivalInfo.scheduledTime}
                                                </div>
                                                {showArrivalInfo.liveTime && showArrivalInfo.liveTime !== showArrivalInfo.scheduledTime && (
                                                    <div className="subtitle is-7" style={{ textDecoration: 'line-through' }}>
                                                        ({showArrivalInfo.scheduledTime})
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {showDepartureInfo && (
                                            <div className="mr-4">
                                                <span className="label m-0">{t('timetables.departsAt')}</span>
                                                <div className="is-size-6" style={{ color: showDepartureInfo.hasScheduleChange ? 'var(--bulma-danger)' : 'inherit' }}>
                                                    {showDepartureInfo.liveTime || showDepartureInfo.scheduledTime}
                                                </div>
                                                {showDepartureInfo.liveTime && showDepartureInfo.liveTime !== showDepartureInfo.scheduledTime && (
                                                    <div className="subtitle is-7" style={{ textDecoration: 'line-through' }}>
                                                        ({showDepartureInfo.scheduledTime})
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {showArrivalInfo && !showDepartureInfo && getEta() && (
                                            <div className="">
                                                <span className="label m-0">{t('timetables.timeToArrival')}</span>
                                                <div className="is-size-6">{getEta()}</div>
                                            </div>
                                        )}

                                        {showDepartureInfo && !showArrivalInfo && getEtd() && (
                                            <div className="">
                                                <span className="label m-0">{t('timetables.timeToDeparture')}</span>
                                                <div className="is-size-6">{getEtd()}</div>
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
