/**
 * Sitemap Generator Script
 * 
 * This script generates a static sitemap.xml file from the station translations.
 * It can be run independently of the Next.js build process.
 * 
 * Usage: node scripts/generate-sitemap.js
 *    or: npm run generate-sitemap
 */

const fs = require('fs');
const path = require('path');

// Read station translations
const stationTranslationsPath = path.join(__dirname, '../src/app/resources/station_translations.json');
const stationTranslations = JSON.parse(fs.readFileSync(stationTranslationsPath, 'utf-8'));

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://junajuoksu.fi';
const OUTPUT_PATH = path.join(__dirname, '../public/sitemap.xml');

/**
 * Convert station name to SEO-friendly URL slug
 * Preserves Finnish/Swedish special characters (ä, ö, å) via URL encoding
 */
function stationNameToSlug(stationName) {
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
 * Get current date in ISO format for sitemap
 */
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Generate station URLs
 */
function getStationUrls() {
    const stations = stationTranslations.stations;
    const lastmod = getCurrentDate();
    
    return stations.map((station) => ({
        loc: `${BASE_URL}/station/${stationNameToSlug(station.stationName_fi)}`,
        lastmod,
        changefreq: 'daily',
        priority: 0.8,
    }));
}

/**
 * Get static page URLs
 */
function getStaticUrls() {
    const lastmod = getCurrentDate();
    
    return [
        {
            loc: BASE_URL,
            lastmod,
            changefreq: 'daily',
            priority: 1.0,
        },
        {
            loc: `${BASE_URL}/blog`,
            lastmod,
            changefreq: 'weekly',
            priority: 0.7,
        },
        {
            loc: `${BASE_URL}/blog/1`,
            lastmod,
            changefreq: 'monthly',
            priority: 0.6,
        },
        {
            loc: `${BASE_URL}/blog/2`,
            lastmod,
            changefreq: 'monthly',
            priority: 0.6,
        },
        {
            loc: `${BASE_URL}/legal/privacy-policy`,
            lastmod,
            changefreq: 'yearly',
            priority: 0.3,
        },
        {
            loc: `${BASE_URL}/legal/terms-of-service`,
            lastmod,
            changefreq: 'yearly',
            priority: 0.3,
        },
    ];
}

/**
 * Generate XML sitemap content
 */
function generateSitemapXml(urls) {
    const urlElements = urls
        .map(
            (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
        )
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
}

/**
 * Main function to generate the sitemap
 */
function main() {
    console.log('🗺️  Generating sitemap...');
    
    const staticUrls = getStaticUrls();
    const stationUrls = getStationUrls();
    const allUrls = [...staticUrls, ...stationUrls];
    
    console.log(`📍 Found ${staticUrls.length} static pages`);
    console.log(`🚉 Found ${stationUrls.length} station pages`);
    console.log(`📊 Total URLs: ${allUrls.length}`);
    
    const sitemapXml = generateSitemapXml(allUrls);
    
    fs.writeFileSync(OUTPUT_PATH, sitemapXml, 'utf-8');
    
    console.log(`✅ Sitemap generated successfully at: ${OUTPUT_PATH}`);
    
    // Print some example URLs
    console.log('\n📋 Example station URLs:');
    stationUrls.slice(0, 5).forEach((url) => {
        console.log(`   ${url.loc}`);
    });
    console.log('   ...');
}

main();
