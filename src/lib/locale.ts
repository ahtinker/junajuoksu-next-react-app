'use client';

export function setLocale(locale: string) {
    // Set cookie for server-side locale detection
    document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;

    // Reload page to apply new locale
    window.location.reload();
}

export function getLocale(): string {
    if (typeof window === 'undefined') return 'fi';

    const cookies = document.cookie.split(';');
    const localeCookie = cookies.find(cookie => cookie.trim().startsWith('locale='));

    if (localeCookie) {
        return localeCookie.split('=')[1];
    }

    return 'fi';
}
