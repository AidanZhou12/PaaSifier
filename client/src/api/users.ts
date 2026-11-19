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

export async function createUser({ username, password }: UserCreate): Promise<UserResponse> {
    const response = await fetch(`${API_URL}/users/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
        const errorData: { detail?: string } = await response.json().catch(() => ({}));
        throw new ApiError(errorData.detail || 'Failed to create account', response.status);
    }
    return response.json();
}
