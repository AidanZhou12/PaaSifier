import { Link } from 'react-router'
import './pages.css'

function Landing() {
    return (
        <main>
            <nav className="navbar">
                <span>PaaSifier</span>
                <Link to="/login" className="action-button">Login</Link>
                <Link to="/register" className="action-button">Sign Up</Link>
            </nav>
            <h1>The easiest way to deploy containers</h1>
            <h2>You give me the image reference and I give you a link to your site</h2>
        </main>
    );
}

export default Landing;