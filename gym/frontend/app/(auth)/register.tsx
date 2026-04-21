import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AuthHeader } from '@/components/ui/auth-header';
import { GoogleButton } from '@/components/ui/google-button';
import { AppColors } from '@/constants/theme';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { authApi } from '@/lib/auth-api';
import { router } from 'expo-router';
import React, { useState } from 'react';
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

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  const { loading: googleLoading, startGoogleAuth } = useGoogleAuth({
    onSuccess: (response) => {
      if (response.token) {
        router.replace('/(roles)/member');
        return;
      }
      Alert.alert('Google Sign-Up', response.message || 'Google sign-up successful.');
    },
    onError: (message) => {
      Alert.alert('Google Sign-Up failed', message);
    },
  });

  const validate = () => {
    const e: typeof errors = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) e.email = 'Email is required.';
    else if (!EMAIL_RE.test(normalizedEmail)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Password is required.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password.';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    const normalizedEmail = email.trim();

    setLoading(true);
    try {
      const response = await authApi.register(normalizedEmail, password);
      const infoMessage = response.verificationCode
        ? `${response.message} (Dev code: ${response.verificationCode})`
        : response.message;
      Alert.alert('Registration', infoMessage);

      router.push({
        pathname: '/(auth)/verification',
        params: { email: normalizedEmail, mode: 'verify' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register.';
      Alert.alert('Registration failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    await startGoogleAuth();
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
          title="Create Account"
          subtitle="Create an account so you can explore all the existing jobs"
          style={styles.header}
        />

        <View style={styles.form}>
          <AppInput
            placeholder="Email"
            value={email}
            onChangeText={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: undefined })); }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <AppInput
            placeholder="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); }}
            secureTextEntry
            error={errors.password}
          />
          <AppInput
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setErrors((p) => ({ ...p, confirmPassword: undefined })); }}
            secureTextEntry
            error={errors.confirmPassword}
          />

          <AppButton title="Continue" onPress={handleRegister} loading={loading} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>Already have an account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <Text style={styles.dividerText}>Or continue with</Text>
        </View>

        <GoogleButton onPress={handleGoogleRegister} loading={googleLoading} disabled={loading} />
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
