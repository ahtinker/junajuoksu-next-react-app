/**
 * Legal documents configuration
 * Update these timestamps whenever the legal documents are modified
 * Users will be prompted to re-accept the terms when these dates change
 */

export const legalConfig = {
    // Contact email for data deletion requests and legal inquiries
    contactEmail: 'support@junajuoksu.fi',

    // Last update timestamps for legal documents (ISO 8601 format)
    termsOfService: {
        lastUpdated: '2026-01-18T20:01:00.000Z',
        version: '1.0.0',
    },
    privacyPolicy: {
        lastUpdated: '2026-01-19T00:00:00.000Z',
        version: '1.0.0',
    },

    /**
     * Get the most recent update date across all legal documents
     * This is used to determine if a user needs to re-accept terms
     */
    getLatestUpdateDate(): Date {
        const dates = [
            new Date(this.termsOfService.lastUpdated),
            new Date(this.privacyPolicy.lastUpdated),
        ];
        return new Date(Math.max(...dates.map(d => d.getTime())));
    },

    /**
     * Check if the user needs to re-accept terms based on their last acceptance date
     */
    needsReAcceptance(lastAcceptedAt: Date | string | null): boolean {
        if (!lastAcceptedAt) return true;

        const acceptedDate = typeof lastAcceptedAt === 'string'
            ? new Date(lastAcceptedAt)
            : lastAcceptedAt;

        return this.getLatestUpdateDate() > acceptedDate;
    },
};

export type LegalConfig = typeof legalConfig;
