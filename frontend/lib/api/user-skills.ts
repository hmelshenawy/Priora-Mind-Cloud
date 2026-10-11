export type UserSkillSummary = {id: string; name: string; description: string};
export type UserSkill = UserSkillSummary & {instructions: string; isEnabled: boolean};
export type CreateUserSkillInput = Pick<UserSkill, 'name' | 'description' | 'instructions'>;
export type UpdateUserSkillInput = Partial<CreateUserSkillInput & {isEnabled: boolean}>;

export class UserSkillsApiError extends Error {
  constructor(public code: 'unauthorized' | 'notFound' | 'conflict' | 'requestFailed' | 'deleteFailed') {
    super(code);
  }
}

async function request(token: string, path = '', init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`/api/v1/user-skills${path}`, {
      ...init,
      headers: {Authorization: `Bearer ${token}`, ...init?.headers},
      cache: 'no-store',
    });
  } catch {
    throw new UserSkillsApiError('requestFailed');
  }
  if (!response.ok) {
    throw new UserSkillsApiError(
      response.status === 401 ? 'unauthorized' : response.status === 404 ? 'notFound' :
        response.status === 409 ? 'conflict' : 'requestFailed',
    );
  }
  return response;
}

async function unwrap<T>(response: Response): Promise<T> {
  const result = await response.json();
  if (result?.ok !== true || result.data === undefined) throw new UserSkillsApiError('requestFailed');
  return result.data as T;
}

// No enabled filter: management must include disabled user-created skills.
export async function listUserSkills(token: string) {
  return unwrap<UserSkillSummary[]>(await request(token));
}

export async function getUserSkill(token: string, id: string) {
  return unwrap<UserSkill>(await request(token, `/${encodeURIComponent(id)}`));
}

export async function createUserSkill(token: string, input: CreateUserSkillInput) {
  return unwrap<UserSkill>(await request(token, '', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input),
  }));
}

export async function updateUserSkill(token: string, id: string, input: UpdateUserSkillInput) {
  return unwrap<UserSkill>(await request(token, `/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input),
  }));
}

export async function deleteUserSkill(token: string, id: string) {
  // The existing DELETE returns plain text. Do not assume a JSON wrapper.
  await request(token, `/${encodeURIComponent(id)}`, {method: 'DELETE'});
}
