'use client';

import { MapContainer, TileLayer, CircleMarker, useMapEvents, Marker } from 'react-leaflet';
import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import L from 'leaflet';
import StationDetailsDrawer from './stationdetailsdrawer';
import stationTranslations from '../../../resources/station_translations.json';
import 'leaflet/dist/leaflet.css';

// Component to handle map events
function MapEvents({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
    useMapEvents({
        zoomend: (e) => {
            onZoomChange(e.target.getZoom());
        },
    });
    return null;
}

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

interface MapComponentProps {
    stations: StationFeature[];
}

// Declare global window interface for station click handler
declare global {
  interface Window { handleStationNameClick?: (stationUICCode: number) => void; }
}

export default function MapComponent({ stations }: MapComponentProps) {
    const locale = useLocale();
    const [zoomLevel, setZoomLevel] = useState(5);
    const [isDarkTheme, setIsDarkTheme] = useState(false);
    const [selectedStation, setSelectedStation] = useState<StationFeature | null>(null);
    const [isStationDrawerOpen, setIsStationDrawerOpen] = useState(false);

    // Finland center coordinates
    const finlandCenter: [number, number] = [65.0, 26.0];

    // Show station names when zoomed in enough
    const showStationNames = zoomLevel >= 10;

    // Function to get translated station name
    const getTranslatedStationName = (stationUICCode: number): string => {
        const translation = stationTranslations.stations.find(
            station => station.stationUICCode === stationUICCode
        );

        if (!translation) {
            // Fallback to the original station name from API
            const station = stations.find(s => s.properties.stationUICCode === stationUICCode);
            return station?.properties.stationName || '';
        }

        // Get name based on current locale with fallback priority
        const localeKey = `stationName_${locale}` as keyof typeof translation;
        let stationName = String(translation[localeKey] || '');

        // Fallback hierarchy: current locale -> Finnish -> Swedish -> English -> original API name
        if (!stationName || stationName.trim() === '') {
            stationName = String(translation.stationName_fi || '');
        }
        if (!stationName || stationName.trim() === '') {
            stationName = String(translation.stationName_sv || '');
        }
        if (!stationName || stationName.trim() === '') {
            stationName = String(translation.stationName_en || '');
        }
        if (!stationName || stationName.trim() === '') {
            // Final fallback to API name
            const station = stations.find(s => s.properties.stationUICCode === stationUICCode);
            stationName = station?.properties.stationName || '';
        }

        return stationName;
    };

    // Handle station click
    const handleStationClick = (station: StationFeature) => {
        setSelectedStation(station);
        setIsStationDrawerOpen(true);
    };

    // Handle drawer close
    const handleDrawerClose = () => {
        setIsStationDrawerOpen(false);
        setSelectedStation(null);
    };

    // Detect theme changes
    useEffect(() => {
        const detectTheme = () => {
            const htmlElement = document.documentElement;
            const isDark = htmlElement.getAttribute('data-theme') === 'dark' ||
                htmlElement.classList.contains('theme-dark') ||
                window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDarkTheme(isDark);
        };

        // Initial detection
        detectTheme();

        // Watch for theme changes
        const observer = new MutationObserver(detectTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme', 'class']
        });

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', detectTheme);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener('change', detectTheme);
        };
    }, []);

    // Set up global function for station name clicks
    useEffect(() => {
        window.handleStationNameClick = (stationUICCode: number) => {
            const station = stations.find(s => s.properties.stationUICCode === stationUICCode);
            if (station) handleStationClick(station);
        };
        return () => { delete window.handleStationNameClick; };
    }, [stations]);

    // Choose tile layer based on theme
    const tileLayerConfig = isDarkTheme
        ? {
            url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }
        : {
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        };

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
            <style jsx>{`
                :global(.station-label) {
                    background: transparent !important;
                    border: none !important;
                }
            `}</style>
            <MapContainer
                center={finlandCenter}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
            >
                <MapEvents onZoomChange={setZoomLevel} />
                <TileLayer
                    url={tileLayerConfig.url}
                    attribution={tileLayerConfig.attribution}
                />

                {stations.map((station) => {
                    const [lon, lat] = station.geometry.coordinates;
                    const translatedName = getTranslatedStationName(station.properties.stationUICCode);

                    // Create a custom icon for station name labels
                    const stationNameIcon = showStationNames ? L.divIcon({
                        html: `<div style="
                            font-size: 11px;
                            font-weight: bold;
                            color: var(--bulma-color);
                            background-color: var(--bulma-background);
                            padding: 2px 6px;
                            border-radius: 3px;
                            border: 1px solid #ccc;
                            white-space: nowrap;
                            display: inline-block;
                            box-sizing: border-box;
                            cursor: pointer;
                            margin-left: 1rem;
                        ">${translatedName}</div>`,
                        className: 'station-label',
                        iconSize: [120, 20],
                        iconAnchor: [0, 10]
                    }) : undefined;

                    return (
                        <div key={station.properties.stationUICCode}>
                            <CircleMarker
                                center={[lat, lon]}
                                radius={6}
                                pathOptions={{
                                    fillColor: 'var(--bulma-primary)',
                                    color: 'var(--bulma-primary)',
                                    weight: 2,
                                    opacity: 1,
                                    fillOpacity: 0.8
                                }}
                                eventHandlers={{
                                    click: () => handleStationClick(station)
                                }}
                            >
                                {/* Popup removed to prevent popup on click */}
                            </CircleMarker>
                            {showStationNames && stationNameIcon && (
                                <Marker
                                    position={[lat, lon]}
                                    icon={stationNameIcon}
                                    eventHandlers={{ click: () => handleStationClick(station) }}
                                />
                            )}
                        </div>
                    );
                })}
            </MapContainer>

            <StationDetailsDrawer
                station={selectedStation}
                isOpen={isStationDrawerOpen}
                onClose={handleDrawerClose}
            />
        </div>
    );
}
