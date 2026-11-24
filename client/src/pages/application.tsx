import './pages.css'
import { useNavigate, useParams } from 'react-router'
import { useEffect, useState } from 'react'
import { ApiError, getCurrentUser, logout, type UserResponse } from '../api/users'
import { getApplications, getProject, type ApplicationResponse, type ProjectResponse } from '../api/projects'

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

    // Load the project (for its name in the navbar) and find this app in the project's list.
    // There's no backend route for a single app, so the list is searched by name; names are
    // unique within a project.
    useEffect(() => {
        if (!Number.isInteger(projectId) || !appName) {
            return;
        }
        let ignore = false;
        Promise.all([getProject(projectId), getApplications(projectId)])
            .then(([project, applications]) => {
                if (ignore) return;
                const application = applications.find((app) => app.name === appName) ?? null;
                setLoaded({
                    key,
                    project,
                    application,
                    error: application ? '' : 'Application not found',
                });
            })
            .catch((err) => {
                if (ignore) return;
                setLoaded({
                    key,
                    project: null,
                    application: null,
                    // 404 also covers projects that belong to someone else
                    error: err instanceof ApiError && err.status === 404 ? 'Project not found' : 'Failed to load application',
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
