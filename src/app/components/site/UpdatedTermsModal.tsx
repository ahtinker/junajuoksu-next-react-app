'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface UpdatedTermsModalProps {
    isOpen: boolean;
    contactEmail: string;
    onAccept: () => void;
    onLogout: () => void;
    isLoading?: boolean;
}

const UpdatedTermsModal = ({
    isOpen,
    contactEmail,
    onAccept,
    onLogout,
    isLoading = false,
}: UpdatedTermsModalProps) => {
    const t = useTranslations();

    if (!isOpen) return null;

    return (
        <div className={`modal ${isOpen ? 'is-active' : ''}`}>
            <div className="modal-background"></div>
            <div className="modal-card" style={{ maxWidth: '500px' }}>
                <header className="modal-card-head is-shadowless">
                    <p className="modal-card-title">
                        {t('auth.updatedTermsModal.title')}
                    </p>
                </header>
                <section className="modal-card-body pt-0">
                    <div className="content has-text-left">
                        <div className="notification">

                            <span>{t('auth.updatedTermsModal.notice')}</span>
                        </div>

                        <p>{t('auth.updatedTermsModal.description')}</p>

                        <ul>
                            <li>
                                <Link href="/legal/terms-of-service" target="_blank" className="has-text-link">
                                    {t('auth.updatedTermsModal.termsOfService')}
                                </Link>
                            </li>
                            <li>
                                <Link href="/legal/privacy-policy" target="_blank" className="has-text-link">
                                    {t('auth.updatedTermsModal.privacyPolicy')}
                                </Link>
                            </li>
                        </ul>

                        <p className="is-size-7 has-text-grey">
                            {t('auth.updatedTermsModal.disclaimer')}
                        </p>

                        <hr />

                        <p className="is-size-7">
                            {t('auth.updatedTermsModal.dataRequest')}{' '}
                            <a href={`mailto:${contactEmail}`} className="has-text-link">
                                {contactEmail}
                            </a>
                        </p>
                    </div>
                </section>
                <footer className="modal-card-foot buttons" style={{ justifyContent: 'flex-end' }}>
                    <button
                        className="button"
                        onClick={onLogout}
                        disabled={isLoading}
                    >
                        {t('auth.updatedTermsModal.logout')}
                    </button>
                    <button
                        className={`button is-primary ${isLoading ? 'is-loading' : ''}`}
                        onClick={onAccept}
                        disabled={isLoading}
                    >
                        {t('auth.updatedTermsModal.accept')}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default UpdatedTermsModal;
