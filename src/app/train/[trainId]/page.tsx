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
import { useTrainPosition } from '@/lib/useTrainPosition';

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

    // Use train position hook for realtime GPS tracking
    const trainPosition = useTrainPosition(
        parsedParams?.trainNumber ?? null,
        parsedParams?.departureDate ?? null,
        train?.commuterLineID ?? null
    );

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

        const fetchTrainData = async (isInitialFetch = false) => {
            try {
                if (isInitialFetch) {
                    setLoading(true);
                }
                setError(null);

                const response = await fetch(
                    `https://rata.digitraffic.fi/api/v1/trains/${parsedParams.departureDate}/${parsedParams.trainNumber}`
                );

                if (!response.ok) {
                    if (isInitialFetch) {
                        throw new Error(`Failed to fetch train data: ${response.status}`);
                    } else {
                        console.warn(`Failed to update train data: ${response.status}`);
                        return;
                    }
                }

                const trainData: Train[] = await response.json();

                if (trainData && trainData.length > 0) {
                    setTrain(trainData[0]);
                } else {
                    if (isInitialFetch) {
                        setError('Train not found');
                    }
                }
            } catch (err) {
                console.error('Error fetching train data:', err);
                if (isInitialFetch) {
                    setError(err instanceof Error ? err.message : 'Failed to fetch train data');
                }
            } finally {
                if (isInitialFetch) {
                    setLoading(false);
                }
            }
        };

        fetchTrainData(true); // Initial fetch

        const intervalId = setInterval(() => fetchTrainData(), 5000); // Fetch every 5 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
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
                    {/* <Link className="button is-ghost mb-4 pl-0" href={"/station/" + parsedParams.originStationUic}>
                        <span className="icon is-small">
                            <i className="fas fa-chevron-left"></i>
                        </span>
                        <span>{t('timetables', { station: getTranslatedStationNameWithFallback(Number(parsedParams.originStationUic), locale, "Unknown Station") })}</span>
                    </Link> */}
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
                                        <p className="title is-size-5 has-text-weight-normal">
                                            {trainPosition.speed > 0 ? `${trainPosition.speed} km/h` : '-'}
                                        </p>
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

                    {/* Debug Section - Realtime Position Data */}
                    <div className="box mt-6" style={{ backgroundColor: 'var(--bulma-scheme-main-bis)' }}>
                        <h3 className="title is-5">
                            <span className="icon-text">
                                <span className="icon">
                                    <i className="fas fa-bug"></i>
                                </span>
                                <span>Debug - Realtime Position</span>
                            </span>
                        </h3>
                        <div className="content">
                            <table className="table is-narrow is-fullwidth" style={{ backgroundColor: 'transparent' }}>
                                <tbody>
                                    <tr>
                                        <td><strong>Data Source</strong></td>
                                        <td>
                                            {trainPosition.source ? (
                                                <span className={`tag ${trainPosition.source === 'HSL' ? 'is-success' : 'is-info'}`}>
                                                    {trainPosition.source}
                                                </span>
                                            ) : (
                                                <span className="tag is-warning">Connecting...</span>
                                            )}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>Latitude</strong></td>
                                        <td>{trainPosition.latitude !== null ? trainPosition.latitude.toFixed(6) : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Longitude</strong></td>
                                        <td>{trainPosition.longitude !== null ? trainPosition.longitude.toFixed(6) : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Speed</strong></td>
                                        <td>{trainPosition.speed > 0 ? `${trainPosition.speed} km/h` : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Heading</strong></td>
                                        <td>{trainPosition.heading !== null ? `${trainPosition.heading}°` : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Last Update</strong></td>
                                        <td>
                                            {trainPosition.timestamp ? (
                                                new Date(trainPosition.timestamp).toLocaleTimeString()
                                            ) : '-'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>Train Number</strong></td>
                                        <td>{parsedParams.trainNumber}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Commuter Line</strong></td>
                                        <td>{train.commuterLineID || 'N/A (Long-distance)'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </section>

            <Footer />
        </div>
    );
}
