"use client";

import { useState, useEffect, useMemo } from 'react';
import { TVDisplayParams } from '../page';
import { getTranslatedStationNameWithFallback } from '../../../../../lib/stationUtils';

interface StationData {
    uicCode: number;
    shortCode: string;
    name: string;
}

interface TVSettingsModalProps {
    currentParams: TVDisplayParams;
    stationData: StationData;
    onClose: () => void;
    onUpdate: (params: Partial<TVDisplayParams>) => void;
    currentLanguage: 'fi' | 'sv' | 'en';
}

interface StationOption {
    shortCode: string;
    name: string;
    uicCode: number;
}

// Translations for the settings modal
const translations = {
    fi: {
        settings: 'Asetukset',
        displayMode: 'Näyttötila',
        departures: 'Lähtevät',
        arrivals: 'Saapuvat',
        all: 'Kaikki',
        trainType: 'Junatyyppi',
        allTrains: 'Kaikki junat',
        commuter: 'Lähijunat',
        longDistance: 'Kaukojunat',
        destination: 'Määränpää',
        noFilter: 'Ei suodatusta',
        searchStation: 'Etsi asema...',
        language: 'Kieli',
        rotate: 'Vaihtuva (fi/sv/en)',
        finnish: 'Suomi',
        swedish: 'Ruotsi',
        english: 'Englanti',
        apply: 'Käytä',
        cancel: 'Peruuta',
        clearDestination: 'Poista suodatus',
        track: 'Raide',
        trackPlaceholder: 'esim. 1'
    },
    sv: {
        settings: 'Inställningar',
        displayMode: 'Visningsläge',
        departures: 'Avgående',
        arrivals: 'Ankommande',
        all: 'Alla',
        trainType: 'Tågtyp',
        allTrains: 'Alla tåg',
        commuter: 'Närtåg',
        longDistance: 'Fjärrtåg',
        destination: 'Destination',
        noFilter: 'Ingen filtrering',
        searchStation: 'Sök station...',
        language: 'Språk',
        rotate: 'Roterande (fi/sv/en)',
        finnish: 'Finska',
        swedish: 'Svenska',
        english: 'Engelska',
        apply: 'Tillämpa',
        cancel: 'Avbryt',
        clearDestination: 'Rensa filtrering',
        track: 'Spår',
        trackPlaceholder: 't.ex. 1'
    },
    en: {
        settings: 'Settings',
        displayMode: 'Display Mode',
        departures: 'Departures',
        arrivals: 'Arrivals',
        all: 'All',
        trainType: 'Train Type',
        allTrains: 'All trains',
        commuter: 'Commuter trains',
        longDistance: 'Long-distance trains',
        destination: 'Destination',
        noFilter: 'No filter',
        searchStation: 'Search station...',
        language: 'Language',
        rotate: 'Rotating (fi/sv/en)',
        finnish: 'Finnish',
        swedish: 'Swedish',
        english: 'English',
        apply: 'Apply',
        cancel: 'Cancel',
        clearDestination: 'Clear filter',
        track: 'Track',
        trackPlaceholder: 'e.g. 1'
    }
};

// Popular destinations
const POPULAR_DESTINATIONS = ['LEN', 'HKI', 'TPE', 'TKU', 'OL', 'TKL', 'LR', 'KE'];

export default function TVSettingsModal({
    currentParams,
    stationData,
    onClose,
    onUpdate,
    currentLanguage
}: TVSettingsModalProps) {
    const [displayMode, setDisplayMode] = useState<'departures' | 'arrivals'>(
        currentParams.displayMode || 'departures'
    );
    const [trainType, setTrainType] = useState<'commuter' | 'long-distance' | 'all'>(
        currentParams.trainType || 'all'
    );
    const [destination, setDestination] = useState<string>(currentParams.destination || '');
    const [language, setLanguage] = useState<'fi' | 'sv' | 'en' | 'rotate'>(
        currentParams.language || 'rotate'
    );
    const [track, setTrack] = useState<string>(currentParams.track || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [stations, setStations] = useState<StationOption[]>([]);
    const [showDestinationSearch, setShowDestinationSearch] = useState(false);

    const t = translations[currentLanguage];

    // Fetch stations for destination search
    useEffect(() => {
        const fetchStations = async () => {
            try {
                const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations');
                const data = await response.json();

                const stationOptions: StationOption[] = data
                    .filter((s: { passengerTraffic: boolean }) => s.passengerTraffic)
                    .map((s: { stationShortCode: string; stationName: string; stationUICCode: number }) => ({
                        shortCode: s.stationShortCode,
                        name: s.stationName,
                        uicCode: s.stationUICCode
                    }));

                setStations(stationOptions);
            } catch (err) {
                console.error('Failed to fetch stations:', err);
            }
        };

        fetchStations();
    }, []);

    // Filter stations based on search
    const filteredStations = useMemo(() => {
        if (!searchQuery) {
            // Show popular destinations first
            return stations
                .filter(s => s.shortCode !== stationData.shortCode)
                .sort((a, b) => {
                    const aPopular = POPULAR_DESTINATIONS.includes(a.shortCode);
                    const bPopular = POPULAR_DESTINATIONS.includes(b.shortCode);
                    if (aPopular && !bPopular) return -1;
                    if (!aPopular && bPopular) return 1;
                    return a.name.localeCompare(b.name);
                })
                .slice(0, 10);
        }

        const query = searchQuery.toLowerCase();
        return stations
            .filter(s =>
                s.shortCode !== stationData.shortCode &&
                (s.name.toLowerCase().includes(query) ||
                    s.shortCode.toLowerCase().includes(query))
            )
            .slice(0, 10);
    }, [stations, searchQuery, stationData.shortCode]);

    // Get translated station name for display
    const getStationDisplayName = (station: StationOption): string => {
        return getTranslatedStationNameWithFallback(station.uicCode, currentLanguage, station.shortCode);
    };

    // Get current destination display name
    const currentDestinationName = useMemo(() => {
        if (!destination) return '';
        const station = stations.find(s => s.shortCode === destination.toUpperCase());
        return station ? getStationDisplayName(station) : destination;
    }, [destination, stations, currentLanguage]);

    const handleApply = () => {
        onUpdate({
            displayMode,
            trainType,
            destination: destination || undefined,
            language,
            track: track || undefined
        });
        onClose();
    };

    const handleSelectDestination = (shortCode: string) => {
        setDestination(shortCode);
        setShowDestinationSearch(false);
        setSearchQuery('');
    };

    const handleClearDestination = () => {
        setDestination('');
        setShowDestinationSearch(false);
        setSearchQuery('');
    };

    return (
        <div className="tv-modal-overlay" onClick={onClose}>
            <div className="tv-modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="tv-modal-title">{t.settings}</h2>

                {/* Display Mode */}
                <div className="tv-modal-section">
                    <label className="tv-modal-label">{t.displayMode}</label>
                    <div className="tv-button-group">
                        <button
                            className={`tv-button ${displayMode === 'departures' ? 'active' : ''}`}
                            onClick={() => setDisplayMode('departures')}
                        >
                            {t.departures}
                        </button>
                        <button
                            className={`tv-button ${displayMode === 'arrivals' ? 'active' : ''}`}
                            onClick={() => setDisplayMode('arrivals')}
                        >
                            {t.arrivals}
                        </button>
                    </div>
                </div>

                {/* Train Type */}
                <div className="tv-modal-section">
                    <label className="tv-modal-label">{t.trainType}</label>
                    <div className="tv-button-group">
                        <button
                            className={`tv-button ${trainType === 'all' ? 'active' : ''}`}
                            onClick={() => setTrainType('all')}
                        >
                            {t.allTrains}
                        </button>
                        <button
                            className={`tv-button ${trainType === 'commuter' ? 'active' : ''}`}
                            onClick={() => setTrainType('commuter')}
                        >
                            {t.commuter}
                        </button>
                        <button
                            className={`tv-button ${trainType === 'long-distance' ? 'active' : ''}`}
                            onClick={() => setTrainType('long-distance')}
                        >
                            {t.longDistance}
                        </button>
                    </div>
                </div>

                {/* Track Filter */}
                <div className="tv-modal-section">
                    <label className="tv-modal-label">{t.track}</label>
                    <input
                        type="text"
                        className="tv-input tv-input-small"
                        placeholder={t.trackPlaceholder}
                        value={track}
                        onChange={(e) => setTrack(e.target.value)}
                    />
                </div>

                {/* Destination Filter */}
                <div className="tv-modal-section">
                    <label className="tv-modal-label">{t.destination}</label>

                    {!showDestinationSearch ? (
                        <div className="tv-destination-display">
                            <span className="tv-destination-value">
                                {currentDestinationName || t.noFilter}
                            </span>
                            <div className="tv-destination-buttons">
                                <button
                                    className="tv-button"
                                    onClick={() => setShowDestinationSearch(true)}
                                >
                                    {t.searchStation}
                                </button>
                                {destination && (
                                    <button
                                        className="tv-button tv-button-danger"
                                        onClick={handleClearDestination}
                                    >
                                        {t.clearDestination}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="tv-destination-search">
                            <input
                                type="text"
                                className="tv-input"
                                placeholder={t.searchStation}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            <div className="tv-station-list">
                                {filteredStations.map((station) => (
                                    <button
                                        key={station.shortCode}
                                        className="tv-station-option"
                                        onClick={() => handleSelectDestination(station.shortCode)}
                                    >
                                        <span className="tv-station-name">{getStationDisplayName(station)}</span>
                                        <span className="tv-station-code">{station.shortCode}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                className="tv-button"
                                onClick={() => setShowDestinationSearch(false)}
                            >
                                {t.cancel}
                            </button>
                        </div>
                    )}
                </div>

                {/* Language */}
                <div className="tv-modal-section">
                    <label className="tv-modal-label">{t.language}</label>
                    <div className="tv-button-group tv-button-group-wrap">
                        <button
                            className={`tv-button ${language === 'rotate' ? 'active' : ''}`}
                            onClick={() => setLanguage('rotate')}
                        >
                            {t.rotate}
                        </button>
                        <button
                            className={`tv-button ${language === 'fi' ? 'active' : ''}`}
                            onClick={() => setLanguage('fi')}
                        >
                            {t.finnish}
                        </button>
                        <button
                            className={`tv-button ${language === 'sv' ? 'active' : ''}`}
                            onClick={() => setLanguage('sv')}
                        >
                            {t.swedish}
                        </button>
                        <button
                            className={`tv-button ${language === 'en' ? 'active' : ''}`}
                            onClick={() => setLanguage('en')}
                        >
                            {t.english}
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="tv-modal-actions">
                    <button className="tv-button tv-button-secondary" onClick={onClose}>
                        {t.cancel}
                    </button>
                    <button className="tv-button tv-button-primary" onClick={handleApply}>
                        {t.apply}
                    </button>
                </div>
            </div>
        </div>
    );
}
