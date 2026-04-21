import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AuthHeader } from '@/components/ui/auth-header';
import { GoogleButton } from '@/components/ui/google-button';
import { AppColors } from '@/constants/theme';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import {
  isMemberOnboardingCompleted,
  setActiveMemberSession,
  syncMemberOnboardingCompletion,
} from '@/lib/member-onboarding-state';
import { authApi, type AuthUser } from '@/lib/auth-api';
import { router } from 'expo-router';
import { setAuthState } from '@/lib/auth-state';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type UserRole = 'admin' | 'trainer' | 'member';

const ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: 'I am Admin', value: 'admin' },
  { label: 'I am Trainer', value: 'trainer' },
  { label: 'I am Member', value: 'member' },
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const isMember = selectedRole === 'member';

  useEffect(() => {
    setErrors({});
    setEmail('');
    setPassword('');
  }, [selectedRole]);

  const navigateByRole = async (args: {
    role?: UserRole;
    accountEmail?: string;
    token?: string;
    onboardingCompleted?: boolean;
    user?: AuthUser;
  }) => {
    const { role, accountEmail, token, onboardingCompleted, user } = args;

    if (role === 'admin') {
      if (token) {
        setAuthState(user || null, token);
      }
      router.replace('/(roles)/admin');
      return;
    }

    if (role === 'trainer') {
      if (token) {
        setAuthState(user || null, token);
      }
      router.replace('/(roles)/trainer');
      return;
    }

    if (token) {
      setAuthState(user || null, token);
    }

    const resolvedEmail = accountEmail?.trim().toLowerCase();
    let completed = false;

    if (onboardingCompleted === true) {
      completed = true;
      await syncMemberOnboardingCompletion(resolvedEmail, true);
    } else if (onboardingCompleted === false) {
      completed = false;
      await syncMemberOnboardingCompletion(resolvedEmail, false);
    } else {
      completed = await isMemberOnboardingCompleted(resolvedEmail);
    }

    if (completed) {
      router.replace('/(roles)/member');
      return;
    }

    await setActiveMemberSession({ email: resolvedEmail, token });
    router.replace('/(member-onboarding)/step-1');
  };

  const { loading: googleLoading, startGoogleAuth } = useGoogleAuth({
    onSuccess: async (response) => {
      if (response.token) {
        await navigateByRole({
          role: response.user?.role || selectedRole,
          accountEmail: response.user?.email,
          token: response.token,
          onboardingCompleted: response.user?.onboardingCompleted,
          user: response.user,
        });
        return;
      }
      Alert.alert('Google Sign-In', response.message || 'Google sign-in successful.');
    },
    onError: (message) => {
      Alert.alert('Google Sign-In failed', message);
    },
  });

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await authApi.login(email.trim(), password, selectedRole);
      if (response.token) {
        await navigateByRole({
          role: response.user?.role || selectedRole,
          accountEmail: response.user?.email || email.trim(),
          token: response.token,
          onboardingCompleted: response.user?.onboardingCompleted,
          user: response.user,
        });
        return;
      }
      Alert.alert('Login', response.message || 'Login successful.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to login.';
      if (message.toLowerCase().includes('verify')) {
        router.push({
          pathname: '/(auth)/verification',
          params: { email: email.trim(), mode: 'verify' },
        });
        return;
      }
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    await startGoogleAuth({ role: selectedRole });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHeader
          title="Login here"
          subtitle={"Welcome back you've\nbeen missed!"}
          style={styles.header}
        />

        <View style={styles.form}>
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Login As</Text>
            <View style={styles.optionGrid}>
              {ROLE_OPTIONS.map((option) => {
                const active = option.value === selectedRole;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => setSelectedRole(option.value)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <AppInput
            placeholder={selectedRole === 'trainer' ? 'Trainer email (provided by admin)' : 'Email'}
            value={email}
            onChangeText={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: undefined })); }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <AppInput
            placeholder={selectedRole === 'trainer' ? 'Password (provided by admin)' : 'Password'}
            value={password}
            onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); }}
            secureTextEntry
            error={errors.password}
          />

          {selectedRole !== 'admin' ? (
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </TouchableOpacity>
          ) : null}

          {!isMember ? (
            <Text style={styles.roleHintText}>
              {selectedRole === 'admin'
                ? 'Use admin credentials to continue.'
                : 'Trainer login uses credentials shared by admin.'}
            </Text>
          ) : null}

          <AppButton title="Continue" onPress={handleLogin} loading={loading} />

          {isMember ? (
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.linkText}>Create new account</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isMember ? (
          <>
            <View style={styles.divider}>
              <Text style={styles.dividerText}>Or continue with</Text>
            </View>

            <GoogleButton onPress={handleGoogleLogin} loading={googleLoading} disabled={loading} />
          </>
        ) : null}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: AppColors.white,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 50,
  },
  form: {
    width: '100%',
  },
  sectionWrap: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: AppColors.primaryLight,
    borderColor: AppColors.primaryLight,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  optionChipText: {
    color: AppColors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: AppColors.white,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: 4,
  },
  forgotText: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '500',
  },
  roleHintText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 12,
  },
  linkRow: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  divider: {
    alignItems: 'center',
    marginVertical: 28,
  },
  dividerText: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '600',
  },
});
