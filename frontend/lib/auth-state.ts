import type {LoginResponse} from './api/auth';

const AUTH_STATE_KEY = 'priora.auth';

export type AuthState = LoginResponse;

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

export function saveAuthState(authState: AuthState) {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify(authState));
}

export function getAuthState(): AuthState | null {
  if (!canUseStorage()) return null;

  const value = window.sessionStorage.getItem(AUTH_STATE_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as AuthState;
  } catch {
    clearAuthState();
    return null;
  }
}

export function clearAuthState() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(AUTH_STATE_KEY);
}

export function isAuthenticated() {
  return Boolean(getAuthState()?.accessToken);
}
