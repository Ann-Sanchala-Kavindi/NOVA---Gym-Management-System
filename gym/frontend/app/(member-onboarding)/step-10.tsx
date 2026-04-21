import { AppInput } from '@/components/ui/app-input';
import { authApi } from '@/lib/auth-api';
import {
  getActiveMemberSession,
  getMemberOnboardingDraft,
  markMemberOnboardingCompleted,
  updateMemberOnboardingDraft,
} from '@/lib/member-onboarding-state';
import { setAuthState } from '@/lib/auth-state';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton, ScreenWrap, onboardingStyles } from './_shared';

export default function Step10Screen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const session = await getActiveMemberSession();
      const draft = await getMemberOnboardingDraft(session.email);

      if (!mounted) return;

      if (session.email) setEmail(session.email);
      if (session.token) setToken(session.token);

      if (draft.name) setName(draft.name);
      if (draft.mobile) setMobile(draft.mobile);
      if (draft.whatsapp) setWhatsapp(draft.whatsapp);

      if (draft.mobile && draft.whatsapp && draft.mobile === draft.whatsapp) {
        setSameAsMobile(true);
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (sameAsMobile) {
      setWhatsapp(mobile);
    }
  }, [mobile, sameAsMobile]);

  const toggleSameAsMobile = () => {
    setSameAsMobile((prev) => {
      const next = !prev;
      if (next) {
        setWhatsapp(mobile);
      }
      return next;
    });
  };

  const onFinish = async () => {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Please provide your name.');
      return;
    }

    if (!mobile.trim()) {
      setMobileError('Mobile number is required.');
      Alert.alert('Missing info', 'Please provide your mobile number.');
      return;
    }

    if (!token) {
      Alert.alert('Session expired', 'Please login again to save your onboarding details.');
      router.replace('/(auth)/login');
      return;
    }

    const draft = await getMemberOnboardingDraft(email);

    try {
      const response = await authApi.submitMemberOnboarding(
        {
          gender: draft.gender,
          age: draft.age,
          height: draft.height,
          weight: draft.weight,
          goals: draft.goals || [],
          activityLevel: draft.activityLevel,
          name: name.trim(),
          mobile: mobile.trim(),
          whatsapp: whatsapp.trim(),
        },
        token
      );

      setAuthState(response.user || null, token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save onboarding details.';
      Alert.alert('Save failed', message);
      return;
    }

    await updateMemberOnboardingDraft(
      {
        name: name.trim(),
        mobile: mobile.trim(),
        whatsapp: whatsapp.trim(),
      },
      email
    );

    await markMemberOnboardingCompleted(email);
    router.replace('/(roles)/member');
  };

  return (
    <ScreenWrap style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.title}>Fill Your Details</Text>
        <Text style={styles.subtitle}>Give your personal detail to contact and get in touch with you</Text>
      </View>

      <View style={styles.formWrap}>
        <AppInput placeholder="Name" value={name} onChangeText={setName} containerStyle={styles.input} />
        <AppInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={false}
          containerStyle={styles.input}
        />
        <AppInput
          placeholder="Mobile Number"
          value={mobile}
          onChangeText={(value) => {
            setMobile(value);
            if (mobileError) setMobileError('');
          }}
          keyboardType="phone-pad"
          error={mobileError || undefined}
          containerStyle={styles.input}
        />
        <AppInput
          placeholder="Whatsapp Number"
          value={whatsapp}
          onChangeText={setWhatsapp}
          keyboardType="phone-pad"
          editable={!sameAsMobile}
          containerStyle={styles.input}
        />
        <Pressable style={styles.sameWrap} onPress={toggleSameAsMobile}>
          <View style={[styles.checkbox, sameAsMobile && styles.checkboxActive]}>
            {sameAsMobile ? <Text style={styles.checkboxTick}>✓</Text> : null}
          </View>
          <Text style={styles.sameWrapText}>Use mobile number as WhatsApp number</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <ActionButton label="Finish" onPress={onFinish} />
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
  formWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  input: {
    marginBottom: 12,
  },
  sameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#17c700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#ffffff',
  },
  checkboxActive: {
    backgroundColor: '#17c700',
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  sameWrapText: {
    color: '#5a5c60',
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    paddingBottom: 10,
  },
});
