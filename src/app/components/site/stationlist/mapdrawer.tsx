'use client';

import { Drawer } from 'vaul';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the Map component to avoid SSR issues
const MapWithNoSSR = dynamic(() => import('./MapComponent'), {
    ssr: false,
    loading: () => <p style={{ textAlign: 'center', padding: '2rem' }}>Loading map...</p>
});

interface StationFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        passengerTraffic: boolean;
        type: 'STATION';
        stationName: string;
        stationShortCode: string;
        stationUICCode: number;
        countryCode: string;
    };
}

export default function MapDrawer() {
    const t = useTranslations();
    const [stations, setStations] = useState<StationFeature[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const fetchStations = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations.geojson');
            const data = await response.json();

            // Filter to only passenger stations
            const passengerStations = data.features.filter(
                (station: StationFeature) => station.properties.passengerTraffic
            );
            setStations(passengerStations);
        } catch (err) {
            setError('Failed to load station data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open && stations.length === 0 && !isLoading) {
            fetchStations();
        }
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={handleOpenChange} dismissible={false}>
            <Drawer.Trigger
                style={{
                    position: 'relative',
                    width: '100%',
                    borderWidth: "none !important",
                }}
            >
                <div className="button is-primary is-fullwidth mr-1 px-1">
                    <span className="icon">
                        <i className="fas fa-map" aria-hidden="true"></i>
                    </span>
                    <span>
                        {t('stationList.map')}
                    </span>
                </div>
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)' }} />
                <Drawer.Content
                    style={{
                        backgroundColor: 'var(--bulma-background)',
                        display: 'flex',
                        flexDirection: 'column',
                        borderTopLeftRadius: '10px',
                        borderTopRightRadius: '10px',
                        marginTop: '1rem',
                        height: '90%',
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        outline: 'none',
                    }}
                >
                    {/* Header with minimal padding */}
                    <div style={{
                        padding: '0.5rem',
                        backgroundColor: 'var(--bulma-background)',
                        borderTopLeftRadius: '10px',
                        borderTopRightRadius: '10px',
                        flexShrink: 0,
                        position: 'relative'
                    }}>
                        <div
                            aria-hidden
                            style={{
                                margin: '0 auto',
                                width: '3rem',
                                height: '0.25rem',
                                borderRadius: '9999px',
                                backgroundColor: 'transparent',
                                marginBottom: '0.5rem',
                            }}
                        />
                        <Drawer.Title style={{
                            fontWeight: 500,
                            textAlign: 'center',
                            fontSize: '1rem',
                            margin: 0
                        }}>
                            {t('stationList.mapDrawer.title')}
                        </Drawer.Title>

                        {/* Close button */}
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '0.5rem',
                                right: '0.5rem',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--bulma-text)',
                                fontSize: '1.2rem'
                            }}
                            aria-label="Close map"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    {/* Map container that fills the rest of the space */}
                    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                        {isLoading ? (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '100%',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <i className="fas fa-spinner fa-spin fa-2x"></i>
                                <p>{t('stationList.mapDrawer.loadingStations')}</p>
                            </div>
                        ) : error ? (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '100%',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <i className="fas fa-exclamation-triangle fa-2x" style={{ color: 'red' }}></i>
                                <p style={{ color: 'red' }}>
                                    {t('stationList.mapDrawer.errorLoading')}: {error}
                                </p>
                            </div>
                        ) : (
                            <>
                                <MapWithNoSSR stations={stations} />
                                {/* Station count overlay */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '1rem',
                                    right: '1rem',
                                    backgroundColor: 'rgba(0, 209, 178, 0.9)',
                                    color: 'white',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '20px',
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                }}>
                                    {t('stationList.mapDrawer.stationCount').replace('%count%', stations.length.toString())}
                                </div>
                            </>
                        )}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}