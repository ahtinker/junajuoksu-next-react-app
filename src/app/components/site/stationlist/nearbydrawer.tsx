'use client';

import { Drawer } from 'vaul';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function VaulDrawer() {
    const t = useTranslations();
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by this browser.');
            return;
        }

        setIsLocating(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                setIsLocating(false);
            },
            (error) => {
                setError(error.message);
                setIsLocating(false);
            }
        );
    };

    const handleOpenChange = (open: boolean) => {
        if (open && !location && !isLocating && !error) {
            requestLocation();
        }
    };
    return (
        <Drawer.Root onOpenChange={handleOpenChange}>
            <Drawer.Trigger
                style={{
                    position: 'relative',
                    width: '100%',
                    borderWidth: "none !important",
                }}
            >
                <div className="button is-primary is-fullwidth ml-2 px-1">
                    <span className="icon">
                        <i className="fas fa-location-dot" aria-hidden="true"></i>
                    </span>
                    <span>
                        {t('stationList.nearestStation')}
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
                        marginTop: '6rem',
                        height: 'fit-content',
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        outline: 'none',
                    }}
                >
                    <div style={{ padding: '1rem', backgroundColor: 'var(--bulma-background)', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', flex: 1 }}>
                        <div
                            aria-hidden
                            style={{
                                margin: '0 auto',
                                width: '3rem',
                                height: '0.375rem',
                                flexShrink: 0,
                                borderRadius: '9999px',
                                backgroundColor: 'var(--bulma-text-weak)',
                                marginBottom: '2rem',
                            }}
                        />
                        <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
                            {isLocating ? (
                                <>
                                    <Drawer.Title style={{ fontWeight: 500, marginBottom: '1rem' }}>
                                        {t('stationList.nearbyDrawer.Locating')}
                                    </Drawer.Title>
                                    <p style={{ marginBottom: '0.5rem' }}>
                                        {t('stationList.nearbyDrawer.PleaseWait')}
                                    </p>
                                </>
                            ) : location ? (
                                <>
                                    <Drawer.Title style={{ fontWeight: 500, marginBottom: '1rem' }}>
                                        {t('stationList.nearbyDrawer.LocationFound')}
                                    </Drawer.Title>
                                    <p style={{ marginBottom: '0.5rem' }}>
                                        <strong>Latitude:</strong> {location.latitude.toFixed(6)}
                                    </p>
                                    <p style={{ marginBottom: '0.5rem' }}>
                                        <strong>Longitude:</strong> {location.longitude.toFixed(6)}
                                    </p>
                                </>
                            ) : error ? (
                                <>
                                    <Drawer.Title style={{ fontWeight: 500, marginBottom: '1rem' }}>
                                        {t('stationList.nearbyDrawer.LocationError')}
                                    </Drawer.Title>
                                    <p style={{ marginBottom: '0.5rem' }}>
                                        {t('stationList.nearbyDrawer.ErrorMessage')}: {error}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Drawer.Title style={{ fontWeight: 500, marginBottom: '1rem' }}>
                                        {t('stationList.nearbyDrawer.PleaseAcceptLocation')}
                                    </Drawer.Title>
                                    <p style={{ marginBottom: '0.5rem' }}>
                                        {t('stationList.nearbyDrawer.Explanation')}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}