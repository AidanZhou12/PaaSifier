import './pages.css'
import { ApiError, getCurrentUser, logout, type UserResponse } from '../api/users'
import { deleteProject, getProject, type ProjectResponse, type ApplicationResponse, getApplications } from '../api/projects'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

// How often to check on deploying apps
const POLL_INTERVAL_MS = 5000;

// Apps in these statuses aren't running yet: their link isn't usable, and the page keeps checking on them
function isDeploying(status: string): boolean {
    return status === 'deploying' || status === 'pending';
}

function Project() {
    // "7" from /project/7. URL parameters are always strings, so convert it.
    const { id } = useParams();
    const projectId = Number(id);
    const [user, setUser] = useState<UserResponse | null>(null);
    // The result of the last fetch, tagged with the ID it was for
    const [loaded, setLoaded] = useState<{ id: number; project: ProjectResponse | null; error: string } | null>(null);
    // True while the delete request is running; drives the button text and disables it
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    // The last app list fetched, tagged with the project ID it was for (same idea as `loaded`)
    const [appsLoaded, setAppsLoaded] = useState<{ id: number; apps: ApplicationResponse[]; error: string } | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        getCurrentUser()
            .then(setUser)
            .catch(() => {
                // Not logged in, or the session has ended (the refresh cookie was rejected)
                navigate('/login', { replace: true });
            });
    }, [navigate]);

    // Load the project's apps, and again whenever the ID in the URL changes
    useEffect(() => {
        if (!Number.isInteger(projectId)) {
            return;
        }
        let ignore = false;
        getApplications(projectId)
            .then((apps) => {
                if (!ignore) setAppsLoaded({ id: projectId, apps, error: '' });
            })
            .catch((err) => {
                if (!ignore) setAppsLoaded({
                    id: projectId,
                    apps: [],
                    error: err instanceof ApiError ? err.message : 'Failed to load applications',
                });
            });
        return () => {
            ignore = true;
        };
    }, [projectId]);

    const appsCurrent = appsLoaded?.id === projectId ? appsLoaded : null;
    const applications = appsCurrent?.apps ?? [];
    const appsError = appsCurrent?.error ?? '';
    // A newly created app starts as deploying (or pending); its link appears once IBM finishes.
    // The backend asks IBM for fresh data whenever one of these statuses is present.
    const waitingOnDeploy = applications.some((app) => isDeploying(app.status));

    // While an app is deploying or pending, fetch the list again every few seconds so the
    // status and link update without a page refresh. Stops on its own once everything settles.
    useEffect(() => {
        if (!waitingOnDeploy) {
            return;
        }
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        // setTimeout after each response (instead of setInterval) so a slow request
        // never overlaps with the next one
        const scheduleNext = () => {
            timer = setTimeout(async () => {
                try {
                    const apps = await getApplications(projectId);
                    if (!stopped) setAppsLoaded({ id: projectId, apps, error: '' });
                } catch {
                    // A failed check keeps the list on screen; the next check tries again
                }
                if (!stopped) scheduleNext();
            }, POLL_INTERVAL_MS);
        };
        scheduleNext();
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [projectId, waitingOnDeploy]);

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

    async function handleDelete() {
        if (!project) {
            return;
        }
        setDeleteError('');
        setDeleting(true);
        try {
            await deleteProject(project.id);
            // The dashboard reloads its list, so the deleted project won't be in it
            navigate('/dashboard');
        } catch (err) {
            setDeleteError(err instanceof ApiError ? err.message : 'Something went wrong');
        } finally {
            setDeleting(false);
        }
    }

    if (!user) {
        return null;
    }

    return (
        <main>
            <nav className="navbar">
                <span>{user.username}</span>
                <button className="navbar-path" onClick={() => navigate('/dashboard')}>Dashboard</button>
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
                // Project name on the left, delete button on the right, on one line
                <>
                    <div className="project-header">
                        <h1>{project.name}</h1>
                        {/* Disabled while a delete is already running */}
                        <button className="delete-button" onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete project'}
                        </button>
                    </div>
                    <div className="applications-list">
                        <h2>Applications</h2>
                    </div>
                    <table className="application-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Link</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applications.map((application) => (
                                <tr key={application.id}>
                                    <td>
                                        <button
                                            className="application-name-button"
                                            type="button"
                                            onClick={() => navigate(`/project/${project.id}/apps/${encodeURIComponent(application.name)}`)}
                                        >
                                            {application.name}
                                        </button>
                                    </td>
                                    <td>{application.status}</td>
                                    <td>
                                        {/* Only ready apps get a link: while deploying or pending the URL doesn't work
                                            yet, and a failed app's URL won't either. Only http(s) URLs become links,
                                            so an unexpected value can't run as a javascript: link. */}
                                        {application.status === 'ready' && application.endpoint && /^https?:\/\//.test(application.endpoint) && (
                                            <a href={application.endpoint} target="_blank" rel="noopener noreferrer">
                                                Open URL
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            <tr className="create-application-row">
                                <td colSpan={3}>
                                    <button className="create-application-button" type="button" onClick={() => navigate(`/project/${project.id}/create`)}>+ New</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    {appsError && <p className="error">{appsError}</p>}
                </>
            )}
            {/* Shown under the heading row, next to the button that caused it */}
            {deleteError && <p className="error">{deleteError}</p>}
        </main>
    )
}

export default Project;
