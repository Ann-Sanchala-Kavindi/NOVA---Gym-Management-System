import { router } from 'expo-router';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { ActionButton, ScreenWrap, StepDots } from './_shared';

const HERO = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80';

export default function Step3Screen() {
  return (
    <ScreenWrap>
      <ImageBackground source={{ uri: HERO }} style={styles.hero} resizeMode="cover" />

      <View style={styles.content}>
        <Text style={styles.title}>Track Every Rep, Every Result</Text>
        <View style={styles.dotsWrap}>
          <StepDots active={3} />
        </View>
        <ActionButton label="Continue" onPress={() => router.push('/(member-onboarding)/step-4')} style={styles.cta} />
      </View>
    </ScreenWrap>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: '56%',
    width: '100%',
    backgroundColor: '#d2d2d2',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 32,
    justifyContent: 'flex-start',
    backgroundColor: '#efefef',
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: '#24252a',
    textAlign: 'center',
    marginTop: 8,
  },
  dotsWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    marginTop: 'auto',
  },
});
