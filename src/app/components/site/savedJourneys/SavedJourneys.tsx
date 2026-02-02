'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import styles from './SavedJourneys.module.css';

interface SavedJourney {
    id: number;
    train_number: number;
    departure_date: string;
    train_type: string | null;
    train_commuter_line: string | null;
    origin_station_uic: number;
    origin_stop_index: number;
    destination_station_uic: number;
    origin_station_name: string | null;
    destination_station_name: string | null;
    final_destination_name: string | null;
    scheduled_departure: string | null;
    scheduled_arrival: string | null;
}

interface User {
    id?: number;
    email: string;
    name: string;
    picture: string;
}

export default function SavedJourneys() {
    const t = useTranslations('savedJourneys');
    const locale = useLocale();

    const [journeys, setJourneys] = useState<SavedJourney[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    // Check auth and fetch journeys
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Check authentication
                const authResponse = await fetch('/api/auth/google');
                const authData = await authResponse.json();

                if (authData.authenticated && authData.user) {
                    setUser(authData.user);

                    // Fetch saved journeys
                    const journeysResponse = await fetch('/api/saved-journeys?limit=10');
                    if (journeysResponse.ok) {
                        const journeysData = await journeysResponse.json();
                        setJourneys(journeysData.journeys || []);
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Format train identifier (e.g., "IC 123" or "S 456")
    const formatTrainIdentifier = (journey: SavedJourney): string => {
        if (journey.train_commuter_line) {
            return journey.train_commuter_line;
        }
        return `${journey.train_type || ''} ${journey.train_number}`.trim();
    };

    // Build train URL
    const buildTrainUrl = (journey: SavedJourney): string => {
        const parts = [
            journey.departure_date.split("T")[0],
            journey.train_number.toString(),
            journey.origin_station_uic.toString(),
            journey.origin_stop_index.toString(),
            journey.destination_station_uic.toString()
        ];
        return `/train/${parts.join('-')}`;
    };

    // Format date as Today, Yesterday, or yyyy-mm-dd using scheduled_departure
    const formatDateLabel = (scheduledDeparture: string | null): string => {
        if (!scheduledDeparture) return '-';
        const date = new Date(scheduledDeparture);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        if (dateOnly.getTime() === today.getTime()) {
            return t('today');
        }
        if (dateOnly.getTime() === yesterday.getTime()) {
            return t('yesterday');
        }
        // Format as YYYY-MM-DD
        return date.toISOString().split('T')[0];
    };

    // Format time from timestamp (HH:MM)
    const formatTime = (timestamp: string | null): string => {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    };

    if (isLoading) {
        return (
            <div className="has-text-centered py-6">
                <span className="icon is-large has-text-white">
                    <i className="fas fa-spinner fa-spin fa-2x"></i>
                </span>
                <p className="has-text-white mt-2">{t('loadingJourneys')}</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="box has-text-centered is-shadowless" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <span className="icon is-large has-text-white-ter mb-3">
                    <i className="fas fa-user-lock fa-2x"></i>
                </span>
                <p className="has-text-white-ter">{t('loginToSee')}</p>
            </div>
        );
    }

    if (journeys.length === 0) {
        return (
            <div className="box has-text-centered is-shadowless" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <span className="icon is-large has-text-white-ter mb-3">
                    <i className="fas fa-bookmark fa-2x"></i>
                </span>
                <p className="title is-5 has-text-white">{t('noJourneys')}</p>
                <p className="has-text-white-ter">{t('noJourneysDescription')}</p>
            </div>
        );
    }

    return (
        <Carousel journeys={journeys} locale={locale} t={t} formatDateLabel={formatDateLabel} formatTime={formatTime} formatTrainIdentifier={formatTrainIdentifier} buildTrainUrl={buildTrainUrl} />
    );
}

interface CarouselProps {
    journeys: SavedJourney[];
    locale: string;
    t: ReturnType<typeof useTranslations>;
    formatDateLabel: (scheduledDeparture: string | null) => string;
    formatTime: (timestamp: string | null) => string;
    formatTrainIdentifier: (journey: SavedJourney) => string;
    buildTrainUrl: (journey: SavedJourney) => string;
}

function Carousel({ journeys, locale, t, formatDateLabel, formatTime, formatTrainIdentifier, buildTrainUrl }: CarouselProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        containScroll: 'trimSnaps'
    });
    const [prevBtnEnabled, setPrevBtnEnabled] = useState(false);
    const [nextBtnEnabled, setNextBtnEnabled] = useState(false);

    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setPrevBtnEnabled(emblaApi.canScrollPrev());
        setNextBtnEnabled(emblaApi.canScrollNext());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
            emblaApi.off('reInit', onSelect);
        };
    }, [emblaApi, onSelect]);

    return (
        <div className="is-relative">
            {/* Carousel viewport */}
            <div className={styles.embla} ref={emblaRef}>
                <div className={styles.embla__container}>
                    {journeys.map((journey) => {
                        const originName = getTranslatedStationNameWithFallback(
                            journey.origin_station_uic,
                            locale,
                            journey.origin_station_name || 'Unknown'
                        );
                        const destName = getTranslatedStationNameWithFallback(
                            journey.destination_station_uic,
                            locale,
                            journey.destination_station_name || 'Unknown'
                        );
                        const finalDestName = journey.final_destination_name
                            ? getTranslatedStationNameWithFallback(
                                0,
                                locale,
                                journey.final_destination_name
                            )
                            : destName;

                        return (
                            <div
                                key={journey.id}
                                className={styles.embla__slide}
                            >
                                <div className="card is-shadowless" style={{ backgroundColor: "var(--bulma-background)", height: '100%' }}>
                                    <div className="card-content">
                                        {/* Date label based on scheduled departure */}
                                        <p className="is-size-5 mb-4">{formatDateLabel(journey.scheduled_departure)}</p>

                                        <div className="is-flex is-align-items-center mb-4">
                                            {journey.train_commuter_line ? (
                                                ["A", "E", "L", "U", "Y", "I", "P", "K"].includes(journey.train_commuter_line) ? (
                                                    <span className="tag is-primary is-large has-text-weight-bold" style={{ marginRight: '0.75rem', backgroundColor: "#8d3889", minWidth: "40px" }}>
                                                        {journey.train_commuter_line}
                                                    </span>
                                                ) : (
                                                    <span className="tag is-primary is-large has-text-weight-bold" style={{ marginRight: '0.75rem', minWidth: "40px" }}>
                                                        {journey.train_commuter_line}
                                                    </span>
                                                )
                                            ) : (
                                                <span className="tag is-primary is-large p-2" style={{ marginRight: '0.75rem' }}>
                                                    {journey.train_type} {journey.train_number}
                                                </span>
                                            )}
                                            <div>
                                                <span className="title is-4 mb-0" style={{ color: "var(--bulma-text-strong)" }}>
                                                    {finalDestName}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Journey stops as level items */}
                                        <nav className="level is-mobile mb-4">
                                            <div className="level-item has-text-centered">
                                                <div>
                                                    <p className="heading">{t('from')}</p>
                                                    <p className="title is-6">{originName}</p>
                                                    <p className="is-size-7">{formatTime(journey.scheduled_departure)}</p>
                                                </div>
                                            </div>
                                            <div className="level-item has-text-centered">
                                                <div>
                                                    <p className="heading">{t('to')}</p>
                                                    <p className="title is-6">{destName}</p>
                                                    <p className="is-size-7">{formatTime(journey.scheduled_arrival)}</p>
                                                </div>
                                            </div>
                                        </nav>
                                    </div>
                                    <footer className="card-footer">
                                        <Link href={buildTrainUrl(journey)} className="card-footer-item">
                                            <span>{t('openTrain')}</span>
                                            <span className="icon">
                                                <i className="fas fa-chevron-right"></i>
                                            </span>
                                        </Link>
                                    </footer>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
