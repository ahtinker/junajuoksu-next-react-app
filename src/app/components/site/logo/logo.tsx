import Image from 'next/image';
import "./logo.css";

const Logo = () => {
    return (
        <span className="logo-container">
            <Image className="logo" src="/junajuoksu-logo.png" alt="Junajuoksu Logo" height="28" width="28" />
            <span className="domain">
                junajuoksu.fi
                <span className="tag ml-2 has-text-warning">BETA</span>
            </span>
        </span>
    );
}

export default Logo;