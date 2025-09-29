import stationTranslations from '../app/resources/station_translations.json';
import stationGrammarForms from '../app/resources/station_cases.json';

// Station feature interface for type safety
export interface StationFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        passengerTraffic: boolean;
        type: 'STATION';
        stationName: string;
        stationShortCode: string;
        stationUICCode: number;
        countryCode: string;
    };
}

// Station translation interface
export interface Station {
    stationUICCode: number;
    stationName_fi: string;
    stationName_sv: string;
    stationName_en: string;
    stationBackground?: string;
}

// Station grammar forms interface
export interface StationGrammarForm {
    stationUICCode: number;
    stationName_fi: string;
    illative: string;
    elative: string;
}

/**
 * Get station name by locale with fallback
 * @param station - Station translation object
 * @param locale - Current locale (e.g., 'fi', 'sv', 'en')
 * @returns Station name in the specified locale or fallback
 */
export const getStationNameByLocale = (station: Station, locale: string): string => {
    switch (locale) {
        case 'fi':
            return station.stationName_fi;
        case 'sv':
            return station.stationName_sv;
        case 'en':
            return station.stationName_en;
        default:
            return station.stationName_fi;
    }
};

/**
 * Get translated station name based on locale with fallback hierarchy
 * @param stationUICCode - The UIC code of the station
 * @param locale - Current locale (e.g., 'fi', 'sv', 'en')
 * @param stations - Optional array of station features for API fallback
 * @returns Translated station name
 */
export function getTranslatedStationName(
    stationUICCode: number,
    locale: string,
    stations?: StationFeature[]
): string {
    const translation = stationTranslations.stations.find(
        station => station.stationUICCode === stationUICCode
    );

    if (!translation) {
        // Fallback to the original station name from API if stations array is provided
        if (stations) {
            const station = stations.find(s => s.properties.stationUICCode === stationUICCode);
            return station?.properties.stationName || '';
        }
        // If no stations array provided, return empty string
        return '';
    }

    // Get name based on current locale with fallback priority
    const localeKey = `stationName_${locale}` as keyof typeof translation;
    let stationName = String(translation[localeKey] || '');

    // Fallback hierarchy: current locale -> Finnish -> Swedish -> English -> original API name
    if (!stationName || stationName.trim() === '') {
        stationName = String(translation.stationName_fi || '');
    }
    if (!stationName || stationName.trim() === '') {
        stationName = String(translation.stationName_sv || '');
    }
    if (!stationName || stationName.trim() === '') {
        stationName = String(translation.stationName_en || '');
    }
    if (!stationName || stationName.trim() === '') {
        // Final fallback to API name if stations array is provided
        if (stations) {
            const station = stations.find(s => s.properties.stationUICCode === stationUICCode);
            stationName = station?.properties.stationName || '';
        }
    }

    return stationName;
}

/**
 * Get translated station name for station details (when we already have the station object)
 * @param stationUICCode - The UIC code of the station
 * @param locale - Current locale (e.g., 'fi', 'sv', 'en')
 * @param fallbackName - The original station name from the API as fallback
 * @returns Translated station name
 */
export function getTranslatedStationNameWithFallback(
    stationUICCode: number,
    locale: string,
    fallbackName: string
): string {
    const translation = stationTranslations.stations.find(
        station => station.stationUICCode === stationUICCode
    );

    if (!translation) {
        // Fallback to the original station name from API
        return fallbackName;
    }

    // Get name based on current locale with fallback priority
    const localeKey = `stationName_${locale}` as keyof typeof translation;
    let stationName = String(translation[localeKey] || '');

    // Fallback hierarchy: current locale -> Finnish -> Swedish -> English -> original API name
    if (!stationName || stationName.trim() === '') {
        stationName = String(translation.stationName_fi || '');
    }
    if (!stationName || stationName.trim() === '') {
        stationName = String(translation.stationName_sv || '');
    }
    if (!stationName || stationName.trim() === '') {
        stationName = String(translation.stationName_en || '');
    }
    if (!stationName || stationName.trim() === '') {
        // Final fallback to API name
        stationName = fallbackName;
    }

    return stationName;
}

/**
 * Get station grammar forms (illative and elative) by UIC code
 * @param stationUICCode - The UIC code of the station
 * @param locale - Current locale (e.g., 'fi', 'sv', 'en')
 * @returns Object with illative and elative forms, or null if not found
 */
export function getStationGrammarForms(
    stationUICCode: number,
    locale: string = 'fi'
): { illative: string; elative: string; inessive: string; } | null {
    // For Swedish and English, use the regular translated station name for both forms
    if (locale === 'sv' || locale === 'en') {
        const translation = getTranslatedStationNameWithFallback(stationUICCode, locale, "Unknown Station");

        return {
            illative: translation,
            elative: translation,
            inessive: translation
        };
    }

    // For Finnish (and default), use the proper grammatical forms
    const grammarForm = stationGrammarForms.stations.find(
        station => station.stationUICCode === stationUICCode
    );

    if (!grammarForm) {
        return null;
    }

    return {
        illative: grammarForm.illative,
        elative: grammarForm.elative,
        inessive: grammarForm.inessive
    };
}

/**
 * Get station background image URL by UIC code
 * @param stationUICCode - The UIC code of the station
 * @returns The background image URL or undefined if not found
 */
export function getStationBackgroundByUicCode(stationUICCode: number): string | undefined {
    const translation = stationTranslations.stations.find(
        station => station.stationUICCode === stationUICCode
    );
    return translation?.stationBackground || "var(--bulma-primary)";
}

// Levenshtein distance calculation for search functionality
export const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[len1][len2];
};

// Simple similarity calculation using multiple approaches
export const calculateSimpleScore = (searchTerm: string, stationName: string): number => {
    if (!searchTerm || !stationName) return 0;

    const search = searchTerm.toLowerCase().trim();
    const station = stationName.toLowerCase().trim();

    if (search === station) return 1.0; // Perfect match
    if (station.includes(search)) return 0.9; // Substring match
    if (station.startsWith(search)) return 0.8; // Starts with
    if (station.endsWith(search)) return 0.7; // Ends with

    // Simple character overlap
    const searchChars = new Set(search.split(''));
    const stationChars = new Set(station.split(''));
    const intersection = new Set([...searchChars].filter(x => stationChars.has(x)));
    const union = new Set([...searchChars, ...stationChars]);

    return intersection.size / union.size * 0.5; // Jaccard similarity
};

// Main search function
export const getSearchResults = (searchTerm: string, currentLocale: string, resultsPerPage = 5) => {
    if (!searchTerm.trim()) return [];

    const threshold = 0.1; // Very low threshold

    // Calculate similarity scores for all stations
    const stationsWithScores = stationTranslations.stations.map((station: Station) => {
        // Determine the primary name to use for the current language
        const currentLangName =
            getStationNameByLocale(station, currentLocale) ||
            station.stationName_fi ||
            station.stationName_sv ||
            station.stationName_en || '';

        const otherLangNames = [
            station.stationName_fi || '',
            station.stationName_sv || '',
            station.stationName_en || ''
        ].filter((name: string) => name.length > 0 && name !== currentLangName);

        // Calculate score for the current language name
        const currentLangScore = calculateSimpleScore(searchTerm, currentLangName);

        // Calculate scores for other language names
        const otherLangScores = otherLangNames.map(name => calculateSimpleScore(searchTerm, name));
        const bestOtherLangScore = Math.max(...otherLangScores, 0);

        // Prioritize current language but include high-scoring other languages
        const finalScore = currentLangScore >= threshold ? currentLangScore : bestOtherLangScore;

        return {
            ...station,
            similarity: finalScore,
            isCurrentLang: currentLangScore >= threshold // Flag to indicate if the match is in the current language
        };
    });

    // Filter and sort by similarity score
    const filtered = stationsWithScores
        .filter(station => station.similarity >= threshold)
        .sort((a, b) => {
            // Prioritize current language matches, then by similarity score
            if (b.isCurrentLang !== a.isCurrentLang) {
                return b.isCurrentLang ? 1 : -1;
            }
            return b.similarity - a.similarity;
        });

    // Return only the first 5 results
    return filtered.slice(0, resultsPerPage);
};
