import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AuthHeader } from '@/components/ui/auth-header';
import { AppColors } from '@/constants/theme';
import { authApi } from '@/lib/auth-api';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
    KeyboardAvoidingView,
    NativeSyntheticEvent,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TextInputKeyPressEventData,
    TouchableOpacity,
    View,
} from 'react-native';

const OTP_LENGTH = 4;

export default function VerificationScreen() {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpError, setOtpError] = useState<string | undefined>();
  const [pwErrors, setPwErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const inputs = useRef<(TextInput | null)[]>([]);
  const params = useLocalSearchParams<{ email?: string | string[]; mode?: string | string[] }>();

  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const email = emailParam?.trim() || '';
  const mode = modeParam === 'reset' ? 'reset' : 'verify';
  const isResetMode = mode === 'reset';

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const validate = () => {
    let valid = true;
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setOtpError('Please enter the complete 4-digit code.');
      valid = false;
    } else {
      setOtpError(undefined);
    }
    if (isResetMode) {
      const pe: typeof pwErrors = {};
      if (!newPassword) pe.newPassword = 'New password is required.';
      else if (newPassword.length < 6) pe.newPassword = 'Password must be at least 6 characters.';
      if (!confirmPassword) pe.confirmPassword = 'Please confirm your new password.';
      else if (newPassword !== confirmPassword) pe.confirmPassword = 'Passwords do not match.';
      setPwErrors(pe);
      if (Object.keys(pe).length > 0) valid = false;
    }
    return valid;
  };

  const handleVerify = async () => {
    if (!validate()) return;
    const code = otp.join('');
    if (!email) {
      Alert.alert('Missing email', 'Go back and enter your email again.');
      return;
    }

    setLoading(true);
    try {
      if (isResetMode) {
        const response = await authApi.resetPassword(email, code, newPassword);
        Alert.alert('Password updated', response.message || 'Password reset successful.');
        router.replace('/(auth)/login');
      } else {
        const response = await authApi.verifyEmail(email, code);
        Alert.alert('Verified', response.message || 'Email verified.');
        router.replace('/(roles)/member');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed.';
      Alert.alert('Verification failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      Alert.alert('Missing email', 'Go back and enter your email again.');
      return;
    }

    setOtp(Array(OTP_LENGTH).fill(''));
    inputs.current[0]?.focus();
    try {
      if (isResetMode) {
        const response = await authApi.forgotPassword(email);
        const infoMessage = response.resetCode
          ? `${response.message} (Dev code: ${response.resetCode})`
          : response.message;
        Alert.alert('Code resent', infoMessage);
      } else {
        const response = await authApi.resendVerification(email);
        const infoMessage = response.verificationCode
          ? `${response.message} (Dev code: ${response.verificationCode})`
          : response.message;
        Alert.alert('Code resent', infoMessage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend code.';
      Alert.alert('Resend failed', message);
    }
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
          title="Verification"
          subtitle={
            isResetMode
              ? "Enter the code and your new password"
              : "Check your email we've sent you the pin\nat your email"
          }
          style={styles.header}
        />

        {/* OTP Inputs */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(el) => { inputs.current[index] = el; }}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : styles.otpBoxEmpty,
                !!otpError && styles.otpBoxError,
              ]}
              value={digit}
              onChangeText={(text) => { handleChange(text, index); setOtpError(undefined); }}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>
        {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}

        {isResetMode ? (
          <View style={styles.resetFields}>
            <AppInput
              placeholder="New password"
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setPwErrors((p) => ({ ...p, newPassword: undefined })); }}
              secureTextEntry
              error={pwErrors.newPassword}
            />
            <AppInput
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setPwErrors((p) => ({ ...p, confirmPassword: undefined })); }}
              secureTextEntry
              error={pwErrors.confirmPassword}
            />
          </View>
        ) : null}

        <AppButton
          title={isResetMode ? 'Reset Password' : 'Verify'}
          onPress={handleVerify}
          loading={loading}
          style={styles.btn}
        />

        <TouchableOpacity style={styles.resendRow} onPress={handleResend}>
          <Text style={styles.resendText}>Resend the code</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
  },
  header: {
    marginBottom: 60,
    width: '100%',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 36,
  },
  otpBox: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 24,
    fontWeight: '600',
    color: AppColors.text,
  },
  otpBoxEmpty: {
    borderColor: AppColors.inputBorder,
    backgroundColor: AppColors.white,
  },
  otpBoxFilled: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.white,
  },
  otpBoxError: {
    borderColor: AppColors.error,
  },
  otpErrorText: {
    color: AppColors.error,
    fontSize: 12,
    marginTop: -28,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  btn: {
    width: '100%',
  },
  resetFields: {
    width: '100%',
    marginTop: 16,
  },
  resendRow: {
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
});
