import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppInput } from '@/components/ui/app-input';
import { getMemberOnboardingDraft, updateMemberOnboardingDraft } from '@/lib/member-onboarding-state';
import { NumberWheel } from './number-wheel';
import { BottomActions, ScreenWrap, onboardingStyles } from './_shared';

export default function Step7Screen() {
  const [weight, setWeight] = useState(59);

  React.useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const draft = await getMemberOnboardingDraft();
      if (mounted && typeof draft.weight === 'number') {
        setWeight(draft.weight);
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const onManualChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits) return setWeight(30);
    const numeric = Number(digits);
    setWeight(Math.max(30, Math.min(200, numeric)));
  };

  const continueNext = async () => {
    await updateMemberOnboardingDraft({ weight });
    router.push('/(member-onboarding)/step-8');
  };

  return (
    <ScreenWrap style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.title}>What is Your Weight?</Text>
        <Text style={styles.subtitle}>Weight in kg. Don't worry, you can always change it later.</Text>
      </View>

      <View style={styles.wheelWrap}>
        <NumberWheel value={weight} min={30} max={200} onChange={setWeight} />
        <AppInput
          placeholder="Type weight (kg)"
          value={String(weight)}
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
    width: 190,
    marginTop: 16,
    marginBottom: 0,
  },
});
