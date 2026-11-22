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

    useEffect(() => {
        getProjects()
            .then(setProjects)
            .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'));
    }, []);

    if (!user) {
        return null;
    }

    return (
        <main>
            <nav className="navbar">
                <span>{user.username}</span>
                <button onClick={async () => {await logout(); navigate('/login')}}>Log out</button>
            </nav>
            <h1>Projects</h1>
            {error && <p className="error">{error}</p>}
            <section className="project-page">
                {projects.map((project) => 
                <div className="project" key={project.id}>
                    <h2>{project.name}</h2>
                </div>)}
            </section>
            <button onClick={() => {console.log("A pop-up will be here");}}>Create project</button>
        </main>
    );
}

export default Dashboard;
