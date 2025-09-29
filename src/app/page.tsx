
import './App.css';
import "./globals.scss";
import NavBar from './components/site/navbar';
import Footer from './components/site/footer';
import StationList from './components/site/stationlist/stationlist';
import { useTranslations } from 'next-intl';
import BlogCard from './components/site/blogcard/card';


function Home() {
  const t = useTranslations();
  return (
    <div className="App" style={{ backgroundColor: 'var(--bulma-scheme-main)' }}>
      <div>
        <NavBar />
        <section className="hero is-fullheight-with-navbar">
          <div className="hero-body">
            <div className="columns is-centered is-6-desktop is-0 is-desktop" style={{ width: "100%" }}>
              <div className="column is-2 is-hidden-mobile"></div>
              <div className="column" style={{ height: "450px", width: "100%" }}>
                <StationList />
              </div>
              <div className="column has-text-left">
                <h1 className="domain is-size-3 m-0" style={{ width: "100%" }}>Junien aikautaulut</h1>
                <h4 className="is-size-5 has-text-weight-bold mt-2 mb-4">
                  {t('hero.description')}
                </h4>
              </div>
              <div className="column is-2 is-hidden-mobile"></div>
            </div>
          </div>
        </section>
      </div>
      <div className="" style={{ marginBottom: '-7px', zIndex: 2 }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="rgb(61, 136, 61)" fillOpacity="1" d="M0,160L1440,320L1440,320L0,320Z"></path></svg>
      </div>
      <section className="section has-background-primary">
        <div className="container has-text-left">
          <h2 className="title mb-6 has-text-white">
            {t('hero.tagline')}
          </h2>
          <div className="fixed-grid has-text-left has-1-cols-mobile">
            <div className="grid is-gap-6">
              <div className="cell">
                <BlogCard blogId={1} />
              </div>
              <div className="cell">
                <BlogCard blogId={2} />
              </div>
            </div>
          </div>

        </div>
      </section>

      <div style={{ position: "absolute", width: "100%", height: "100vh", overflowX: "hidden", overflowY: "visible"}}>
        <img
          style={{
            position: "absolute",
            top: 0,
            left: "-10%",
            width: "100%",
            height: "auto",
            marginTop: "0",
            transform: "scale(1.2)",
            transformOrigin: "top left",
            zIndex: 10, // ensures it overlaps
            pointerEvents: "none", // optional, so it doesn't block clicks
          }}
          src="/trackpattern.svg"
          alt="track pattern"
        />
      </div>

      {/* Wave decoration */}
      <div className="has-background-primary">
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
      {/* Wave decoration */}
      

      <Footer />
    </div>
  );
}

export default Home;
