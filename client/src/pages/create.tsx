import './pages.css'
import { ApiError, getCurrentUser, logout, type UserResponse } from '../api/users'
import { createApplication, getProject, type ProjectResponse } from '../api/projects'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'

function Create() {
    const { id } = useParams();
    const projectId = Number(id);
    const [user, setUser] = useState<UserResponse | null>(null);
    const [loaded, setLoaded] = useState<{ id: number; project: ProjectResponse | null; error: string } | null>(null);
    // Form fields. Number inputs give strings, so the instance counts are kept as strings
    // and converted on submit; the defaults match the backend's (0 and 10).
    const [name, setName] = useState('');
    const [imageReference, setImageReference] = useState('');
    const [minInstances, setMinInstances] = useState('0');
    const [maxInstances, setMaxInstances] = useState('10');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
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

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!project) {
            return;
        }
        const min = Number(minInstances);
        const max = Number(maxInstances);
        // Same rule as the backend's validator: 0 max is allowed, otherwise max can't be below min.
        // Checked here too so the user gets the message without waiting for the server.
        if (max !== 0 && max < min) {
            setFormError("Max instances can't be less than min instances");
            return;
        }
        setFormError('');
        setSubmitting(true);
        try {
            await createApplication(
                { name, image_reference: imageReference, min_instances: min, max_instances: max },
                project.id,
            );
            // The project page loads its app list, so the new app shows up there
            navigate(`/project/${project.id}`);
        } catch (err) {
            setFormError(err instanceof ApiError ? err.message : 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    }

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
            <h2>Source code</h2>
            {error && <p className="error">{error}</p>}
            {project && (
                <form className="create-app-form" onSubmit={handleSubmit}>
                    <div className="form-field">
                        <label>
                            Name
                            <input
                                type="text"
                                value={name}
                                // IBM only accepts lowercase names, so convert as the user types
                                onChange={(e) => setName(e.target.value.toLowerCase())}
                                pattern="[a-z]([\-a-z0-9]*[a-z0-9])?"
                                title="Lowercase letters, numbers and hyphens. Must start with a letter and can't end with a hyphen."
                                maxLength={63}
                                disabled={submitting}
                                required
                            />
                        </label>
                    </div>

                    <div className="form-field">
                        <label>
                            Image reference
                            <input
                                type="text"
                                value={imageReference}
                                onChange={(e) => setImageReference(e.target.value)}
                                placeholder="docker.io/namespace/repository:tag"
                                maxLength={256}
                                disabled={submitting}
                                required
                            />
                        </label>
                    </div>

                    {/* Min and max side by side */}
                    <div className="instances-row">
                        <div className="form-field">
                            <label>
                                Min instances
                                <input
                                    type="number"
                                    value={minInstances}
                                    onChange={(e) => setMinInstances(e.target.value)}
                                    min={0}
                                    step={1}
                                    disabled={submitting}
                                    required
                                />
                            </label>
                        </div>
                        <div className="form-field">
                            <label>
                                Max instances
                                <input
                                    type="number"
                                    value={maxInstances}
                                    onChange={(e) => setMaxInstances(e.target.value)}
                                    min={0}
                                    step={1}
                                    disabled={submitting}
                                    required
                                />
                            </label>
                        </div>
                    </div>

                    {formError && <p className="error">{formError}</p>}
                    {submitting && <p>Creating...</p>}
                    <div className="create-app-buttons">
                        <button type="button" disabled={submitting} onClick={() => navigate(`/project/${project.id}`)}>Cancel</button>
                        <button type="submit" disabled={submitting}>Create</button>
                    </div>
                </form>
            )}
        </main>
    )
}

export default Create;