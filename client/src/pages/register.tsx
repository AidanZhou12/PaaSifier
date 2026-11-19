import { Link, useNavigate } from 'react-router'
import { useState } from 'react'
import './pages.css'
import { createUser, ApiError } from '../api/users'

function Register() {
    const [username, setUsername] = useState('');
    const [password1, setPassword1] = useState('');
    const [password2, setPassword2] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    return (
        <main>
            <h1>Start deploying with us</h1>
            <div className="registration-page">
                <form className="registration-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    try {
                        if (password1 !== password2) {
                            setError('Passwords do not match');
                        }
                        const user = await createUser({ username, password: password1 });
                        navigate('/dashboard', { state: user });
                    }
                    catch (err) {
                        setError(err instanceof ApiError ? err.message : 'Something went wrong');
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
                            <input type="password" value={password1} onChange={(e) => setPassword1(e.target.value)} required />
                        </label>
                    </div>
                    <div className="form-field">
                        <label>
                            Confirm Password:
                            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
                        </label>
                    </div>
                    {error && <p className="error">{error}</p>}
                    <button type="submit">Create Account</button>
                </form>
                <Link to="/login">Already have an account?</Link>
            </div>
        </main>
    );
}

export default Register;