'use client';

import { Drawer } from 'vaul';
import { useTranslations, useLocale } from 'next-intl';
import { useState, memo, useMemo, useEffect } from 'react';
import Link from 'next/link';
import TimetableList from '@/app/asema/[stationId]/components/TimeTableList';
import { TimeTableRow, Cause } from '../../../../lib/types';
import TrainCompositionView from './TrainCompositionView';
import { getStationGeolocations, calculateDistance, formatDistance } from '../../../../lib/stationGeolocations';

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

interface StationStopInfo {
    uicCode: number;
    shortCode: string;
    stationName: string;
    stopIndex: number;
    arrivalRow?: TimeTableRow;
    departureRow?: TimeTableRow;
}

interface TrainInfo {
    departureDate: string;
    trainNumber: number;
}

interface TrainPositionInfo {
    latitude: number | null;
    longitude: number | null;
    speed: number | null;
    timestamp: string | null;
}

interface StationStopDrawerProps {
    station: StationStopInfo | null;
    isOpen: boolean;
    onClose: () => void;
    trainInfo: TrainInfo;
    currentOriginUic?: number;
    currentOriginStopIndex?: number;
    currentOriginDepartureTime?: string;
    currentDestinationUic?: number;
    onSetAsDeparture?: (uicCode: number, stopIndex: number) => void;
    onSetAsDestination?: (uicCode: number) => void;
    trainPosition?: TrainPositionInfo | null;
    isTrainRunning?: boolean;
}

const StationStopDrawer = memo(function StationStopDrawer({
    station,
    isOpen,
    onClose,
    trainInfo,
    currentOriginUic,
    currentOriginStopIndex,
    currentOriginDepartureTime,
    currentDestinationUic,
    onSetAsDeparture,
    onSetAsDestination,
    trainPosition,
    isTrainRunning
}: StationStopDrawerProps) {
    const t = useTranslations();
    const locale = useLocale();

    // Snap points: first snap point shows header + buttons, second is fully open
    const snapPoints = ['400px', 1];
    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(snapPoints[1]);

    // State for showing only connecting trains or all trains
    const [showOnlyConnecting, setShowOnlyConnecting] = useState(true);

    // Composition state
    const [composition, setComposition] = useState<JourneySection | null>(null);
    const [compositionLoading, setCompositionLoading] = useState(false);
    const [compositionExpanded, setCompositionExpanded] = useState(false);

    // Cause codes state
    const [causeCategories, setCauseCategories] = useState<CauseCategory[]>([]);
    const [detailedCauseCategories, setDetailedCauseCategories] = useState<DetailedCauseCategory[]>([]);
    const [thirdCauseCategories, setThirdCauseCategories] = useState<ThirdCauseCategory[]>([]);

    // Station geolocation state
    const [stationGeolocation, setStationGeolocation] = useState<{ latitude: number; longitude: number } | null>(null);

    // Current time for countdown (updates every second)
    const [currentTime, setCurrentTime] = useState(new Date());

    // Fetch station geolocation when drawer opens
    useEffect(() => {
        if (!isOpen || !station) return;

        const fetchGeolocation = async () => {
            const geolocations = await getStationGeolocations();
            const geo = geolocations.get(station.uicCode);
            if (geo) {
                setStationGeolocation({ latitude: geo.latitude, longitude: geo.longitude });
            }
        };

        fetchGeolocation();
    }, [isOpen, station]);

    // Update current time every second for countdown
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen]);

    // Fetch cause codes
    useEffect(() => {
        const fetchCauseCodes = async () => {
            try {
                const [categoriesRes, detailedRes, thirdRes] = await Promise.all([
                    fetch('/cause-codes/cause-category-codes.json'),
                    fetch('/cause-codes/detailed-cause-category-codes.json'),
                    fetch('/cause-codes/third-cause-category-codes.json')
                ]);

                if (categoriesRes.ok) setCauseCategories(await categoriesRes.json());
                if (detailedRes.ok) setDetailedCauseCategories(await detailedRes.json());
                if (thirdRes.ok) setThirdCauseCategories(await thirdRes.json());
            } catch (err) {
                console.error('Error fetching cause codes:', err);
            }
        };
        fetchCauseCodes();
    }, []);

    // Fetch composition when drawer opens
    useEffect(() => {
        if (!isOpen || !station) return;

        const fetchComposition = async () => {
            try {
                setCompositionLoading(true);
                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/compositions/${trainInfo.departureDate}/${trainInfo.trainNumber}`
                );

                if (response.ok) {
                    const data = await response.json();
                    // Find the journey section that applies to this station
                    const sections = data.journeySections || [];
                    
                    // First, check if a composition change starts at this station
                    // (i.e., this station is the beginTimeTableRow of a section)
                    // This takes priority because we want to show the NEW composition
                    const sectionStartingHere = sections.find((section: JourneySection) => 
                        section.beginTimeTableRow.stationShortCode === station.shortCode
                    );
                    
                    if (sectionStartingHere) {
                        setComposition(sectionStartingHere);
                    } else {
                        // Otherwise, find the section where this station falls within the time range
                        let foundSection = null;
                        for (const section of sections) {
                            const beginTime = new Date(section.beginTimeTableRow.scheduledTime).getTime();
                            const endTime = new Date(section.endTimeTableRow.scheduledTime).getTime();

                            // Get the station's time
                            const stationTime = station.arrivalRow?.scheduledTime || station.departureRow?.scheduledTime;
                            if (stationTime) {
                                const stationTimeMs = new Date(stationTime).getTime();
                                if (stationTimeMs >= beginTime && stationTimeMs <= endTime) {
                                    foundSection = section;
                                    break;
                                }
                            }
                        }
                        
                        // If no matching section found, use the first one
                        if (foundSection) {
                            setComposition(foundSection);
                        } else if (sections.length > 0) {
                            setComposition(sections[0]);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching composition:', err);
            } finally {
                setCompositionLoading(false);
            }
        };

        fetchComposition();
    }, [isOpen, trainInfo.departureDate, trainInfo.trainNumber, station]);

    // Memoize stationData to prevent TimetableList from refetching on every render
    const stationData = useMemo(() => {
        if (!station) return null;
        return {
            uicCode: station.uicCode,
            shortCode: station.shortCode,
            name: station.stationName,
            translatedName: station.stationName
        };
    }, [station]);

    // Calculate the arrival time at this station for the current train
    const arrivalDateTime = useMemo(() => {
        if (!station?.arrivalRow && !station?.departureRow) return undefined;
        const row = station?.arrivalRow || station?.departureRow;
        if (!row) return undefined;
        const timeStr = row.actualTime || row.liveEstimateTime || row.scheduledTime;
        return timeStr ? new Date(timeStr) : undefined;
    }, [station?.arrivalRow, station?.departureRow]);

    // Helper function to format time
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

    // Helper function to format delay
    const formatDelaySeconds = (delaySeconds: number): string => {
        if (delaySeconds === 0) return '';
        const isEarly = delaySeconds < 0;
        const absSeconds = Math.abs(delaySeconds);

        if (absSeconds < 60) {
            return `${isEarly ? '-' : '+'}${absSeconds}s`;
        } else if (absSeconds < 3600) {
            const minutes = Math.floor(absSeconds / 60);
            const seconds = absSeconds % 60;
            return seconds > 0
                ? `${isEarly ? '-' : '+'}${minutes}m ${seconds}s`
                : `${isEarly ? '-' : '+'}${minutes}m`;
        } else {
            const hours = Math.floor(absSeconds / 3600);
            const minutes = Math.floor((absSeconds % 3600) / 60);
            let result = `${isEarly ? '-' : '+'}${hours}h`;
            if (minutes > 0) result += ` ${minutes}m`;
            return result;
        }
    };

    // Get time info with delay
    const getTimeInfo = (row?: TimeTableRow) => {
        if (!row) return null;
        const scheduledTime = formatTime(row.scheduledTime);
        const actualTime = row.actualTime ? formatTime(row.actualTime) : null;
        const liveTime = row.liveEstimateTime ? formatTime(row.liveEstimateTime) : null;
        const displayTime = actualTime || liveTime || scheduledTime;

        let delaySeconds = 0;
        if (row.actualTime || row.liveEstimateTime) {
            const scheduledDate = new Date(row.scheduledTime);
            const actualDate = new Date(row.actualTime || row.liveEstimateTime!);
            delaySeconds = Math.floor((actualDate.getTime() - scheduledDate.getTime()) / 1000);
        }

        return {
            displayTime,
            scheduledTime,
            delaySeconds,
            delayFormatted: formatDelaySeconds(delaySeconds),
            track: row.commercialTrack,
            isCancelled: row.cancelled
        };
    };

    // Helper function to get localized name
    const getLocalizedName = (name: LocalizedName): string => {
        const localeKey = locale as keyof LocalizedName;
        return name[localeKey] || name.fi;
    };

    // Helper function to get cause description
    const getCauseDescription = (cause: Cause): string => {
        if (cause.thirdCategoryCodeId) {
            const thirdCategory = thirdCauseCategories.find(c => c.id === cause.thirdCategoryCodeId);
            if (thirdCategory) return getLocalizedName(thirdCategory.thirdCategoryName);
        }
        if (cause.detailedCategoryCodeId) {
            const detailedCategory = detailedCauseCategories.find(c => c.id === cause.detailedCategoryCodeId);
            if (detailedCategory) return getLocalizedName(detailedCategory.detailedCategoryName);
        }
        const category = causeCategories.find(c => c.id === cause.categoryCodeId);
        if (category) return getLocalizedName(category.categoryName);
        return cause.categoryCode || 'Unknown cause';
    };

    // Get all causes for this station
    const getCauses = (): Cause[] => {
        if (!station) return [];
        const causes: Cause[] = [];
        if (station.arrivalRow?.causes) causes.push(...station.arrivalRow.causes);
        if (station.departureRow?.causes) causes.push(...station.departureRow.causes);
        return causes;
    };

    // Calculate tracking information
    const trackingInfo = useMemo(() => {
        if (!station || !isTrainRunning) return null;

        const now = currentTime.getTime();

        // Get arrival and departure times
        const arrivalRow = station.arrivalRow;
        const departureRow = station.departureRow;

        const arrivalTimeStr = arrivalRow?.actualTime || arrivalRow?.liveEstimateTime || arrivalRow?.scheduledTime;
        const departureTimeStr = departureRow?.actualTime || departureRow?.liveEstimateTime || departureRow?.scheduledTime;

        const arrivalTime = arrivalTimeStr ? new Date(arrivalTimeStr).getTime() : null;
        const departureTime = departureTimeStr ? new Date(departureTimeStr).getTime() : null;

        // Determine station status
        let isUpcoming = false;
        let isAtStation = false;
        let timeUntilMs: number | null = null;
        let timeUntilType: 'arrival' | 'departure' | null = null;

        if (arrivalTime && departureTime) {
            // Station has both arrival and departure
            if (now < arrivalTime) {
                // Train hasn't arrived yet
                isUpcoming = true;
                timeUntilMs = arrivalTime - now;
                timeUntilType = 'arrival';
            } else if (now >= arrivalTime && now < departureTime) {
                // Train is at the station
                isAtStation = true;
                timeUntilMs = departureTime - now;
                timeUntilType = 'departure';
            }
            // else: train has departed
        } else if (departureTime && !arrivalTime) {
            // First station (only departure)
            if (now < departureTime) {
                isAtStation = true;
                timeUntilMs = departureTime - now;
                timeUntilType = 'departure';
            }
        } else if (arrivalTime && !departureTime) {
            // Last station (only arrival)
            if (now < arrivalTime) {
                isUpcoming = true;
                timeUntilMs = arrivalTime - now;
                timeUntilType = 'arrival';
            } else {
                isAtStation = true; // Train has arrived at final destination
            }
        }

        // Calculate distance if train position and station geolocation are available
        // Show distance while approaching AND while at station (until departure is confirmed)
        let distance: number | null = null;
        let positionAge: number | null = null;

        if ((isUpcoming || isAtStation) && trainPosition?.latitude && trainPosition?.longitude && stationGeolocation) {
            distance = calculateDistance(
                trainPosition.latitude,
                trainPosition.longitude,
                stationGeolocation.latitude,
                stationGeolocation.longitude
            );

            if (trainPosition.timestamp) {
                positionAge = Math.floor((now - new Date(trainPosition.timestamp).getTime()) / 1000) + 1;
            }
        }

        // Check if departure has been confirmed (actualTime is set)
        const departureConfirmed = !!departureRow?.actualTime;

        // Hide tracking box only after departure is confirmed
        if (departureConfirmed) return null;
        if (!isUpcoming && !isAtStation) return null;

        return {
            isUpcoming,
            isAtStation,
            timeUntilMs,
            timeUntilType,
            distance,
            positionAge
        };
    }, [station, isTrainRunning, currentTime, trainPosition, stationGeolocation]);

    // Format time until as "x h, x min, x s"
    const formatTimeUntil = (ms: number): string => {
        if (ms <= 0) return '0 s';

        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts: string[] = [];
        if (hours > 0) parts.push(`${hours} h`);
        if (minutes > 0) parts.push(`${minutes} min`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds} s`);

        return parts.join(', ');
    };

    // Format position age
    const formatPositionAge = (seconds: number): string => {
        if (seconds < 60) {
            return `${seconds} s`;
        }
        const minutes = Math.floor(seconds / 60);
        return `${minutes} min`;
    };

    if (!station || !stationData) return null;

    const arrivalInfo = getTimeInfo(station.arrivalRow);
    const departureInfo = getTimeInfo(station.departureRow);
    const causes = getCauses();
    const track = departureInfo?.track || arrivalInfo?.track;

    // Build the URL for the train page with this station as the departure stop
    const buildDepartureStationUrl = () => {
        const parts = [
            trainInfo.departureDate,
            trainInfo.trainNumber.toString(),
            station.uicCode.toString(),
            station.stopIndex.toString()
        ];
        // Preserve current destination if set
        if (currentDestinationUic) {
            parts.push(currentDestinationUic.toString());
        }
        return `/train/${parts.join('-')}`;
    };

    // Build the URL for the train page with this station as the destination
    const buildDestinationStationUrl = () => {
        const parts = [
            trainInfo.departureDate,
            trainInfo.trainNumber.toString(),
            (currentOriginUic ?? station.uicCode).toString(),
            (currentOriginStopIndex ?? station.stopIndex).toString(),
            station.uicCode.toString()
        ];
        return `/train/${parts.join('-')}`;
    };

    const handleSetAsDeparture = () => {
        if (onSetAsDeparture) {
            onSetAsDeparture(station.uicCode, station.stopIndex);
        }
        onClose();
    };

    const handleSetAsDestination = () => {
        if (onSetAsDestination) {
            onSetAsDestination(station.uicCode);
        }
        onClose();
    };

    // Check if this station can be set as destination
    // It cannot be destination if:
    // 1. It's the same station and stop as the current origin
    // 2. It's before the current origin station (by scheduled time)
    const isCurrentOrigin = currentOriginUic === station.uicCode && currentOriginStopIndex === station.stopIndex;
    
    const isBeforeOrigin = (() => {
        if (!currentOriginDepartureTime) return false;
        
        // Get the scheduled time of this station's arrival (preferred) or departure
        const thisStationTime = station.arrivalRow?.scheduledTime || station.departureRow?.scheduledTime;
        if (!thisStationTime) return false;
        
        // Compare times - if this station's time is before or equal to origin's departure, it's "before"
        const thisTime = new Date(thisStationTime).getTime();
        const originTime = new Date(currentOriginDepartureTime).getTime();
        
        return thisTime <= originTime;
    })();
    
    const canSetAsDestination = !isCurrentOrigin && !isBeforeOrigin;

    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                    // Reset state when drawer closes
                    setShowOnlyConnecting(true);
                }
            }}
            dismissible={true}
            snapPoints={snapPoints}
            activeSnapPoint={activeSnapPoint}
            setActiveSnapPoint={setActiveSnapPoint}
        >
            <Drawer.Portal>
                <Drawer.Overlay
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        zIndex: 10001
                    }}
                />
                <Drawer.Content
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        height: '90vh',
                        flexDirection: 'column',
                        borderRadius: '10px 10px 0 0',
                        zIndex: 10002,
                        backgroundColor: 'var(--bulma-scheme-main)',
                        border: "1px solid var(--bulma-border)",
                        color: 'var(--bulma-text)',
                        width: '100%',
                        maxWidth: '600px',
                        margin: '0 auto',
                        textAlign: 'left'
                    }}
                >
                    {/* Fixed Header section - Station name only */}
                    <div style={{
                        padding: '1rem 1rem 1rem',
                        flexShrink: 0,
                        borderBottom: '1px solid var(--bulma-border-weak)'
                    }}>
                        {/* Handle bar */}
                        <div
                            style={{
                                width: '48px',
                                height: '6px',
                                backgroundColor: 'var(--bulma-text-weak)',
                                borderRadius: '3px',
                                margin: '0 auto 1rem',
                            }}
                        />
                        <Drawer.Title className="title is-4" style={{ color: 'var(--bulma-text-strong)', margin: 0 }}>
                            {station.stationName}
                        </Drawer.Title>
                    </div>

                    {/* Scrollable content */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '0 1rem 1rem 1rem',
                        marginTop: "1rem"
                    }}>
                        {/* Action buttons */}
                        <div className="buttons">
                            <Link
                                href={`/asema/${station.uicCode}`}
                                className="button is-primary"
                            >
                                <span className="icon">
                                    <i className="fas fa-clock"></i>
                                </span>
                                <span>{t('train.stationDrawer.openStationPage')}</span>
                            </Link>
                            <Link
                                href={buildDepartureStationUrl()}
                                className="button is-primary is-outlined"
                                onClick={handleSetAsDeparture}
                            >
                                <span className="icon">
                                    <i className="fas fa-sign-out-alt"></i>
                                </span>
                                <span>{t('train.stationDrawer.setAsDeparture')}</span>
                            </Link>
                            {canSetAsDestination ? (
                                <Link
                                    href={buildDestinationStationUrl()}
                                    className="button is-primary is-outlined"
                                    onClick={handleSetAsDestination}
                                >
                                    <span className="icon">
                                        <i className="fas fa-flag-checkered"></i>
                                    </span>
                                    <span>{t('train.stationDrawer.setAsDestination')}</span>
                                </Link>
                            ) : (
                                <button
                                    className="button is-primary is-outlined"
                                    disabled
                                    title={isCurrentOrigin ? t('train.stationDrawer.cannotDestinationSameAsOrigin') : t('train.stationDrawer.cannotDestinationBeforeOrigin')}
                                >
                                    <span className="icon">
                                        <i className="fas fa-flag-checkered"></i>
                                    </span>
                                    <span>{t('train.stationDrawer.setAsDestination')}</span>
                                </button>
                            )}
                        </div>

                        {/* Train tracking section - only shown when train is running and station is upcoming or current */}
                        {trackingInfo && (
                            <div className="box mt-4 mx-0 p-3" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                                <div className="is-flex is-align-items-center mb-2">
                                    <span className="icon has-text-primary">
                                        <i className="fas fa-location-arrow"></i>
                                    </span>
                                    <span className="has-text-weight-semibold ml-1">
                                        {trackingInfo.isAtStation
                                            ? t('train.stationDrawer.trainAtStation')
                                            : t('train.stationDrawer.trainApproaching')
                                        }
                                    </span>
                                </div>

                                <div className="columns is-mobile is-multiline">
                                    {/* Distance to station - shown while approaching and at station */}
                                    {(trackingInfo.isUpcoming || trackingInfo.isAtStation) && trackingInfo.distance !== null && (
                                        <div className="column is-narrow">
                                            <div className="has-text-weight-semibold is-size-7 mb-1">
                                                {t('train.stationDrawer.distanceToStation')}
                                            </div>
                                            <div className="is-size-5 has-text-weight-bold">
                                                {formatDistance(trackingInfo.distance)}
                                            </div>
                                            {trainPosition?.speed !== null && trainPosition?.speed !== undefined && (
                                                <div className="is-size-7 has-text-grey">
                                                    {t('train.stationDrawer.currentSpeed', { speed: trainPosition.speed })}
                                                </div>
                                            )}
                                            {trackingInfo.positionAge !== null && (
                                                <div className="is-size-7 has-text-grey">
                                                    {t('train.stationDrawer.positionAge', { age: formatPositionAge(trackingInfo.positionAge) })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Time until arrival/departure */}
                                    {trackingInfo.timeUntilMs !== null && trackingInfo.timeUntilMs > 0 && (
                                        <div className="column is-narrow">
                                            <div className="has-text-weight-semibold is-size-7 mb-1">
                                                {trackingInfo.timeUntilType === 'arrival'
                                                    ? t('train.stationDrawer.timeToArrival')
                                                    : t('train.stationDrawer.timeToDeparture')
                                                }
                                            </div>
                                            <div className="is-size-5 has-text-weight-bold">
                                                {formatTimeUntil(trackingInfo.timeUntilMs)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Arrival/Departure Times and Track */}
                        <div className="columns is-mobile mb-0 box  mx-0 p-1" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                            {track && (
                                <div className="column is-narrow">
                                    <div className="has-text-weight-semibold is-size-7 mb-1">{t('train.track')}</div>
                                    <div className="tag is-medium" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                                        {track}
                                    </div>
                                </div>
                            )}
                            {arrivalInfo && (
                                <div className="column is-narrow">
                                    <div className="has-text-weight-semibold is-size-7 mb-1">{t('train.arrives')}</div>
                                    <div className={arrivalInfo.delaySeconds > 0 ? 'has-text-danger' : arrivalInfo.delaySeconds < 0 ? 'has-text-success' : ''}>
                                        {arrivalInfo.displayTime}
                                    </div>
                                    {arrivalInfo.delaySeconds !== 0 && (
                                        <div className="is-size-7 has-text-grey">
                                            {arrivalInfo.scheduledTime} {arrivalInfo.delayFormatted}
                                        </div>
                                    )}
                                </div>
                            )}
                            {departureInfo && (
                                <div className="column is-narrow">
                                    <div className="has-text-weight-semibold is-size-7 mb-1">{t('train.departs')}</div>
                                    <div className={departureInfo.delaySeconds > 0 ? 'has-text-danger' : departureInfo.delaySeconds < 0 ? 'has-text-success' : ''}>
                                        {departureInfo.displayTime}
                                    </div>
                                    {departureInfo.delaySeconds !== 0 && (
                                        <div className="is-size-7 has-text-grey">
                                            {departureInfo.scheduledTime} {departureInfo.delayFormatted}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Warning messages / Causes */}
                        {causes.length > 0 && (
                            <div className="notification py-2 px-3 mt-3" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                                <div className="is-flex is-align-items-center mb-1">
                                    <span className="icon has-text-warning">
                                        <i className="fas fa-exclamation-triangle"></i>
                                    </span>
                                    <span className="has-text-weight-semibold ml-1">{t('train.exceptionCause')}</span>
                                </div>
                                {causes.map((cause, index) => (
                                    <div key={index} className="is-size-7">
                                        {getCauseDescription(cause)}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Train Composition Dropdown */}
                        <div className="mt-3">
                            <button
                                className="button is-ghost is-fullwidth is-justify-content-space-between"
                                onClick={() => setCompositionExpanded(!compositionExpanded)}
                                style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}
                            >
                                <span className="icon-text">
                                    <span className="icon">
                                        <i className="fas fa-train"></i>
                                    </span>
                                    <span>{t('train.composition')}</span>
                                </span>
                                <span className="icon">
                                    <i className={`fas fa-chevron-${compositionExpanded ? 'up' : 'down'}`}></i>
                                </span>
                            </button>
                            {compositionExpanded && (
                                <div className="p-3 box " style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                                    {compositionLoading ? (
                                        <div className="has-text-centered py-3">
                                            <span className="icon">
                                                <i className="fas fa-spinner fa-spin"></i>
                                            </span>
                                        </div>
                                    ) : composition ? (
                                        <TrainCompositionView
                                            section={composition}
                                            translations={{
                                                playground: t('train.wagonFeatures.playground'),
                                                pet: t('train.wagonFeatures.pet'),
                                                catering: t('train.wagonFeatures.catering'),
                                                disabled: t('train.wagonFeatures.disabled'),
                                                wagons: t('train.wagons'),
                                                maxSpeed: t('train.maxSpeed')
                                            }}
                                        />
                                    ) : (
                                        <div className="has-text-grey has-text-centered py-2">
                                            {t('train.noComposition')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>


                        {/* Connecting trains header */}
                        <div className="my-4">
                            <div className="is-flex is-gap-2">
                                <p className="has-text-weight-semibold">
                                    {showOnlyConnecting
                                        ? t('train.stationDrawer.connectingTrains')
                                        : t('train.stationDrawer.allTrains')
                                    }
                                </p>
                                <button
                                    className="button is-small is-ghost"
                                    onClick={() => setShowOnlyConnecting(!showOnlyConnecting)}
                                >
                                    <span className="icon is-small">
                                        <i className={`fas ${showOnlyConnecting ? 'fa-clock' : 'fa-link'}`}></i>
                                    </span>
                                    <span>
                                        {showOnlyConnecting
                                            ? t('train.stationDrawer.showAllTrains')
                                            : t('train.stationDrawer.showConnectingOnly')
                                        }
                                    </span>
                                </button>
                            </div>
                            {showOnlyConnecting && arrivalDateTime && (
                                <p className="is-size-7 has-text-grey mt-1">
                                    {t('train.stationDrawer.trainsAfter', {
                                        time: arrivalDateTime.toLocaleTimeString(locale, {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })
                                    })}
                                </p>
                            )}
                        </div>

                        {/* Train timetables */}
                        <TimetableList
                            stationData={stationData}
                            hideTop={true}
                            selectedDateTime={showOnlyConnecting ? arrivalDateTime : undefined}
                            isRealtime={!showOnlyConnecting}
                        />
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
});

export default StationStopDrawer;