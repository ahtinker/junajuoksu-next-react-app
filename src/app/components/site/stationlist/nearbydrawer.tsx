'use client';

import { Drawer } from 'vaul';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import StationElement from './stationelement';

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

interface NearbyStation {
    uicCode: number;
    name: string;
    distance: number;
}

export default function NearbyDrawer() {
    const t = useTranslations();
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
    const [isLoadingStations, setIsLoadingStations] = useState(false);

    // Calculate distance between two points using Haversine formula
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const findNearbyStations = async (userLat: number, userLon: number) => {
        setIsLoadingStations(true);
        try {
            const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations.geojson');
            const data = await response.json();
            
            // Filter passenger stations and calculate distances
            const stationsWithDistance = data.features
                .filter((station: StationFeature) => station.properties.passengerTraffic)
                .map((station: StationFeature) => {
                    const [stationLon, stationLat] = station.geometry.coordinates;
                    const distance = calculateDistance(userLat, userLon, stationLat, stationLon);
                    
                    return {
                        uicCode: station.properties.stationUICCode,
                        name: station.properties.stationName,
                        distance: distance
                    };
                })
                .sort((a: NearbyStation, b: NearbyStation) => a.distance - b.distance)
                .slice(0, 3); // Get 3 closest stations
            
            setNearbyStations(stationsWithDistance);
        } catch {
            setError('Failed to fetch station data');
        } finally {
            setIsLoadingStations(false);
        }
    };

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by this browser.');
            return;
        }

        setIsLocating(true);
        setError(null);
        setNearbyStations([]);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                setLocation({
                    latitude: lat,
                    longitude: lon
                });
                setIsLocating(false);
                findNearbyStations(lat, lon);
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
                <div className="button is-primary is-fullwidth px-1 is-outlined">
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
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        height: 'fit-content',
                        flexDirection: 'column',
                        minHeight: '40vh',
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
                    <div style={{ padding: '1rem', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', flex: 1 }}>
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
                                        {t('stationList.nearbyDrawer.PleaseAcceptLocation')}
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
                                    
                                    {isLoadingStations ? (
                                        <p style={{ marginBottom: '1rem', textAlign: 'center' }}>
                                                <i className="fas fa-spinner fa-spin"></i> {t('stationList.nearbyDrawer.LoadingStations')}
                                        </p>
                                    ) : nearbyStations.length > 0 ? (
                                        <div style={{ marginBottom: '1rem' }}>
                                                    <h4 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('stationList.nearbyDrawer.NearestStations')}</h4>
                                            {nearbyStations.map((station) => (
                                                <div key={station.uicCode} style={{ marginBottom: '0.5rem' }}>
                                                    <StationElement stationUIC={station.uicCode.toString()} />
                                                    <p style={{ fontSize: '0.875rem', color: 'gray', marginTop: '0.25rem' }}>
                                                        {station.distance.toFixed(1)} {t('stationList.nearbyDrawer.KmAway')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ marginBottom: '0.5rem' }}>
                                                        {t('stationList.nearbyDrawer.NoNearbyStations')}
                                        </p>
                                    )}
                                    
                                    <details style={{ marginTop: '1rem' }}>
                                        <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                                                {t('stationList.nearbyDrawer.YourLocationDetails')}
                                        </summary>
                                        <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                                <strong>LAT:</strong> {location.latitude.toFixed(6)}
                                        </p>
                                        <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                                <strong>LON:</strong> {location.longitude.toFixed(6)}
                                            </p>
                                            <p>
                                                {t('stationList.nearbyDrawer.PrivacyNotice')}
                                        </p>
                                    </details>
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
                                                    {t('stationList.nearbyDrawer.PleaseWait')}
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