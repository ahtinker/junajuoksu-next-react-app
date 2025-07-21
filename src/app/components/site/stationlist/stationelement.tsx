"use client"

import { useLocale } from 'next-intl';
import stationTranslations from '../../../resources/station_translations.json';

interface Station {
    stationUICCode: number;
    stationName_fi: string;
    stationName_sv: string;
    stationName_en: string;
}

const getStationNameByLocale = (station: Station, locale: string): string => {
    switch (locale) {
        case 'fi':
            return station.stationName_fi;
        case 'sv':
            return station.stationName_sv;
        case 'en':
            return station.stationName_en;
        default:
            return station.stationName_fi;
    }
};

const StationElement = ({ stationUIC }: { stationUIC: string }) => {
    const currentLocale = useLocale();

    const getStationName = (uicCode: string) => {
        const station = stationTranslations.stations.find((station: Station) => station.stationUICCode.toString() === uicCode.toString());
        if (!station) return `Unknown Station (UIC=${uicCode})`;

        return (
            getStationNameByLocale(station, currentLocale) ||
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