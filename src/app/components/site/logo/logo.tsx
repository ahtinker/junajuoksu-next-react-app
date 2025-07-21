import Image from 'next/image';
import "./logo.css";

const Logo = () => {
    return (
        <span className="logo-container">
            <Image className="logo" src="/junajuoksu-logo.png" alt="Junajuoksu Logo" width={120} height={40} />
            <span className="domain">junajuoksu.fi</span>
        </span>
    );
}

export default Logo;