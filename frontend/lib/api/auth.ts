export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
};

export type LoginErrorCode = 'invalidCredentials' | 'networkError';

export class LoginError extends Error {
  code: LoginErrorCode;

  constructor(code: LoginErrorCode) {
    super(code);
    this.code = code;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_NEST_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
  } catch {
    throw new LoginError('networkError');
  }

  if (response.status === 401) {
    throw new LoginError('invalidCredentials');
  }

  if (!response.ok) {
    throw new LoginError('networkError');
  }

  return response.json() as Promise<LoginResponse>;
}
