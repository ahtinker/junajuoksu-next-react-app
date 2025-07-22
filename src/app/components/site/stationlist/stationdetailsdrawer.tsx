'use client';

import { Drawer } from 'vaul';
import { useTranslations, useLocale } from 'next-intl';
import StationElement from './stationelement';
import { getTranslatedStationNameWithFallback, type StationFeature } from '../../../../lib/stationUtils';

interface StationDetailsDrawerProps {
    station: StationFeature | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function StationDetailsDrawer({ station, isOpen, onClose }: StationDetailsDrawerProps) {
    const t = useTranslations();
    const locale = useLocale();

    if (!station) return null;

    // Note: station coordinates not used in this drawer

    const translatedStationName = getTranslatedStationNameWithFallback(
        station.properties.stationUICCode,
        locale,
        station.properties.stationName
    );

    // Debug log
    console.log('StationDetailsDrawer render:', { isOpen, station: station?.properties.stationName });

    return (
        <Drawer.Root open={isOpen} onOpenChange={onClose} dismissible={true}>
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
                        height: '60vh',
                        flexDirection: 'column',
                        borderRadius: '10px 10px 0 0',
                        zIndex: 10002,
                        backgroundColor: 'var(--bulma-background)',
                        color: 'var(--bulma-text)',
                        width: '100%',
                        maxWidth: '600px',
                        margin: '0 auto'
                    }}
                >
                    <div style={{
                        flex: 1,
                        borderRadius: '10px 10px 0 0',
                        padding: '1rem'
                    }}>
                        {/* Handle bar */}
                        <div
                            style={{
                                width: '48px',
                                height: '6px',
                                backgroundColor: 'var(--bulma-text-weak)',
                                borderRadius: '3px',
                                margin: 'auto',
                                flexShrink: 0
                            }}
                        />

                        {/* Header with close button */}
                        <div style={{
                            alignItems: 'center',
                            marginBottom: '1rem'
                        }}>
                            <Drawer.Title className="title is-4 my-5" style={{ color: 'var(--bulma-text)', margin: 0 }}>
                                {translatedStationName}
                            </Drawer.Title>
                            <p className="mb-4">{t('stationList.mapDrawer.openTimetable')}</p>
                            <StationElement stationUIC={station.properties.stationUICCode.toString()} />
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
