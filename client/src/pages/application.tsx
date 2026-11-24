import './pages.css'
import { useNavigate, useParams } from 'react-router'
import { useEffect, useState } from 'react'
import { ApiError, getCurrentUser, logout, type UserResponse } from '../api/users'
import { APP_POLL_INTERVAL_MS, deleteApplication, getApplication, getProject, isDeploying, type ApplicationResponse, type ProjectResponse } from '../api/projects'

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
    // True while the delete request is running; drives the button text and disables it
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
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
    const waitingOnDeploy = application !== null && isDeploying(application.status);

    // While the app is deploying or pending, fetch it again every few seconds (the backend asks
    // IBM for fresh data in that case), so its status and link update without a page refresh.
    // Stops on its own once the app settles. Same approach as the app table in project.tsx.
    useEffect(() => {
        if (!waitingOnDeploy || !appName) {
            return;
        }
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        // setTimeout after each response (instead of setInterval) so requests never overlap
        const scheduleNext = () => {
            timer = setTimeout(async () => {
                try {
                    const app = await getApplication(projectId, appName);
                    // Only update if this page is still showing the same app; keep the loaded project
                    if (!stopped) setLoaded((prev) => (prev && prev.key === key ? { ...prev, application: app } : prev));
                } catch {
                    // A failed check keeps what's on screen; the next check tries again
                }
                if (!stopped) scheduleNext();
            }, APP_POLL_INTERVAL_MS);
        };
        scheduleNext();
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [projectId, appName, key, waitingOnDeploy]);

    async function handleDelete() {
        if (!project || !application) {
            return;
        }
        setDeleteError('');
        setDeleting(true);
        try {
            await deleteApplication(project.id, application.name);
            // The project page reloads its app list, so the deleted app won't be in it
            navigate(`/project/${project.id}`);
        } catch (err) {
            setDeleteError(err instanceof ApiError ? err.message : 'Something went wrong');
        } finally {
            setDeleting(false);
        }
    }

    if (!user) {
        return null;
    }

    // Ready and warning apps are running, so their link works; other statuses get no link.
    // Only http(s) URLs are shown as links, so an unexpected value can't run as a javascript: link.
    const showLink = application !== null
        && (application.status === 'ready' || application.status === 'warning')
        && !!application.endpoint
        && /^https?:\/\//.test(application.endpoint);

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
                <>
                    {/* App name on the left, delete button on the right, like the project page */}
                    <div className="project-header">
                        <h1>{application.name}</h1>
                        {/* Disabled while a delete is already running */}
                        <button className="delete-button" onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete application'}
                        </button>
                    </div>
                    <div className="application-details">
                        {/* The class sets the colour: green ready, red failed, yellow warning, blue deploying/pending */}
                        <p className={`app-status app-status-${isDeploying(application.status) ? 'deploying' : application.status}`}>
                            {application.status}
                        </p>
                        {showLink && (
                            <p>
                                <a href={application.endpoint!} target="_blank" rel="noopener noreferrer">
                                    {application.endpoint}
                                </a>
                            </p>
                        )}
                    </div>
                </>
            )}
            {deleteError && <p className="error">{deleteError}</p>}
        </main>
    )
}

export default Application;
