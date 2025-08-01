'use client';

import { Drawer } from 'vaul';
import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';
import StationElement from './stationelement';
import { getTranslatedStationNameWithFallback, type StationFeature } from '../../../../lib/stationUtils';
import TimetableList from '@/app/station/[stationId]/components/TimeTableList';

interface StationDetailsDrawerProps {
    station: StationFeature | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function StationDetailsDrawer({ station, isOpen, onClose }: StationDetailsDrawerProps) {
    const t = useTranslations();
    const locale = useLocale();

    // Snap points: first snap point shows header + button, second is fully open
    const snapPoints = ['400px', 1];
    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(snapPoints[0]);

    if (!station) return null;

    // Note: station coordinates not used in this drawer

    const translatedStationName = getTranslatedStationNameWithFallback(
        station.properties.stationUICCode,
        locale,
        station.properties.stationName
    );

    const stationData = {
        uicCode: station.properties.stationUICCode,
        shortCode: station.properties.stationShortCode,
        name: station.properties.stationName,
        translatedName: translatedStationName
    }

    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={onClose}
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
                        height: '90vh', // Increased height
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
                            {translatedStationName}
                        </Drawer.Title>
                        <p className="my-4">{t('stationList.mapDrawer.openTimetable')}</p>
                        <StationElement stationUIC={station.properties.stationUICCode.toString()} />
                    </div>

                    {/* Scrollable content */}
                    <div style={{
                        flex: 1,
                        overflowY: activeSnapPoint === snapPoints[1] ? 'scroll' : 'hidden',
                        padding: '0 1rem 1rem'
                    }}>
                        <TimetableList stationData={stationData} hideTop={true} />
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
