export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export type DocumentRecord = {
  id: string;
  mindSpaceId: string;
  fileName: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type UploadDocumentResponse = {
  documentId: string;
  jobId: string;
  status: 'PENDING';
};

export type DocumentsApiErrorCode = 'unauthorized' | 'notFound' | 'requestFailed';

export class DocumentsApiError extends Error {
  code: DocumentsApiErrorCode;

  constructor(code: DocumentsApiErrorCode) {
    super(code);
    this.code = code;
  }
}

const API_BASE_URL = '/api/v1';

function errorFromStatus(status: number) {
  if (status === 401) return new DocumentsApiError('unauthorized');
  if (status === 404) return new DocumentsApiError('notFound');
  return new DocumentsApiError('requestFailed');
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
    throw new DocumentsApiError('requestFailed');
  }

  if (!response.ok) throw errorFromStatus(response.status);
  return response.json() as Promise<T>;
}

export function listDocuments(accessToken: string, mindSpaceId: string, signal?: AbortSignal) {
  return request<DocumentRecord[]>(
    `${API_BASE_URL}/documents?mindSpaceId=${encodeURIComponent(mindSpaceId)}`,
    accessToken,
    {signal},
  );
}

export function uploadDocument(accessToken: string, mindSpaceId: string, file: File) {
  const body = new FormData();
  body.append('mindSpaceId', mindSpaceId);
  body.append('file', file);

  return request<UploadDocumentResponse>(`${API_BASE_URL}/documents`, accessToken, {
    method: 'POST',
    body,
  });
}
