type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: 'admin' | 'trainer' | 'member';
  memberType?: 'normal' | 'premium';
  onboardingCompleted?: boolean;
  authProvider: 'local' | 'google';
  isEmailVerified: boolean;
};

export type AuthResponse = {
  message: string;
  token?: string;
  user?: AuthUser;
  verificationCode?: string;
  resetCode?: string;
  needsVerification?: boolean;
  email?: string;
};

const BASE_URL = getApiBaseUrl();

console.log('[auth-api] Using API base URL:', BASE_URL);

function normalizeApiBaseUrl(value: string) {
  let url = value.trim();
  if (!url) return url;

  // Common typo fix: http://10.0.0.1.5000 -> http://10.0.0.1:5000
  url = url.replace(/(https?:\/\/\d{1,3}(?:\.\d{1,3}){3})\.(\d{2,5})(?=\/|$)/, '$1:$2');

  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }

  return url.replace(/\/+$/, '');
}

function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return normalizeApiBaseUrl(configured);
  return '';
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  if (!BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL. Set it in frontend/.env and restart Expo with --clear.');
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `Cannot connect to backend at ${BASE_URL}. Start backend server and set EXPO_PUBLIC_API_URL if needed.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || 'Request failed.';
    throw new Error(message);
  }

  return data as T;
}

export const authApi = {
  register: (email: string, password: string) =>
    apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    }),

  verifyEmail: (email: string, code: string) =>
    apiRequest<AuthResponse>('/api/auth/verify-email', {
      method: 'POST',
      body: { email, code },
    }),

  resendVerification: (email: string) =>
    apiRequest<AuthResponse>('/api/auth/resend-verification', {
      method: 'POST',
      body: { email },
    }),

  login: (email: string, password: string, role?: 'admin' | 'trainer' | 'member') =>
    apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password, role },
    }),

  forgotPassword: (email: string) =>
    apiRequest<AuthResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (email: string, code: string, newPassword: string) =>
    apiRequest<AuthResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: { email, code, newPassword },
    }),

  googleSignIn: (idToken: string, role?: 'admin' | 'trainer' | 'member') =>
    apiRequest<AuthResponse>('/api/auth/google', {
      method: 'POST',
      body: { idToken, role },
    }),

  submitMemberOnboarding: (
    body: {
      gender?: 'male' | 'female';
      age?: number;
      height?: number;
      weight?: number;
      goals?: string[];
      activityLevel?: string;
      name?: string;
      mobile?: string;
      whatsapp?: string;
    },
    token: string
  ) =>
    apiRequest<AuthResponse>('/api/auth/member-onboarding', {
      method: 'POST',
      body,
      token,
    }),
};

export { BASE_URL as API_BASE_URL };
