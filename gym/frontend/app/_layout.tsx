import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { NotificationProvider } from '@/hooks/use-notification';
import { NotificationDisplay } from '@/components/notification-display';

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <NotificationProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(member-onboarding)" options={{ headerShown: false }} />
          <Stack.Screen name="(roles)" options={{ headerShown: false }} />
        </Stack>
        <NotificationDisplay />
        <StatusBar style="auto" />
      </ThemeProvider>
    </NotificationProvider>
  );
}
