import { useEffect, useState } from 'react';
import {
  AuthState,
  getAuthState,
  setAuthState,
  clearAuthState,
  subscribeAuthState,
} from '@/lib/auth-state';

export function useAuth() {
  const [authState, setLocalAuthState] = useState<AuthState>(getAuthState());

  useEffect(() => {
    setLocalAuthState(getAuthState());
    const unsubscribe = subscribeAuthState(() => {
      setLocalAuthState(getAuthState());
    });

    const storageListener = () => {
      setLocalAuthState(getAuthState());
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', storageListener);
    }

    return () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('storage', storageListener);
      }
      unsubscribe();
    };
  }, []);

  return {
    authState,
    isAuthenticated: !!authState.token,
    isLoading: false,
    setAuthState,
    clearAuthState,
  };
}
