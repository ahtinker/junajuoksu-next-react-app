'use client';

import Logo from "./logo/logo";
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { setLocale } from '../../../lib/locale';

const NavBar = () => {
    const t = useTranslations();
    const currentLocale = useLocale();

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
                                        <a href="#fi" className={`dropdown-item p-4 ${currentLocale === 'fi' ? 'is-active has-background-primary has-text-white' : ''}`} onClick={() => changeLanguage('fi')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="icon-text pr-1">
                                                <span className="icon">
                                                    <Image src="/flag_fi.svg" alt="Suomi" width={20} height={15} />
                                                </span>
                                                <span className="has-text-weight-semibold is-size-6">Suomi</span> {/* This text needs to be hard coded so that the translation function is not used, because a foreigner looking for Finnish might not understand the translation. */}
                                            </span>
                                            {currentLocale === 'fi' && <span className="icon is-small"><i className="fas fa-check"></i></span>}
                                        </a>
                                        <a href="#sv" className={`dropdown-item p-4 ${currentLocale === 'sv' ? 'is-active has-background-primary has-text-white' : ''}`} onClick={() => changeLanguage('sv')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="icon-text pr-1">
                                                <span className="icon">
                                                    <Image src="/flag_sv.svg" alt="Svenska" width={20} height={15} />
                                                </span>
                                                <span className="has-text-weight-semibold is-size-6">Svenska</span>
                                            </span>
                                            {currentLocale === 'sv' && <span className="icon is-small"><i className="fas fa-check"></i></span>}
                                        </a>
                                        <a href="#en" className={`dropdown-item p-4 ${currentLocale === 'en' ? 'is-active has-background-primary has-text-white' : ''}`} onClick={() => changeLanguage('en')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            <Link className="button is-rounded has-text-primary-60 is-hidden-mobile" href="/login">
                                <span className="icon is-small">
                                    <i className="fas fa-user-large" aria-hidden="true"></i>
                                </span>
                                <span>{t('navbar.login')}</span>
                            </Link>
                            <Link className="button is-rounded has-text-primary-60 is-hidden-tablet" href="/login">
                                <span className="icon is-small">
                                    <i className="fas fa-user-large" aria-hidden="true"></i>
                                </span>
                            </Link>
                        </div>

                    </div>
                </div>
            </div>
        </nav>
    );
}

export default NavBar;