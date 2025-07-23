'use client';

interface StationData {
    uicCode: number;
    shortCode: string;
    name: string;
    translatedName: string;
}

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import styles from './StationTimetables.module.css';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';

interface TimetableListProps {
    stationData: StationData,
    hideTop?: boolean
    classNames?: string
}

export default function TimetableList({ stationData, hideTop = false, classNames = '' }: TimetableListProps) {
    const t = useTranslations();
    const locale = useLocale();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [timetables, setTimetables] = useState<Train[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Helper function to format time
    const formatTime = (dateTimeString: string) => {
        const date = new Date(dateTimeString);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}.${minutes}.${seconds}`;
    };

    // Helper function to get destination station name
    const getDestinationName = (train: Train): string => {
        // Find the last station in the timetable
        const lastRow = train.timeTableRows[train.timeTableRows.length - 1];
        if (lastRow) {
            return getTranslatedStationNameWithFallback(
                lastRow.stationUICCode,
                locale,
                lastRow.stationShortCode
            );
        }
        return 'Unknown';
    };

    // Helper function to get origin station name
    const getOriginName = (train: Train): string => {
        // Find the first station in the timetable
        const firstRow = train.timeTableRows[0];
        if (firstRow) {
            return getTranslatedStationNameWithFallback(
                firstRow.stationUICCode,
                locale,
                firstRow.stationShortCode
            );
        }
        return 'Unknown';
    };

    useEffect(() => {
        const fetchTimetables = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/live-trains/station/${stationData.shortCode}?arrived_trains=10&arriving_trains=50&departed_trains=10&departing_trains=50&include_nonstopping=false`
                );
                const data = await response.json();
                setTimetables(data);
            } catch {
                setError('Failed to fetch timetables');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTimetables();
    }, [stationData.shortCode]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 100);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollButton(window.scrollY > 100);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <article className={"panel is-primary themebackground " + classNames}>
            <div className={`${styles['mobile-border']}`} style={hideTop ? { position: 'sticky', top: 0, zIndex: 1 } : { position: 'sticky', top: 0, zIndex: 1, border: 'solid var(--bulma-scheme-main)' }}>
                <div className="panel-heading level is-mobile mb-0 py-2">
                    <div className="level-left has-text-left is-block py-2">
                        <div className="title is-4 has-text-left m-0 has-text-light">
                            {currentTime.toLocaleTimeString()}
                        </div>
                    </div>

                    {showScrollButton && (
                        <p className="level-right">
                            <button className="button is-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                                <span className="icon">
                                    <i className="fas fa-chevron-up"></i>
                                </span>
                                <span>{t("timetables.up")}</span>
                            </button>
                        </p>
                    )}
                </div>
            </div>
            {isLoading && (
                <div className="panel-block">
                    <span className="panel-icon">
                        <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    </span>
                    Loading timetables...
                </div>
            )}
            {error && (
                <div className="panel-block">
                    <span className="panel-icon">
                        <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    </span>
                    {error}
                </div>
            )}
            {timetables.map(train => {
                const arrivalRow = train.timeTableRows.find(
                    row => row.stationShortCode === stationData.shortCode && row.type === 'ARRIVAL'
                );
                const departureRow = train.timeTableRows.find(
                    row => row.stationShortCode === stationData.shortCode && row.type === 'DEPARTURE'
                );

                if (!arrivalRow && !departureRow) {
                    return null;
                }

                const destination = getDestinationName(train);
                const origin = getOriginName(train);

                const formatRow = (row: TimeTableRow) => {
                    const scheduledTime = formatTime(row.scheduledTime);
                    const liveTime = row.liveEstimateTime ? formatTime(row.liveEstimateTime) : null;
                    const hasScheduleChange = liveTime && liveTime !== scheduledTime;
                    return { scheduledTime, liveTime, hasScheduleChange, track: row.commercialTrack };
                };

                const arrivalInfo = arrivalRow ? formatRow(arrivalRow) : null;
                const departureInfo = departureRow ? formatRow(departureRow) : null;

                const getEta = () => {
                    if (arrivalRow) {
                        const time = new Date(arrivalRow.liveEstimateTime || arrivalRow.scheduledTime).getTime();
                        const diff = Math.round((time - currentTime.getTime()) / 60000);
                        if (diff > 0) {
                            return `${diff} min`;
                        }
                    }
                    return null;
                }

                return (
                    <div className="panel-block pt-4 my-0" key={`${train.trainNumber}-${train.departureDate}`} style={{ display: 'block', marginBottom: '1rem' }}>
                        {/* Top part */}
                        <div className="level is-mobile">
                            <div className="level-left">
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {train.commuterLineID && (
                                        <span className="tag is-primary is-large" style={{ marginRight: '1rem' }}>
                                            {train.commuterLineID}
                                        </span>
                                    )}
                                    <div className="has-text-left">
                                        <p className="title is-5">{destination}</p>
                                        <p className="subtitle is-6">
                                            {t('timetables.from')} {origin}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="level-right">
                                {train.cancelled && (
                                    <span className="tag is-danger">{t('timetables.cancelled')}</span>
                                )}
                            </div>
                        </div>

                        {/* Bottom part */}
                        <div className="ml-3 my-4">
                            <div className="columns is-mobile">
                                <div className="mr-4">
                                    <p className="heading">{t('timetables.track')}</p>
                                    <p className="title is-5">{(arrivalInfo?.track || departureInfo?.track) || '-'}</p>
                                </div>
                                {arrivalInfo && (
                                    <div className="mr-4">
                                        <p className="heading">{t('timetables.arrivesAt')}</p>
                                        <p className="title is-5" style={{ color: arrivalInfo.hasScheduleChange ? 'var(--bulma-danger)' : 'inherit' }}>
                                            {arrivalInfo.liveTime || arrivalInfo.scheduledTime}
                                        </p>
                                        {arrivalInfo.liveTime && arrivalInfo.liveTime !== arrivalInfo.scheduledTime && (
                                            <p className="subtitle is-7" style={{ textDecoration: 'line-through' }}>
                                                ({arrivalInfo.scheduledTime})
                                            </p>
                                        )}
                                    </div>
                                )}
                                {departureInfo && (
                                    <div className="mr-4">
                                        <p className="heading">{t('timetables.departsAt')}</p>
                                        <p className="title is-5" style={{ color: departureInfo.hasScheduleChange ? 'var(--bulma-danger)' : 'inherit' }}>
                                            {departureInfo.liveTime || departureInfo.scheduledTime}
                                        </p>
                                        {departureInfo.liveTime && departureInfo.liveTime !== departureInfo.scheduledTime && (
                                            <p className="subtitle is-7" style={{ textDecoration: 'line-through' }}>
                                                ({departureInfo.scheduledTime})
                                            </p>
                                        )}
                                    </div>
                                )}

                                {arrivalInfo && !departureInfo && (
                                    <div className="">
                                        <p className="heading">{t('timetables.timeToArrival')}</p>
                                        <p className="title is-5">{getEta()}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </article>
    );
}
