import { AuthUser } from './auth-api';

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

const STORAGE_KEY = 'gym_auth_state';

let currentAuthState: AuthState = {
  user: null,
  token: null,
};

const listeners = new Set<() => void>();

function isWeb() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function loadStoredAuthState(): AuthState {
  try {
    if (!isWeb()) {
      return { user: null, token: null };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw);
    return {
      user: parsed?.user || null,
      token: parsed?.token || null,
    };
  } catch {
    return { user: null, token: null };
  }
}

function saveStoredAuthState(state: AuthState) {
  try {
    if (isWeb()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {}
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

currentAuthState = loadStoredAuthState();

export function setAuthState(user: AuthUser | null, token: string | null): void;
export function setAuthState(state: Partial<AuthState> | AuthState): void;
export function setAuthState(
  userOrState: AuthUser | null | Partial<AuthState> | AuthState,
  tokenArg?: string | null
) {
  if (
    userOrState &&
    typeof userOrState === 'object' &&
    ('user' in userOrState || 'token' in userOrState) &&
    tokenArg === undefined
  ) {
    currentAuthState = {
      user: (userOrState as Partial<AuthState>).user || null,
      token: (userOrState as Partial<AuthState>).token || null,
    };
  } else {
    currentAuthState = {
      user: (userOrState as AuthUser | null) || null,
      token: tokenArg || null,
    };
  }

  saveStoredAuthState(currentAuthState);
  notify();
}

export function getAuthState(): AuthState {
  if ((!currentAuthState.user || !currentAuthState.token) && isWeb()) {
    currentAuthState = loadStoredAuthState();
  }
  return currentAuthState;
}

export function clearAuthState() {
  currentAuthState = { user: null, token: null };
  try {
    if (isWeb()) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  notify();
}

export function subscribeAuthState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
