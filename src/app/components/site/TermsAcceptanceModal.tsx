'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface PendingUser {
    email: string;
    name: string;
    picture: string;
}

interface TermsAcceptanceModalProps {
    isOpen: boolean;
    pendingUser: PendingUser | null;
    onAccept: () => void;
    onDecline: () => void;
    isLoading?: boolean;
}

const TermsAcceptanceModal = ({
    isOpen,
    pendingUser,
    onAccept,
    onDecline,
    isLoading = false,
}: TermsAcceptanceModalProps) => {
    const t = useTranslations();

    if (!isOpen || !pendingUser) return null;

    return (
        <div className={`modal ${isOpen ? 'is-active' : ''}`}>
            <div className="modal-background" onClick={onDecline}></div>
            <div className="modal-card" style={{ maxWidth: '500px' }}>
                <header className="modal-card-head ">
                    <p className="modal-card-title">
                        {t('auth.termsModal.title')}
                    </p>
                </header>
                <section className="modal-card-body pt-0">
                    <div className="has-text-centered mb-4">
                        {pendingUser.picture && (
                            <figure className="image is-96x96 is-inline-block mb-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={pendingUser.picture}
                                    alt={pendingUser.name}
                                    className="is-rounded"
                                    referrerPolicy="no-referrer"
                                />
                            </figure>
                        )}
                        <p className="has-text-weight-semibold is-size-5">
                            {pendingUser.name}
                        </p>
                        <p className="has-text-grey is-size-7">
                            {pendingUser.email}
                        </p>
                    </div>

                    <div className="content has-text-left">
                        <p>{t('auth.termsModal.description')}</p>
                        <ul>
                            <li>
                                <Link href="/legal/terms-of-service" target="_blank" className="has-text-link">
                                    {t('auth.termsModal.termsOfService')}
                                </Link>
                            </li>
                            <li>
                                <Link href="/legal/privacy-policy" target="_blank" className="has-text-link">
                                    {t('auth.termsModal.privacyPolicy')}
                                </Link>
                            </li>
                        </ul>
                        <p className="is-size-7 has-text-grey">
                            {t('auth.termsModal.disclaimer')}
                        </p>
                    </div>
                </section>
                <footer className="modal-card-foot buttons" style={{ justifyContent: 'flex-end' }}>
                    <button
                        className="button"
                        onClick={onDecline}
                        disabled={isLoading}
                    >
                        {t('auth.termsModal.decline')}
                    </button>
                    <button
                        className={`button is-primary ${isLoading ? 'is-loading' : ''}`}
                        onClick={onAccept}
                        disabled={isLoading}
                    >
                        {t('auth.termsModal.accept')}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default TermsAcceptanceModal;
