// Utility functions for managing saved stations in localStorage

export interface SavedStation {
    uicCode: number;
    shortCode: string;
    name: string;
    savedAt: number; // timestamp for sorting
}

const STORAGE_KEY = 'junajuoksu_saved_stations';

export function getSavedStations(): SavedStation[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

export function saveStation(station: Omit<SavedStation, 'savedAt'>): SavedStation[] {
    const stations = getSavedStations();

    // Check if station already exists
    const existingIndex = stations.findIndex(s => s.uicCode === station.uicCode);
    if (existingIndex !== -1) {
        // Already saved, return current list
        return stations;
    }

    const newStation: SavedStation = {
        ...station,
        savedAt: Date.now()
    };

    const updatedStations = [newStation, ...stations];

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStations));
    } catch {
        // Storage full or unavailable
        console.error('Failed to save station to localStorage');
    }

    return updatedStations;
}

export function removeStation(uicCode: number): SavedStation[] {
    const stations = getSavedStations();
    const updatedStations = stations.filter(s => s.uicCode !== uicCode);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStations));
    } catch {
        console.error('Failed to remove station from localStorage');
    }

    return updatedStations;
}

export function isStationSaved(uicCode: number): boolean {
    const stations = getSavedStations();
    return stations.some(s => s.uicCode === uicCode);
}

export function toggleStation(station: Omit<SavedStation, 'savedAt'>): { stations: SavedStation[]; isSaved: boolean } {
    if (isStationSaved(station.uicCode)) {
        return {
            stations: removeStation(station.uicCode),
            isSaved: false
        };
    } else {
        return {
            stations: saveStation(station),
            isSaved: true
        };
    }
}
