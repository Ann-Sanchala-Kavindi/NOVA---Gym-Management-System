import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { clearAuthState } from '@/lib/auth-state';

export default function Index() {
  const { authState, isLoading } = useAuth();

  if (isLoading) return null;

  if (!authState?.token) {
    return <Redirect href='/(auth)/login' />;
  }

  const role = authState?.user?.role;

  if (role === 'admin') return <Redirect href='/(roles)/admin' />;
  if (role === 'trainer') return <Redirect href='/(roles)/trainer' />;
  if (role === 'member' || !role) return <Redirect href='/(roles)/member' />;

  clearAuthState();
  return <Redirect href='/(auth)/login' />;
}
