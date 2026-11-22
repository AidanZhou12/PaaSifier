import { useNavigate } from 'react-router'
import './pages.css'
import { useEffect, useState } from 'react'
import { getCurrentUser, logout, type UserResponse, ApiError } from '../api/users'
import { getProjects, type ProjectResponse } from '../api/projects'

function Dashboard() {
    const [user, setUser] = useState<UserResponse | null>(null);
    const [error, setError] = useState('');
    const [projects, setProjects] = useState<ProjectResponse[]>([]);
    const navigate = useNavigate();

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

    useEffect(() => {
    getProjects()
        .then(setProjects)
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'));
    }, []);

    return (
        <main>
            <nav className="navbar">
                <span>{user.username}</span>
                <button onClick={async () => {await logout(); navigate('/login')}}>Log out</button>
            </nav>
            <h1>Projects</h1>
        </main>
    );
}

export default Dashboard;
