"use client";
import '../App.css';
import "../globals.scss";
import Footer from '../components/site/footer';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface StationPageProps {
    params: Promise<{
        stationId: string;
    }>;
}

function LoginPage({ params }: StationPageProps) {
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
                <section className="section is-fullheight pt-0 mr-0 pr-0" style={{ backgroundColor: 'var(--bulma-scheme-main)', minHeight: '120vh' }}>
                    <div className="container has-text-left pt-0">
                        <div className="columns p-0 m-0">
                            <div className="column pt-6 is-5 mr-5">
                                <div className="mb-5 mt-6">
                                    <div className="title">
                                        Log in to <Link className="has-text-primary" href="/">junajuoksu.fi</Link>
                                    </div>
                                </div>
                                <form className="mt-6">
                                    <p className="control">
                                        <label className="label mb-0">Email</label>
                                        <input className="input is-medium is-primary" type="text" placeholder="eemeli.esimerkki@esi.mer" />
                                    </p>
                                    <p className="control mt-4">
                                        <label className="label mb-0">Password</label>
                                        <input className="input is-medium is-primary" type="password" placeholder="**********" />
                                    </p>
                                    <p className="control mt-5">
                                        <button className="is-fullwidth button is-primary">
                                            <span>Log in</span>
                                            <span className="icon">
                                                <i className="fas fa-chevron-right"></i>
                                            </span>
                                        </button>
                                    </p>
                                    
                                    <p className="control my-5 mt-6">
                                        <button className="button is-fullwidth has-text-weight-normal">
                                            <span className="icon">
                                                <i className="fab fa-google"></i>
                                            </span>
                                            <span>
                                                Sign in with Google
                                            </span>
                                            
                                        </button>
                                    </p>
                                    <button className="button is-fullwidth is-primary is-ghost">{"Don't have an account? Create one"}</button>
                                </form>

                            </div>
                            <div className="column p-0 m-0 is-hidden-mobile ml-5" style={{overflow: "visible"}}>
                                <img style={{position: "absolute", height: "120vh"}} src="/loginpattern.svg" alt="Login page"></img>
                            </div>
                        </div>
                    </div>
                </section > 
                <Footer />

            </div>
        );
    }
    return (
        <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
            <section className="section is-fullheight" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
                <div className="content">
                   
                </div>
            </section >
            <Footer />
        </div >
    );
}

export default LoginPage;
