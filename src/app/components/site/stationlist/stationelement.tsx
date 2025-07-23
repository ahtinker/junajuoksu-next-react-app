"use client"

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import { useState } from 'react';

const StationElement = ({ stationUIC }: { stationUIC: string }) => {
    const currentLocale = useLocale();
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
        setIsLoading(true);
    };

    return (
        <Link
            href={`/station/${stationUIC}`}
            className={`button is-fullwidth ${isLoading ? 'is-loading' : ''}`}
            style={{ justifyContent: "left" }}
            onClick={handleClick}
        >
            <span className="icon mr-2">
                <i className="fa-solid fa-arrow-up-right-from-square" style={{ opacity: 0.4 }}></i>
            </span>
            <span className="station-info">
                <strong>{getStationName(stationUIC)}</strong>
            </span>
        </Link >
    );
}

export default StationElement;