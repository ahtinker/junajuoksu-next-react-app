'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Train, TimeTableRow, Cause } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import styles from './TrainStationStops.module.css';
import { useEffect, useState, useCallback, useMemo } from 'react';
import TrainCompositionView from './TrainCompositionView';
import StationStopDrawer from './StationStopDrawer';

// Cause code types - names are localized
interface LocalizedName {
    fi: string;
    en: string;
    sv: string;
}

interface CauseCategory {
    id: number;
    categoryCode: string;
    categoryName: LocalizedName;
    validFrom: string;
}

interface DetailedCauseCategory {
    id: number;
    detailedCategoryCode: string;
    detailedCategoryName: LocalizedName;
    validFrom: string;
}

interface ThirdCauseCategory {
    id: number;
    thirdCategoryCode: string;
    thirdCategoryName: LocalizedName;
    validFrom: string;
}

interface TrainStationStopsProps {
    train: Train;
    originStationUic: number;
    originStopIndex: number;
    selectedDestinationUic?: number;
    onSetAsDeparture?: (uicCode: number, stopIndex: number) => void;
    onSetAsDestination?: (uicCode: number) => void;
    trainPosition?: {
        latitude: number | null;
        longitude: number | null;
        speed: number | null;
        timestamp: string | null;
        source: 'HSL' | 'VR' | null;
        heading?: number | null;
    };
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
    selectedDestinationUic,
    onSetAsDeparture,
    onSetAsDestination,
    trainPosition
}: TrainStationStopsProps) {
    const locale = useLocale();
    const t = useTranslations();

    const [TAProgressFullLength, setTAProgressFullLength] = useState<number>(0);
    const [, setForceUpdate] = useState(Date.now());
    const [showAllStops, setShowAllStops] = useState(false);
    const [composition, setComposition] = useState<TrainComposition | null>(null);
    const [, setCompositionLoading] = useState(true);
    const [, setExpandedSections] = useState<{ [key: number]: boolean }>({});
    const [boardingTime, setBoardingTime] = useState<string | null>(null);
    const [boardingTimeLoading, setBoardingTimeLoading] = useState(true);
    const [expandedCompositions, setExpandedCompositions] = useState<{ [key: number]: boolean }>({});

    // Cause codes state
    const [causeCategories, setCauseCategories] = useState<CauseCategory[]>([]);
    const [detailedCauseCategories, setDetailedCauseCategories] = useState<DetailedCauseCategory[]>([]);
    const [thirdCauseCategories, setThirdCauseCategories] = useState<ThirdCauseCategory[]>([]);
    const [expandedCauses, setExpandedCauses] = useState<{ [key: number]: boolean }>({});

    // Station drawer state
    const [selectedStationForDrawer, setSelectedStationForDrawer] = useState<{
        uicCode: number;
        shortCode: string;
        stationName: string;
        stopIndex: number;
        arrivalRow?: TimeTableRow;
        departureRow?: TimeTableRow;
    } | null>(null);
    const [isStationDrawerOpen, setIsStationDrawerOpen] = useState(false);

    // Memoize trainInfo for the drawer to prevent unnecessary re-renders
    const trainInfoForDrawer = useMemo(() => ({
        departureDate: train.departureDate,
        trainNumber: train.trainNumber
    }), [train.departureDate, train.trainNumber]);

    // Memoize origin departure time for the drawer
    const originDepartureTime = useMemo(() => {
        // Find the origin station's departure row based on stopIndex
        let stopCount = 0;
        for (const row of train.timeTableRows) {
            if (row.stationUICCode === originStationUic && row.trainStopping && row.type === 'DEPARTURE') {
                if (stopCount === originStopIndex) {
                    return row.scheduledTime;
                }
                stopCount++;
            }
        }
        // If no departure found (might be last station), check for arrival
        stopCount = 0;
        for (const row of train.timeTableRows) {
            if (row.stationUICCode === originStationUic && row.trainStopping && row.type === 'ARRIVAL') {
                if (stopCount === originStopIndex) {
                    return row.scheduledTime;
                }
                stopCount++;
            }
        }
        return undefined;
    }, [train.timeTableRows, originStationUic, originStopIndex]);

    // Memoize drawer close handler
    const handleDrawerClose = useCallback(() => {
        setIsStationDrawerOpen(false);
        setSelectedStationForDrawer(null);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setForceUpdate(Date.now()), 500);
        return () => clearInterval(timer);
    }, []);

    // Fetch cause codes from static JSON files
    useEffect(() => {
        const fetchCauseCodes = async () => {
            try {
                const [categoriesRes, detailedRes, thirdRes] = await Promise.all([
                    fetch('/cause-codes/cause-category-codes.json'),
                    fetch('/cause-codes/detailed-cause-category-codes.json'),
                    fetch('/cause-codes/third-cause-category-codes.json')
                ]);

                if (categoriesRes.ok) {
                    const data = await categoriesRes.json();
                    setCauseCategories(data);
                }
                if (detailedRes.ok) {
                    const data = await detailedRes.json();
                    setDetailedCauseCategories(data);
                }
                if (thirdRes.ok) {
                    const data = await thirdRes.json();
                    setThirdCauseCategories(data);
                }
            } catch (err) {
                console.error('Error fetching cause codes:', err);
            }
        };

        fetchCauseCodes();
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

                // Skip fetching if train has already left the first station
                if (firstDepartureRow.actualTime) {
                    console.log('Train has already left the first station, skipping boarding time fetch');
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
                                actualTime
                                liveEstimateTime
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
                            // Prioritize actualTime > liveEstimateTime > scheduledTime
                            const bestTime = row.actualTime || row.liveEstimateTime || row.scheduledTime;
                            const arrivalTime = new Date(bestTime);
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
            if (!row.commercialStop && row.stationUICCode !== 1034) return;

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
            isStarting: !stop.arrivalRow && !!stop.departureRow,

            // Cancelled flag - stop is cancelled if both arrival and departure are cancelled (or whichever exists)
            isCancelled: (stop.arrivalRow?.cancelled ?? false) && (stop.departureRow?.cancelled ?? false),
            arrivalCancelled: stop.arrivalRow?.cancelled ?? false,
            departureCancelled: stop.departureRow?.cancelled ?? false
        };
    });

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

    // Helper function to check if composition changes at a specific station
    const getCompositionAtStop = (stopIndex: number): JourneySection | null => {
        if (!composition || stopIndex < 0 || stopIndex >= stationStopsData.length) {
            return null;
        }

        const stop = stationStopsData[stopIndex];

        // For the first stop, always show the composition
        if (stopIndex === 0) {
            // Find the first journey section
            return composition.journeySections[0] || null;
        }

        // For other stops, check if composition changes here
        for (const section of composition.journeySections) {
            const beginStation = section.beginTimeTableRow.stationShortCode;

            // Check if this stop matches the beginning of a journey section (composition change)
            if (stop.shortCode === beginStation) {
                return section;
            }
        }

        return null;
    };

    // Check if composition changes at a stop
    const hasCompositionChange = (stopIndex: number): boolean => {
        return getCompositionAtStop(stopIndex) !== null;
    };

    // Helper function to get localized name from a localized name object
    const getLocalizedName = (name: LocalizedName): string => {
        const localeKey = locale as keyof LocalizedName;
        return name[localeKey] || name.fi; // Fallback to Finnish if locale not found
    };

    // Helper function to get cause description by ID - prioritizes most detailed available
    const getCauseDescription = (cause: Cause): string => {
        // Try third level (most detailed) first
        if (cause.thirdCategoryCodeId) {
            const thirdCategory = thirdCauseCategories.find(c => c.id === cause.thirdCategoryCodeId);
            if (thirdCategory) {
                return getLocalizedName(thirdCategory.thirdCategoryName);
            }
        }

        // Try detailed level second
        if (cause.detailedCategoryCodeId) {
            const detailedCategory = detailedCauseCategories.find(c => c.id === cause.detailedCategoryCodeId);
            if (detailedCategory) {
                return getLocalizedName(detailedCategory.detailedCategoryName);
            }
        }

        // Fall back to category level (always available)
        const category = causeCategories.find(c => c.id === cause.categoryCodeId);
        if (category) {
            return getLocalizedName(category.categoryName);
        }

        return cause.categoryCode || 'Unknown cause';
    };

    // Get all causes for a stop, including causes from non-stopping stations that should be shown here
    const getCausesForStop = (stopIndex: number): { causes: Cause[], fromNonStoppingStation?: string }[] => {
        if (stopIndex < 0 || stopIndex >= stationStopsData.length) {
            return [];
        }

        const stop = stationStopsData[stopIndex];
        const result: { causes: Cause[], fromNonStoppingStation?: string }[] = [];

        // Get direct causes from this stop's arrival and departure rows
        const directCauses: Cause[] = [];
        if (stop.arrival.rawRow?.causes && stop.arrival.rawRow.causes.length > 0) {
            directCauses.push(...stop.arrival.rawRow.causes);
        }
        if (stop.departure.rawRow?.causes && stop.departure.rawRow.causes.length > 0) {
            directCauses.push(...stop.departure.rawRow.causes);
        }

        if (directCauses.length > 0) {
            result.push({ causes: directCauses });
        }

        // Check for causes from non-stopping stations between this stop and the previous stopping station
        // These should be shown at the first stopping station after the non-stopping station
        if (stopIndex > 0) {
            // Find all timetable rows between the previous stop and this stop
            const prevStop = stationStopsData[stopIndex - 1];
            const prevDepartureTime = prevStop.departure.rawRow?.scheduledTime;
            const thisArrivalTime = stop.arrival.rawRow?.scheduledTime;

            if (prevDepartureTime && thisArrivalTime) {
                // Find non-stopping rows between these times
                const nonStoppingCauses: { causes: Cause[], stationName: string }[] = [];

                train.timeTableRows.forEach((row) => {
                    if (!row.trainStopping && row.causes && row.causes.length > 0) {
                        const rowTime = row.scheduledTime;
                        if (rowTime > prevDepartureTime && rowTime <= thisArrivalTime) {
                            const stationName = getTranslatedStationNameWithFallback(
                                row.stationUICCode,
                                locale,
                                row.stationShortCode
                            );
                            nonStoppingCauses.push({
                                causes: row.causes as Cause[],
                                stationName
                            });
                        }
                    }
                });

                nonStoppingCauses.forEach(({ causes, stationName }) => {
                    result.push({ causes, fromNonStoppingStation: stationName });
                });
            }
        }

        return result;
    };

    // Check if a stop has any causes (including from non-stopping stations)
    const hasCauses = (stopIndex: number): boolean => {
        const causesForStop = getCausesForStop(stopIndex);
        return causesForStop.some(c => c.causes.length > 0);
    };

    return (
        <div>
            <div style={{ overflowY: showAllStops ? 'auto' : 'hidden', position: "relative", transition: 'height 0.5s ease' }}>
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
                        <span className="icon">
                            <i className={`fa-solid fa-caret-${showAllStops ? 'down' : 'up'}`}></i>
                        </span>
                        <span>
                            {showAllStops ? t('train.centerNextStop') : t('train.showAllStops')}
                        </span>
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
                                    return "var(--bulma-primary)";
                                case 'current':
                                    return "var(--bulma-primary-60)";
                                case 'upcoming':
                                    return "var(--bulma-primary-60)";
                                default:
                                    return "var(--bulma-primary-60)";
                            }
                        };

                        return (
                            <div key={`${stop.uicCode}-${stop.stopIndex}`}>
                                <div style={{ backgroundColor: "var(--bulma-background)" }} className={`box  ${styles["station-stop"]} ${stop.isOrigin ? 'is-origin' : ''} ${stop.isDestination ? 'is-destination' : ''}`}>
                                    <div className="columns is-desktop" style={{ position: "relative" }}>
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
                                                            left: "17.5px",
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
                                                            left: '17.5px',
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
                                            <span
                                                className={`station-name title is-5 has-text-weight-bold ml-5 pl-2 ${styles['clickable-station-name']}`}
                                                style={{ color: stop.isCancelled ? 'var(--bulma-danger)' : statusColor(), zIndex: 2, position: "absolute", textDecoration: stop.isCancelled ? 'line-through' : 'none' }}
                                                onClick={() => {
                                                    setSelectedStationForDrawer({
                                                        uicCode: stop.uicCode,
                                                        shortCode: stop.shortCode,
                                                        stationName: stop.stationName,
                                                        stopIndex: stop.stopIndex,
                                                        arrivalRow: stop.arrival.rawRow,
                                                        departureRow: stop.departure.rawRow
                                                    });
                                                    setIsStationDrawerOpen(true);
                                                }}
                                            >
                                            {stop.stationName}
                                                {stop.isCancelled && (
                                                    <span className="tag is-danger ml-2" style={{ verticalAlign: 'middle', fontSize: '0.7rem' }}>
                                                        {t('train.stopCancelled')}
                                                    </span>
                                                )}
                                        </span>
                                            <div className={"ml-5 pl-2 mt-5 pt-2 is-3 is-hidden-touch is-hidden-widescreen"}>
                                                <div className="title is-6 mb-1 has-text-weight-semibold">
                                                    {t('train.track')}
                                                </div>
                                                <div className="tag is-size-6 px-4" style={{ backgroundColor: 'var(--bulma-scheme-main)', color: 'var(--bulma-text-strong)' }}>
                                                    {getStationTrack(stop.arrival.track ? index : stop.departure.track ? index + 1 : -1) || "?"}
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
                                                        {getStationTrack(stop.arrival.track ? index : stop.departure.track ? index + 1 : -1) || "?"}
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
                                                        <div style={{ opacity: stop.arrivalCancelled ? 0.5 : 1 }}>
                                                            <div
                                                                className={`${stop.arrivalCancelled ? 'has-text-grey' : stop.arrival.delaySeconds > 0 ? 'has-text-danger' : stop.arrival.delaySeconds < 0 ? 'has-text-success' : ''}`}
                                                                style={{ textDecoration: stop.arrivalCancelled ? 'line-through' : 'none' }}
                                                            >
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
                                                        <div style={{ opacity: stop.departureCancelled ? 0.5 : 1 }}>
                                                            <div
                                                                className={`${stop.departureCancelled ? 'has-text-grey' : stop.departure.delaySeconds > 0 ? 'has-text-danger' : stop.departure.delaySeconds < 0 ? 'has-text-success' : ''}`}
                                                                style={{ textDecoration: stop.departureCancelled ? 'line-through' : 'none' }}
                                                            >
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

                                    {/* Show train composition at this stop if it changes here or at first stop */}
                                    {hasCompositionChange(index) && index !== stationStopsData.length - 1 && (
                                        <div className="px-4 pb-3 ml-4">
                                            <hr className="my-3" style={{ backgroundColor: 'var(--bulma-border-weak)' }} />
                                            <h4
                                                className="title is-6 mb-3 has-text-weight-semibold is-clickable"
                                                onClick={() => setExpandedCompositions(prev => ({ ...prev, [index]: !prev[index] }))}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <span className="icon-text">
                                                    <span className="icon has-text-primary">
                                                        <i className={`fas fa-chevron-${expandedCompositions[index] ? 'down' : 'right'}`}></i>
                                                    </span>
                                                    <span>{index === 0 ? t('train.startingComposition') : t('train.compositionChange')}</span>
                                                </span>
                                            </h4>
                                            {expandedCompositions[index] && (() => {
                                                const section = getCompositionAtStop(index);
                                                if (!section) return null;

                                                return (
                                                    <TrainCompositionView
                                                        section={section}
                                                        translations={{
                                                            playground: t('train.wagonFeatures.playground'),
                                                            pet: t('train.wagonFeatures.pet'),
                                                            catering: t('train.wagonFeatures.catering'),
                                                            disabled: t('train.wagonFeatures.disabled'),
                                                            wagons: t('train.wagons'),
                                                            maxSpeed: t('train.maxSpeed')
                                                        }}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Show exception causes at this stop */}
                                    {hasCauses(index) && (
                                        <div className="px-4 pb-3 ml-4">
                                            <hr className="my-3" style={{ backgroundColor: 'var(--bulma-border-weak)' }} />
                                            <h4
                                                className="title is-6 mb-3 has-text-weight-semibold is-clickable"
                                                onClick={() => setExpandedCauses(prev => ({ ...prev, [index]: !prev[index] }))}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <span className="icon-text">
                                                    <span className="icon has-text-warning">
                                                        <i className={`fas fa-chevron-${expandedCauses[index] ? 'down' : 'right'}`}></i>
                                                    </span>
                                                    <span>{t('train.exceptionCause')}</span>
                                                </span>
                                            </h4>
                                            {expandedCauses[index] && (
                                                <div className="content">
                                                    {getCausesForStop(index).map((causeGroup, groupIndex) => (
                                                        <div key={groupIndex} className="mb-3">
                                                            {causeGroup.fromNonStoppingStation && (
                                                                <p className="is-size-7 has-text-grey mb-1">
                                                                    <span className="icon is-small">
                                                                        <i className="fas fa-map-marker-alt"></i>
                                                                    </span>
                                                                    {' '}{t('train.causeFromStation', { station: causeGroup.fromNonStoppingStation })}
                                                                </p>
                                                            )}
                                                            {causeGroup.causes.map((cause, causeIndex) => (
                                                                <div key={causeIndex} className="box  py-2 px-3 mb-2" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                                                                    <div className="is-flex is-align-items-center">
                                                                        <span className="is-size-6">
                                                                            {getCauseDescription(cause)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </div>
                                <div className="is-size-7" style={{ position: "absolute", marginTop: "-21px", marginLeft: "53px" }}>{getTimeBetweenStations(index, index + 1)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Station Details Drawer */}
            <StationStopDrawer
                station={selectedStationForDrawer}
                isOpen={isStationDrawerOpen}
                onClose={handleDrawerClose}
                trainInfo={trainInfoForDrawer}
                currentOriginUic={originStationUic}
                currentOriginStopIndex={originStopIndex}
                currentOriginDepartureTime={originDepartureTime}
                currentDestinationUic={selectedDestinationUic}
                onSetAsDeparture={onSetAsDeparture}
                onSetAsDestination={onSetAsDestination}
                trainPosition={trainPosition}
                isTrainRunning={train.runningCurrently}
            />
        </div>
    );
}
