import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getMemberOnboardingDraft, updateMemberOnboardingDraft } from '@/lib/member-onboarding-state';
import { BottomActions, ScreenWrap, onboardingStyles } from './_shared';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function Step9Screen() {
  const [selectedLevel, setSelectedLevel] = useState('Intermediate');

  React.useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const draft = await getMemberOnboardingDraft();
      if (mounted && draft.activityLevel) {
        setSelectedLevel(draft.activityLevel);
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const continueNext = async () => {
    await updateMemberOnboardingDraft({ activityLevel: selectedLevel });
    router.push('/(member-onboarding)/step-10');
  };

  return (
    <ScreenWrap style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.title}>Physical Activity Level</Text>
        <Text style={styles.subtitle}>This helps us create your personalized workout plan.</Text>
      </View>

      <View style={styles.levelWrap}>
        {LEVELS.map((level) => {
          const active = level === selectedLevel;
          return (
            <Pressable key={level} style={[styles.levelItem, active && styles.levelItemActive]} onPress={() => setSelectedLevel(level)}>
              <Text style={[styles.levelText, active && styles.levelTextActive]}>{level}</Text>
            </Pressable>
          );
        })}
      </View>

      <BottomActions onBack={() => router.back()} onContinue={continueNext} />
    </ScreenWrap>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 28,
    paddingTop: 84,
  },
  top: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    ...onboardingStyles.title,
    fontSize: 22,
    lineHeight: 30,
  },
  subtitle: {
    ...onboardingStyles.subtitle,
    fontSize: 16,
    lineHeight: 26,
    marginTop: 12,
    maxWidth: 360,
  },
  levelWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  levelItem: {
    height: 58,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c9e7b8',
  },
  levelItemActive: {
    backgroundColor: '#17c700',
  },
  levelText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#17b600',
  },
  levelTextActive: {
    color: '#ffffff',
  },
});
