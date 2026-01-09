'use client';

import { Drawer } from 'vaul';
import { useTranslations, useLocale } from 'next-intl';
import { useState, memo, useMemo } from 'react';
import Link from 'next/link';
import TimetableList from '@/app/station/[stationId]/components/TimeTableList';
import { TimeTableRow } from '../../../../lib/types';

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
    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(snapPoints[0]);

    // State for showing only connecting trains or all trains
    const [showOnlyConnecting, setShowOnlyConnecting] = useState(true);

    // Memoize stationData to prevent TimetableList from refetching on every render
    const stationData = useMemo(() => {
        if (!station) return null;
        return {
            uicCode: station.uicCode,
            shortCode: station.shortCode,
            name: station.stationName,
            translatedName: station.stationName
        };
    }, [station?.uicCode, station?.shortCode, station?.stationName]);

    // Calculate the arrival time at this station for the current train
    // Use the best available time (actual > liveEstimate > scheduled)
    const arrivalDateTime = useMemo(() => {
        if (!station?.arrivalRow && !station?.departureRow) return undefined;

        const row = station?.arrivalRow || station?.departureRow;
        if (!row) return undefined;

        const timeStr = row.actualTime || row.liveEstimateTime || row.scheduledTime;
        return timeStr ? new Date(timeStr) : undefined;
    }, [station?.arrivalRow, station?.departureRow]);

    if (!station || !stationData) return null;

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
                    {/* Header section */}
                    <div style={{
                        padding: '1rem',
                        flexShrink: 0
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

                        {/* Action buttons */}
                        <div className="buttons mt-4">
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
                                className="button is-info"
                                onClick={handleSetAsHighlighted}
                            >
                                <span className="icon">
                                    <i className="fas fa-star"></i>
                                </span>
                                <span>{t('train.stationDrawer.setAsHighlighted')}</span>
                            </Link>
                        </div>

                        {/* Connecting trains info */}
                        <div className="mt-4">
                            <div className="is-flex is-align-items-center is-justify-content-space-between">
                                <p className="has-text-weight-semibold">
                                    {showOnlyConnecting
                                        ? t('train.stationDrawer.connectingTrains')
                                        : t('train.stationDrawer.allTrains')
                                    }
                                </p>
                                <button
                                    className="button is-small is-outlined"
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
                    </div>

                    {/* Scrollable content - Train timetables */}
                    <div style={{
                        flex: 1,
                        overflowY: activeSnapPoint === snapPoints[1] ? 'scroll' : 'hidden',
                        padding: '0 1rem 1rem'
                    }}>
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