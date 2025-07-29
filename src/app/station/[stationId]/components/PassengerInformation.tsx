'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';

interface PassengerInformationProps {
    stationShortCode: string;
}

interface PassengerInfo {
    id: string;
    version: number;
    creationDateTime: string;
    startValidity: string;
    endValidity: string;
    stations: string[];
    video: {
        text: {
            fi: string;
            sv: string;
            en: string;
        };
        deliveryRules: Record<string, unknown>;
    };
    audio: {
        text: {
            fi: string;
            sv: string;
            en: string;
        };
        deliveryRules: Record<string, unknown>;
    };
}

export default function PassengerInformation({ stationShortCode }: PassengerInformationProps) {
    const t = useTranslations();
    const locale = useLocale();
    const [passengerInfo, setPassengerInfo] = useState<PassengerInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPassengerInfo = async () => {
            if (!stationShortCode) return;

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/passenger-information/active?station=${stationShortCode}&only_general=true`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch passenger information');
                }

                const data = await response.json();
                setPassengerInfo(data.filter((info: PassengerInfo) => {
                    if (info.audio?.deliveryRules.deliveryType === "NOW" || info.video?.deliveryRules.deliveryType === "NOW") {
                        return false; // Exclude NOW delivery type
                    }
                    return true
                }) || []);
            } catch (err) {
                console.error('Error fetching passenger information:', err);
                setError('Failed to load passenger information');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPassengerInfo();
    }, [stationShortCode]);

    const getLocalizedText = (textObj: { fi: string; sv: string; en: string }) => {
        const localeKey = locale as 'fi' | 'sv' | 'en';
        return textObj[localeKey] || textObj.fi || textObj.en || '';
    };

    if (passengerInfo.length === 0 || error || isLoading) {
        return <></>;
    }

    return (
        <article className="panel is-shadowless is-warning has-text-left">
            <div className="panel-heading">
                <span className="icon-text">
                    <span className="icon">
                        <i className="fas fa-triangle-exclamation"></i>
                    </span>
                    <span>{t('timetables.passengerInformation.title')}</span>
                </span>
            </div>
            {passengerInfo.map((info) => {
                const localizedText = getLocalizedText(info.video?.text || info.audio?.text || { fi: 'Tapahtui virhe', sv: 'Ett problem dök upp', en: 'Parsing error' });

                return (
                    <div key={info.id} className="panel-block is-block p-5 themebackground"  >
                        <p style={{ whiteSpace: 'pre-line' }}>
                            {localizedText}
                        </p>
                    </div>
                );
            })}
        </article>
    );
}
