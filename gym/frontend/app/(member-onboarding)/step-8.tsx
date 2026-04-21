import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getMemberOnboardingDraft, updateMemberOnboardingDraft } from '@/lib/member-onboarding-state';
import { BottomActions, ScreenWrap, onboardingStyles } from './_shared';

const GOALS = ['Get Fitter', 'Gain Weight', 'Lose Weight', 'Build Muscles', 'Improving Endurance', 'Others'];

export default function Step8Screen() {
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['Get Fitter', 'Lose Weight']);

  React.useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const draft = await getMemberOnboardingDraft();
      if (mounted && draft.goals?.length) {
        setSelectedGoals(draft.goals);
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) => (prev.includes(goal) ? prev.filter((item) => item !== goal) : [...prev, goal]));
  };

  const continueNext = async () => {
    await updateMemberOnboardingDraft({ goals: selectedGoals });
    router.push('/(member-onboarding)/step-9');
  };

  return (
    <ScreenWrap style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.title}>What's your goal?</Text>
        <Text style={styles.subtitle}>This helps us create your personalized meal plan {'&'} workout plan.</Text>
      </View>

      <View style={styles.listWrap}>
        {GOALS.map((goal) => {
          const active = selectedGoals.includes(goal);
          return (
            <Pressable key={goal} style={[styles.goalItem, active && styles.goalItemActive]} onPress={() => toggleGoal(goal)}>
              <Text style={[styles.goalText, active && styles.goalTextActive]}>{goal}</Text>
              <View style={[styles.checkBox, active && styles.checkBoxActive]}>
                <Text style={[styles.checkMark, active && styles.checkMarkActive]}>✓</Text>
              </View>
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
  listWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  goalItem: {
    height: 52,
    borderRadius: 10,
    borderColor: '#18be06',
    borderWidth: 2,
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  goalItemActive: {
    backgroundColor: '#17c700',
  },
  goalText: {
    fontSize: 16,
    color: '#1f2025',
    fontWeight: '500',
  },
  goalTextActive: {
    color: '#ffffff',
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#17c700',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBoxActive: {
    borderColor: '#ffffff',
  },
  checkMark: {
    color: '#17c700',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  checkMarkActive: {
    color: '#17c700',
  },
});
