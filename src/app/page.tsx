
import './App.css';
import "./globals.scss";
import NavBar from './components/site/navbar';
import Footer from './components/site/footer';
import StationList from './components/site/stationlist/stationlist';
import { useTranslations } from 'next-intl';
import Image from 'next/image';


function Home() {
  const t = useTranslations();
  return (
    <div className="App hero-home " style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
      <NavBar />
      <section className="hero is-fullheight-with-navbar">
        <div className="hero-body">
          <div className="columns is-centered is-6-desktop is-0 is-desktop" style={{ width: "100%" }}>
            <div className="column is-2 is-hidden-mobile"></div>
            <div className="column" style={{ height: "450px", width: "100%" }}>
              <StationList />
            </div>
            <div className="column has-text-left">
              <span className="domain is-size-3 m-0">junajuoksu.fi</span>
              <div className="is-size-5">
                {t('hero.description')}
              </div>
            </div>
            <div className="column is-2 is-hidden-mobile"></div>
          </div>
        </div>
      </section>

      {/* Wave decoration */}
      <div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 320"
          className="wave-svg"
          style={{ marginBottom: '-10px', zIndex: 2 }}
        >
          <path
            fill="var(--bulma-background)"
            fillOpacity="1"
            d="M0,224L30,229.3C60,235,120,245,180,224C240,203,300,149,360,122.7C420,96,480,96,540,128C600,160,660,224,720,213.3C780,203,840,117,900,80C960,43,1020,53,1080,80C1140,107,1200,149,1260,154.7C1320,160,1380,128,1410,112L1440,96L1440,320L1410,320C1380,320,1320,320,1260,320C1200,320,1140,320,1080,320C1020,320,960,320,900,320C840,320,780,320,720,320C660,320,600,320,540,320C480,320,420,320,360,320C300,320,240,320,180,320C120,320,60,320,30,320L0,320Z"
          />
        </svg>
      </div>

      <Footer />
    </div>
  );
}

export default Home;
