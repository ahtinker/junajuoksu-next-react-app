'use client';

import { Drawer } from 'vaul';
import { useTranslations, useLocale } from 'next-intl';
import { useState, memo, useMemo, useEffect } from 'react';
import Link from 'next/link';
import TimetableList from '@/app/station/[stationId]/components/TimeTableList';
import { TimeTableRow, Cause } from '../../../../lib/types';
import TrainCompositionView from './TrainCompositionView';

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

interface StationStopDrawerProps {
    station: StationStopInfo | null;
    isOpen: boolean;
    onClose: () => void;
    trainInfo: TrainInfo;
    onSetAsHighlightedStation?: (uicCode: number, stopIndex: number) => void;
}

const StationStopDrawer = memo(function StationStopDrawer({
    station,
    isOpen,
    onClose,
    trainInfo,
    onSetAsHighlightedStation
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

    if (!station || !stationData) return null;

    const arrivalInfo = getTimeInfo(station.arrivalRow);
    const departureInfo = getTimeInfo(station.departureRow);
    const causes = getCauses();
    const track = departureInfo?.track || arrivalInfo?.track;

    // Build the URL for the train page with this station as the highlighted stop
    const buildHighlightedStationUrl = () => {
        const parts = [
            trainInfo.departureDate,
            trainInfo.trainNumber.toString(),
            station.uicCode.toString(),
            station.stopIndex.toString()
        ];
        return `/train/${parts.join('-')}`;
    };

    const handleSetAsHighlighted = () => {
        if (onSetAsHighlightedStation) {
            onSetAsHighlightedStation(station.uicCode, station.stopIndex);
        }
        onClose();
    };

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
                                href={`/station/${station.uicCode}`}
                                className="button is-primary"
                            >
                                <span className="icon">
                                    <i className="fas fa-clock"></i>
                                </span>
                                <span>{t('train.stationDrawer.openStationPage')}</span>
                            </Link>
                            <Link
                                href={buildHighlightedStationUrl()}
                                className="button is-primary is-outlined"
                                onClick={handleSetAsHighlighted}
                            >
                                <span className="icon">
                                    <i className="fas fa-star"></i>
                                </span>
                                <span>{t('train.stationDrawer.setAsHighlighted')}</span>
                            </Link>
                        </div>

                        {/* Arrival/Departure Times and Track */}
                        <div className="columns is-mobile mt-4 mb-0 box is-shadowless mx-0 p-1" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
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
                                <div className="p-3 box is-shadowless" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
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