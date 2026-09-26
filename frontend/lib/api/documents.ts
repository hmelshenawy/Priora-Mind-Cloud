export type DocumentRecord = {
  id: string;
  mindSpaceId: string;
  fileName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type UploadDocumentResponse = {
  result: string;
  documentMetaData: DocumentRecord & {
    storageKey: string;
  };
};

export type DocumentsApiErrorCode = 'unauthorized' | 'notFound' | 'requestFailed';

export class DocumentsApiError extends Error {
  code: DocumentsApiErrorCode;

  constructor(code: DocumentsApiErrorCode) {
    super(code);
    this.code = code;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_NEST_API_BASE_URL ?? 'http://localhost:3000/api/v1';

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

export function listDocuments(accessToken: string, mindSpaceId: string) {
  return request<DocumentRecord[]>(
    `${API_BASE_URL}/documents?mindSpaceId=${encodeURIComponent(mindSpaceId)}`,
    accessToken,
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
