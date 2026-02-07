'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect, useRef, useMemo, MouseEvent } from 'react';
import { getStationBackgroundByUicCode, getTranslatedStationNameWithFallback, Station } from '../../../../lib/stationUtils';
import { isStationSaved, toggleStation, getSavedStations, SavedStation } from '../../../../lib/savedStations';
import stationTranslations from '../../../resources/station_translations.json';
import TimetableList from './TimeTableList'
import DateTimeDrawer from './DateTimeDrawer';
import DestinationDrawer from './DestinationDrawer';
import PassengerInformation from './PassengerInformation';
import StationSkeleton from './StationSkeleton';
import styles from './StationTimetables.module.css';
import StationElement from '@/app/components/site/stationlist/stationelement';
import { getSearchResults } from '../../../components/site/stationlist/searchUtils';

interface StationTimetablesProps {
    stationId: string;
}

interface StationData {
    uicCode: number;
    shortCode: string;
    name: string;
    translatedName: string;
    stationBackground?: string;
    backgroundAttribution?: string;
}

interface DestinationData {
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
    const [selectedDateTime, setSelectedDateTime] = useState(new Date());
    const [isRealtime, setIsRealtime] = useState(true); // Default to realtime
    const [isDateTimeDrawerOpen, setIsDateTimeDrawerOpen] = useState(false);
    const [isDestinationDrawerOpen, setIsDestinationDrawerOpen] = useState(false);
    const [selectedDestination, setSelectedDestination] = useState<DestinationData | null>(null);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [savedStations, setSavedStations] = useState<SavedStation[]>([]);

    // Search results using the same logic as DestinationDrawer
    const resultsPerPage = 3;
    const searchResults = useMemo(() => getSearchResults(searchQuery, locale, resultsPerPage), [searchQuery, locale]);

    const handleDateTimeDrawerOpen = (e: MouseEvent) => {
        const element = e.target as HTMLElement;
        if (element.tagName === 'I' || element.tagName === 'DIV') return;
        setIsDateTimeDrawerOpen(true);
    };

    const handleDestinationDrawerOpen = (e: MouseEvent) => {
        const element = e.target as HTMLElement;
        if (element.tagName === 'I' || element.tagName === 'DIV') return;
        setIsDestinationDrawerOpen(true);
    };

    const handleDateTimeChange = (newDateTime: Date, isRealtimeState: boolean) => {
        setSelectedDateTime(newDateTime);
        setIsRealtime(isRealtimeState);
    };

    const handleDestinationSelect = (destination: DestinationData) => {
        setSelectedDestination(destination);
    };

    const handleSearchOpen = () => {
        setIsSearchActive(true);
        // For iOS compatibility, we need to ensure focus happens directly from user interaction
        // Try multiple approaches to ensure focus works on iOS
        const focusInput = () => {
            if (searchInputRef.current) {
                // Method 1: Direct focus
                searchInputRef.current.focus();

                // Method 2: For iOS, also simulate click and set cursor position
                if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                    searchInputRef.current.click();
                    searchInputRef.current.setSelectionRange(0, 0);
                }

                // Method 3: Force focus by temporarily making it visible and focusable
                searchInputRef.current.style.opacity = '1';
                searchInputRef.current.style.pointerEvents = 'auto';
                searchInputRef.current.focus();
                searchInputRef.current.parentElement!.parentElement!.style.background = "var(--bulma-primary)";

            }
        };

        // Try immediate focus
        focusInput();

        // Also try after animation frame
        requestAnimationFrame(() => {
            focusInput();
        });

        // Final fallback with slight delay for iOS
        setTimeout(() => {
            focusInput();
        }, 50);
    };

    const handleSearchClose = () => {
        setIsSearchActive(false);
        setSearchQuery('');
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
    };

    // Handle escape key to close search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isSearchActive) {
                handleSearchClose();
            }
        };

        if (isSearchActive) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSearchActive]);

    // Additional iOS focus handling
    useEffect(() => {
        if (isSearchActive && searchInputRef.current) {
            const input = searchInputRef.current;

            // Small delay to ensure the element is visible after animation
            const timer = setTimeout(() => {
                if (input && document.contains(input)) {
                    input.focus();

                    // Additional iOS-specific handling
                    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                        input.click();
                        input.setSelectionRange(0, 0);
                    }
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isSearchActive]);

    const getDateTimeLabel = () => {
        if (isRealtime) {
            return t('timetables.dateTimeDrawer.today') + ', ' + t('timetables.dateTimeDrawer.now');
        }
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const selectedDate = new Date(selectedDateTime.getFullYear(), selectedDateTime.getMonth(), selectedDateTime.getDate());

        const isToday = selectedDate.getTime() === today.getTime();
        const isTomorrow = selectedDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000;

        if (isToday) {
            return `${t('timetables.dateTimeDrawer.today')}, ${selectedDateTime.toLocaleTimeString("fi-FI", { hour: '2-digit', minute: '2-digit' })}`;
        } else if (isTomorrow) {
            return `${t('timetables.dateTimeDrawer.tomorrow')}, ${selectedDateTime.toLocaleTimeString("fi-FI", { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return `${selectedDateTime.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${selectedDateTime.toLocaleTimeString("fi-FI", { hour: '2-digit', minute: '2-digit' })}`;
        }
    };

    const handleSaveStation = () => {
        if (!stationData) return;

        const result = toggleStation({
            uicCode: stationData.uicCode,
            shortCode: stationData.shortCode,
            name: stationData.name
        });

        setIsSaved(result.isSaved);
        setSaveMessage(result.isSaved ? t('stationList.saved') : t('timetables.selection.save'));

        // Clear message after 2 seconds
        setTimeout(() => {
            setSaveMessage(null);
        }, 2000);
    };

    // Check if station is saved on mount and when stationData changes
    useEffect(() => {
        if (stationData) {
            setIsSaved(isStationSaved(stationData.uicCode));
        }
    }, [stationData]);

    // Load saved stations for suggestions
    useEffect(() => {
        setSavedStations(getSavedStations());
    }, []);

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

                    if (props.stationName.split(' ').join('+').toLowerCase() === decodeURIComponent(stationId).toLowerCase()) {
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
                        translatedName: translatedName,
                        stationBackground: getStationBackgroundByUicCode(foundStation.stationUICCode),
                        backgroundAttribution: translationEntry?.backgroundAttribution
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
        return <StationSkeleton showFullLayout={true} />;
    }

    if (error || !stationData) {
        return (
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-8">
                        <div className="box ">
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
                    <div className={`pt-2`} style={{ position: 'sticky', top: 50, marginTop: "50px" }}>
                        <article className="panel is-primary themebackground">
                            <div className="panel-heading level is-mobile mb-0"
                                style={{
                                    position: 'relative',
                                    backgroundImage: `linear-gradient(to right, var(--bulma-primary) 30%, rgba(0,0,0,0.5)), ${stationData.stationBackground}`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center"
                                }}>
                                <h1 className={`m-0 level-left has-text-left is-block ${styles['header-content']} ${isSearchActive ? styles['search-active'] : ''}`}>
                                    <div className="subtitle is-6 has-text-light has-text-left">
                                        {t('timetables.stationTimetables.timetablesFor')}
                                    </div>
                                    <div className="title is-4 has-text-left m-0 has-text-light">
                                        {stationData.translatedName}
                                    </div>
                                </h1>

                                <div
                                    className={`${styles['search-container']} ${isSearchActive ? styles['search-active'] : ''}`}
                                    onTransitionEnd={(e) => {
                                        // Focus input when the scale animation completes
                                        if (e.propertyName === 'transform' && isSearchActive && searchInputRef.current) {
                                            searchInputRef.current.focus();
                                            // Additional iOS handling
                                            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                                                searchInputRef.current.click();
                                            }
                                        }
                                    }}
                                >
                                    <form onSubmit={handleSearchSubmit} style={{ display: 'flex', width: '100%', alignItems: 'center', border: '1px solid #FFF', borderRadius: '5px' }}>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder={t('stationList.search')}
                                            className={`input ${styles['search-input']}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSearchClose}
                                            className={`button is-primary px-5  has-text-light ${styles['search-close-button']}`}
                                        >
                                            <span className="icon">
                                                <i className="fas fa-times"></i>
                                            </span>
                                        </button>
                                    </form>
                                </div>

                                <p className={`level-right ${styles['header-content']} ${isSearchActive ? styles['search-active'] : ''}`}>
                                    <button className="button is-outlined is-light" onClick={handleSearchOpen}>
                                        <span className="icon">
                                            <i className="fas fa-search"></i>
                                        </span>
                                        <span>{t('stationList.search')}</span>
                                    </button>
                                </p>


                            </div>
                            <div className={`${isSearchActive ? 'is-hidden' : ''}`}>
                                <a className="panel-block is-active has-background-primary is-clickable" style={{ cursor: 'pointer' }} onClick={handleSaveStation}>
                                    <span className="panel-icon has-text-white">
                                        <i className={`${isSaved ? 'fas' : 'far'} fa-star`} aria-hidden="true"></i>
                                    </span>
                                    <span className="has-text-white">
                                        <div>{saveMessage || t("timetables.selection.save")}</div>
                                    </span>
                                </a>
                                <a className="panel-block is-active" onClick={handleDateTimeDrawerOpen} style={{ cursor: 'pointer' }}>
                                    <span className="panel-icon">
                                        <i className="fas fa-calendar-days" aria-hidden="true"></i>
                                    </span>
                                    {getDateTimeLabel()}
                                    <div className={`button is-small is-primary is-rounded mr-2 ${!isRealtime ? '' : 'is-hidden'}`} style={{ right: 0, position: 'absolute' }} onClick={() => { setIsRealtime(true); setSelectedDateTime(new Date()); }}>
                                        <div className="icon">
                                            <i className="fas fa-rotate-left" aria-hidden="true"></i>
                                        </div>
                                        <div>{t("timetables.selection.reset")}</div>
                                    </div>
                                </a>
                                <a className="panel-block is-active" onClick={handleDestinationDrawerOpen} style={{ cursor: 'pointer' }}>
                                    <span className="panel-icon">
                                        <i className="fas fa-route" aria-hidden="true"></i>
                                    </span>
                                    {selectedDestination ? selectedDestination.translatedName : t("timetables.stationTimetables.selectDestination")}
                                    <div className={`button is-small is-primary is-rounded mr-2 ${selectedDestination ? '' : 'is-hidden'}`} style={{ right: 0, position: 'absolute' }} onClick={setSelectedDestination.bind(null, null)}>
                                        <div className="icon">
                                            <i className="fas fa-rotate-left" aria-hidden="true"></i>
                                        </div>
                                        <div>{t("timetables.selection.reset")}</div>
                                    </div>
                                </a>
                            </div>
                            <div className={`${!isSearchActive ? 'is-hidden' : ''} has-text-left`}>
                                {searchQuery.trim() ? (
                                    <div className="p-4">
                                        <label className="label">{t("stationList.searchResults")}</label>
                                        {searchResults.length > 0 ? (
                                            <div className="buttons">
                                                {searchResults.map((station) => {
                                                    const isCurrentStation = stationData && station.stationUICCode === stationData.uicCode;
                                                    return (
                                                        <div key={station.stationUICCode} style={{ position: 'relative', width: '100%' }}>
                                                            <StationElement
                                                                stationUIC={station.stationUICCode.toString()}
                                                                shortCode={station.stationUICCode.toString()}
                                                                popup={false}
                                                                target=""
                                                                icon="fas fa-location-dot"
                                                                disabled={isCurrentStation}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="has-text-light" style={{ padding: '1rem' }}>
                                                <span className="icon">
                                                    <i className="fas fa-search"></i>
                                                </span>
                                                <span className="ml-2">{t('stationList.noResults')}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4">
                                            <label className="label">
                                                {savedStations.length > 0 ? t("stationList.savedStations") : t("stationList.suggestions")}
                                            </label>
                                        <div className="buttons">
                                                {savedStations.length > 0 ? (
                                                    savedStations.slice(0, 3).map((station) => (
                                                        <StationElement
                                                            key={station.uicCode}
                                                            icon="fas fa-location-dot"
                                                            stationUIC={station.uicCode.toString()}
                                                            shortCode={station.shortCode}
                                                            popup={false}
                                                            disabled={stationData && station.uicCode === stationData.uicCode}
                                                            target=""
                                                        />
                                                    ))
                                                ) : (
                                                    <>
                                                            <StationElement icon="fas fa-location-dot" stationUIC="1" shortCode="HKI" popup={false} disabled={stationData && 1 === stationData.uicCode} target="" />
                                                            <StationElement icon="fas fa-location-dot" stationUIC="30" shortCode="HY" popup={false} disabled={stationData && 30 === stationData.uicCode} target="" />
                                                            <StationElement icon="fas fa-location-dot" stationUIC="18" shortCode="TKL" popup={false} disabled={stationData && 18 === stationData.uicCode} target="" />
                                                    </>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </article>

                        <PassengerInformation stationShortCode={stationData.shortCode} />
                    </div>
                </div>
                <div className="column is-responsive">
                    <TimetableList
                        stationData={stationData}
                        classNames=""
                        selectedDateTime={selectedDateTime}
                        isRealtime={isRealtime}
                        selectedDestination={selectedDestination}
                    />
                </div>

            </div>
            <DateTimeDrawer
                isOpen={isDateTimeDrawerOpen}
                onClose={() => setIsDateTimeDrawerOpen(false)}
                selectedDate={selectedDateTime}
                onDateTimeChange={handleDateTimeChange}
            />

            <DestinationDrawer
                isOpen={isDestinationDrawerOpen}
                onClose={() => setIsDestinationDrawerOpen(false)}
                onDestinationSelect={handleDestinationSelect}
                currentStation={stationData}
            />
        </div>
    );
}
