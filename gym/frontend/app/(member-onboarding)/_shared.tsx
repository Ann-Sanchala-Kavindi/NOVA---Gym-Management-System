import { AppColors } from '@/constants/theme';
import React, { PropsWithChildren } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outline';
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({ label, onPress, variant = 'filled', style }: ActionButtonProps) {
  const outlined = variant === 'outline';
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.actionButtonOuter, style]}
      >
        {outlined ? (
          <View style={[styles.actionButton, styles.actionButtonOutline]}>
            <Text style={[styles.actionButtonText, styles.actionButtonTextOutline]}>{label}</Text>
          </View>
        ) : (
          <LinearGradient
            colors={['#178f2a', '#46c96a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.actionButton}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextFilled]}>{label}</Text>
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
}

type BottomActionsProps = {
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
};

export function BottomActions({ onBack, onContinue, continueLabel = 'Continue' }: BottomActionsProps) {
  return (
    <View style={styles.bottomActions}>
      {onBack ? <ActionButton label="Back" onPress={onBack} variant="outline" style={styles.halfButton} /> : null}
      <ActionButton label={continueLabel} onPress={onContinue} style={[styles.halfButton, !onBack && styles.fullButton]} />
    </View>
  );
}

export function StepDots({ active }: { active: 1 | 2 | 3 }) {
  return (
    <View style={styles.dotRow}>
      {[1, 2, 3].map((item) => (
        <View key={item} style={[styles.dot, item === active && styles.dotActive]} />
      ))}
    </View>
  );
}

export function ScreenWrap({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export const onboardingStyles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#24252a',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 14,
    color: '#2d2e32',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#efefef',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 28,
    paddingBottom: 34,
  },
  actionButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  actionButtonOuter: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  actionButtonFilled: {
    backgroundColor: '#17c700',
  },
  actionButtonOutline: {
    backgroundColor: '#eff8ea',
    borderWidth: 2,
    borderColor: '#17c700',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextFilled: {
    color: AppColors.white,
  },
  actionButtonTextOutline: {
    color: '#17b600',
  },
  halfButton: {
    flex: 1,
  },
  fullButton: {
    flex: 1,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cfcfcf',
  },
  dotActive: {
    width: 28,
    backgroundColor: '#16c500',
  },
});

export default function MemberOnboardingSharedRoute() {
  return null;
}
