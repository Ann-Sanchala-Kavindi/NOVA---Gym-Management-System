import { AppColors } from '@/constants/theme';
import { router } from 'expo-router';
import React from 'react';
import {
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header text */}
      <View style={styles.topContent}>
        <Text style={styles.gymName}>NOVA FITNESS{'\n'}CENTER</Text>
      </View>

      {/* Logo placeholder */}
      <View style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <Image
            source={require('../../assets/images/logo.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Get Started button */}
      <View style={styles.bottomContent}>
        <TouchableOpacity
          style={styles.getStartedBtn}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  topContent: {
    alignItems: 'center',
  },
  gymName: {
    fontSize: 34,
    fontWeight: '900',
    color: AppColors.white,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 42,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 200,
    height: 120,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoImage: {
    width: '80%',
    height: '80%',
  },
  logoText: {
    fontSize: 24,
    color: AppColors.white,
    fontWeight: '500',
  },
  bottomContent: {
    width: '100%',
    alignItems: 'center',
  },
  getStartedBtn: {
    backgroundColor: AppColors.primaryLight,
    borderRadius: 30,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    fontSize: 17,
    fontWeight: '600',
    color: AppColors.text,
  },
});
