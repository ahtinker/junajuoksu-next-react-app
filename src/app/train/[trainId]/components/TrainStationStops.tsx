'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import styles from './TrainStationStops.module.css';
import { useEffect, useState, useCallback } from 'react';

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

// Composition types
interface CompositionTimeTableRow {
    stationShortCode: string;
    stationUICCode: number;
    countryCode: string;
    type: 'DEPARTURE' | 'ARRIVAL';
    scheduledTime: string;
}

interface Wagon {
    wagonType: string;
    location: number;
    salesNumber: number;
    length: number;
    vehicleNumber?: string;
    playground?: boolean;
    pet?: boolean;
    catering?: boolean;
    video?: boolean;
    luggage?: boolean;
    smoking?: boolean;
    disabled?: boolean;
}

interface JourneySection {
    beginTimeTableRow: CompositionTimeTableRow;
    endTimeTableRow: CompositionTimeTableRow;
    locomotives: Array<{
        location: number;
        locomotiveType: string;
        powerType: string;
        vehicleNumber?: string;
    }>;
    wagons: Wagon[];
    totalLength: number;
    maximumSpeed: number;
}

interface TrainComposition {
    trainNumber: number;
    departureDate: string;
    operatorUICCode: number;
    operatorShortCode: string;
    trainCategory: string;
    trainType: string;
    version: number;
    journeySections: JourneySection[];
}

export default function TrainStationStops({
    train,
    originStationUic,
    originStopIndex,
    selectedDestinationUic
}: TrainStationStopsProps) {
    const locale = useLocale();
    const t = useTranslations();

    const [TAProgressFullLength, setTAProgressFullLength] = useState<number>(0);
    const [, setForceUpdate] = useState(Date.now());
    const [showAllStops, setShowAllStops] = useState(false);
    const [composition, setComposition] = useState<TrainComposition | null>(null);
    const [compositionLoading, setCompositionLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<{ [key: number]: boolean }>({});
    const [boardingTime, setBoardingTime] = useState<string | null>(null);
    const [boardingTimeLoading, setBoardingTimeLoading] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => setForceUpdate(Date.now()), 500);
        return () => clearInterval(timer);
    }, []);

    // Fetch train composition data
    useEffect(() => {
        const fetchComposition = async () => {
            try {
                setCompositionLoading(true);
                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/compositions/${train.departureDate}/${train.trainNumber}`
                );

                if (response.ok) {
                    const data: TrainComposition = await response.json();
                    setComposition(data);

                    // Auto-expand the currently active section
                    if (data.journeySections.length > 1) {
                        const now = new Date().getTime();
                        const activeIndex = data.journeySections.findIndex((section) => {
                            const beginTime = new Date(section.beginTimeTableRow.scheduledTime).getTime();
                            const endTime = new Date(section.endTimeTableRow.scheduledTime).getTime();
                            return now >= beginTime && now <= endTime;
                        });
                        if (activeIndex !== -1) {
                            setExpandedSections({ [activeIndex]: true });
                        } else {
                            // If no active section, expand the first upcoming one
                            const upcomingIndex = data.journeySections.findIndex(section => {
                                const beginTime = new Date(section.beginTimeTableRow.scheduledTime).getTime();
                                return now < beginTime;
                            });
                            setExpandedSections({ [upcomingIndex !== -1 ? upcomingIndex : 0]: true });
                        }
                    }
                } else {
                    console.warn('Failed to fetch composition data:', response.status);
                }
            } catch (err) {
                console.error('Error fetching composition:', err);
            } finally {
                setCompositionLoading(false);
            }
        };

        if (train.departureDate && train.trainNumber) {
            fetchComposition();
        }
    }, [train.departureDate, train.trainNumber]);

    // Fetch boarding time at first station
    useEffect(() => {
        const fetchBoardingTime = async () => {
            try {
                setBoardingTimeLoading(true);

                // Find first departure row from train data
                const firstDepartureRow = train.timeTableRows.find(
                    row => row.type === 'DEPARTURE' && row.trainStopping
                );

                if (!firstDepartureRow || !firstDepartureRow.commercialTrack) {
                    console.log('No first departure or track available');
                    setBoardingTimeLoading(false);
                    return;
                }

                const firstStationShortCode = firstDepartureRow.stationShortCode;
                const departureTrack = firstDepartureRow.commercialTrack;
                const departureTimeStr = firstDepartureRow.scheduledTime;

                if (!departureTrack || !departureTimeStr) {
                    console.log('No departure track or time available');
                    setBoardingTimeLoading(false);
                    return;
                }

                // Parse departure time to get search date range
                const departureDate = new Date(departureTimeStr);
                const searchDate = new Date(departureDate);
                searchDate.setHours(0, 0, 0, 0); // Start of day
                const formattedSearchDate = searchDate.toISOString().split('T')[0];

                // Also search previous day to find closer arrivals
                const previousDate = new Date(searchDate);
                previousDate.setDate(previousDate.getDate() + 1);
                const formattedPreviousDate = previousDate.toISOString().split('T')[0];

                console.log('Searching for trains at station:', firstStationShortCode, 'track:', departureTrack, 'before:', departureDate);
                console.log('Search dates:', formattedPreviousDate, 'and', formattedSearchDate);

                // GraphQL query to find trains arriving at this station on current and previous date
                const graphqlQuery = {
                    query: `{
                        currentDay: trainsByDepartureDate(departureDate: "${formattedSearchDate}") {
                            trainNumber
                            departureDate
                            timeTableRows(where: {
                                and: [
                                    { station: { shortCode: { equals: "${firstStationShortCode}" } } },
                                    { type: { equals: "ARRIVAL" } },
                                    { commercialTrack: { equals: "${departureTrack}" } }
                                ]
                            }) {
                                type
                                scheduledTime
                                commercialTrack
                                trainStopping
                            }
                        }
                        previousDay: trainsByDepartureDate(departureDate: "${formattedPreviousDate}") {
                            trainNumber
                            departureDate
                            timeTableRows(where: {
                                and: [
                                    { station: { shortCode: { equals: "${firstStationShortCode}" } } },
                                    { type: { equals: "ARRIVAL" } },
                                    { commercialTrack: { equals: "${departureTrack}" } }
                                ]
                            }) {
                                type
                                scheduledTime
                                commercialTrack
                                trainStopping
                            }
                        }
                    }`
                };

                const response = await fetch('https://rata.digitraffic.fi/api/v2/graphql/graphql', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept-Encoding': 'gzip'
                    },
                    body: JSON.stringify(graphqlQuery)
                });

                if (!response.ok) {
                    console.error('GraphQL query failed:', response.status);
                    setBoardingTimeLoading(false);
                    return;
                }

                const data = await response.json();
                console.log('GraphQL response:', data);

                if (data.errors) {
                    console.error('GraphQL errors:', data.errors);
                    setBoardingTimeLoading(false);
                    return;
                }

                // Combine trains from both days
                const currentDayTrains = data.data?.currentDay || [];
                const previousDayTrains = data.data?.previousDay || [];
                const trains = [...currentDayTrains, ...previousDayTrains];
                console.log('Found trains:', trains.length, '(current day:', currentDayTrains.length, ', previous day:', previousDayTrains.length, ')');

                // Find the closest arrival time before departure
                let closestArrivalTime: Date | null = null;
                const departureDateTime = departureDate.getTime();

                for (const trainData of trains) {
                    // Skip the current train
                    if (trainData.trainNumber === train.trainNumber &&
                        trainData.departureDate === train.departureDate) {
                        continue;
                    }

                    for (const row of trainData.timeTableRows) {
                        if (row.type === 'ARRIVAL' && row.commercialTrack === departureTrack) {
                            const arrivalTime = new Date(row.scheduledTime);
                            const arrivalDateTime = arrivalTime.getTime();

                            // Only consider arrivals before the departure
                            if (arrivalDateTime < departureDateTime) {
                                // Find the closest arrival to departure
                                if (!closestArrivalTime ||
                                    (departureDateTime - arrivalDateTime) < (departureDateTime - closestArrivalTime.getTime())) {
                                    closestArrivalTime = arrivalTime;
                                    const minutesBefore = Math.floor((departureDateTime - arrivalDateTime) / 60000);
                                    console.log(`Found arrival from train ${trainData.trainNumber} at ${arrivalTime.toISOString()}, ${minutesBefore} minutes before departure`);
                                }
                            }
                        }
                    }
                }

                if (closestArrivalTime) {
                    // Only set boarding time if it's within 30 minutes of departure
                    const minutesBefore = Math.floor((departureDateTime - closestArrivalTime.getTime()) / 60000);
                    if (minutesBefore <= 30) {
                        setBoardingTime(closestArrivalTime.toISOString());
                        console.log('Boarding time set to:', closestArrivalTime.toISOString(), `(${minutesBefore} minutes before departure)`);
                    } else {
                        console.log(`Closest arrival is ${minutesBefore} minutes before departure - too far, not showing boarding time`);
                    }
                } else {
                    console.log('No previous train arrival found on this track');
                }

                setBoardingTimeLoading(false);
            } catch (error) {
                console.error('Error fetching boarding time:', error);
                setBoardingTimeLoading(false);
            }
        };

        // Fetch when train data is available
        if (train.departureDate && train.trainNumber && train.timeTableRows.length > 0) {
            fetchBoardingTime();
        }
    }, [train.trainNumber, train.departureDate, train.timeTableRows]);

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

    function getPositionAtCenter(element: HTMLElement | null) {
        if (!element) return { x: 0, y: 0 };
        const { top, left, width, height } = element.getBoundingClientRect();
        return {
            x: left + width / 2,
            y: top + height / 2
        };
    }

    const getDistanceBetweenElements = useCallback((a: HTMLElement | null, b: HTMLElement | null) => {
        const aPosition = getPositionAtCenter(a);
        const bPosition = getPositionAtCenter(b);

        return Math.sqrt(
            Math.pow(aPosition.x - bPosition.x, 2) +
            Math.pow(aPosition.y - bPosition.y, 2)
        );
    }, []);

    // const distance = getDistanceBetweenElements(
    //     document.getElementById("x"),
    //     document.getElementById("y")
    // );

    useEffect(() => {
        if (stationStopsData.length > 1) {
            setTAProgressFullLength(getDistanceBetweenElements(
                document.getElementById("TAmarker0"),
                document.getElementById("TAmarker" + (stationStopsData.length - 1))
            ) + 20);
        }
    }, [stationStopsData, getDistanceBetweenElements]);

    const calculateProgressBetweenStops = (stopIndex1: number, stopIndex2: number): number => {
        if (stopIndex1 < 0 || stopIndex2 >= stationStopsData.length || stopIndex1 >= stopIndex2) {
            return 0;
        }

        const stop1 = stationStopsData[stopIndex1];
        const stop2 = stationStopsData[stopIndex2];

        if (!stop1.hasDeparture || !stop2.hasArrival) {
            return 0;
        }

        const getBestTime = (row: TimeTableRow | undefined): string | null => {
            if (!row) return null;
            return row.liveEstimateTime || row.actualTime || row.scheduledTime;
        };

        const startTimeStr = getBestTime(stop1.departure.rawRow);
        const endTimeStr = getBestTime(stop2.arrival.rawRow);

        if (!startTimeStr || !endTimeStr) {
            return 0;
        }

        const startTime = new Date(startTimeStr).getTime();
        const endTime = new Date(endTimeStr).getTime();
        const now = new Date().getTime();

        if (now <= startTime) {
            return 0;
        }
        if (now >= endTime) {
            return 1;
        }

        const totalDuration = endTime - startTime;
        if (totalDuration <= 0) {
            return now >= endTime ? 1 : 0;
        }

        const elapsed = now - startTime;
        const progress = elapsed / totalDuration;

        return Math.max(0, Math.min(1, progress));
    };

    const getStopStatus = (stop: typeof stationStopsData[0]): 'passed' | 'current' | 'upcoming' => {
        const now = new Date().getTime();

        const getBestTime = (row: TimeTableRow | undefined): string | null => {
            if (!row) return null;
            return row.liveEstimateTime || row.actualTime || row.scheduledTime;
        };

        const arrivalTimeStr = getBestTime(stop.arrival.rawRow);
        const departureTimeStr = getBestTime(stop.departure.rawRow);

        const arrivalTime = arrivalTimeStr ? new Date(arrivalTimeStr).getTime() : null;
        const departureTime = departureTimeStr ? new Date(departureTimeStr).getTime() : null;

        if (stop.isStarting) {
            if (departureTime && now > departureTime) return 'passed';
            if (departureTime && now <= departureTime) return 'current';
        }

        if (stop.isTerminal) {
            if (arrivalTime && now >= arrivalTime) return 'current';
        }

        if (arrivalTime && departureTime) {
            if (now >= departureTime) return 'passed';
            if (now >= arrivalTime && now < departureTime) return 'current';
        }

        // Fallback for other cases
        if (departureTime && now > departureTime) return 'passed';
        if (arrivalTime && now > arrivalTime) return 'passed'; // If no departure time, but arrival time has passed.

        return 'upcoming';
    };

    const getNextStopIndex = (): number => {
        for (let i = 0; i < stationStopsData.length; i++) {
            const stop = stationStopsData[i];
            const status = getStopStatus(stop);

            if (status === 'current' || status === 'upcoming') {
                return i;
            }
        }

        // If all stops are passed, return the last stop's index
        return stationStopsData.length > 0 ? stationStopsData.length - 1 : -1;
    };

    const getTimeBetweenStations = (stopIndex1: number, stopIndex2: number): string => {
        if (stopIndex1 < 0 || stopIndex2 >= stationStopsData.length || stopIndex1 >= stopIndex2) {
            return '';
        }

        const stop1 = stationStopsData[stopIndex1];
        const stop2 = stationStopsData[stopIndex2];

        if (!stop1.hasDeparture || !stop2.hasArrival) {
            return '';
        }

        const getBestTime = (row: TimeTableRow | undefined): string | null => {
            if (!row) return null;
            return row.liveEstimateTime || row.actualTime || row.scheduledTime;
        };

        const departureTimeStr = getBestTime(stop1.departure.rawRow);
        const arrivalTimeStr = getBestTime(stop2.arrival.rawRow);

        if (!departureTimeStr || !arrivalTimeStr) {
            return '';
        }

        const departureTime = new Date(departureTimeStr).getTime();
        const arrivalTime = new Date(arrivalTimeStr).getTime();

        const timeDifferenceMs = arrivalTime - departureTime;

        if (timeDifferenceMs < 0) {
            return '';
        }

        const totalSeconds = Math.floor(timeDifferenceMs / 1000);

        if (totalSeconds < 60) {
            return `${totalSeconds} s`;
        }

        const totalMinutes = Math.floor(totalSeconds / 60);

        if (totalMinutes < 60) {
            return `${totalMinutes} min`;
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        return minutes > 0 ? `${hours} h, ${minutes} min` : `${hours} h`;
    };

    const getStationTrack = (stopIndex: number): string => {
        if (stopIndex < 0 || stopIndex >= stationStopsData.length) {
            return '';
        }

        const stop = stationStopsData[stopIndex];

        // Prefer departure track, fallback to arrival track
        return stop.departure.track || stop.arrival.track || '';
    };

    return (
        <div>
            <div className="columns mt-6">
                <div className="column" style={{ overflowY: showAllStops ? 'auto' : 'hidden', position: "relative", transition: 'height 0.5s ease' }}>
                    <div style={{
                        height: "100px",
                        zIndex: 7,
                        width: "100%",
                        position: "absolute",
                        top: "0",
                        left: "0",
                        textAlign: "center",
                        background: "linear-gradient(180deg, var(--bulma-scheme-main) 50%, transparent 100%)",
                        display: getNextStopIndex() === 0 ? 'none' : 'block',
                    }}>
                        <button className="button" onClick={() => setShowAllStops(!showAllStops)}>
                            {showAllStops ? t('train.centerNextStop') : t('train.showAllStops')}
                        </button>
                    </div>
                    <div style={{
                        marginTop: showAllStops ? '100px' : getNextStopIndex() === 0 ? "0" : `${-(getDistanceBetweenElements(
                            document.getElementById("TAmarker0"),
                            document.getElementById("TAmarker" + (getNextStopIndex() - 1))
                        ) + getDistanceBetweenElements(
                            document.getElementById("TAmarker" + (getNextStopIndex() - 1)),
                            document.getElementById("TAmarker" + (getNextStopIndex()))
                        ) * calculateProgressBetweenStops(getNextStopIndex() - 1, getNextStopIndex()) - 120)}px`,
                        overflowX: "hidden",
                        transition: 'margin-top 0.5s ease'
                    }}>

                    {stationStopsData.map((stop, index) => {
                        const status = getStopStatus(stop);
                        const statusColor = () => {
                            switch (status) {
                                case 'passed':
                                    return "var(--bulma-text-weak)";
                                case 'current':
                                    return "var(--bulma-text-strong)";
                                case 'upcoming':
                                    return "var(--bulma-text-strong)";
                                default:
                                    return "var(--bulma-text-strong)";
                            }
                        };

                        return (
                            <div key={`${stop.uicCode}-${stop.stopIndex}`}>
                                <div className={`box is-shadowless is-clickable ${styles["station-stop"]} ${stop.isOrigin ? 'is-origin' : ''} ${stop.isDestination ? 'is-destination' : ''}`}>
                                    <div className="columns is-desktop">
                                        <div className="column is-5-tablet is-5-desktop is-5-widescreen">
                                        {index == 0 ?
                                                <div>
                                                    <div
                                                        className="mr-4"
                                                        id={`TAprogressPathBackground${index}`}
                                                        style={{
                                                            height: `${TAProgressFullLength}px`,
                                                            backgroundColor: 'var(--bulma-scheme-main)',
                                                            width: '10px',
                                                            left: "37.5px",
                                                            zIndex: 0,
                                                            position: "absolute",
                                                            borderRadius: "20px"
                                                        }}>
                                                    </div>
                                            </div>
                                            : null}

                                            {index != stationStopsData.length - 1 ?
                                                <div>

                                                    <div
                                                        className="has-background-primary mr-4"
                                                        id={`TAprogress${index}`}
                                                        style={{
                                                            height: `${(calculateProgressBetweenStops(index, index + 1))
                                                                * getDistanceBetweenElements(
                                                                    document.getElementById("TAmarker" + index),
                                                                    document.getElementById("TAmarker" + (index + 1))
                                                                ) + 20}px`,
                                                            width: '10px',
                                                            left: '37.5px',
                                                            display: status === "passed" ? 'block' : 'none',
                                                            zIndex: 1,
                                                            position: "absolute",
                                                            borderRadius: "10px"
                                                        }}>
                                                    </div>

                                                    <div
                                                        id={`TAprogressLocation${index}`}
                                                        style={{
                                                            marginTop: `${(calculateProgressBetweenStops(index, index + 1))
                                                                * getDistanceBetweenElements(
                                                                    document.getElementById("TAmarker" + index),
                                                                    document.getElementById("TAmarker" + (index + 1))
                                                                ) - 5}px`,
                                                            position: "absolute",
                                                            height: '30px',
                                                            width: '30px',
                                                            borderRadius: "50%",
                                                            marginLeft: '-5px',
                                                            zIndex: 3,
                                                            display: calculateProgressBetweenStops(index, index + 1) < 1 && status === "passed" ? 'block' : 'none',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                background: "linear-gradient(180deg,transparent 0%, var(--bulma-link) 100%)",
                                                                height: index == 0 ? (50 * (calculateProgressBetweenStops(index, index + 1))) : `50px`,
                                                                width: '10px',
                                                                position: "absolute",
                                                                zIndex: 3,
                                                                left: "10px",
                                                                top: index == 0 ? (-40) * (calculateProgressBetweenStops(index, index + 1)) : "-40px",
                                                                display: calculateProgressBetweenStops(index, index + 1) ? 'block' : 'none',
                                                            }}
                                                        >
                                                        </div>
                                                        <span className={`icon ${styles['TAbackground-dot']} has-background-link has-text-light`} style={{ zIndex: 4 }}>
                                                            <i className="fa-solid fa-arrow-down"></i>
                                                        </span>
                                                    </div>
                                                </div>
                                                : null}



                                            <div className="mr-4" id={`TAmarkerBackground${index}`} style={{ height: '20px', width: '20px', position: "absolute", borderRadius: "50%", zIndex: 0 }}>
                                                <div className={styles['TAbackground-dot']}></div>
                                            </div>
                                            <div className="mr-4" id={`TAmarker${index}`} style={{ height: '20px', width: '20px', position: "absolute", borderRadius: "50%", zIndex: 2 }}>
                                                {status === 'current' && <div className={styles['blinking-dot-background']}>
                                                    <span className={`icon ${(index === stationStopsData.length - 1 || !index) ? '' : styles['blinking-dot']} has-text-white`}>
                                                        <i className={(index === stationStopsData.length - 1 || !index) ? "fa-solid fa-location-dot" : "fa-solid fa-circle"}></i>
                                                </span>
                                            </div>}
                                                {status === 'passed' && <div className={styles['passed-dot']}></div>}


                                        </div>
                                            <span className="station-name title is-5 has-text-weight-bold ml-5 pl-2" style={{ color: statusColor(), zIndex: 2, position: "absolute" }}>
                                            {stop.stationName}
                                        </span>
                                            <div className={"ml-5 pl-2 mt-5 pt-2 is-3 is-hidden-touch is-hidden-widescreen"}>
                                                <div className="title is-6 mb-1 has-text-weight-semibold">
                                                    {t('train.track')}
                                                </div>
                                                <div className="tag is-size-6 px-4" style={{ backgroundColor: 'var(--bulma-scheme-main)', color: 'var(--bulma-text-strong)' }}>
                                                    {getStationTrack(stop.departure.track ? index : index - 1)}
                                                </div>
                                            </div>
                                    </div>
                                    <div className="column">
                                            <div className="mt-2 is-hidden-desktop"></div>
                                            <div className="columns is-mobile is-4">
                                            <div className={"column is-1"}></div>

                                                <div className={"column is-3 is-hidden-desktop-only"}>
                                                    <div className="title is-6 mb-1 has-text-weight-semibold">
                                                        {t('train.track')}
                                                    </div>
                                                    <div className="tag is-size-6 px-4" style={{ backgroundColor: 'var(--bulma-scheme-main)', color: 'var(--bulma-text-strong)' }}>
                                                        {getStationTrack(stop.departure.track ? index : index - 1)}
                                                    </div>
                                                </div>
                                                <div className={"column " + (!stop.hasArrival && !(index === 0 && boardingTime) ? "is-hidden" : "")}>
                                                <div className="title is-6 mb-1 has-text-weight-semibold">
                                                        {(() => {
                                                            // First station with boarding time
                                                            if (index === 0 && !stop.hasArrival && boardingTime) {
                                                                return t('train.boarding');
                                                            }
                                                            if (!stop.arrival.rawRow) return t('train.arrives');
                                                            const arrivalTimeStr = stop.arrival.rawRow.liveEstimateTime || stop.arrival.rawRow.actualTime || stop.arrival.rawRow.scheduledTime;
                                                            const arrivalTime = new Date(arrivalTimeStr).getTime();
                                                            const now = new Date().getTime();
                                                            return now > arrivalTime ? t('train.arrived') : t('train.arrives');
                                                        })()}
                                                </div>
                                                {stop.hasArrival && (
                                                    <div>
                                                        <div className={`${stop.arrival.delaySeconds > 0 ? 'has-text-danger' : stop.arrival.delaySeconds < 0 ? 'has-text-success' : ''}`}>
                                                            {stop.arrival.time}
                                                        </div>
                                                        <div className={`is-size-7 ${stop.arrival.delaySeconds > 0 || stop.arrival.delaySeconds < 0 ? '' : 'is-hidden'}`}>
                                                                ({stop.arrival.scheduledTime})
                                                        </div>
                                                    </div>
                                                )}
                                                    {/* Show boarding time at first station */}
                                                    {index === 0 && !stop.hasArrival && boardingTime && !boardingTimeLoading && (
                                                        <div>
                                                            <div className="has-text-info">
                                                                {formatTime(boardingTime)}
                                                            </div>
                                                            <div className="is-size-7 has-text-grey">
                                                                {t('train.boardingNote')}
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                            <div className={"column " + (!stop.hasDeparture ? "is-hidden" : "")}>
                                                <div className="title is-6 mb-1 has-text-weight-semibold">
                                                        {(() => {
                                                            if (!stop.departure.rawRow) return t('train.departs');
                                                            const departureTimeStr = stop.departure.rawRow.liveEstimateTime || stop.departure.rawRow.actualTime || stop.departure.rawRow.scheduledTime;
                                                            const departureTime = new Date(departureTimeStr).getTime();
                                                            const now = new Date().getTime();
                                                            return now > departureTime ? t('train.departed') : t('train.departs');
                                                        })()}
                                                </div>
                                                {stop.hasDeparture && (
                                                    <div>
                                                        <div className={`${stop.departure.delaySeconds > 0 ? 'has-text-danger' : stop.departure.delaySeconds < 0 ? 'has-text-success' : ''}`}>
                                                            {stop.departure.time}
                                                        </div>
                                                        <div className={`is-size-7 ${stop.departure.delaySeconds > 0 || stop.departure.delaySeconds < 0 ? '' : 'is-hidden'}`}>
                                                                ({stop.departure.scheduledTime})
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </div>

                            </div>
                                <div className="is-size-7" style={{ position: "absolute", marginTop: "-21px", marginLeft: "53px" }}>{getTimeBetweenStations(index, index + 1)}</div>
                            </div>
                        );
                    })}
                </div>
                </div>
                <div className="column">
                    {/* Train Composition */}
                    <div className="box is-shadowless" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                        <h3 className="title is-6 mb-4 has-text-weight-semibold">
                            <span className="icon-text">
                                <span className="icon">
                                    <i className="fas fa-train"></i>
                                </span>
                                <span>{t('train.composition')}</span>
                            </span>
                        </h3>

                        {compositionLoading ? (
                            <div className="has-text-centered py-4">
                                <span className="icon is-large">
                                    <i className="fas fa-spinner fa-pulse"></i>
                                </span>
                            </div>
                        ) : !composition || composition.journeySections.length === 0 ? (
                            <p className="has-text-grey">{t('train.noComposition')}</p>
                        ) : composition.journeySections.length === 1 ? (
                            // Single composition - no dropdowns needed
                            <div className="wagon-list">
                                <div className="is-flex is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                                    {composition.journeySections[0].wagons
                                        .sort((a, b) => (a.salesNumber + b.salesNumber > 0) ? (a.salesNumber - b.salesNumber) : (a.location - b.location))
                                        .map((wagon, idx) => (
                                            <div
                                                key={idx}
                                                className="box p-2 mb-0 is-shadowless"
                                                style={{
                                                    backgroundColor: 'var(--bulma-scheme-main)',
                                                    minWidth: '60px',
                                                    textAlign: 'center'
                                                }}
                                                title={[
                                                    wagon.wagonType,
                                                    wagon.salesNumber > 0 ? `#${wagon.salesNumber}` : null,
                                                    wagon.playground ? t('train.wagonFeatures.playground') : null,
                                                    wagon.pet ? t('train.wagonFeatures.pet') : null,
                                                    wagon.catering ? t('train.wagonFeatures.catering') : null,
                                                    wagon.disabled ? t('train.wagonFeatures.disabled') : null,
                                                ].filter(Boolean).join(' • ')}
                                            >
                                                <div className="is-size-7 has-text-weight-bold">
                                                    {wagon.salesNumber > 0 ? wagon.salesNumber : wagon.location}
                                                </div>
                                                <div className="is-size-7 has-text-grey">
                                                    {wagon.wagonType} {wagon.vehicleNumber}
                                                </div>
                                                <div className="is-flex is-justify-content-center" style={{ gap: '2px', marginTop: '2px' }}>
                                                    {wagon.playground && (
                                                        <span className="icon is-small has-text-info" title={t('train.wagonFeatures.playground')}>
                                                            <i className="fas fa-child fa-xs"></i>
                                                        </span>
                                                    )}
                                                    {wagon.pet && (
                                                        <span className="icon is-small has-text-warning" title={t('train.wagonFeatures.pet')}>
                                                            <i className="fas fa-paw fa-xs"></i>
                                                        </span>
                                                    )}
                                                    {wagon.catering && (
                                                        <span className="icon is-small has-text-danger" title={t('train.wagonFeatures.catering')}>
                                                            <i className="fas fa-utensils fa-xs"></i>
                                                        </span>
                                                    )}
                                                    {wagon.disabled && (
                                                        <span className="icon is-small has-text-link" title={t('train.wagonFeatures.disabled')}>
                                                            <i className="fas fa-wheelchair fa-xs"></i>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                                <p className="is-size-7 has-text-grey mt-2">
                                    {composition.journeySections[0].wagons.length} {t('train.wagons')} • {composition.journeySections[0].totalLength} m
                                </p>
                            </div>
                        ) : (
                            // Multiple compositions - use dropdowns
                            <div className="composition-sections">
                                {composition.journeySections.map((section, sectionIndex) => {
                                    const isExpanded = expandedSections[sectionIndex] ?? false;
                                    const now = new Date().getTime();
                                    const beginTime = new Date(section.beginTimeTableRow.scheduledTime).getTime();
                                    const endTime = new Date(section.endTimeTableRow.scheduledTime).getTime();
                                    const isActive = now >= beginTime && now <= endTime;

                                    const startStationName = getTranslatedStationNameWithFallback(
                                        section.beginTimeTableRow.stationUICCode,
                                        locale,
                                        section.beginTimeTableRow.stationShortCode
                                    );
                                    const endStationName = getTranslatedStationNameWithFallback(
                                        section.endTimeTableRow.stationUICCode,
                                        locale,
                                        section.endTimeTableRow.stationShortCode
                                    );

                                    return (
                                        <div key={sectionIndex} className="mb-3">
                                            <button
                                                className={`button is-fullwidth is-justify-content-space-between`}
                                                onClick={() => setExpandedSections(prev => ({
                                                    ...prev,
                                                    [sectionIndex]: !prev[sectionIndex]
                                                }))}
                                                style={{ height: 'auto', padding: '0.75rem 1rem' }}
                                            >
                                                <span className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                                                    <span>
                                                        {startStationName} - {endStationName}
                                                    </span>
                                                    {isActive && (
                                                        <span className="tag is-success is-light ml-2">{t('train.active')}</span>
                                                    )}
                                                </span>
                                                <span className="icon is-small">
                                                    <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                                </span>
                                            </button>

                                            {isExpanded && (
                                                <div className="box mt-2 p-3 is-shadowless" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                                                    <div className="is-flex is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                                                        {section.wagons
                                                            .sort((a, b) => a.location - b.location)
                                                            .map((wagon, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="box p-2 mb-0 is-shadowless"
                                                                    style={{
                                                                        backgroundColor: 'var(--bulma-scheme-main-bis)',
                                                                        minWidth: '60px',
                                                                        textAlign: 'center'
                                                                    }}
                                                                    title={[
                                                                        wagon.wagonType,
                                                                        wagon.salesNumber > 0 ? `#${wagon.salesNumber}` : null,
                                                                        wagon.playground ? t('train.wagonFeatures.playground') : null,
                                                                        wagon.pet ? t('train.wagonFeatures.pet') : null,
                                                                        wagon.catering ? t('train.wagonFeatures.catering') : null,
                                                                        wagon.disabled ? t('train.wagonFeatures.disabled') : null,
                                                                    ].filter(Boolean).join(' • ')}
                                                                >
                                                                    <div className="is-size-7 has-text-weight-bold">
                                                                        {wagon.salesNumber > 0 ? wagon.salesNumber : wagon.location}
                                                                    </div>
                                                                    <div className="is-size-7 has-text-grey">
                                                                        {wagon.wagonType}
                                                                    </div>
                                                                    <div className="is-flex is-justify-content-center" style={{ gap: '2px', marginTop: '2px' }}>
                                                                        {wagon.playground && (
                                                                            <span className="icon is-small has-text-info" title={t('train.wagonFeatures.playground')}>
                                                                                <i className="fas fa-child fa-xs"></i>
                                                                            </span>
                                                                        )}
                                                                        {wagon.pet && (
                                                                            <span className="icon is-small has-text-warning" title={t('train.wagonFeatures.pet')}>
                                                                                <i className="fas fa-paw fa-xs"></i>
                                                                            </span>
                                                                        )}
                                                                        {wagon.catering && (
                                                                            <span className="icon is-small has-text-danger" title={t('train.wagonFeatures.catering')}>
                                                                                <i className="fas fa-utensils fa-xs"></i>
                                                                            </span>
                                                                        )}
                                                                        {wagon.disabled && (
                                                                            <span className="icon is-small has-text-link" title={t('train.wagonFeatures.disabled')}>
                                                                                <i className="fas fa-wheelchair fa-xs"></i>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                    <p className="is-size-7 has-text-grey mt-2">
                                                        {section.wagons.length} {t('train.wagons')} • {section.totalLength} m
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* TODO: Implement frontend using the following data structures */}

                    <div className="notification is-warning">
                        <div className='title is-5'>Debugger</div >
                        <p>Total stations: {totalStations}</p>
                        <p>Has delays: {hasDelays ? 'Yes' : 'No'}</p>
                        <p>Max delay: {maxDelayFormatted || 'None'}</p>
                        <p>Progress between 1st and 2nd stop: {stationStopsData.length > 1 ? calculateProgressBetweenStops(0, 1).toFixed(2) : 'N/A'}</p>
                        <p>Next stop index: {getNextStopIndex()}</p>

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
