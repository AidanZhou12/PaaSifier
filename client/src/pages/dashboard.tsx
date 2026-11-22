import { useNavigate } from 'react-router'
import './pages.css'
import { useEffect, useRef, useState } from 'react'
import { getCurrentUser, logout, type UserResponse, ApiError } from '../api/users'
import { createProject, getProjects, type ProjectResponse } from '../api/projects'

function Dashboard() {
    const [user, setUser] = useState<UserResponse | null>(null);
    const [error, setError] = useState('');
    const [projects, setProjects] = useState<ProjectResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    // Errors from the create form, kept separate from page errors like a failed project load
    const [createError, setCreateError] = useState('');
    const navigate = useNavigate();
    // Points at the <dialog> element so the button can open it
    const createDialogRef = useRef<HTMLDialogElement>(null);

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
                <button className="navbar-path" onClick={() => navigate('/dashboard')}>Projects</button>
                <button onClick={async () => {await logout(); navigate('/login')}}>Log out</button>
            </nav>
            <h1>Projects</h1>
            {error && <p className="error">{error}</p>}
            <section className="project-page">
                {projects.map((project) => 
                <button className="project" onClick={() => navigate('/project', { state: { project } })} key={project.id}>
                    <h2>{project.name}</h2>
                </button>)}
                <button className="project create-project" type="button" onClick={() => {
                    // Start fresh every time: no leftover error or name from the last attempt
                    setCreateError('');
                    setNewProjectName('');
                    createDialogRef.current?.showModal();
                }}>Create project</button>
            </section>
            {/* Opens centered on top of the page. Closes with Escape, Cancel, or clicking the dimmed background,
                but not while a project is being created. */}
            <dialog
                ref={createDialogRef}
                className="modal"
                onCancel={(e) => {
                    // Fired when Escape is pressed
                    if (loading) {
                        e.preventDefault();
                    }
                }}
                onClick={(e) => {
                    // e.target is the <dialog> itself only when the click lands outside .modal-content
                    if (e.target === e.currentTarget && !loading) {
                        createDialogRef.current?.close();
                    }
                }}
            >
                <div className="modal-content">
                    <h2>Create a project</h2>
                    <form className="create-form" onSubmit={async (e) => {
                        e.preventDefault();
                        setCreateError('');
                        setLoading(true);
                        try {
                            const proj = await createProject(newProjectName);
                            setProjects((current) => [proj, ...current]);
                            setNewProjectName('');
                            createDialogRef.current?.close();
                        }
                        catch (err) {
                            setCreateError(err instanceof ApiError ? err.message : "Something went wrong");
                        }
                        finally {
                            // Runs after success or failure
                            setLoading(false);
                        }
                    }}>
                        <div className="project-name-input">
                            <label>
                                Project name
                                <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} maxLength={50} required />
                            </label>
                        </div>
                        {createError && <p className="error">{createError}</p>}
                        {loading && <p>Creating...</p>}
                        <button type="button" disabled={loading} onClick={() => createDialogRef.current?.close()}>Cancel</button>
                        <button type="submit" disabled={loading}>Create</button>
                    </form>
                </div>
            </dialog>
        </main>
    );
}

export default Dashboard;
