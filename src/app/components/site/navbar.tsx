'use client';

import Logo from "./logo/logo";
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { useTranslations, useLocale } from 'next-intl';
import { setLocale } from '../../../lib/locale';
import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import TermsAcceptanceModal from './TermsAcceptanceModal';

// Constants for localStorage keys
const PENDING_CREDENTIAL_KEY = 'pending_google_credential';
const PENDING_USER_KEY = 'pending_google_user';

// Helper function to get cookie value
function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
    }
    return null;
}

interface PendingUser {
    email: string;
    name: string;
    picture: string;
}

// Google Identity Services types
declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: GoogleIdConfiguration) => void;
                    prompt: (callback?: (notification: PromptMomentNotification) => void) => void;
                    renderButton: (element: HTMLElement, config: GoogleButtonConfiguration) => void;
                    disableAutoSelect: () => void;
                    revoke: (email: string, callback: () => void) => void;
                };
            };
        };
    }
}

interface GoogleIdConfiguration {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
}

interface GoogleCredentialResponse {
    credential: string;
    select_by: string;
}

interface PromptMomentNotification {
    isDisplayMoment: () => boolean;
    isDisplayed: () => boolean;
    isNotDisplayed: () => boolean;
    getNotDisplayedReason: () => string;
    isSkippedMoment: () => boolean;
    getSkippedReason: () => string;
    isDismissedMoment: () => boolean;
    getDismissedReason: () => string;
}

interface GoogleButtonConfiguration {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number;
    locale?: string;
}

const GOOGLE_CLIENT_ID = "329262926570-c42l0cp1g01n80grfafhvgou5vomc9mk.apps.googleusercontent.com";

const NavBar = () => {
    const t = useTranslations();
    const currentLocale = useLocale();
    const pathname = usePathname();
    const [user, setUser] = useState<{ id?: number; email: string; name: string; picture: string } | null>(null);
    const [avatarError, setAvatarError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check if we're on a legal page (don't show auth UI on these pages)
    const isLegalPage = pathname?.startsWith('/legal');

    // Terms acceptance modal state
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
    const [pendingCredential, setPendingCredential] = useState<string | null>(null);
    const [isTermsLoading, setIsTermsLoading] = useState(false);

    // Check for pending terms acceptance on mount (persists across refresh)
    // Don't show on legal pages so user can read terms/privacy
    useEffect(() => {
        if (isLegalPage) return;

        const storedCredential = localStorage.getItem(PENDING_CREDENTIAL_KEY);
        const storedPendingUser = localStorage.getItem(PENDING_USER_KEY);

        if (storedCredential && storedPendingUser) {
            try {
                const parsedUser = JSON.parse(storedPendingUser);
                setPendingCredential(storedCredential);
                setPendingUser(parsedUser);
                setShowTermsModal(true);
            } catch {
                // Clear invalid data
                localStorage.removeItem(PENDING_CREDENTIAL_KEY);
                localStorage.removeItem(PENDING_USER_KEY);
            }
        }
    }, [isLegalPage]);

    // Check session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const response = await fetch('/api/auth/google');
                const data = await response.json();
                if (data.authenticated && data.user) {
                    setUser(data.user);
                    // Also update localStorage for consistency
                    localStorage.setItem('google_user', JSON.stringify(data.user));
                    // Clear any pending terms data if user is authenticated
                    localStorage.removeItem(PENDING_CREDENTIAL_KEY);
                    localStorage.removeItem(PENDING_USER_KEY);
                } else {
                    // Check localStorage as fallback (for when DB is not available)
                    const storedUser = localStorage.getItem('google_user');
                    if (storedUser) {
                        try {
                            setUser(JSON.parse(storedUser));
                        } catch {
                            localStorage.removeItem('google_user');
                        }
                    }
                }
            } catch (error) {
                // Fallback to localStorage if API fails
                const storedUser = localStorage.getItem('google_user');
                if (storedUser) {
                    try {
                        setUser(JSON.parse(storedUser));
                    } catch {
                        localStorage.removeItem('google_user');
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };
        checkSession();
    }, []);

    const handleTermsAccept = async () => {
        if (!pendingCredential) return;

        setIsTermsLoading(true);
        try {
            // Create the user account
            const response = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    credential: pendingCredential,
                    g_csrf_token: getCookie('g_csrf_token'),
                    action: 'create',
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Clear pending data
                localStorage.removeItem(PENDING_CREDENTIAL_KEY);
                localStorage.removeItem(PENDING_USER_KEY);
                // Store user and reload
                localStorage.setItem('google_user', JSON.stringify(data.user));
                window.location.reload();
            } else {
                console.error('Failed to create account:', data.error);
                // Clear pending data on error
                localStorage.removeItem(PENDING_CREDENTIAL_KEY);
                localStorage.removeItem(PENDING_USER_KEY);
                setShowTermsModal(false);
                setPendingUser(null);
                setPendingCredential(null);
            }
        } catch (error) {
            console.error('Error creating account:', error);
        } finally {
            setIsTermsLoading(false);
        }
    };

    const handleTermsDecline = async () => {
        // Clear all pending data
        localStorage.removeItem(PENDING_CREDENTIAL_KEY);
        localStorage.removeItem(PENDING_USER_KEY);
        localStorage.removeItem('google_user');

        // Clear session cookie if any
        try {
            await fetch('/api/auth/google', { method: 'DELETE' });
        } catch {
            // Ignore errors
        }

        // Disable Google auto-select
        if (window.google) {
            window.google.accounts.id.disableAutoSelect();
        }

        // Close modal and reset state
        setShowTermsModal(false);
        setPendingUser(null);
        setPendingCredential(null);

        // Reload to reset Google button state
        window.location.reload();
    };

    const handleGoogleCallback = useCallback(async (response: GoogleCredentialResponse) => {
        console.log("Received Google credential");

        try {
            // First, check if the user already exists
            const checkResponse = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    credential: response.credential,
                    g_csrf_token: getCookie('g_csrf_token'),
                    action: 'check',
                }),
            });

            const checkData = await checkResponse.json();

            if (!checkResponse.ok) {
                console.error("Server check failed:", checkData.error);
                return;
            }

            if (checkData.exists) {
                // Existing user - log them in directly
                const authResponse = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        credential: response.credential,
                        g_csrf_token: getCookie('g_csrf_token'),
                    }),
                });

                const authData = await authResponse.json();

                if (authResponse.ok && authData.success) {
                    localStorage.setItem('google_user', JSON.stringify(authData.user));
                    window.location.reload();
                } else {
                    console.error("Server authentication failed:", authData.error);
                }
            } else {
                // New user - show terms acceptance modal
                // Store credential and pending user info in localStorage (persists across refresh)
                localStorage.setItem(PENDING_CREDENTIAL_KEY, response.credential);
                localStorage.setItem(PENDING_USER_KEY, JSON.stringify(checkData.pendingUser));

                setPendingCredential(response.credential);
                setPendingUser(checkData.pendingUser);
                setShowTermsModal(true);
            }
        } catch (error) {
            console.error("Error during authentication:", error);
            // Fallback to client-side decoding for display only
            try {
                const payload = JSON.parse(atob(response.credential.split('.')[1]));
                // Store as pending user requiring terms acceptance
                const pendingUserData = {
                    email: payload.email,
                    name: payload.name,
                    picture: payload.picture,
                };
                localStorage.setItem(PENDING_CREDENTIAL_KEY, response.credential);
                localStorage.setItem(PENDING_USER_KEY, JSON.stringify(pendingUserData));

                setPendingCredential(response.credential);
                setPendingUser(pendingUserData);
                setShowTermsModal(true);
            } catch (decodeError) {
                console.error("Error decoding token:", decodeError);
            }
        }
    }, []);

    const initializeGoogle = useCallback(() => {
        if (window.google && !isLoading) {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCallback,
                auto_select: false,
                cancel_on_tap_outside: true,
            });

            // Only render buttons if user is not logged in
            if (!user) {
                // Detect if dark mode is active
                const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const buttonTheme = isDarkMode ? 'filled_black' : 'outline';

                // Render pill button for desktop
                const desktopButton = document.getElementById('google-signin-desktop');
                if (desktopButton) {
                    window.google.accounts.id.renderButton(desktopButton, {
                        type: 'standard',
                        theme: buttonTheme,
                        size: 'medium',
                        text: 'signin',
                        shape: 'pill',
                        logo_alignment: 'left',
                    });
                }

                // Render circle button for mobile
                const mobileButton = document.getElementById('google-signin-mobile');
                if (mobileButton) {
                    window.google.accounts.id.renderButton(mobileButton, {
                        type: 'icon',
                        theme: buttonTheme,
                        size: 'medium',
                        shape: 'circle',
                    });
                }
            }
        }
    }, [handleGoogleCallback, isLoading, user]);

    useEffect(() => {
        // If Google script is already loaded, initialize
        if (window.google && !isLoading) {
            initializeGoogle();
        }
    }, [initializeGoogle, isLoading]);

    const handleSignOut = async () => {
        try {
            // Call server to clear session
            await fetch('/api/auth/google', { method: 'DELETE' });
        } catch (error) {
            console.error('Error signing out:', error);
        }

        // Clear local storage
        localStorage.removeItem('google_user');

        if (window.google) {
            window.google.accounts.id.disableAutoSelect();
        }
        // Refresh the page to reset Google button state
        window.location.reload();
    };

    const changeLanguage = (lng: string) => {
        setLocale(lng);
    };

    const getCurrentLanguageFlag = () => {
        switch (currentLocale) {
            case 'sv':
                return 'flag_sv.svg';
            case 'en':
                return 'flag_en.svg';
            default:
                return 'flag_fi.svg';
        }
    };

    const getCurrentLanguageName = () => {
        return t(`navbar.language.${currentLocale}`);
    };
    return (
        <>
            {/* Load Google Identity Services script */}
            <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onLoad={initializeGoogle}
            />

            <nav className="navbar px-4" style={{ width: "100%", backgroundColor: "transparent !important" }}>
            <div className="container">
                <div className="navbar-brand">
                    <Link className="navbar-item" href="/">
                        <Logo />
                    </Link>
                </div>
                <div id="navbarMenuHeroA" className="navbar-menu">
                    <div className="navbar-end">
                        <div className="navbar-item pr-0">
                            <div className="dropdown is-hoverable">
                                <div className="dropdown-trigger">
                                    <button className="button is-rounded" aria-haspopup="true" aria-controls="dropdown-menu4">
                                        <span className="icon pr-1">
                                            <Image src={`/${getCurrentLanguageFlag()}`} alt={getCurrentLanguageName()} width={20} height={15} />
                                        </span>
                                        <span className="is-hidden-mobile">{getCurrentLanguageName()}</span>
                                        <span className="icon is-small">
                                            <i className="fas fa-angle-down" aria-hidden="true"></i>
                                        </span>
                                    </button>
                                </div>
                                <div className="dropdown-menu has-text-left" role="menu" style={{ minWidth: "150px" }}>
                                    <div className="dropdown-content">
                                        <a href="" className={`dropdown-item p-4 ${currentLocale === 'fi' ? 'is-active has-background-primary has-text-white' : ''}`} onClick={() => changeLanguage('fi')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="icon-text pr-1">
                                                <span className="icon">
                                                    <Image src="/flag_fi.svg" alt="Suomi" width={20} height={15} />
                                                </span>
                                                <span className="has-text-weight-semibold is-size-6">Suomi</span> {/* This text needs to be hard coded so that the translation function is not used, because a foreigner looking for Finnish might not understand the translation. */}
                                            </span>
                                            {currentLocale === 'fi' && <span className="icon is-small"><i className="fas fa-check"></i></span>}
                                        </a>
                                        <a href="" className={`dropdown-item p-4 ${currentLocale === 'sv' ? 'is-active has-background-primary has-text-white' : ''}`} onClick={() => changeLanguage('sv')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="icon-text pr-1">
                                                <span className="icon">
                                                    <Image src="/flag_sv.svg" alt="Svenska" width={20} height={15} />
                                                </span>
                                                <span className="has-text-weight-semibold is-size-6">Svenska</span>
                                            </span>
                                            {currentLocale === 'sv' && <span className="icon is-small"><i className="fas fa-check"></i></span>}
                                        </a>
                                        <a href="" className={`dropdown-item p-4 ${currentLocale === 'en' ? 'is-active has-background-primary has-text-white' : ''}`} onClick={() => changeLanguage('en')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="icon-text pr-1">
                                                <span className="icon">
                                                    <Image src="/flag_en.svg" alt="English" width={20} height={15} />
                                                </span>
                                                <span className="has-text-weight-semibold is-size-6">English</span>
                                            </span>
                                            {currentLocale === 'en' && <span className="icon is-small"><i className="fas fa-check"></i></span>}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="navbar-item">
                                {isLegalPage ? (
                                    // Don't show auth UI on legal pages
                                    null
                                ) : user ? (
                                    <>
                                        {/* Signed in - Desktop */}
                                        <div className="dropdown is-hoverable is-right is-hidden-mobile">
                                            <div className="dropdown-trigger">
                                                <button className="button is-rounded" aria-haspopup="true">
                                                    <span className="icon">
                                                        {!avatarError && user.picture ? (
                                                            <img
                                                                src={user.picture}
                                                                alt={user.name}
                                                                style={{ borderRadius: '50%', width: '24px', height: '24px' }}
                                                                referrerPolicy="no-referrer"
                                                                onError={() => setAvatarError(true)}
                                                            />
                                                        ) : (
                                                            <i className="fas fa-user is-size-6 has-text-primary-60" style={{ fontSize: '24px' }} aria-hidden="true"></i>
                                                        )}
                                                    </span>
                                                    <span>{user.name.split(' ')[0]}</span>
                                                    <span className="icon is-small">
                                                        <i className="fas fa-angle-down" aria-hidden="true"></i>
                                                    </span>
                                                </button>
                                            </div>
                                            <div className="dropdown-menu" role="menu">
                                                <div className="dropdown-content">
                                                    <div className="dropdown-item">
                                                        <p className="has-text-weight-semibold">{user.name}</p>
                                                        <p className="is-size-7 has-text-grey">{user.email}</p>
                                                    </div>
                                                    <hr className="dropdown-divider" />
                                                    <a className="dropdown-item" onClick={handleSignOut}>
                                                        <span className="icon"><i className="fas fa-sign-out-alt"></i></span>
                                                        <span>{t('navbar.signout')}</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Signed in - Mobile */}
                                        <div className="dropdown is-hoverable is-right is-hidden-tablet">
                                            <div className="dropdown-trigger">
                                                <button className="button is-rounded" aria-haspopup="true" style={{ padding: '0', width: '40px', height: '40px' }}>
                                                    {!avatarError && user.picture ? (
                                                        <img
                                                            src={user.picture}
                                                            alt={user.name}
                                                            style={{ borderRadius: '50%', width: '32px', height: '32px' }}
                                                            referrerPolicy="no-referrer"
                                                            onError={() => setAvatarError(true)}
                                                        />
                                                    ) : (
                                                        <i className="fas fa-user is-size-5 has-text-primary-60" style={{ fontSize: '32px' }} aria-hidden="true"></i>
                                                    )}
                                                </button>
                                            </div>
                                            <div className="dropdown-menu" role="menu">
                                                <div className="dropdown-content">
                                                    <div className="dropdown-item">
                                                        <p className="has-text-weight-semibold">{user.name}</p>
                                                        <p className="is-size-7 has-text-grey">{user.email}</p>
                                                    </div>
                                                    <hr className="dropdown-divider" />
                                                    <a className="dropdown-item" onClick={handleSignOut}>
                                                        <span className="icon"><i className="fas fa-sign-out-alt"></i></span>
                                                        <span>{t('navbar.signout')}</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Google Sign-In - Desktop (pill) */}
                                        <div id="google-signin-desktop" className="is-hidden-mobile ml-2" style={{ colorScheme: 'auto', transform: "scale(1.1,1.1)" }}></div>
                                        {/* Google Sign-In - Mobile (circle) */}
                                        <div id="google-signin-mobile" className="is-hidden-tablet" style={{ colorScheme: 'auto', transform: "scale(1.2,1.2)" }}></div>
                                    </>
                                )}
                        </div>

                    </div>
                </div>
            </div>
        </nav>

            {/* Terms Acceptance Modal - Don't show on legal pages */}
            {!isLegalPage && (
                <TermsAcceptanceModal
                    isOpen={showTermsModal}
                    pendingUser={pendingUser}
                    onAccept={handleTermsAccept}
                    onDecline={handleTermsDecline}
                    isLoading={isTermsLoading}
                />
            )}
        </>
    );
}

export default NavBar;