import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getMemberOnboardingDraft, updateMemberOnboardingDraft } from '@/lib/member-onboarding-state';
import { ActionButton, ScreenWrap, onboardingStyles } from './_shared';

type Gender = 'male' | 'female';

export default function Step4Screen() {
  const [gender, setGender] = useState<Gender>('female');

  React.useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const draft = await getMemberOnboardingDraft();
      if (mounted && draft.gender) setGender(draft.gender);
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const continueNext = async () => {
    await updateMemberOnboardingDraft({ gender });
    router.push('/(member-onboarding)/step-5');
  };

  return (
    <ScreenWrap style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.title}>Tell Us About Yourself</Text>
        <Text style={styles.subtitle}>To give you a better experience and results we need to know your gender.</Text>
      </View>

      <View style={styles.optionsWrap}>
        <Pressable
          style={[styles.genderCircle, gender === 'male' ? styles.genderActive : styles.genderInactive]}
          onPress={() => setGender('male')}
        >
          <Text style={styles.genderIcon}>♂</Text>
          <Text style={styles.genderText}>Male</Text>
        </Pressable>

        <Pressable
          style={[styles.genderCircle, gender === 'female' ? styles.genderActive : styles.genderInactive]}
          onPress={() => setGender('female')}
        >
          <Text style={styles.genderIcon}>♀</Text>
          <Text style={styles.genderText}>Female</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <ActionButton label="Continue" onPress={continueNext} />
      </View>
    </ScreenWrap>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 28,
    paddingTop: 84,
    paddingBottom: 34,
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
    maxWidth: 340,
  },
  optionsWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 22,
  },
  genderCircle: {
    width: 246,
    height: 246,
    borderRadius: 123,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderActive: {
    backgroundColor: '#90ef84',
  },
  genderInactive: {
    backgroundColor: '#bebec0',
  },
  genderIcon: {
    fontSize: 70,
    color: '#f2f2f2',
    marginBottom: 8,
    fontWeight: '600',
  },
  genderText: {
    color: '#f2f2f2',
    fontSize: 48,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 10,
  },
});
