export type MindSpace = {
  id: string;
  name: string;
};

type MindSpacesResponse = {
  count: number;
  result: MindSpace[];
};

export type MindSpacesErrorCode = 'unauthorized' | 'requestFailed';

export class MindSpacesError extends Error {
  code: MindSpacesErrorCode;

  constructor(code: MindSpacesErrorCode) {
    super(code);
    this.code = code;
  }
}

const API_BASE_URL = '/api/v1';

export async function createMindSpace(accessToken: string, name: string): Promise<MindSpace> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/mindspaces`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`},
      body: JSON.stringify({name}),
    });
  } catch {
    throw new MindSpacesError('requestFailed');
  }
  if (response.status === 401) throw new MindSpacesError('unauthorized');
  if (!response.ok) throw new MindSpacesError('requestFailed');
  const mindSpace = await response.json() as MindSpace;
  if (!mindSpace || typeof mindSpace.id !== 'string' || !mindSpace.id || typeof mindSpace.name !== 'string') {
    throw new MindSpacesError('requestFailed');
  }
  return mindSpace;
}

export async function getMindSpaces(accessToken: string): Promise<MindSpacesResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/mindspaces`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new MindSpacesError('requestFailed');
  }

  if (response.status === 401) {
    throw new MindSpacesError('unauthorized');
  }

  if (!response.ok) {
    throw new MindSpacesError('requestFailed');
  }

  return response.json() as Promise<MindSpacesResponse>;
}
