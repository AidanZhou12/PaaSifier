import { request } from './users'

export interface ProjectResponse {
    id: number;
    name: string;
    crn: string;
    href: string;
    ibm_id: string;
    status: string;
}

// Calls GET /projects (get_projects in backend/routers/projects.py).
// request() adds the access token, and refreshes it and retries once if it has expired.
export function getProjects(): Promise<ProjectResponse[]> {
    return request<ProjectResponse[]>('GET', '/projects', undefined, 'Failed to load projects');
}

export function createProject(name: string): Promise<ProjectResponse> {
    return request<ProjectResponse>('POST', '/projects/create', { name }, 'Failed to create project');
}

export function deleteProject(id: number): Promise<void> {
    return request('DELETE', `/projects/${id}`, undefined, 'Failed to delete project');
}

export function getProject(id: number): Promise<ProjectResponse> {
    return request<ProjectResponse>('GET', `/projects/${id}`, undefined, 'Failed to load project');
}

export interface ApplicationCreate {
    name: string;
    image_reference: string;
    min_instances: number;
    max_instances: number;
}

export interface ApplicationResponse {
    id: number;
    name: string;
    image_reference: string;
    min_instances: number;
    max_instances: number
    href: string
    ibm_id: string
    status: string
    endpoint: string | null;
}