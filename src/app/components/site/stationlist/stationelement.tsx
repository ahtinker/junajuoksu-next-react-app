"use client"

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import { useState } from 'react';
import StationDetailsDrawer from './stationdetailsdrawer';

const StationElement = ({ stationUIC, shortCode, popup = false, target = "_blank", disabled = false, icon = "fas fa-arrow-up-right-from-square" }: { stationUIC: string, shortCode?: string, popup?: boolean, target?: string, disabled?: boolean, icon?: string }) => {
    const currentLocale = useLocale();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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

    const handleLinkClick = () => {
        if (target !== "_blank") {
            setIsLoading(true);
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
                <i className={`${popup ? 'fas fa-chevron-up' : icon}`} style={{ opacity: 0.4 }}></i>
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
                    disabled={disabled}
                >
                    {buttonContent}
                </button>
            ) : (
                    <Link
                        href={`/station/${stationUIC}`}
                        target={target}
                        className={`button is-fullwidth ${target !== "_blank" && isLoading ? 'is-loading' : ''} ${disabled ? 'is-static' : ''}`}
                        style={{ justifyContent: "left" }}
                        onClick={disabled ? undefined : handleLinkClick}
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