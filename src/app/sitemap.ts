import { MetadataRoute } from 'next';
import stationTranslations from './resources/station_translations.json';

// Base URL for the site - update this to your production URL
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://junajuoksu.fi';

// Station interface from the translations file
interface StationTranslation {
    stationUICCode: number;
    stationName_fi: string;
    stationName_sv: string;
    stationName_en: string;
    stationBackground?: string;
    backgroundAttribution?: string;
}

/**
 * Convert station name to SEO-friendly URL slug
 * Preserves Finnish/Swedish special characters (ä, ö, å) via URL encoding
 * @param stationName - The station name to convert
 * @returns URL-safe slug (encoded)
 */
function stationNameToSlug(stationName: string): string {
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
 * Get all station URLs for the sitemap
 * Uses station names for SEO-friendly URLs
 */
function getStationUrls(): MetadataRoute.Sitemap {
    const stations = stationTranslations.stations as StationTranslation[];
    
    return stations.map((station) => {
        // Use Finnish name as the URL slug (primary language)
        const slug = stationNameToSlug(station.stationName_fi);
        
        return {
            url: `${BASE_URL}/asema/${slug}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.8,
        };
    });
}

/**
 * Get static page URLs for the sitemap
 */
function getStaticUrls(): MetadataRoute.Sitemap {
    return [
        {
            url: BASE_URL,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/blog`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/blog/1`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/blog/2`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/legal/privacy-policy`,
            lastModified: new Date(),
            changeFrequency: 'yearly' as const,
            priority: 0.3,
        },
        {
            url: `${BASE_URL}/legal/terms-of-service`,
            lastModified: new Date(),
            changeFrequency: 'yearly' as const,
            priority: 0.3,
        },
        {
            url: `${BASE_URL}/login`,
            lastModified: new Date(),
            changeFrequency: 'yearly' as const,
            priority: 0.2,
        },
    ];
}

/**
 * Generate the sitemap for the application
 * Includes static pages and all station pages
 * Excludes train pages as they are dynamic and not meant for SEO
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const staticUrls = getStaticUrls();
    const stationUrls = getStationUrls();
    
    return [...staticUrls, ...stationUrls];
}
