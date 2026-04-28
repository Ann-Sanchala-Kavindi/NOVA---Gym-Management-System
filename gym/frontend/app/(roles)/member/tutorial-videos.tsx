import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { tutorialApi, TutorialCategory, TutorialVideo } from '@/lib/tutorial-api';
import { PageHeader, SectionHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { AppColors } from '@/constants/theme';

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export default function MemberTutorialVideosPage() {
  const params = useLocalSearchParams<{ categoryId?: string; categoryName?: string }>();
  const categoryId = params.categoryId ? String(params.categoryId) : undefined;
  const categoryName = params.categoryName ? String(params.categoryName) : 'Videos';

  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TutorialCategory | null>(null);

  const authToken = useMemo(() => getAuthState()?.token || '', []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (!authToken) {
          setVideos([]);
          setSelectedCategory(null);
          return;
        }

        const [videoRes, categoryRes] = await Promise.all([
          tutorialApi.listVideos(authToken, categoryId),
          tutorialApi.listCategories(authToken),
        ]);

        const loadedVideos = videoRes.videos || [];
        const loadedCategories = categoryRes.categories || [];

        setVideos(loadedVideos);
        setSelectedCategory(loadedCategories.find((item) => item.id === categoryId) || null);
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load tutorial videos');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authToken, categoryId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <PageHeader title={categoryName} subtitle="Tutorial videos" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentWrap}>
      <PageHeader title={categoryName} subtitle="Tutorial videos" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />
      <View style={styles.innerWrap}>
        {selectedCategory && (
          <SurfaceCard>
            {selectedCategory.thumbnailImageUrl ? (
              <Image source={{ uri: selectedCategory.thumbnailImageUrl }} style={styles.categoryImage} resizeMode="cover" />
            ) : null}
            <Text style={styles.cardTitle}>{selectedCategory.name}</Text>
            {!!selectedCategory.description && <Text style={styles.cardSub}>{selectedCategory.description}</Text>}
          </SurfaceCard>
        )}

        <SectionHeader title={`Videos (${videos.length})`} />
        {videos.length === 0 ? (
          <SurfaceCard>
            <Text style={styles.emptyText}>No videos available for this category.</Text>
          </SurfaceCard>
        ) : (
          videos.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: '/(roles)/member/tutorial-video-player' as any,
                  params: {
                    videoId: item.id,
                    categoryId,
                    categoryName,
                  },
                })
              }
            >
              <SurfaceCard>
                {item.thumbnailImageUrl ? (
                  <Image source={{ uri: item.thumbnailImageUrl }} style={styles.videoImage} resizeMode="cover" />
                ) : null}
                <Text style={styles.cardTitle}>{item.title}</Text>
                {!!item.description && <Text style={styles.cardSub}>{item.description}</Text>}
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Duration: {formatDuration(item.durationSeconds)}</Text>
                  <Text style={[styles.metaText, item.completed ? styles.completedText : styles.pendingText]}>
                    {item.completed ? 'Completed' : 'Continue'}
                  </Text>
                </View>
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
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  completedText: {
    color: '#16a34a',
  },
  pendingText: {
    color: AppColors.primary,
  },
  categoryImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#e5e7eb',
  },
  videoImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#e5e7eb',
  },
});
