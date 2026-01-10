import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://junajuoksu.fi';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/train/',      // Train pages are dynamic and not suitable for indexing
                    '/api/',        // API routes should not be indexed
                    '/login',       // Login page doesn't need to be indexed
                ],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    };
}
