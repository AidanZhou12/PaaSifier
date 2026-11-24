import './pages.css'
import { useNavigate, useParams } from 'react-router'
import { useEffect, useState } from 'react'
import { ApiError, getCurrentUser, logout, type UserResponse } from '../api/users'
import { getApplication, getProject, type ApplicationResponse, type ProjectResponse } from '../api/projects'

type Loaded = {
    // Which URL this result is for, so a slow response for another page can't be shown here
    key: string;
    project: ProjectResponse | null;
    application: ApplicationResponse | null;
    error: string;
};

function Application() {
    // /project/7/apps/web gives id "7" and appName "web"
    const { id, appName } = useParams();
    const projectId = Number(id);
    const key = `${projectId}/${appName}`;
    const [user, setUser] = useState<UserResponse | null>(null);
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        getCurrentUser()
            .then(setUser)
            .catch(() => {
                // Not logged in, or the session has ended (the refresh cookie was rejected)
                navigate('/login', { replace: true });
            });
    }, [navigate]);

    // Load the project (for its name in the navbar) and this one app, at the same time
    useEffect(() => {
        if (!Number.isInteger(projectId) || !appName) {
            return;
        }
        let ignore = false;
        Promise.all([getProject(projectId), getApplication(projectId, appName)])
            .then(([project, application]) => {
                if (!ignore) setLoaded({ key, project, application, error: '' });
            })
            .catch((err) => {
                if (ignore) return;
                setLoaded({
                    key,
                    project: null,
                    application: null,
                    // The backend's 404 message says which one is missing ("Project not found" or
                    // "Application not found"); someone else's project also gets a 404
                    error: err instanceof ApiError && err.status === 404 ? err.message : 'Failed to load application',
                });
            });
        return () => {
            ignore = true;
        };
    }, [projectId, appName, key]);

    // Worked out on every render, so a different URL shows "Loading..." instead of the previous app
    const current = loaded?.key === key ? loaded : null;
    const project = current?.project ?? null;
    const application = current?.application ?? null;
    const error = Number.isInteger(projectId) && appName ? (current?.error ?? '') : 'Application not found';

    if (!user) {
        return null;
    }

    return (
        <main>
            <nav className="navbar">
                <span>{user.username}</span>
                <button className="navbar-path" onClick={() => navigate('/dashboard')}>Dashboard</button>
                {project && (
                    <button className="navbar-path" title={project.name} onClick={() => navigate(`/project/${project.id}`)}>{project.name}</button>
                )}
                {project && application && (
                    <button
                        className="navbar-path"
                        title={application.name}
                        onClick={() => navigate(`/project/${project.id}/apps/${encodeURIComponent(application.name)}`)}
                    >
                        {application.name}
                    </button>
                )}
                <button onClick={async () => {await logout(); navigate('/login')}}>Log out</button>
            </nav>
            {error ? (
                <p className="error">{error}</p>
            ) : !application ? (
                <p>Loading...</p>
            ) : (
                <h1>{application.name}</h1>
            )}
        </main>
    )
}

export default Application;
