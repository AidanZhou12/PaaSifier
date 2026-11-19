const API_URL = import.meta.env.VITE_API_URL
const TOKEN_KEY = 'access_token'

export interface UserCreate {
    username: string;
    password: string;
}

export interface UserResponse {
    id: number;
    username: string;
}

// Mirrors TokenResponse in backend/schemas.py
interface TokenResponse {
    access_token: string;
    token_type: string;
    user: UserResponse;
}

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: string, path: string, body: unknown, fallbackError: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        const errorData: { detail?: string } = await response.json().catch(() => ({}));
        throw new ApiError(errorData.detail || fallbackError, response.status);
    }
    return response.json();
}

async function authenticate(path: string, data: UserCreate, fallbackError: string): Promise<UserResponse> {
    const result = await request<TokenResponse>('POST', path, data, fallbackError);
    localStorage.setItem(TOKEN_KEY, result.access_token);
    return result.user;
}

export function createUser(data: UserCreate): Promise<UserResponse> {
    return authenticate('/users/create', data, 'Failed to create account');
}

export function login(data: UserCreate): Promise<UserResponse> {
    return authenticate('/users/login', data, 'Failed to log in');
}

export function getCurrentUser(): Promise<UserResponse> {
    return request<UserResponse>('GET', '/users/me', undefined, 'Failed to load user');
}
