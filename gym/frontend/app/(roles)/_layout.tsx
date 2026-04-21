import { AppColors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function RolesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppColors.white },
      }}
    >
      <Stack.Screen name="admin" />
      <Stack.Screen name="admin-tutorials" />
      <Stack.Screen name="admin-reviews" />
      <Stack.Screen name="trainer" />
      <Stack.Screen name="member" />
    </Stack>
  );
}
