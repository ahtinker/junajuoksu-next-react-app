import '../App.css';
import "../globals.scss";
import NavBar from '../components/site/navbar';
import Footer from '../components/site/footer';
import Timetables from './components/Timetables';

function TimetablesPage() {
    return (
        <div className="App">
            <NavBar />
            <section className="hero is-fullheight-with-navbar">
                <div className="hero-body" style={{ backdropFilter: "brightness(80%)" }}>
                    <Timetables />
                </div>
            </section>
            <Footer />
        </div>
    );
}

export default TimetablesPage;
