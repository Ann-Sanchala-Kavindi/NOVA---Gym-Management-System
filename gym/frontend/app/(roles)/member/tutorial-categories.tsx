import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { tutorialApi, TutorialCategory } from '@/lib/tutorial-api';
import { PageHeader, SectionHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { AppColors } from '@/constants/theme';

export default function MemberTutorialCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<TutorialCategory[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const auth = getAuthState();
        if (!auth?.token) {
          setCategories([]);
          return;
        }

        const res = await tutorialApi.listCategories(auth.token);
        setCategories(res.categories || []);
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load tutorial categories');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <PageHeader title="Tutorials" subtitle="Choose a category" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentWrap}>
      <PageHeader title="Tutorials" subtitle="Choose a category" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />
      <View style={styles.innerWrap}>
        <SectionHeader title={`Categories (${categories.length})`} />
        {categories.length === 0 ? (
          <SurfaceCard>
            <Text style={styles.emptyText}>No tutorial categories available.</Text>
          </SurfaceCard>
        ) : (
          categories.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: '/(roles)/member/tutorial-videos' as any,
                  params: { categoryId: item.id, categoryName: item.name },
                })
              }
            >
              <SurfaceCard>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.description && <Text style={styles.cardSub}>{item.description}</Text>}
                <Text style={styles.countText}>{item.videoCount || 0} videos</Text>
              </SurfaceCard>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f3f5',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    paddingBottom: 120,
  },
  innerWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontWeight: '600',
    paddingVertical: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
});
