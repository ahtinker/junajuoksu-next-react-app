"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import TVTimetableDisplay from './components/TVTimetableDisplay';
import TVSettingsModal from './components/TVSettingsModal';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';
import './tv.css';

interface StationTVPageProps {
    params: Promise<{
        stationId: string;
    }>;
}

export interface TVDisplayParams {
    destination?: string;        // Station short code to filter trains stopping at
    trainType?: 'commuter' | 'long-distance' | 'all';
    displayMode?: 'departures' | 'arrivals';
    language?: 'fi' | 'sv' | 'en' | 'rotate';
    track?: string;              // Track number to filter by
}

interface StationData {
    uicCode: number;
    shortCode: string;
    name: string;
}

function StationTVPage({ params }: StationTVPageProps) {
    const [stationId, setStationId] = useState<string | null>(null);
    const [stationData, setStationData] = useState<StationData | null>(null);
    const [displayParams, setDisplayParams] = useState<TVDisplayParams>({
        trainType: 'all',
        displayMode: 'departures',
        language: 'rotate'
    });
    const [currentLanguage, setCurrentLanguage] = useState<'fi' | 'sv' | 'en'>('fi');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const languageRotationRef = useRef<NodeJS.Timeout | null>(null);

    // Parse URL search params
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const newParams: TVDisplayParams = {
            destination: searchParams.get('destination') || undefined,
            trainType: (searchParams.get('trainType') as TVDisplayParams['trainType']) || 'all',
            displayMode: (searchParams.get('displayMode') as TVDisplayParams['displayMode']) || 'departures',
            language: (searchParams.get('language') as TVDisplayParams['language']) || 'rotate',
            track: searchParams.get('track') || undefined
        };
        setDisplayParams(newParams);

        // Set initial language
        if (newParams.language && newParams.language !== 'rotate') {
            setCurrentLanguage(newParams.language);
        }
    }, []);

    // Language rotation
    useEffect(() => {
        if (displayParams.language === 'rotate') {
            const languages: ('fi' | 'sv' | 'en')[] = ['fi', 'sv', 'en'];
            let index = 0;

            languageRotationRef.current = setInterval(() => {
                index = (index + 1) % languages.length;
                setCurrentLanguage(languages[index]);
            }, 10000); // Rotate every 10 seconds

            return () => {
                if (languageRotationRef.current) {
                    clearInterval(languageRotationRef.current);
                }
            };
        } else if (displayParams.language) {
            setCurrentLanguage(displayParams.language);
        }
    }, [displayParams.language]);

    // Resolve params
    useEffect(() => {
        (async () => {
            const awaitedParams = await params;
            setStationId(awaitedParams.stationId);
        })();
    }, [params]);

    // Fetch station data
    useEffect(() => {
        if (!stationId) return;

        const fetchStationData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations');
                const stations = await response.json();

                const station = stations.find((s: { stationShortCode: string; stationUICCode: number; stationName: string }) =>
                    s.stationShortCode.toLowerCase() === stationId.toLowerCase() ||
                    s.stationUICCode.toString() === stationId
                );

                if (station) {
                    setStationData({
                        uicCode: station.stationUICCode,
                        shortCode: station.stationShortCode,
                        name: station.stationName
                    });
                } else {
                    setError('Station not found');
                }
            } catch (err) {
                setError('Failed to load station data');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStationData();
    }, [stationId]);

    // Update URL with new params
    const updateParams = useCallback((newParams: Partial<TVDisplayParams>) => {
        const updated = { ...displayParams, ...newParams };
        setDisplayParams(updated);

        const searchParams = new URLSearchParams();
        if (updated.destination) searchParams.set('destination', updated.destination);
        if (updated.trainType && updated.trainType !== 'all') searchParams.set('trainType', updated.trainType);
        if (updated.displayMode && updated.displayMode !== 'departures') searchParams.set('displayMode', updated.displayMode);
        if (updated.language && updated.language !== 'rotate') searchParams.set('language', updated.language);

        const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
    }, [displayParams]);

    const handleSettingsClose = useCallback(() => {
        setIsSettingsOpen(false);
    }, []);

    const handleSettingsUpdate = useCallback((newParams: Partial<TVDisplayParams>) => {
        updateParams(newParams);
    }, [updateParams]);

    // Get translated station name
    const getStationDisplayName = useCallback(() => {
        if (!stationData) return '';
        return getTranslatedStationNameWithFallback(stationData.uicCode, currentLanguage, stationData.shortCode);
    }, [stationData, currentLanguage]);

    if (isLoading) {
        return (
            <div className="tv-display tv-loading">
                <div className="tv-loading-spinner"></div>
            </div>
        );
    }

    if (error || !stationData) {
        return (
            <div className="tv-display tv-error">
                <p>{error || 'Unknown error'}</p>
            </div>
        );
    }

    return (
        <div className="tv-display">
            <TVTimetableDisplay
                stationData={stationData}
                displayParams={displayParams}
                currentLanguage={currentLanguage}
                onStationNameClick={() => setIsSettingsOpen(true)}
            />

            {isSettingsOpen && (
                <TVSettingsModal
                    currentParams={displayParams}
                    stationData={stationData}
                    onClose={handleSettingsClose}
                    onUpdate={handleSettingsUpdate}
                    currentLanguage={currentLanguage}
                />
            )}
        </div>
    );
}

export default StationTVPage;
