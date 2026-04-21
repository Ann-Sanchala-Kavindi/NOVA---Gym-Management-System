import { AppColors } from '@/constants/theme';
import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export function AuthHeader({ title, subtitle, style }: AuthHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Image source={require('../../assets/images/logo.jpeg')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
    borderRadius: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.primary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
