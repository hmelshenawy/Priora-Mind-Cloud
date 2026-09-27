export type Task = {
  id: string;
  mindSpaceId: string;
  title: string;
  description: string | null;
  status: string;
  executor: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskExecutor = 'USER' | 'AGENT';

export type CreateTaskInput = {
  mindSpaceId: string;
  title: string;
  description?: string;
  executor: TaskExecutor;
};

export type TasksApiErrorCode = 'unauthorized' | 'notFound' | 'requestFailed';

export class TasksApiError extends Error {
  code: TasksApiErrorCode;

  constructor(code: TasksApiErrorCode) {
    super(code);
    this.code = code;
  }
}

const API_BASE_URL = '/api/v1';

function errorFromStatus(status: number) {
  if (status === 401) return new TasksApiError('unauthorized');
  if (status === 404) return new TasksApiError('notFound');
  return new TasksApiError('requestFailed');
}

async function request<T>(url: string, accessToken: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    });
  } catch {
    throw new TasksApiError('requestFailed');
  }

  if (!response.ok) throw errorFromStatus(response.status);
  return response.json() as Promise<T>;
}

export function listTasks(accessToken: string, mindSpaceId: string) {
  return request<Task[]>(
    `${API_BASE_URL}/tasks?mindSpaceId=${encodeURIComponent(mindSpaceId)}`,
    accessToken,
  );
}

export function createTask(accessToken: string, input: CreateTaskInput) {
  return request<Task>(`${API_BASE_URL}/tasks`, accessToken, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(input),
  });
}
