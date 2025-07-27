"use client"

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import { useState } from 'react';
import StationDetailsDrawer from './stationdetailsdrawer';

const StationElement = ({ stationUIC, shortCode, popup = false }: { stationUIC: string, shortCode?: string, popup?: boolean }) => {
    const currentLocale = useLocale();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const getStationName = (uicCode: string) => {
        const uicNumber = parseInt(uicCode);
        if (isNaN(uicNumber)) {
            return `Unknown Station (UIC=${uicCode})`;
        }

        return getTranslatedStationNameWithFallback(
            uicNumber,
            currentLocale, 
            `Unknown Station (UIC=${uicCode})`
        );
    };

    const handleClick = () => {
        if (popup) {
            setIsDrawerOpen(true);
        }
    };

    // Create station feature object for the drawer
    const stationFeature = {
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [0, 0] as [number, number] // Coordinates not used in drawer
        },
        properties: {
            passengerTraffic: true,
            type: 'STATION' as const,
            stationName: getStationName(stationUIC),
            stationShortCode: shortCode || stationUIC, // Use shortCode if provided, fallback to UIC
            stationUICCode: parseInt(stationUIC),
            countryCode: 'FI'
        }
    };

    const buttonContent = (
        <>
            <span className="icon mr-2">
                <i className={`fa-solid ${popup ? 'fa-chevron-up' : 'fa-arrow-up-right-from-square'}`} style={{ opacity: 0.4 }}></i>
            </span>
            <span className="station-info">
                <strong>{getStationName(stationUIC)}</strong>
            </span>
        </>
    );

    return (
        <>
            {popup ? (
                <button
                    className={`button is-fullwidth`}
                    style={{ justifyContent: "left" }}
                    onClick={handleClick}
                >
                    {buttonContent}
                </button>
            ) : (
                    <Link
                        href={`/station/${stationUIC}`}
                        target="_blank"
                        className={`button is-fullwidth`}
                        style={{ justifyContent: "left" }}
                    >
                    {buttonContent}
                </Link>
            )}

            {popup && (
                <StationDetailsDrawer
                    station={stationFeature}
                    isOpen={isDrawerOpen}
                    onClose={() => setIsDrawerOpen(false)}
                />
            )}
        </>
    );
}

export default StationElement;