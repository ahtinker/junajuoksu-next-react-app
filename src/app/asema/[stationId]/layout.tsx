import type { Metadata } from 'next';
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
 * Find station info by various identifiers
 */
async function findStation(stationId: string): Promise<{ uicCode: number; name: string } | null> {
    try {
        const response = await fetch('https://rata.digitraffic.fi/api/v1/metadata/stations.geojson', {
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        const data = await response.json();

        for (const station of data.features) {
            const props = station.properties;

            // Check UIC code
            if (!isNaN(Number(stationId)) && props.stationUICCode === Number(stationId)) {
                return { uicCode: props.stationUICCode, name: props.stationName };
            }

            // Check short code
            if (props.stationShortCode.toLowerCase() === stationId.toLowerCase()) {
                return { uicCode: props.stationUICCode, name: props.stationName };
            }

            // Check station name
            const decodedId = decodeURIComponent(stationId).toLowerCase();
            if (props.stationName.toLowerCase() === decodedId) {
                return { uicCode: props.stationUICCode, name: props.stationName };
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
                    if (name.toLowerCase() === decodedId) {
                        return { uicCode: props.stationUICCode, name: props.stationName };
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
 * Get canonical URL for a station
 */
function getCanonicalUrl(uicCode: number): string | null {
    const station = stationTranslations.stations.find(
        (s: StationTranslation) => s.stationUICCode === uicCode
    );

    if (!station) return null;

    const slug = stationNameToSlug(station.stationName_fi);
    return `${BASE_URL}/asema/${slug}`;
}

type Props = {
    params: Promise<{ stationId: string }>;
    children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { stationId } = await params;
    const stationInfo = await findStation(stationId);

    if (!stationInfo) {
        return {
            title: 'Asema - Junajuoksu',
        };
    }

    const canonicalUrl = getCanonicalUrl(stationInfo.uicCode);

    // Get translated name for title
    const translationEntry = stationTranslations.stations.find(
        (s: StationTranslation) => s.stationUICCode === stationInfo.uicCode
    );
    const stationName_fi = translationEntry?.stationName_fi || stationInfo.name;
    const stationName_sv = translationEntry?.stationName_sv || '';
    const stationName_en = translationEntry?.stationName_en || '';

    // Build keywords array with station name variations
    const keywords = [
        'juna',
        'junat',
        'juna-aikataulut',
        'junan aikataulut',
        'trains',
        'train timetables',
        'tåg',
        'tågtidtabeller',
        stationName_fi,
        `${stationName_fi} juna`,
        `${stationName_fi} aikataulut`,
        `${stationName_fi} asema`,
        `${stationName_fi} lähtevät junat`,
        `${stationName_fi} saapuvat junat`,
        `${stationName_fi} train`,
        `${stationName_fi} station`,
    ];

    // Add Swedish and English station names if available
    if (stationName_sv) {
        keywords.push(stationName_sv, `${stationName_sv} tåg`, `${stationName_sv} station`);
    }
    if (stationName_en) {
        keywords.push(stationName_en, `${stationName_en} train`, `${stationName_en} station`);
    }

    return {
        title: `${stationName_fi} - Saapuvat ja lähtevät junat reaaliajassa`,
        description: `🚂 Katso juna-aseman ${stationName_fi} aikataulut reaaliajassa, sekunnin tarkkuudella - Junajuoksu.fi`,
        keywords: keywords.filter(k => k).join(', '),
        alternates: {
            canonical: canonicalUrl || undefined,
        },
    };
}

export default function StationLayout({ children }: Props) {
    return children;
}
