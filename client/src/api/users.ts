const API_URL = import.meta.env.VITE_API_URL

export interface UserCreate {
    username: string;
    password: string;
}

export interface UserResponse {
    id: number;
    username: string;
}

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

// The access token lives only in memory. After a page reload it's gone, and the
// first request gets a new one using the httpOnly refresh cookie.
let accessToken: string | null = null;

// While a refresh is running, every caller waits on this same promise. Sending two
// refreshes at once would present the same (single-use) refresh token twice.
let refreshInFlight: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            try {
                const response = await fetch(`${API_URL}/users/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                });
                if (!response.ok) {
                    accessToken = null;
                    return false;
                }
                const result: TokenResponse = await response.json();
                accessToken = result.access_token;
                return true;
            } catch {
                return false;
            } finally {
                refreshInFlight = null;
            }
        })();
    }
    return refreshInFlight;
}

export async function request<T>(
    method: string,
    path: string,
    body: unknown,
    fallbackError: string,
    retryOnUnauthorized = true,
): Promise<T> {
    const send = () => {
        const headers: Record<string, string> = {};
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return fetch(`${API_URL}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            credentials: 'include', // send and receive the refresh cookie
        });
    };

    let response = await send();
    // Missing or expired access token: get a new one with the refresh cookie and try once more
    if (response.status === 401 && retryOnUnauthorized && await refreshAccessToken()) {
        response = await send();
    }

    if (!response.ok) {
        const errorData: { detail?: string } = await response.json().catch(() => ({}));
        throw new ApiError(errorData.detail || fallbackError, response.status);
    }
    if (response.status === 204) {
        return undefined as T;
    }
    return response.json();
}

async function authenticate(path: string, data: UserCreate, fallbackError: string): Promise<UserResponse> {
    // retryOnUnauthorized is off: a 401 here means a wrong password, not an expired token
    const result = await request<TokenResponse>('POST', path, data, fallbackError, false);
    accessToken = result.access_token;
    return result.user;
}

export function createUser(data: UserCreate): Promise<UserResponse> {
    return authenticate('/users/create', data, 'Failed to create account');
}

export function login(data: UserCreate): Promise<UserResponse> {
    return authenticate('/users/login', data, 'Failed to log in');
}

export async function logout(): Promise<void> {
    accessToken = null;
    // The server revokes the refresh token and clears the cookie (JavaScript can't touch httpOnly cookies)
    await request<void>('POST', '/users/logout', undefined, 'Failed to log out', false).catch(() => {});
}

export function getCurrentUser(): Promise<UserResponse> {
    return request<UserResponse>('GET', '/users/me', undefined, 'Failed to load user');
}
