import './pages.css'
import { ApiError, getCurrentUser, logout, type UserResponse } from '../api/users'
import { getProject, type ProjectResponse } from '../api/projects'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

function Project() {
    // "7" from /project/7. URL parameters are always strings, so convert it.
    const { id } = useParams();
    const projectId = Number(id);
    const [user, setUser] = useState<UserResponse | null>(null);
    // The result of the last fetch, tagged with the ID it was for
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

    // Runs again whenever the ID in the URL changes
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

    // Worked out on every render instead of stored, so a different ID in the URL
    // immediately shows "Loading..." rather than the previous project
    const current = loaded?.id === projectId ? loaded : null;
    const project = current?.project ?? null;
    // e.g. /project/abc never reaches the backend
    const error = Number.isInteger(projectId) ? (current?.error ?? '') : 'Project not found';

    if (!user) {
        return null;
    }

    return (
        <main>
            <nav className="navbar">
                <span>{user.username}</span>
                <button className="navbar-path" onClick={() => navigate('/dashboard')}>Projects</button>
                {project && (
                    <button className="navbar-path" onClick={() => navigate(`/project/${project.id}`)}>{project.name}</button>
                )}
                <button onClick={async () => {await logout(); navigate('/login')}}>Log out</button>
            </nav>
            {error ? (
                <p className="error">{error}</p>
            ) : !project ? (
                <p>Loading...</p>
            ) : (
                <h1>{project.name}</h1>
            )}
        </main>
    )
}

export default Project;
