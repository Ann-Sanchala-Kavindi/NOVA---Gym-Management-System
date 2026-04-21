import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppInput } from '@/components/ui/app-input';
import { getMemberOnboardingDraft, updateMemberOnboardingDraft } from '@/lib/member-onboarding-state';
import { NumberWheel } from './number-wheel';
import { BottomActions, ScreenWrap, onboardingStyles } from './_shared';

export default function Step5Screen() {
  const [age, setAge] = useState(32);

  React.useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const draft = await getMemberOnboardingDraft();
      if (mounted && typeof draft.age === 'number') {
        setAge(draft.age);
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const onManualChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits) return setAge(10);
    const numeric = Number(digits);
    setAge(Math.max(10, Math.min(90, numeric)));
  };

  const continueNext = async () => {
    await updateMemberOnboardingDraft({ age });
    router.push('/(member-onboarding)/step-6');
  };

  return (
    <ScreenWrap style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.title}>How Old Are You?</Text>
        <Text style={styles.subtitle}>Age in years. This will help us to personalize an exercise program plan that suits you.</Text>
      </View>

      <View style={styles.wheelWrap}>
        <NumberWheel value={age} min={10} max={90} onChange={setAge} />
        <AppInput
          placeholder="Type age"
          value={String(age)}
          onChangeText={onManualChange}
          keyboardType="number-pad"
          containerStyle={styles.manualInput}
        />
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
  wheelWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  manualInput: {
    width: 170,
    marginTop: 16,
    marginBottom: 0,
  },
});
