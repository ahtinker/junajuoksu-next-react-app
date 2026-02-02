/**
 * Station geolocations cache - fetched once per session
 */

interface StationGeolocation {
    stationUICCode: number;
    stationShortCode: string;
    stationName: string;
    latitude: number;
    longitude: number;
}

interface StationMetadata {
    passengerTraffic: boolean;
    type: string;
    stationName: string;
    stationShortCode: string;
    stationUICCode: number;
    countryCode: string;
    longitude: number;
    latitude: number;
}

// Module-level cache for station geolocations
let stationGeolocationsCache: Map<number, StationGeolocation> | null = null;
let fetchPromise: Promise<Map<number, StationGeolocation>> | null = null;

/**
 * Fetches station geolocations from Digitraffic API.
 * Results are cached in memory for the duration of the session.
 * If a fetch is already in progress, returns the same promise.
 */
export async function getStationGeolocations(): Promise<Map<number, StationGeolocation>> {
    // Return cached data if available
    if (stationGeolocationsCache) {
        return stationGeolocationsCache;
    }

    // Return existing fetch promise if already fetching
    if (fetchPromise) {
        return fetchPromise;
    }

    // Start new fetch
    fetchPromise = (async () => {
        try {
            const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations');
            if (!response.ok) {
                throw new Error(`Failed to fetch stations: ${response.status}`);
            }

            const stations: StationMetadata[] = await response.json();
            const geolocations = new Map<number, StationGeolocation>();

            for (const station of stations) {
                if (station.latitude && station.longitude) {
                    geolocations.set(station.stationUICCode, {
                        stationUICCode: station.stationUICCode,
                        stationShortCode: station.stationShortCode,
                        stationName: station.stationName,
                        latitude: station.latitude,
                        longitude: station.longitude
                    });
                }
            }

            stationGeolocationsCache = geolocations;
            return geolocations;
        } catch (error) {
            console.error('Error fetching station geolocations:', error);
            // Reset promise so next call can retry
            fetchPromise = null;
            return new Map<number, StationGeolocation>();
        }
    })();

    return fetchPromise;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
}
