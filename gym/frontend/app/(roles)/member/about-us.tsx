import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';

export default function AboutUsPage() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} style={styles.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={AppColors.text} />
      </TouchableOpacity>
      <View style={styles.card}>
        <MaterialCommunityIcons name="star-circle-outline" size={54} color={AppColors.primary} />
        <Text style={styles.title}>Ratings & Reviews</Text>
        <Text style={styles.subtitle}>
          The old feedback feature has been removed. Please use the Ratings & Reviews screen to share your experience and view management replies.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(roles)/member/reviews' as any)}>
          <Text style={styles.primaryBtnText}>Open Ratings & Reviews</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background, padding: 20, justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 18, left: 18, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: AppColors.text, marginTop: 16 },
  subtitle: { fontSize: 14, color: AppColors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 10 },
  primaryBtn: { marginTop: 18, backgroundColor: AppColors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
