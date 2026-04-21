import { AuthResponse, authApi } from '@/lib/auth-api';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

type UseGoogleAuthOptions = {
  onSuccess: (response: AuthResponse) => void;
  onError: (message: string) => void;
};

type StartGoogleAuthOptions = {
  role?: 'admin' | 'trainer' | 'member';
};

function getGoogleConfig() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';

  return {
    webClientId,
    androidClientId,
    iosClientId,
  };
}

export function useGoogleAuth({ onSuccess, onError }: UseGoogleAuthOptions) {
  const [loading, setLoading] = useState(false);
  const pendingRoleRef = useRef<'admin' | 'trainer' | 'member' | undefined>(undefined);
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  const googleConfig = useMemo(() => getGoogleConfig(), []);

  const hasWebClientId = !!googleConfig.webClientId;
  const hasAnyClientId = useMemo(
    () => !!(googleConfig.webClientId || googleConfig.androidClientId || googleConfig.iosClientId),
    [googleConfig]
  );

  // Prevent expo-auth-session invariant crashes by always passing a placeholder web client id.
  const safeGoogleConfig = useMemo(
    () => ({
      ...googleConfig,
      webClientId: googleConfig.webClientId || 'missing-google-web-client-id',
    }),
    [googleConfig]
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(safeGoogleConfig);

  useEffect(() => {
    if (!response) return;

    if (response.type !== 'success') {
      if (response.type !== 'dismiss' && response.type !== 'cancel') {
        onError('Google sign-in was not completed. Please try again.');
      }
      return;
    }

    const idToken = response.params?.id_token || response.authentication?.idToken;
    if (!idToken) {
      onError('Google did not return an ID token. Verify your Google client IDs.');
      return;
    }

    const signIn = async () => {
      setLoading(true);
      try {
        const authResponse = await authApi.googleSignIn(idToken, pendingRoleRef.current);
        onSuccess(authResponse);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google authentication failed.';
        onError(message);
      } finally {
        pendingRoleRef.current = undefined;
        setLoading(false);
      }
    };

    signIn();
  }, [onError, onSuccess, response]);

  const startGoogleAuth = async (options: StartGoogleAuthOptions = {}) => {
    if (isExpoGo) {
      onError('Google sign-in is not supported in Expo Go for this setup. Use a development build and run: npx expo start --dev-client');
      return;
    }

    if (!hasAnyClientId) {
      onError(
        'Google client IDs are missing. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and platform-specific IDs in frontend/.env.'
      );
      return;
    }

    if (!hasWebClientId) {
      const platformLabel = Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'web';
      onError(
        `${platformLabel} Google auth requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Set it in frontend/.env and restart Expo with --clear.`
      );
      return;
    }

    if (!request) {
      onError('Google sign-in is still initializing. Try again in a moment.');
      return;
    }

    try {
      pendingRoleRef.current = options.role;
      await promptAsync();
    } catch {
      onError('Unable to open Google sign-in. Check internet connection and try again.');
    }
  };

  return {
    loading,
    startGoogleAuth,
  };
}
