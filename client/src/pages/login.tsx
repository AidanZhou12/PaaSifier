import { Link, useNavigate } from 'react-router'
import './pages.css'
import { useState } from 'react'
import { login, ApiError } from '../api/users'

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    return (
        <main>
            <h1>Keep deploying with us</h1>
            <div className="login-page">
                <form className="login-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    try {
                        const user = await login({username, password});
                        navigate('/dashboard', { state: user });
                    }
                    catch (err) {
                        setError(err instanceof ApiError ? err.message: "Something went wrong");
                    }
                }}>
                    <div className="form-field">
                        <label>
                            Username:
                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                        </label>
                    </div>
                    <div className="form-field">
                        <label>
                            Password:
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </label>
                    </div>
                    {error && <p className="error">{error}</p>}
                    <button type="submit">Sign In</button>
                </form>
                <Link to="/register">Don't have an account?</Link>
            </div>
        </main>
    );
}

export default Login;