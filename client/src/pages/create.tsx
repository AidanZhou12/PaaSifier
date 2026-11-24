import './pages.css'
import { ApiError, getCurrentUser, logout, type UserResponse } from '../api/users'
import { type ApplicationResponse, createApplication, getProject, type ProjectResponse } from '../api/projects'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'

function Create() {
    const { id } = useParams();
    const projectId = Number(id);
    const [user, setUser] = useState<UserResponse | null>(null);
    const [loaded, setLoaded] = useState<{ id: number; project: ProjectResponse | null; error: string } | null>(null);
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
        if (!Number.isInteger(projectId)) {
            return;
        }
        // If the ID changes before this request finishes, ignore its result so a slow
        // response for the old project can't overwrite the new one
        let ignore = false;
        getProject(projectId)
            .then((result) => {
                if (!ignore) setLoaded({ id: projectId, project: result, error: '' });
            })
            .catch((err) => {
                if (!ignore) setLoaded({
                    id: projectId,
                    project: null,
                    // 404 also covers projects that belong to someone else
                    error: err instanceof ApiError && err.status === 404 ? 'Project not found' : 'Failed to load project',
                });
            });
        return () => {
            ignore = true;
        };
    }, [projectId]);

    if (!user) {
        return null;
    }

    const current = loaded?.id === projectId ? loaded : null;
    const project = current?.project ?? null;
    const error = Number.isInteger(projectId) ? (current?.error ?? '') : 'Project not found';

    return (
        <main>
            <nav className="navbar">
                <span>{user.username}</span>
                <button className="navbar-path" onClick={() => navigate('/dashboard')}>Projects</button>
                {project && (
                    <button className="navbar-path" title={project.name} onClick={() => navigate(`/project/${project.id}`)}>{project.name}</button>
                )}
                {project && (
                    <button className="navbar-path" onClick={() => navigate(`/project/${project.id}/create`)}>New App</button>
                )}
                <button onClick={async () => {await logout(); navigate('/login')}}>Log out</button>
            </nav>
            <h1>New App</h1>
            {error && <p className="error">{error}</p>}
            <h2>Source code</h2>
        </main>
    )
}

export default Create;