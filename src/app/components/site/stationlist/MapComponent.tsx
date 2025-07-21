'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useTranslations } from 'next-intl';
import 'leaflet/dist/leaflet.css';

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

export default function MapComponent({ stations }: MapComponentProps) {
    const t = useTranslations();

    // Finland center coordinates
    const finlandCenter: [number, number] = [65.0, 26.0];

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
            <MapContainer
                center={finlandCenter}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {stations.map((station) => {
                    const [lon, lat] = station.geometry.coordinates;
                    return (
                        <CircleMarker
                            key={station.properties.stationUICCode}
                            center={[lat, lon]}
                            radius={6}
                            pathOptions={{
                                fillColor: '#00d1b2', // Bulma primary color
                                color: '#00d1b2',
                                weight: 2,
                                opacity: 1,
                                fillOpacity: 0.8
                            }}
                        >
                            <Popup>
                                <div>
                                    <strong>{station.properties.stationName}</strong><br />
                                    <small>Code: {station.properties.stationShortCode}</small><br />
                                    <small>UIC: {station.properties.stationUICCode}</small>
                                </div>
                            </Popup>
                        </CircleMarker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
