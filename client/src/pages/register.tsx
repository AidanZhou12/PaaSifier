import {Link, useNavigate } from 'react-router'
import { useState } from 'react'
import './pages.css'
import { createUser, login, ApiError } from '../api/users'

function Register() {
    const [username, setUsername] = useState('');
    const [password1, setPassword1] = useState('');
    const [password2, setPassword2] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    return (
        <main>
            <h1>Start deploying with us</h1>
        </main>
    );
}

export default Register;