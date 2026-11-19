const API_URL = import.meta.env.VITE_API_URL

export interface UserCreate {
    username: string;
    password: string;
}

export interface UserResponse {
    id: number;
    username: string;
}

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function postJson<T>(path: string, body: unknown, fallbackError: string): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorData: { detail?: string } = await response.json().catch(() => ({}));
        throw new ApiError(errorData.detail || fallbackError, response.status);
    }
    return response.json();
}

export function createUser(data: UserCreate): Promise<UserResponse> {
    return postJson<UserResponse>('/users/create', data, 'Failed to create account');
}

export function login(data: UserCreate): Promise<UserResponse> {
    return postJson<UserResponse>('/users/login', data, 'Failed to log in');
}
