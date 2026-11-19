import { useNavigate } from 'react-router'
import './pages.css'
import { useEffect, useState } from 'react'
import { getCurrentUser, logout, type UserResponse } from '../api/users'

function Dashboard() {
    const [user, setUser] = useState<UserResponse | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        getCurrentUser()
            .then(setUser)
            .catch(() => {
                // No token, or it's expired/invalid: clear it and send the user to log in
                logout();
                navigate('/login', { replace: true });
            });
    }, [navigate]);

    if (!user) {
        return null;
    }

    return (
        <main>
            <h1>Dashboard</h1>
            <p>Signed in as {user.username}</p>
            <button onClick={() => {
                logout();
                navigate('/login');
            }}>Log out</button>
        </main>
    );
}

export default Dashboard;
