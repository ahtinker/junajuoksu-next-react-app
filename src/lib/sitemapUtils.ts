/**
 * Sitemap URL utilities for SEO-friendly station URLs
 * This module provides functions to convert between station names and URL slugs
 */

import stationTranslations from '../app/resources/station_translations.json';

// Station interface from the translations file
export interface StationTranslation {
    stationUICCode: number;
    stationName_fi: string;
    stationName_sv: string;
    stationName_en: string;
    stationBackground?: string;
    backgroundAttribution?: string;
}

/**
 * Convert station name to SEO-friendly URL slug
 * Uses the Finnish name as the primary URL identifier
 * Preserves Finnish/Swedish special characters (ä, ö, å) via URL encoding
 * @param stationName - The station name to convert
 * @returns URL-safe slug (encoded)
 */
export function stationNameToSlug(stationName: string): string {
    const slug = stationName
        .toLowerCase()
        .trim()
        // Replace spaces with hyphens
        .replace(/\s+/g, '-')
        // Remove characters that are problematic in URLs (but keep Finnish/Swedish letters)
        .replace(/[^a-zäöåü0-9-]/g, '')
        // Remove consecutive hyphens
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-|-$/g, '');
    
    // URL encode the slug to handle special characters
    return encodeURIComponent(slug);
}

/**
 * Get station by its URL slug
 * @param slug - The URL slug to find (can be encoded or decoded)
 * @returns The station translation object or undefined
 */
export function getStationBySlug(slug: string): StationTranslation | undefined {
    const stations = stationTranslations.stations as StationTranslation[];
    // Decode the incoming slug for comparison
    const decodedSlug = decodeURIComponent(slug).toLowerCase();
    
    return stations.find(station => {
        const stationSlug = decodeURIComponent(stationNameToSlug(station.stationName_fi));
        return stationSlug === decodedSlug;
    });
}

/**
 * Get all stations with their slugs
 * @returns Array of stations with slug property added
 */
export function getAllStationsWithSlugs(): (StationTranslation & { slug: string })[] {
    const stations = stationTranslations.stations as StationTranslation[];
    
    return stations.map(station => ({
        ...station,
        slug: stationNameToSlug(station.stationName_fi),
    }));
}

/**
 * Get the SEO-friendly URL for a station
 * @param stationUICCode - The UIC code of the station
 * @returns The SEO-friendly URL path (e.g., "/station/helsinki")
 */
export function getStationSeoUrl(stationUICCode: number): string | null {
    const stations = stationTranslations.stations as StationTranslation[];
    const station = stations.find(s => s.stationUICCode === stationUICCode);
    
    if (!station) return null;
    
    return `/station/${stationNameToSlug(station.stationName_fi)}`;
}
