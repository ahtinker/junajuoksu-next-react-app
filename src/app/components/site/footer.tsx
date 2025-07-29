'use client';

import Image from 'next/image';
import Logo from "./logo/logo";
import { useTranslations } from 'next-intl';

const Footer = () => {
    const t = useTranslations();
    return (
        <footer className="footer themebackground">
            <div className="content">
                {/* <strong className="has-text-info-45">Verkkokehitys Ankeriasniemi</strong> */}
                <div className="columns is-desktop has-text-left">
                    <div className="column"></div>

                    <div className="column">
                        <h4>{t('footer.contact')}</h4>
                        <div className="icon-text mb-4">
                            <span className="icon">
                                <i className="fas fa-envelope"></i>
                            </span>
                            <span>support@junajuoksu.fi</span>
                        </div>
                        <Logo />

                    </div>
                    <div className="column is-0 mr-5 is-hidden-touch" style={{ borderStyle: "solid", borderWidth: "0 2px 0 0", borderColor: "var(--bulma-dark)" }}>
                    </div>
                    <hr className="is-hidden-desktop" />
                    <div className="column">
                        <h4>{t('footer.additionalInfo')}</h4>
                        <div>{t('footer.implementedBy')}</div>
                        <Image className="mt-5" src="/va-logo.svg" alt="Verkkokehitys Ankeriasniemi" width={75} height={30} />

                        <div className="my-4">
                            <a href="/privacy" className="has-text-info-45">{t('footer.privacyPolicy')}</a><br />
                            <a href="/terms-of-service" className="has-text-info-45">{t('footer.termsOfService')}</a>
                        </div>

                    </div>
                    <div className="column"></div>

                </div>
            </div>
        </footer>
    );
}

export default Footer;