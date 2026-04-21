import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AuthHeader } from '@/components/ui/auth-header';
import { AppColors } from '@/constants/theme';
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

type Method = 'email' | 'phone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [method, setMethod] = useState<Method>('email');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();

  const validate = () => {
    const identifier = value.trim();
    if (!identifier) {
      setFieldError(`${method === 'email' ? 'Email' : 'Mobile number'} is required.`);
      return false;
    }
    if (method === 'email' && !EMAIL_RE.test(identifier)) {
      setFieldError('Enter a valid email address.');
      return false;
    }
    setFieldError(undefined);
    return true;
  };

  const handleSend = async () => {
    if (!validate()) return;
    const identifier = value.trim();

    if (method !== 'email') {
      Alert.alert('Not available yet', 'Phone recovery is not implemented yet. Please use email.');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.forgotPassword(identifier);
      const infoMessage = response.resetCode
        ? `${response.message} (Dev code: ${response.resetCode})`
        : response.message;
      Alert.alert('Reset code sent', infoMessage);

      router.push({
        pathname: '/(auth)/verification',
        params: { email: identifier, mode: 'reset' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reset code.';
      Alert.alert('Request failed', message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMethod = () => {
    setMethod((prev) => (prev === 'email' ? 'phone' : 'email'));
    setValue('');
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
          title="Forget Password"
          subtitle="Enter your information below"
          style={styles.header}
        />

        <View style={styles.form}>
          <AppInput
            placeholder={method === 'email' ? 'Enter Email' : 'Enter Mobile Number'}
            value={value}
            onChangeText={(v) => { setValue(v); setFieldError(undefined); }}
            keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
            error={fieldError}
          />

          <AppButton title="Send" onPress={handleSend} loading={loading} style={styles.btn} />

          <TouchableOpacity style={styles.linkRow} onPress={toggleMethod}>
            <Text style={styles.linkText}>Try another way</Text>
          </TouchableOpacity>
        </View>
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
  btn: {
    marginTop: 4,
  },
  linkRow: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
});
