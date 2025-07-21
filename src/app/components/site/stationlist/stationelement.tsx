"use client"

import { useLocale } from 'next-intl';
import stationTranslations from '../../../resources/station_translations.json';

const StationElement = ({ stationUIC }: { stationUIC: string }) => {
    const currentLocale = useLocale();

    const getStationName = (uicCode: string) => {
        const station = stationTranslations.stations.find((station: any) => station.stationUICCode.toString() === uicCode.toString());
        if (!station) return `Unknown Station (UIC=${uicCode})`;

        return (
            (station as any)[`stationName_${currentLocale}`] ||
            station.stationName_fi ||
            station.stationName_sv ||
            station.stationName_en ||
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