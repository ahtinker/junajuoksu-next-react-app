'use client';

import { useTranslations } from 'next-intl';

export default function Timetables() {
    const t = useTranslations();

    return (
        <div className="container">
            <div className="columns is-centered">
                <div className="column is-8">
                    <div className="box">
                        <h1 className="title has-text-centered">
                            {t('timetables.title')}
                        </h1>
                        <p className="subtitle has-text-centered">
                            {t('timetables.subtitle')}
                        </p>

                        <div className="content">
                            <div className="notification is-info">
                                <p className="has-text-centered">
                                    <i className="fas fa-clock"></i>&nbsp;
                                    {t('timetables.comingSoon')}
                                </p>
                            </div>

                            <div className="has-text-centered">
                                <p>{t('timetables.description')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
