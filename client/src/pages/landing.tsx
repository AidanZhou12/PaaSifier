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
            <h1>Landing</h1>
        </main>
    );
}

export default Landing;