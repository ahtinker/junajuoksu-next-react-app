"use client";
import { useEffect } from 'react';
import stationTranslations from '../../resources/station_translations.json';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://junajuoksu.fi';

interface StationTranslation {
    stationUICCode: number;
    stationName_fi: string;
    stationName_sv: string;
    stationName_en: string;
}

/**
 * Convert station name to SEO-friendly URL slug
 * Preserves Finnish/Swedish special characters (ä, ö, å) via URL encoding
 */
function stationNameToSlug(stationName: string): string {
    const slug = stationName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zäöåü0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return encodeURIComponent(slug);
}

/**
 * Find station by various identifiers (UIC code, short code, or name)
 */
async function findStationUicCode(stationId: string): Promise<number | null> {
    try {
        // First check if it's a numeric UIC code
        if (!isNaN(Number(stationId))) {
            return Number(stationId);
        }

        // Fetch station data to find by short code or name
        const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations.geojson');
        const data = await response.json();

        for (const station of data.features) {
            const props = station.properties;

            // Check short code
            if (props.stationShortCode.toLowerCase() === stationId.toLowerCase()) {
                return props.stationUICCode;
            }

            // Check station name
            if (props.stationName.toLowerCase() === decodeURIComponent(stationId).toLowerCase()) {
                return props.stationUICCode;
            }

            // Check translated names
            const translationEntry = stationTranslations.stations.find(
                (s: StationTranslation) => s.stationUICCode === props.stationUICCode
            );
            if (translationEntry) {
                const names = [
                    translationEntry.stationName_fi,
                    translationEntry.stationName_sv,
                    translationEntry.stationName_en
                ].filter(name => name && name.trim() !== '');

                for (const name of names) {
                    if (name.toLowerCase() === decodeURIComponent(stationId).toLowerCase()) {
                        return props.stationUICCode;
                    }
                }
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Get the canonical URL for a station by UIC code
 */
function getCanonicalUrl(uicCode: number): string | null {
    const station = stationTranslations.stations.find(
        (s: StationTranslation) => s.stationUICCode === uicCode
    );

    if (!station) return null;

    const slug = stationNameToSlug(station.stationName_fi);
    return `${BASE_URL}/station/${slug}`;
}

/**
 * Custom hook to add/update canonical URL link tag for station pages
 * This ensures search engines know the preferred URL is the SEO-friendly one
 */
export function useCanonicalUrl(stationId: string | null) {
    useEffect(() => {
        if (!stationId) return;

        let isMounted = true;

        const updateCanonical = async () => {
            const uicCode = await findStationUicCode(stationId);
            if (!isMounted || !uicCode) return;

            const canonicalUrl = getCanonicalUrl(uicCode);
            if (!canonicalUrl) return;

            // Find existing canonical link or create new one
            let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

            if (!canonicalLink) {
                canonicalLink = document.createElement('link');
                canonicalLink.rel = 'canonical';
                document.head.appendChild(canonicalLink);
            }

            canonicalLink.href = canonicalUrl;
        };

        updateCanonical();

        return () => {
            isMounted = false;
        };
    }, [stationId]);
}
