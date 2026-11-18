const API_URL = import.meta.env.VITE_API_URL

export async function createUser(username, password) {
    const response = await fetch(`${API_URL}/users/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.detail || 'Failed to create account');
        error.status = response.status;
        throw error;
    }
    else {
        return response.json();
    }
}