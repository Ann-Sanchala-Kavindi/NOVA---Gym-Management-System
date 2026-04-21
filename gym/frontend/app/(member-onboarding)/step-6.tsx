import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppInput } from '@/components/ui/app-input';
import { getMemberOnboardingDraft, updateMemberOnboardingDraft } from '@/lib/member-onboarding-state';
import { NumberWheel } from './number-wheel';
import { BottomActions, ScreenWrap, onboardingStyles } from './_shared';

export default function Step6Screen() {
  const [height, setHeight] = useState(175);

  React.useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const draft = await getMemberOnboardingDraft();
      if (mounted && typeof draft.height === 'number') {
        setHeight(draft.height);
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const onManualChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits) return setHeight(120);
    const numeric = Number(digits);
    setHeight(Math.max(120, Math.min(230, numeric)));
  };

  const continueNext = async () => {
    await updateMemberOnboardingDraft({ height });
    router.push('/(member-onboarding)/step-7');
  };

  return (
    <ScreenWrap style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.title}>What is Your Height?</Text>
        <Text style={styles.subtitle}>Height in cm. Don't worry, you can always change it later.</Text>
      </View>

      <View style={styles.wheelWrap}>
        <NumberWheel value={height} min={120} max={230} onChange={setHeight} />
        <AppInput
          placeholder="Type height (cm)"
          value={String(height)}
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
