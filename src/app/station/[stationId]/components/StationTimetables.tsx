'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { getTranslatedStationNameWithFallback, Station } from '../../../../lib/stationUtils';
import stationTranslations from '../../../resources/station_translations.json';
import TimetableList from './TimeTableList'
import styles from './StationTimetables.module.css';

interface StationTimetablesProps {
    stationId: string;
}

interface StationData {
    uicCode: number;
    shortCode: string;
    name: string;
    translatedName: string;
}

export default function StationTimetables({ stationId }: StationTimetablesProps) {
    const t = useTranslations();
    const locale = useLocale();
    const [stationData, setStationData] = useState<StationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const findStation = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // First, try to fetch station data from the API
                const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations.geojson');
                const data = await response.json();

                let foundStation = null;

                // Try to find station by different criteria
                for (const station of data.features) {
                    const props = station.properties;

                    // Check if it matches UIC code (numeric)
                    if (!isNaN(Number(stationId)) && props.stationUICCode === Number(stationId)) {
                        foundStation = props;
                        break;
                    }

                    // Check if it matches short code (case insensitive)
                    if (props.stationShortCode.toLowerCase() === stationId.toLowerCase()) {
                        foundStation = props;
                        break;
                    }

                    // Check if it matches station name (case insensitive)
                    if (props.stationName.toLowerCase() === decodeURIComponent(stationId).toLowerCase()) {
                        foundStation = props;
                        break;
                    }

                    // Check if it matches translated names
                    const translationEntry = stationTranslations.stations.find(
                        (s: Station) => s.stationUICCode === props.stationUICCode
                    );

                    if (translationEntry) {
                        const names = [
                            translationEntry.stationName_fi,
                            translationEntry.stationName_sv,
                            translationEntry.stationName_en
                        ].filter(name => name && name.trim() !== '');

                        for (const name of names) {
                            if (name.toLowerCase() === decodeURIComponent(stationId).toLowerCase()) {
                                foundStation = props;
                                break;
                            }
                        }

                        if (foundStation) break;
                    }
                }

                if (foundStation) {
                    const translationEntry = stationTranslations.stations.find(
                        (s: Station) => s.stationUICCode === foundStation.stationUICCode
                    );

                    const translatedName = translationEntry
                        ? getTranslatedStationNameWithFallback(foundStation.stationUICCode, locale, foundStation.stationName)
                        : foundStation.stationName;

                    setStationData({
                        uicCode: foundStation.stationUICCode,
                        shortCode: foundStation.stationShortCode,
                        name: foundStation.stationName,
                        translatedName: translatedName
                    });
                } else {
                    setError('Station not found');
                }
            } catch {
                setError('Failed to fetch station data');
            } finally {
                setIsLoading(false);
            }
        };

        findStation();
    }, [stationId, locale]);

    if (isLoading) {
        return (
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-8">
                        <div className="box has-text-centered">
                            <p>
                                <i className="fas fa-spinner fa-spin"></i>&nbsp;
                                {t('timetables.loadingStation')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !stationData) {
        return (
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-8">
                        <div className="box is-shadowless">
                            <div className="notification is-danger">
                                <p className="has-text-centered">
                                    <i className="fas fa-exclamation-triangle"></i>&nbsp;
                                    {error || t('timetables.stationNotFound')}
                                </p>
                            </div>
                            <div className="has-text-centered">
                                <p>{t('timetables.stationSearchHelp')}</p>
                                <p><strong>{t('timetables.searchedFor')}:</strong> {stationId}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ marginTop: '-50px' }}>
            <div className="columns is-centered is-tablet" style={{ minHeight: '100vh' }}>
                <div className={`column is-4-desktop is-6-tablet ${styles['mobile-full-height']}`}>
                    <article className="panel is-shadowless is-primary themebackground" style={{ position: 'sticky', top: 50, marginTop: "50px" }}>
                        <div className="panel-heading level is-mobile mb-0">
                            <div className="level-left has-text-left is-block">
                                <div className="subtitle is-6 has-text-light has-text-left">Aikataulut asemalle</div>
                                <div className="title is-4 has-text-left m-0 has-text-light">
                                    {stationData.translatedName}
                                </div>
                            </div>

                            <p className="level-right">
                                <button className="button is-outlined is-light" onClick={() => window.history.back()}>
                                    <span className="icon">
                                        <i className="fas fa-search"></i>
                                    </span>
                                    <span>{t('stationList.search')}</span>
                                </button>
                            </p>
                        </div>
                        <a className="panel-block is-active">
                            <span className="panel-icon">
                                <i className="fas fa-calendar-days" aria-hidden="true"></i>
                            </span>
                            Tänään, nyt
                        </a>
                        <a className="panel-block">
                            <span className="panel-icon">
                                <i className="fas fa-plus" aria-hidden="true"></i>
                            </span>
                            Valitse määränpää
                        </a>
                    </article>
                </div>
                <div className="column is-responsive">
                    <TimetableList stationData={stationData} classNames="is-shadowless" />
                </div>

            </div>
        </div>
    );
}
