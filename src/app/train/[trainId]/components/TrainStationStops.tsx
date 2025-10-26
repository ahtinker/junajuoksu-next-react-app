'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import styles from './TrainStationStops.module.css';
import { useEffect, useState } from 'react';

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

    const [TAProgressFullLength, setTAProgressFullLength] = useState<number>(0);
    const [, setForceUpdate] = useState(Date.now());
    const [showAllStops, setShowAllStops] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setForceUpdate(Date.now()), 500);
        return () => clearInterval(timer);
    }, []);

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

    function getDistanceBetweenElements(a: HTMLElement | null, b: HTMLElement | null) {
        const aPosition = getPositionAtCenter(a);
        const bPosition = getPositionAtCenter(b);

        return Math.sqrt(
            Math.pow(aPosition.x - bPosition.x, 2) +
            Math.pow(aPosition.y - bPosition.y, 2)
        );
    }

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
    }, [stationStopsData]);

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
        const now = new Date().getTime();

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
                <div className="column" style={{ overflowY: showAllStops ? 'auto' : 'hidden', position: "relative", transition: 'height 0.5s ease-in-out' }}>
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
                        transition: 'margin-top 0.5s ease-in-out'
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
                                <div className={`box is-shadowless ${styles["station-stop"]} ${stop.isOrigin ? 'is-origin' : ''} ${stop.isDestination ? 'is-destination' : ''}`}>
                                <div className="columns is-desktop">
                                    <div className="column is-5-tablet is-5-desktop is-6-widescreen">
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
                                                            <i className="fa-solid fa-train"></i>
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
                                        <span className="station-name title is-5 mb-1 has-text-weight-bold ml-5 pl-2" style={{ color: statusColor(), zIndex: 2, position: "absolute" }}>
                                            {stop.stationName}
                                        </span>
                                    </div>
                                    <div className="column">
                                            <div className="columns is-mobile is-4">
                                            <div className={"column is-1"}></div>

                                                <div className={"column is-3 is-narrow "}>
                                                    <div className="title is-6 mb-1 has-text-weight-semibold">
                                                        {t('train.track')}
                                                    </div>
                                                    <div className="tag is-size-6 is-primary px-4">
                                                        {getStationTrack(stop.departure.track ? index : index - 1)}
                                                    </div>
                                                </div>
                                                <div className={"column is-narrow " + (!stop.hasArrival ? "is-hidden" : "")}>
                                                <div className="title is-6 mb-1 has-text-weight-semibold">
                                                        {stop.arrival.actualTime ? t('train.arrived') : t('train.arrives')}
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
                                            </div>
                                            <div className={"column " + (!stop.hasDeparture ? "is-hidden" : "")}>
                                                <div className="title is-6 mb-1 has-text-weight-semibold">
                                                        {stop.departure.actualTime ? t('train.departed') : t('train.departs')}
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
