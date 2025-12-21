"use client"
import { useRef, useState, useMemo, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import StationElement from './stationelement';
import { getSearchResults } from './searchUtils';
import NearbyDrawer from './nearbydrawer';
import MapDrawer from './mapdrawer';
import { getSavedStations, SavedStation } from '../../../../lib/savedStations';

const StationList = () => {
    const inputRef = useRef(null);
    const t = useTranslations();
    const currentLocale = useLocale();
    const [searchTerm, setSearchTerm] = useState('');
    const [savedStations, setSavedStations] = useState<SavedStation[]>([]);
    const [showAllSaved, setShowAllSaved] = useState(false);
    const resultsPerPage = 5;

    const searchResults = useMemo(() => getSearchResults(searchTerm, currentLocale, resultsPerPage), [searchTerm, currentLocale]);

    // Load saved stations on mount and listen for storage changes
    useEffect(() => {
        const loadSavedStations = () => {
            setSavedStations(getSavedStations());
        };

        loadSavedStations();

        // Listen for storage changes (e.g., from other tabs or when returning to page)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'junajuoksu_saved_stations') {
                loadSavedStations();
            }
        };

        // Also reload when page becomes visible again
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadSavedStations();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const hasSavedStations = savedStations.length > 0;
    const displayedStations = showAllSaved ? savedStations : savedStations.slice(0, 3);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);

        // Only scroll on mobile devices (screen width <= 768px)
        if (inputRef.current && window.innerWidth <= 768) {
            (inputRef.current as HTMLElement).scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    const handleInputBlur = () => {
        // Scroll to the top of the page on mobile devices when input loses focus
        if (window.innerWidth <= 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <article ref={inputRef} className="panel is-primary has-text-left is-shadowless mb-6" style={{ maxWidth: "500px", margin: "0 auto", width: "100%", border: "1px solid var(--bulma-border)", backdropFilter: "blur(30px)" }}>
            <div className="p-4">
                <div className="control has-icons-left">
                    <input
                        className="input is-primary is-medium"
                        style={{ borderWidth: "3px" }}
                        type="text"
                        placeholder={t('stationList.searchPlaceholder')}
                        value={searchTerm}
                        onChange={handleInputChange}
                        onBlur={handleInputBlur}
                    />
                    <span className="icon is-left">
                        <i className="fas fa-search" aria-hidden="true"></i>
                    </span>
                </div>
            </div>

            {/* Show search results if there's a search term */}
            {searchTerm.trim() && (
                <div className="px-4 pb-4">
                    <div className="container buttons">
                        <label className="label mb-0">
                            {t('stationList.searchResults')}
                        </label>

                        {searchResults.length > 0 ? (
                            searchResults.map((station) => (
                                <StationElement
                                    key={station.stationUICCode}
                                    stationUIC={station.stationUICCode.toString()}
                                />
                            ))
                        ) : (
                            <div className="has-text-grey">
                                {t('stationList.noResults')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Show map/nearby buttons and suggestions only when not searching */}
            {!searchTerm.trim() && (
                <>
                    <div className="columns is-1 is-mobile m-0 py-1 px-3">
                        <p className="column">
                            <MapDrawer />
                        </p>
                        <p className="column">
                            <NearbyDrawer />
                        </p>

                    </div>
                    <div className="buttons panel-block pb-4">
                        <label className="label mb-0 is-size-5">
                            {hasSavedStations ? t('stationList.savedStations') : t('stationList.suggestions')}
                        </label>
                        {hasSavedStations ? (
                            <>
                                {displayedStations.map((station) => (
                                    <StationElement
                                        key={station.uicCode}
                                        stationUIC={station.uicCode.toString()}
                                        shortCode={station.shortCode}
                                    />
                                ))}
                                {savedStations.length > 3 && (
                                    <button
                                        className={`button is-fullwidth is-ghost ${showAllSaved ? 'is-hidden' : ''}`}
                                        onClick={() => setShowAllSaved(!showAllSaved)}
                                    >
                                        <span className="icon">
                                            <i className={`fas fa-chevron-${showAllSaved ? 'up' : 'down'}`}></i>
                                        </span>
                                        <span>
                                            {showAllSaved
                                                ? t('stationList.suggestions')
                                                : `${t('stationList.showAll')} (${savedStations.length})`
                                            }
                                        </span>
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <StationElement stationUIC="1" shortCode="HKI" />
                                <StationElement stationUIC="30" shortCode="HY" />
                                <StationElement stationUIC="18" shortCode="TKL" />
                            </>
                        )}
                    </div>
                </>
            )}
        </article >
    );
}

export default StationList;