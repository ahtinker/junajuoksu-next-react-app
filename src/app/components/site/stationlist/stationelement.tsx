"use client"

import { useLocale } from 'next-intl';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';

const StationElement = ({ stationUIC }: { stationUIC: string }) => {
    const currentLocale = useLocale();

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

    return (
        <div className="button is-fullwidth" style={{ justifyContent: "left" }}>
            <span className="panel-icon">
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
            </span>
            <span className="station-info">
                <strong>{getStationName(stationUIC)}</strong>
            </span>
        </div>
    );
}

export default StationElement;