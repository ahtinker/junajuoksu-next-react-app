import './App.css';
import "./globals.scss";
import NavBar from './components/site/navbar';
import Footer from './components/site/footer';
import StationList from './components/site/stationlist/stationlist';

function Home() {
  return (
    <div className="App">
      <NavBar />
      <section className="hero home-hero is-fullheight-with-navbar">
        <div className="hero-body" style={{ backdropFilter: "brightness(80%)" }}>
          <StationList />
        </div>
      </section>
      <Footer />
    </div>
  );
}

export default Home;
