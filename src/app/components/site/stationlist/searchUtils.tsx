import stationTranslations from '../../../resources/station_translations.json';

// Levenshtein distance calculation
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
    const stationsWithScores = stationTranslations.stations.map((station: any) => {
        // Determine the primary name to use for the current language
        const currentLangName =
            station[`stationName_${currentLocale}`] ||
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
