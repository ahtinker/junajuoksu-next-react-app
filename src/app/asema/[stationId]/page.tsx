"use client";
import '../../App.css';
import "../../globals.scss";
import NavBar from '../../components/site/navbar';
import Footer from '../../components/site/footer';
import StationTimetables from './components/StationTimetables';
import StationSkeleton from './components/StationSkeleton';
import { useEffect, useState } from 'react';

interface StationPageProps {
    params: Promise<{
        stationId: string;
    }>;
}

function StationPage({ params }: StationPageProps) {
    const [stationId, setStationId] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const awaitedParams = await params;
            setStationId(awaitedParams.stationId);
        })();
    }, [params]);

    if (!stationId) {
        return (
            <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <NavBar />
                <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                    <div className="content">
                        <StationSkeleton />
                    </div>
                </section>
                <Footer />

            </div>
        );
    }
    return (
        <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
            <NavBar />
            <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <div className="content">
                    <StationTimetables stationId={stationId} />
                </div>
            </section >
            <Footer />
        </div >
    );
}

export default StationPage;
