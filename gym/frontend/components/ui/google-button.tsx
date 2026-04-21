import { AppColors } from '@/constants/theme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface SocialButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function GoogleButton({ onPress, disabled = false, loading = false }: SocialButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={isDisabled}
    >
      <Text style={styles.googleIcon}>G</Text>
      <Text style={styles.label}>{loading ? 'Connecting to Google...' : 'Continue With Google'}</Text>
      {loading ? <ActivityIndicator size="small" color={AppColors.primary} style={styles.spinner} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primaryLight,
    borderRadius: 30,
    height: 56,
    width: '100%',
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
    fontFamily: 'serif',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: AppColors.text,
  },
  spinner: {
    marginLeft: 4,
  },
});
