'use client';

import { Drawer } from 'vaul';
import { useTranslations, useLocale } from 'next-intl';
import { useState, useMemo } from 'react';
import { getSearchResults } from '../../../components/site/stationlist/searchUtils';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';

interface DestinationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onDestinationSelect: (destination: { uicCode: number; shortCode: string; name: string; translatedName: string }) => void;
    currentStation?: { uicCode: number; shortCode: string; name: string; translatedName: string };
}

export default function DestinationDrawer({ isOpen, onClose, onDestinationSelect, currentStation }: DestinationDrawerProps) {
    const t = useTranslations();
    const locale = useLocale();
    const [searchTerm, setSearchTerm] = useState('');
    const resultsPerPage = 10;

    const searchResults = useMemo(() => getSearchResults(searchTerm, locale, resultsPerPage), [searchTerm, locale]);

    const handleDestinationClick = (station: {
        stationUICCode: number;
        stationShortCode?: string;
        stationName_fi?: string;
        stationName_en?: string;
        stationName_sv?: string;
    }) => {
        const translatedName = getTranslatedStationNameWithFallback(
            station.stationUICCode,
            locale,
            station.stationName_fi || station.stationName_en || station.stationName_sv || 'Unknown'
        );

        onDestinationSelect({
            uicCode: station.stationUICCode,
            shortCode: station.stationShortCode || '',
            name: station.stationName_fi || station.stationName_en || station.stationName_sv || 'Unknown',
            translatedName: translatedName
        });
        setSearchTerm(''); // Clear search on selection
        onClose();
    };

    const handleCancel = () => {
        setSearchTerm(''); // Clear search on cancel
        onClose();
    };

    // Popular destinations
    const popularDestinations = [
        { stationUICCode: 1, shortCode: 'HKI' },
        { stationUICCode: 30, shortCode: 'HY' },
        { stationUICCode: 18, shortCode: 'TKL' },

    ];

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && handleCancel()} repositionInputs={false}>
            <Drawer.Portal>
                <Drawer.Overlay
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }}
                />
                <Drawer.Content
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        height: 'auto',
                        flexDirection: 'column',
                        borderRadius: '10px 10px 0 0',
                        zIndex: 10002,
                        backgroundColor: 'var(--bulma-scheme-main)',
                        color: 'var(--bulma-text)',
                        width: '100%',
                        maxWidth: '600px',
                        margin: '0 auto',
                        textAlign: 'left'
                    }}
                >
                    <div style={{
                        padding: '1rem',
                        backgroundColor: 'var(--bulma-background)',
                        borderTopLeftRadius: '10px',
                        borderTopRightRadius: '10px',
                        overflow: 'auto'
                    }}>
                        {/* Handle bar */}
                        <div
                            style={{
                                margin: '0 auto',
                                width: '3rem',
                                height: '0.375rem',
                                flexShrink: 0,
                                borderRadius: '9999px',
                                backgroundColor: 'var(--bulma-text-weak)',
                                marginBottom: '1rem',
                            }}
                        />

                        <Drawer.Title style={{
                            fontWeight: 500,
                            marginBottom: '1rem',
                            fontSize: '1.25rem',
                            textAlign: 'center'
                        }}>
                            {t('timetables.stationTimetables.selectDestination')}
                        </Drawer.Title>

                        {/* Search input */}
                        <div className="field" style={{ marginBottom: '1.5rem' }}>
                            <div className="control has-icons-left">
                                <input
                                    className="input"
                                    type="text"
                                    placeholder={t('stationList.searchPlaceholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <span className="icon is-left">
                                    <i className="fas fa-search"></i>
                                </span>
                            </div>
                        </div>

                        {/* Search results or popular destinations */}
                        <div style={{ marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                            {searchTerm.trim() ? (
                                <>
                                    <label className="label" style={{ marginBottom: '0.5rem' }}>
                                        {t('stationList.searchResults')}
                                    </label>
                                    {searchResults.length > 0 ? (
                                        <div className="buttons">
                                            {searchResults.map((station) => {
                                                const translatedName = getTranslatedStationNameWithFallback(
                                                    station.stationUICCode,
                                                    locale,
                                                    station.stationName_fi || station.stationName_en || station.stationName_sv || 'Unknown'
                                                );
                                                const isCurrentStation = currentStation && station.stationUICCode === currentStation.uicCode;
                                                return (
                                                    <button
                                                        key={station.stationUICCode}
                                                        className={`button is-fullwidth ${isCurrentStation ? 'is-disabled' : ''}`}
                                                        onClick={() => !isCurrentStation && handleDestinationClick(station)}
                                                        disabled={isCurrentStation}
                                                        style={{ justifyContent: 'flex-start', marginBottom: '0.5rem' }}
                                                    >
                                                        <span className="icon">
                                                            <i className="fas fa-map-marker-alt"></i>
                                                        </span>
                                                        <span>{translatedName}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="has-text-grey" style={{ padding: '1rem', textAlign: 'center' }}>
                                            {t('stationList.noResults')}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <label className="label" style={{ marginBottom: '0.5rem' }}>
                                        {t('stationList.suggestions')}
                                    </label>
                                    <div className="buttons">
                                        {popularDestinations.map((station) => {
                                            const translatedName = getTranslatedStationNameWithFallback(
                                                station.stationUICCode,
                                                locale,
                                                "Unknown Station"
                                            );
                                            const isCurrentStation = currentStation && station.stationUICCode === currentStation.uicCode;
                                            return (
                                                <button
                                                    key={station.stationUICCode}
                                                    className={`button is-fullwidth ${isCurrentStation ? 'is-disabled' : ''}`}
                                                    onClick={() => !isCurrentStation && handleDestinationClick(station)}
                                                    disabled={isCurrentStation}
                                                    style={{ justifyContent: 'flex-start', marginBottom: '0.5rem' }}
                                                >
                                                    <span className="icon">
                                                        <i className="fas fa-map-marker-alt"></i>
                                                    </span>
                                                    <span>{translatedName}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="field">
                            <div className="control">
                                <button
                                    className="button is-fullwidth"
                                    onClick={handleCancel}
                                >
                                    {t('timetables.dateTimeDrawer.cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
