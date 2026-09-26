export type Note = {
  id: string;
  mindSpaceId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  mindSpaceId: string;
  title: string;
  content: string;
};

export type NotesApiErrorCode = 'unauthorized' | 'notFound' | 'requestFailed';

export class NotesApiError extends Error {
  code: NotesApiErrorCode;

  constructor(code: NotesApiErrorCode) {
    super(code);
    this.code = code;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_NEST_API_BASE_URL ?? 'http://localhost:3000/api/v1';

function errorFromStatus(status: number) {
  if (status === 401) return new NotesApiError('unauthorized');
  if (status === 404) return new NotesApiError('notFound');
  return new NotesApiError('requestFailed');
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
    throw new NotesApiError('requestFailed');
  }

  if (!response.ok) throw errorFromStatus(response.status);
  return response.json() as Promise<T>;
}

export function listNotes(accessToken: string, mindSpaceId: string) {
  return request<Note[]>(
    `${API_BASE_URL}/notes?mindSpaceId=${encodeURIComponent(mindSpaceId)}`,
    accessToken,
  );
}

export function createNote(accessToken: string, input: CreateNoteInput) {
  return request<Note>(`${API_BASE_URL}/notes`, accessToken, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(input),
  });
}

export function getNote(accessToken: string, noteId: string) {
  return request<Note>(`${API_BASE_URL}/notes/${encodeURIComponent(noteId)}`, accessToken);
}
