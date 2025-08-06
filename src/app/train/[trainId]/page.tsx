'use client';
import '../../App.css';
import "../../globals.scss";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Train } from '../../../lib/types';
import TrainStationStops from './components/TrainStationStops';
import NavBar from '@/app/components/site/navbar';
import Footer from '@/app/components/site/footer';
import { getTranslatedStationNameWithFallback } from '@/lib/stationUtils';
import Link from 'next/link';

//path for this page /train/${train.departureDate}-${train.trainNumber}-${(origin station) stationData.uicCode}-${(origin station) stopIndex (e.g. if the train stops twice at one station, the second stop at that station makes this stopIndex = 1 and the first = 0)}${(the user's wanted destination will be highlighted) selectedDestination ? "-" + selectedDestination.uicCode : ""}`
//api for train data https://rata.digitraffic.fi/api/v1/trains/${train.departureDate}/${train.trainNumber} you can see a sample response with https://rata.digitraffic.fi/api/v1/trains/2017-01-01/1

interface TrainPageParams {
    trainId: string;
    [key: string]: string | string[] | undefined;
}

interface ParsedTrainId {
    departureDate: string;
    trainNumber: string;
    originStationUic: string;
    originStopIndex: string;
    selectedDestinationUic?: string;
}

export default function TrainPage() {
    const params = useParams<TrainPageParams>();
    const t = useTranslations('train');
    const locale = useLocale();
    const [train, setTrain] = useState<Train | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [parsedParams, setParsedParams] = useState<ParsedTrainId | null>(null);

    // Parse the trainId parameter
    useEffect(() => {
        if (!params?.trainId) return;

        const trainIdStr = Array.isArray(params.trainId) ? params.trainId[0] : params.trainId;
        const parts = trainIdStr.split('-');

        if (parts.length >= 4) {
            const parsed: ParsedTrainId = {
                departureDate: parts[0] + "-" + parts[1] + "-" + parts[2],
                trainNumber: parts[3],
                originStationUic: parts[4],
                originStopIndex: parts[5],
                selectedDestinationUic: parts.length > 6 ? parts[6] : undefined
            };
            setParsedParams(parsed);
        } else {
            setError('Invalid train ID format');
            setLoading(false);
        }
    }, [params?.trainId]);

    // Fetch train data
    useEffect(() => {
        if (!parsedParams) return;

        const fetchTrainData = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/trains/${parsedParams.departureDate}/${parsedParams.trainNumber}`
                );

                if (!response.ok) {
                    throw new Error(`Failed to fetch train data: ${response.status}`);
                }

                const trainData: Train[] = await response.json();

                if (trainData && trainData.length > 0) {
                    setTrain(trainData[0]);
                } else {
                    setError('Train not found');
                }
            } catch (err) {
                console.error('Error fetching train data:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch train data');
            } finally {
                setLoading(false);
            }
        };

        fetchTrainData();
    }, [parsedParams]);

    if (loading) {
        return (
            <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <NavBar />
                <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>

                </section>
                <Footer />
            </div>
        );
    }

    if (error) {
        return (
            <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <NavBar />
                <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                    <div className="container">
                        <div className="has-text-centered">
                            <span className="icon is-large has-text-danger">
                                <i className="fas fa-exclamation-triangle fa-2x"></i>
                            </span>
                            <p className="title is-5 mt-4 has-text-danger">{t('error')}</p>
                            <p className="subtitle is-6">{error}</p>
                        </div>
                    </div>
                </section>
                <Footer />
            </div>
        );
    }

    if (!train || !parsedParams) {
        return (
            <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <NavBar />
                <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                    <div className="container">
                        <div className="has-text-centered">
                            <span className="icon is-large has-text-warning">
                                <i className="fas fa-train fa-2x"></i>
                            </span>
                            <p className="title is-5 mt-4">{t('notFound')}</p>
                            <p className="subtitle is-6">{t('notFoundMessage')}</p>
                        </div>
                    </div>
                </section>
                <Footer />
            </div>
        );
    }
    const delayed = train?.timeTableRows?.filter(row => !row.actualTime && row.type == "ARRIVAL" && !row.cancelled && row.trainStopping)[0]?.differenceInMinutes || train?.timeTableRows[train.timeTableRows.length - 1]?.differenceInMinutes || 0;
    const journeyEnded = !!train?.timeTableRows[train.timeTableRows.length - 1].actualTime;
    return (

        <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
            <NavBar />
            <section className="section is-fullheight has-text-left" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <div className="container">
                    {/* Train Header Information */}
                    <Link className="button is-ghost mb-4 pl-0" href={"/station/" + parsedParams.originStationUic}>
                        <span className="icon is-small">
                            <i className="fas fa-chevron-left"></i>
                        </span>
                        <span>{t('timetables', { station: getTranslatedStationNameWithFallback(Number(parsedParams.originStationUic), locale, "Unknown Station") })}</span>
                    </Link>
                    <div className="columns mt-1">
                        <div className="column">
                            <div className="is-flex is-align-items-center">
                                {train.commuterLineID ?
                                    ["A", "E", "L", "U", "Y", "I", "P", "K"].includes(train.commuterLineID) ?
                                        <span className="tag is-primary is-large has-text-weight-bold" style={{ marginRight: '0.5rem', backgroundColor: "#8d3889", width: "40px" }}>
                                            {train.commuterLineID}
                                        </span>
                                        :
                                        <span className="tag is-primary is-large has-text-weight-bold" style={{ marginRight: '0.5rem', width: "40px" }}>
                                            {train.commuterLineID}
                                        </span>
                                    :
                                    <span className="tag is-primary is-large p-2" style={{ marginRight: '0.5rem' }}>
                                        {train.trainType} {train.trainNumber}
                                    </span>
                                }
                                <span className="title is-3">
                                    {getTranslatedStationNameWithFallback(train.timeTableRows[train.timeTableRows.length - 1].stationUICCode, locale, train.timeTableRows[train.timeTableRows.length - 1].stationName)}
                                </span>

                            </div>
                            <p className="subtitle is-6 mt-2">
                                {parsedParams.departureDate}
                            </p>
                        </div>
                        <div className="column is-4">
                            <hr className="is-hidden-tablet is-invisible" />
                            <nav className="level is-mobile">
                                <div className="level-item has-text-centered">
                                    <div>
                                        <p className="heading">{journeyEnded ? t('ended') : t('running')}</p>
                                        <p className="title is-size-5 has-text-weight-normal">{train.cancelled ? <span>{t('cancelled')}</span> : delayed > 0 ? <span>{t('delayed')} {delayed} min</span> : <span>{t('on_time')}</span>}</p>
                                    </div>
                                </div>
                                <div className="level-item has-text-centered">
                                    <div>
                                        <p className="heading">{t('speed')}</p>
                                        <p className="title is-size-5 has-text-weight-normal">123 km/h</p>
                                    </div>
                                </div>
                            </nav>
                            <hr className="is-hidden-tablet is-invisible" />
                        </div>
                    </div>

                    {/* Train Station Stops */}
                    <TrainStationStops
                        train={train}
                        originStationUic={parseInt(parsedParams.originStationUic)}
                        originStopIndex={parseInt(parsedParams.originStopIndex)}
                        selectedDestinationUic={parsedParams.selectedDestinationUic ? parseInt(parsedParams.selectedDestinationUic) : undefined}
                    />
                </div>

            </section>

            <Footer />
        </div>
    );
}
