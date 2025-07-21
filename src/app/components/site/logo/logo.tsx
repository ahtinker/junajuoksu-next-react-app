import "./logo.css";

const Logo = () => {
    return (
        <span className="logo-container">
            <img className="logo" src="/junajuoksu-logo.png" alt="Junajuoksu Logo" />
            <span className="domain">junajuoksu.fi</span>
        </span>
    );
}

export default Logo;