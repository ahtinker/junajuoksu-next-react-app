'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Train, TimeTableRow } from '../../../../lib/types';
import { getTranslatedStationNameWithFallback } from '../../../../lib/stationUtils';

type ModalAction = 'save_journey' | 'verify_passenger' | null;
type ModalType = 'destination' | 'login' | null;

interface User {
    id?: number;
    email: string;
    name: string;
    picture: string;
}

interface HighlightedStationPanelProps {
    train: Train;
    highlightedStationUic: number;
    stopIndex: number;
    selectedDestinationUic?: number;
    onSelectDestination?: (stationUic: number) => void;
}

interface AvailableDestination {
    stationUic: number;
    stationName: string;
    scheduledArrival?: string;
}

interface StationStopData {
    arrivalRow?: TimeTableRow;
    departureRow?: TimeTableRow;
}

/**
 * Formats a time string to HH:MM:SS format
 */
function formatTime(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Calculates the delay in minutes between scheduled and actual/estimated time
 */
function getDelayMinutes(row: TimeTableRow | undefined): number | null {
    if (!row) return null;
    return row.differenceInMinutes ?? null;
}

/**
 * Gets the best available time (actual > liveEstimate > scheduled)
 */
function getBestTime(row: TimeTableRow | undefined): string | undefined {
    if (!row) return undefined;
    return row.actualTime || row.liveEstimateTime || row.scheduledTime;
}

/**
 * Determines if the train has passed this station
 */
function hasPassedStation(departureRow: TimeTableRow | undefined, arrivalRow: TimeTableRow | undefined): boolean {
    if (departureRow?.actualTime) return true;
    if (!departureRow && arrivalRow?.actualTime) return true;
    return false;
}

export default function HighlightedStationPanel({
    train,
    highlightedStationUic,
    stopIndex,
    selectedDestinationUic,
    onSelectDestination
}: HighlightedStationPanelProps) {
    const locale = useLocale();
    const t = useTranslations('train');
    
    // Tab state: 'departure' or 'destination'
    const [activeTab, setActiveTab] = useState<'departure' | 'destination'>('departure');

    // Modal state
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [pendingAction, setPendingAction] = useState<ModalAction>(null);

    // User authentication state
    const [user, setUser] = useState<User | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Journey saved state
    const [isJourneySaved, setIsJourneySaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Check authentication status on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/google');
                const data = await response.json();
                if (data.authenticated && data.user) {
                    setUser(data.user);
                }
            } catch (error) {
                console.error('Error checking auth:', error);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuth();
    }, []);

    // Check if journey is already saved when destination changes
    useEffect(() => {
        if (!user || !selectedDestinationUic) {
            setIsJourneySaved(false);
            return;
        }

        const checkSavedJourney = async () => {
            try {
                const response = await fetch('/api/saved-journeys');
                if (response.ok) {
                    const data = await response.json();
                    const isSaved = data.journeys?.some((j: {
                        train_number: number;
                        departure_date: string;
                        origin_station_uic: number;
                        destination_station_uic: number
                    }) =>
                        j.train_number === train.trainNumber &&
                        j.departure_date.split('T')[0] === train.departureDate &&
                        j.origin_station_uic === highlightedStationUic &&
                        j.destination_station_uic === selectedDestinationUic
                    );
                    setIsJourneySaved(!!isSaved);
                }
            } catch (error) {
                console.error('Error checking saved journey:', error);
            }
        };
        checkSavedJourney();
    }, [user, selectedDestinationUic, train.trainNumber, train.departureDate, highlightedStationUic]);

    // Get available destinations (stations after the departure station)
    const getAvailableDestinations = (): AvailableDestination[] => {
        const destinations: AvailableDestination[] = [];
        let foundDeparture = false;
        let currentStopCount = 0;
        const seenStations = new Set<number>();

        for (const row of train.timeTableRows) {
            // Find when we pass the departure station at the correct stop index
            if (row.stationUICCode === highlightedStationUic && row.trainStopping) {
                if (row.type === 'DEPARTURE') {
                    if (currentStopCount === stopIndex) {
                        foundDeparture = true;
                    }
                    currentStopCount++;
                }
            }

            // After departure, collect all stopping stations
            if (foundDeparture && row.trainStopping && row.stationUICCode !== highlightedStationUic) {
                if (!seenStations.has(row.stationUICCode)) {
                    seenStations.add(row.stationUICCode);
                    destinations.push({
                        stationUic: row.stationUICCode,
                        stationName: row.stationName || 'Unknown',
                        scheduledArrival: row.type === 'ARRIVAL' ? row.scheduledTime : undefined
                    });
                }
            }
        }

        return destinations;
    };

    const availableDestinations = getAvailableDestinations();

    // Get station data for saving journey
    const getStationData = useCallback(() => {
        const originRow = train.timeTableRows.find(r => r.stationUICCode === highlightedStationUic && r.trainStopping);
        const destRow = selectedDestinationUic
            ? train.timeTableRows.find(r => r.stationUICCode === selectedDestinationUic && r.trainStopping && r.type === 'ARRIVAL')
            : null;
        const finalDestRow = train.timeTableRows[train.timeTableRows.length - 1];

        return {
            originStationName: originRow?.stationName,
            destinationStationName: destRow?.stationName,
            finalDestinationName: finalDestRow?.stationName,
            scheduledDeparture: originRow?.scheduledTime,
            scheduledArrival: destRow?.scheduledTime
        };
    }, [train.timeTableRows, highlightedStationUic, selectedDestinationUic]);

    // Save or unsave journey
    const saveJourney = useCallback(async () => {
        if (!selectedDestinationUic || isSaving) return;

        setIsSaving(true);
        try {
            const stationData = getStationData();
            const response = await fetch('/api/saved-journeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trainNumber: train.trainNumber,
                    departureDate: train.departureDate,
                    trainType: train.trainType,
                    trainCommuterLine: train.commuterLineID,
                    originStationUic: highlightedStationUic,
                    originStopIndex: stopIndex,
                    destinationStationUic: selectedDestinationUic,
                    ...stationData
                })
            });

            if (response.ok) {
                const data = await response.json();
                setIsJourneySaved(data.action === 'saved');
            }
        } catch (error) {
            console.error('Error saving journey:', error);
        } finally {
            setIsSaving(false);
        }
    }, [selectedDestinationUic, isSaving, getStationData, train, highlightedStationUic, stopIndex]);

    // Handler for verify passenger button
    const handleVerifyPassenger = () => {
        if (!user) {
            setPendingAction('verify_passenger');
            setActiveModal('login');
            return;
        }
        if (!selectedDestinationUic) {
            setPendingAction('verify_passenger');
            setActiveModal('destination');
        } else {
            // TODO: Initiate verification process
        }
    };

    // Handler for save journey button
    const handleSaveJourney = () => {
        if (!user) {
            setPendingAction('save_journey');
            setActiveModal('login');
            return;
        }
        if (!selectedDestinationUic) {
            setPendingAction('save_journey');
            setActiveModal('destination');
        } else {
            saveJourney();
        }
    };

    // Handler for destination tab click
    const handleDestinationTabClick = () => {
        if (!selectedDestinationUic) {
            // No destination selected, show modal to select one
            setPendingAction(null);
            setActiveModal('destination');
        } else {
            // Destination exists, just switch tab
            setActiveTab('destination');
        }
    };

    // Handler for when user selects a destination from the modal list
    const handleSelectDestinationFromList = (stationUic: number) => {
        setActiveModal(null);

        if (onSelectDestination) {
            onSelectDestination(stationUic);
        }

        // If there was a pending action, handle it after destination is set
        if (pendingAction === 'verify_passenger') {
            // TODO: Initiate verification process after destination is selected
        } else if (pendingAction === 'save_journey') {
            // Save will trigger after destination is set via useEffect
        }

        setPendingAction(null);
        setActiveTab('destination');
    };

    // Handler to close modal
    const handleCloseModal = () => {
        setActiveModal(null);
        setPendingAction(null);
    };

    // Count total stops at this station
    const getTotalStopsAtStation = (stationUic: number): number => {
        let count = 0;
        for (const row of train.timeTableRows) {
            if (row.stationUICCode === stationUic && row.trainStopping && row.type === 'DEPARTURE') {
                count++;
            }
        }
        // If no departures found, check for arrival-only (last station)
        if (count === 0) {
            for (const row of train.timeTableRows) {
                if (row.stationUICCode === stationUic && row.trainStopping && row.type === 'ARRIVAL') {
                    count++;
                }
            }
        }
        return count;
    };

    // Find the destination stop index (first stop at selectedDestinationUic after the origin)
    const findDestinationStopIndex = (): number => {
        if (!selectedDestinationUic) return 0;
        
        let foundOrigin = false;
        let stopCount = 0;
        
        for (let i = 0; i < train.timeTableRows.length; i++) {
            const row = train.timeTableRows[i];
            
            // Track when we pass the origin
            if (row.stationUICCode === highlightedStationUic && row.trainStopping) {
                if (row.type === 'DEPARTURE') {
                    if (stopCount === stopIndex) {
                        foundOrigin = true;
                    }
                    stopCount++;
                }
            }
            
            // After origin, find first stop at destination
            if (foundOrigin && row.stationUICCode === selectedDestinationUic && row.trainStopping) {
                // Count which stop this is at the destination station
                let destStopIndex = 0;
                for (let j = 0; j < i; j++) {
                    if (train.timeTableRows[j].stationUICCode === selectedDestinationUic && 
                        train.timeTableRows[j].trainStopping && 
                        train.timeTableRows[j].type === 'DEPARTURE') {
                        destStopIndex++;
                    }
                }
                return destStopIndex;
            }
        }
        return 0;
    };

    const totalStopsAtOrigin = getTotalStopsAtStation(highlightedStationUic);
    const totalStopsAtDestination = selectedDestinationUic ? getTotalStopsAtStation(selectedDestinationUic) : 0;
    const destinationStopIndex = findDestinationStopIndex();

    // Find the station stop data for the highlighted station (departure)
    const stationData = findStationStopData(train, highlightedStationUic, stopIndex);
    
    // Find the station stop data for the destination station
    const destinationData = selectedDestinationUic 
        ? findStationStopData(train, selectedDestinationUic, destinationStopIndex) 
        : null;

    if (!stationData.arrivalRow && !stationData.departureRow) {
        return (
            <div className="box has-text-centered" style={{ backgroundColor: 'var(--bulma-background)' }}>
                <span className="icon has-text-grey is-large">
                    <i className="fas fa-info-circle fa-2x"></i>
                </span>
                <p className="has-text-grey mt-2">{t('station_not_found')}</p>
            </div>
        );
    }

    // Departure station data
    const arrivalRow = stationData.arrivalRow;
    const departureRow = stationData.departureRow;
    const primaryRow = arrivalRow || departureRow;

    const stationName = getTranslatedStationNameWithFallback(
        highlightedStationUic,
        locale,
        primaryRow?.stationName || 'Unknown'
    );

    const isPassed = hasPassedStation(departureRow, arrivalRow);
    const isFirstStation = !arrivalRow && !!departureRow;
    const isLastStation = !!arrivalRow && !departureRow;

    const arrivalDelay = getDelayMinutes(arrivalRow);
    const departureDelay = getDelayMinutes(departureRow);

    const track = departureRow?.commercialTrack || arrivalRow?.commercialTrack;

    // Destination station data
    const destArrivalRow = destinationData?.arrivalRow;
    const destDepartureRow = destinationData?.departureRow;
    const destPrimaryRow = destArrivalRow || destDepartureRow;

    const destStationName = selectedDestinationUic ? getTranslatedStationNameWithFallback(
        selectedDestinationUic,
        locale,
        destPrimaryRow?.stationName || 'Unknown'
    ) : '';

    const destIsPassed = hasPassedStation(destDepartureRow, destArrivalRow);
    const destIsLastStation = !!destArrivalRow && !destDepartureRow;

    const destArrivalDelay = getDelayMinutes(destArrivalRow);
    const destDepartureDelay = getDelayMinutes(destDepartureRow);

    const destTrack = destDepartureRow?.commercialTrack || destArrivalRow?.commercialTrack;

    // Render station info panel content
    const renderStationContent = (
        isDestination: boolean,
        name: string,
        arrival: TimeTableRow | undefined,
        departure: TimeTableRow | undefined,
        passed: boolean,
        firstStation: boolean,
        lastStation: boolean,
        arrDelay: number | null,
        depDelay: number | null,
        stationTrack: string | undefined,
        totalStops: number,
        currentStopIndex: number
    ) => (
        <>
            {/* Station Name Header */}
            <div className="has-text-centered mb-4">
                <p className="is-size-7 has-text-grey mb-1">
                    {isDestination ? t('destination_stop') : t('departure_stop')}
                </p>
                <span className="icon-text is-justify-content-center">
                    <span className="title is-4">{name}</span>
                </span>
                {totalStops > 1 && (
                    <p className="is-size-7 has-text-grey mt-1">
                        {t('stop_number', { current: currentStopIndex + 1, total: totalStops })}
                    </p>
                )}
                <p className="is-size-7 has-text-grey mt-1">
                    {passed ? t('station_passed') : (firstStation ? t('departure_station') : (lastStation ? t('arrival_station') : t('station_upcoming')))}
                </p>
            </div>

            {/* Cancelled indicator */}
            {(arrival?.cancelled || departure?.cancelled) && (
                <div className="notification is-danger is-light has-text-centered mb-4">
                    <span className="icon-text is-justify-content-center">
                        <span className="icon">
                            <i className="fas fa-times-circle"></i>
                        </span>
                        <span className="has-text-weight-bold">{t('cancelled')}</span>
                    </span>
                </div>
            )}

            {/* Inline Layout */}
            <div className="is-flex is-flex-wrap-wrap is-justify-content-center is-align-items-center" style={{ gap: '2.5rem' }}>
                {/* Arrival Time */}
                {arrival && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('arrival')}</p>
                        <p className={`is-size-5 has-text-weight-bold`}>
                            {formatTime(getBestTime(arrival))}
                        </p>
                        {arrival.scheduledTime !== getBestTime(arrival) && (
                            <span className="is-size-7 has-text-grey">
                                <s>{formatTime(arrival.scheduledTime)}</s>
                            </span>
                        )}
                        {arrDelay !== null && arrDelay !== 0 && (
                            <span className={`ml-2 is-size-7 ${arrDelay > 0 ? 'has-text-danger' : 'has-text-success'}`}>
                                {arrDelay > 0 ? '+' : ''}{arrDelay} min
                            </span>
                        )}
                    </div>
                )}

                {/* Departure Time */}
                {departure && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('departure')}</p>
                        <p className={`is-size-5 has-text-weight-bold`}>
                            {formatTime(getBestTime(departure))}
                        </p>
                        {departure.scheduledTime !== getBestTime(departure) && (
                            <span className="is-size-7 has-text-grey">
                                <s>{formatTime(departure.scheduledTime)}</s>
                            </span>
                        )}
                        {depDelay !== null && depDelay !== 0 && (
                            <span className={`ml-2 is-size-7 ${depDelay > 0 ? 'has-text-danger' : 'has-text-success'}`}>
                                {depDelay > 0 ? '+' : ''}{depDelay} min
                            </span>
                        )}
                    </div>
                )}

                {/* Track */}
                {stationTrack && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('track')}</p>
                        <p className="is-size-5 has-text-weight-bold">{stationTrack}</p>
                    </div>
                )}

                {/* Stop Duration - only show if 2 minutes or more */}
                {arrival && departure && getStopDurationMinutes(arrival.scheduledTime, departure.scheduledTime) >= 2 && (
                    <div className="has-text-centered">
                        <p className="is-size-7 has-text-grey mb-1">{t('stop_duration')}</p>
                        <p className="is-size-5 has-text-weight-bold">
                            {calculateStopDuration(arrival.scheduledTime, departure.scheduledTime)}
                        </p>
                    </div>
                )}
                <div className="buttons is-centered" style={{ width: "100%" }}>
                    <button className="button is-primary" onClick={handleVerifyPassenger} disabled={isCheckingAuth}>
                        <span className="icon">
                            <i className="fas fa-chair"></i>
                        </span>
                        <span>
                            {t('verify_passenger')}
                        </span>
                    </button>
                    <button
                        className={`button ${isSaving ? "is-loading" : isJourneySaved ? 'is-ghost' : 'is-primary is-outlined'}`}
                        onClick={handleSaveJourney}
                        disabled={isCheckingAuth || isSaving}
                    >
                        <span className="icon">
                            <i className={`fas ${isJourneySaved ? 'fa-bookmark' : 'fa-bookmark'}`}></i>
                        </span>
                        <span>
                            {isJourneySaved ? t('unsave_journey') : t('save_journey')}
                        </span>
                    </button>
                </div>

            </div>
        </>
    );

    return (
        <div className="box is-shadowless" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
            {/* Login Required Modal */}
            <div className={`modal ${activeModal === 'login' ? 'is-active' : ''}`}>
                <div className="modal-background" onClick={handleCloseModal}></div>
                <div className="modal-card">
                    <header className="modal-card-head is-shadowless">
                        <p className="modal-card-title">{t('login_required_title')}</p>
                        <button className="delete" aria-label="close" onClick={handleCloseModal}></button>
                    </header>
                    <section className="modal-card-body has-text-centered">
                        <span className="icon has-text-warning is-large mb-4">
                            <i className="fas fa-user-lock fa-3x"></i>
                        </span>
                        <p className="mb-4">{t('login_required_message')}</p>
                        <div id="google-signin-button-modal" className="is-flex is-justify-content-center">
                            {/* Google Sign-In button will be rendered here by the navbar's Google Identity Services */}
                            <button
                                className="button is-light is-medium"
                                onClick={() => {
                                    handleCloseModal();
                                    // Trigger Google Sign-In by clicking the navbar button
                                    const navbarButton = document.querySelector('[data-google-signin]') as HTMLElement;
                                    if (navbarButton) {
                                        navbarButton.click();
                                    } else {
                                        // Fallback: scroll to top where navbar is
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }
                                }}
                            >
                                <span className="icon">
                                    <i className="fab fa-google"></i>
                                </span>
                                <span>{t('login_with_google')}</span>
                            </button>
                        </div>
                    </section>
                    <footer className="modal-card-foot">
                        <button className="button" onClick={handleCloseModal}>{t('cancel')}</button>
                    </footer>
                </div>
            </div>

            {/* Destination Selection Modal */}
            <div className={`modal ${activeModal === 'destination' ? 'is-active' : ''}`}>
                <div className="modal-background" onClick={handleCloseModal}></div>
                <div className="modal-card">
                    <header className="modal-card-head is-shadowless">
                        <p className="modal-card-title">{t('select_destination_modal_title')}</p>
                        <button className="delete" aria-label="close" onClick={handleCloseModal}></button>
                    </header>
                    <section className="modal-card-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <p className="mb-4">{t('select_destination_modal_message')}</p>
                        <div className="menu">
                            <ul className="menu-list">
                                {availableDestinations.map((dest) => (
                                    <li key={dest.stationUic}>
                                        <a
                                            onClick={() => handleSelectDestinationFromList(dest.stationUic)}
                                            className="is-flex is-justify-content-space-between is-align-items-center has-text-primary"
                                        >
                                            <span>
                                                {getTranslatedStationNameWithFallback(dest.stationUic, locale, dest.stationName)}
                                            </span>
                                            {dest.scheduledArrival && (
                                                <span className="tag is-rounded">
                                                    {formatTime(dest.scheduledArrival).substring(0, 5)}
                                                </span>
                                            )}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                    <footer className="modal-card-foot">
                        <button className="button" onClick={handleCloseModal}>{t('cancel')}</button>
                    </footer>
                </div>
            </div>

            {/* Tabs - always show two tabs */}
            <div className="tabs is-centered is-boxed mb-4" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                <ul>
                    <li className={activeTab === 'departure' ? 'is-active' : ''}>
                        <a onClick={() => setActiveTab('departure')}>
                            <span className="icon is-small">
                                <i className="fas fa-sign-out-alt"></i>
                            </span>
                            <span>{stationName}</span>
                        </a>
                    </li>
                    <li className={activeTab === 'destination' ? 'is-active' : ''}>
                        <a onClick={handleDestinationTabClick}>
                            <span className="icon is-small">
                                <i className={selectedDestinationUic && destinationData ? 'fas fa-flag-checkered' : 'fas fa-plus'}></i>
                            </span>
                            <span>{selectedDestinationUic && destinationData ? destStationName : t('select_destination')}</span>
                        </a>
                    </li>
                </ul>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'departure' ? (
                renderStationContent(
                    false,
                    stationName,
                    arrivalRow,
                    departureRow,
                    isPassed,
                    isFirstStation,
                    isLastStation,
                    arrivalDelay,
                    departureDelay,
                    track,
                    totalStopsAtOrigin,
                    stopIndex
                )
            ) : selectedDestinationUic && destinationData && (destArrivalRow || destDepartureRow) ? (
                renderStationContent(
                    true,
                    destStationName,
                    destArrivalRow,
                    destDepartureRow,
                    destIsPassed,
                    false,
                    destIsLastStation,
                    destArrivalDelay,
                    destDepartureDelay,
                    destTrack,
                    totalStopsAtDestination,
                    destinationStopIndex
                )
            ) : (
                        /* No destination selected - show prompt to select destination */
                        <div className="has-text-centered py-5">
                            <span className="icon has-text-grey is-large mb-3">
                                <i className="fas fa-map-marker-alt fa-2x"></i>
                            </span>
                            <p className="title is-5 has-text-grey">{t('select_destination')}</p>
                            <p className="subtitle is-6 has-text-grey">{t('select_destination_modal_message')}</p>
                        </div>
            )}
        </div>
    );
}

/**
 * Finds the arrival and departure rows for a specific station stop
 */
function findStationStopData(train: Train, stationUic: number, stopIndex: number): StationStopData {
    const rows = train.timeTableRows;
    let currentStopIndex = 0;
    let arrivalRow: TimeTableRow | undefined;
    let departureRow: TimeTableRow | undefined;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (row.stationUICCode === stationUic && row.trainStopping) {
            if (row.type === 'ARRIVAL') {
                // Check if we're at the right stop index
                if (currentStopIndex === stopIndex) {
                    arrivalRow = row;
                    // Look for the corresponding departure
                    if (i + 1 < rows.length &&
                        rows[i + 1].stationUICCode === stationUic &&
                        rows[i + 1].type === 'DEPARTURE' &&
                        rows[i + 1].trainStopping) {
                        departureRow = rows[i + 1];
                    }
                    break;
                }
            } else if (row.type === 'DEPARTURE') {
                // First station case - only departure, no arrival
                if (i === 0 || (rows[i - 1]?.stationUICCode !== stationUic)) {
                    if (currentStopIndex === stopIndex) {
                        departureRow = row;
                        break;
                    }
                }
                // Increment stop index after processing a complete stop
                currentStopIndex++;
            }
        }
    }

    // Handle edge case: first station (only departure)
    if (!arrivalRow && !departureRow && stopIndex === 0) {
        const firstRow = rows.find(r => r.stationUICCode === stationUic && r.trainStopping);
        if (firstRow?.type === 'DEPARTURE') {
            departureRow = firstRow;
        } else if (firstRow?.type === 'ARRIVAL') {
            arrivalRow = firstRow;
            const nextIndex = rows.indexOf(firstRow) + 1;
            if (nextIndex < rows.length &&
                rows[nextIndex].stationUICCode === stationUic &&
                rows[nextIndex].type === 'DEPARTURE' &&
                rows[nextIndex].trainStopping) {
                departureRow = rows[nextIndex];
            }
        }
    }

    return { arrivalRow, departureRow };
}

/**
 * Gets the stop duration in minutes (for conditional rendering)
 */
function getStopDurationMinutes(arrivalTime: string, departureTime: string): number {
    const arrival = new Date(arrivalTime);
    const departure = new Date(departureTime);
    const diffMs = departure.getTime() - arrival.getTime();
    return Math.round(diffMs / 60000);
}

/**
 * Calculates the stop duration between arrival and departure
 */
function calculateStopDuration(arrivalTime: string, departureTime: string): string {
    const diffMinutes = getStopDurationMinutes(arrivalTime, departureTime);

    if (diffMinutes < 60) {
        return `${diffMinutes} min`;
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}min`;
}
