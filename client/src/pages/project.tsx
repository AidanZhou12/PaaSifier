import './pages.css'
import { getCurrentUser, logout, type UserResponse } from '../api/users'
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router'

function Project() {
    const [user, setUser] = useState<UserResponse | null>(null);
    const navigate = useNavigate();
    const { state } = useLocation();

    useEffect(() => {
        getCurrentUser()
            .then(setUser)
            .catch(() => {
                // Not logged in, or the session has ended (the refresh cookie was rejected)
                navigate('/login', { replace: true });
            });
    }, [navigate]);

    if (!user) {
        return null;
    }

    return (
        <main>
            <nav className="navbar">
                <span>{user.username}</span>
                <button className="navbar-path" onClick={() => navigate('/dashboard')}>Projects</button>
                <button className="navbar-path" onClick={() => navigate('/project', { state: { project: state.project } })}>{ state.project.name }</button>
                <button onClick={async () => {await logout(); navigate('/login')}}>Log out</button>
            </nav>
            <h1>{ state.project.name }</h1>
        </main>
    )
}

export default Project;