import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import YoutubePlayer from 'react-native-youtube-iframe';

import { getAuthState } from '@/lib/auth-state';
import { tutorialApi, TutorialCategory, TutorialVideo } from '@/lib/tutorial-api';
import { AppColors } from '@/constants/theme';
import { PageHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';

const PLAYER_PROGRESS_SYNC_SECONDS = 6;

function toSafeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function extractYoutubeVideoId(url: string) {
  const trimmedUrl = (url || '').trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export default function MemberTutorialVideoPlayerPage() {
  const params = useLocalSearchParams<{ videoId?: string; categoryId?: string; categoryName?: string }>();
  const videoId = params.videoId ? String(params.videoId) : '';
  const categoryId = params.categoryId ? String(params.categoryId) : '';
  const categoryName = params.categoryName ? String(params.categoryName) : 'Tutorial Video';

  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState<TutorialVideo | null>(null);
  const [category, setCategory] = useState<TutorialCategory | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const authToken = useMemo(() => getAuthState()?.token || '', []);
  const playerRef = useRef<any>(null);
  const syncProgressRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        if (!authToken || !videoId) {
          setVideo(null);
          return;
        }

        const [videoRes, categoryRes] = await Promise.all([
          tutorialApi.getVideo(videoId, authToken),
          tutorialApi.listCategories(authToken),
        ]);

        const loadedVideo: TutorialVideo = {
          ...videoRes.video,
          watchedSeconds: videoRes.progress?.watchedSeconds || 0,
          completed: videoRes.progress?.completed || false,
          lastWatchedAt: videoRes.progress?.lastWatchedAt || null,
          progressPercent: videoRes.progress?.progressPercent || 0,
        };

        setVideo(loadedVideo);
        setCurrentSecond(toSafeNumber(loadedVideo.watchedSeconds));
        setVideoDuration(toSafeNumber(loadedVideo.durationSeconds));
        syncProgressRef.current = toSafeNumber(loadedVideo.watchedSeconds);

        const loadedCategories = categoryRes.categories || [];
        setCategory(loadedCategories.find((item) => item.id === categoryId) || null);
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load tutorial video');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authToken, categoryId, videoId]);

  const persistProgress = useCallback(
    async (rawSeconds: number) => {
      if (!video || !authToken) {
        return;
      }

      const watchedSeconds = Math.floor(Math.max(0, rawSeconds));
      const durationSeconds = Math.max(0, Math.floor(videoDuration || video.durationSeconds || 0));

      if (Math.abs(watchedSeconds - syncProgressRef.current) < PLAYER_PROGRESS_SYNC_SECONDS) {
        return;
      }

      try {
        const res = await tutorialApi.updateProgress(
          video.id,
          {
            watchedSeconds,
            durationSeconds,
          },
          authToken
        );

        syncProgressRef.current = watchedSeconds;
        setVideo((prev) =>
          prev
            ? {
                ...prev,
                watchedSeconds: res.progress.watchedSeconds,
                completed: res.progress.completed,
                lastWatchedAt: res.progress.lastWatchedAt,
                progressPercent: res.progress.progressPercent,
              }
            : prev
        );
      } catch {
        // Avoid interrupting playback with repeated alerts if network is unstable.
      }
    },
    [authToken, video, videoDuration]
  );

  useEffect(() => {
    if (!video || !isPlaying) {
      return;
    }

    const intervalId = setInterval(async () => {
      if (!playerRef.current) {
        return;
      }

      const [time, duration] = await Promise.all([
        playerRef.current.getCurrentTime?.(),
        playerRef.current.getDuration?.(),
      ]);

      const safeTime = toSafeNumber(time);
      const safeDuration = toSafeNumber(duration);

      setCurrentSecond(safeTime);
      if (safeDuration > 0) {
        setVideoDuration(safeDuration);
      }

      await persistProgress(safeTime);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isPlaying, persistProgress, video]);

  useEffect(() => {
    return () => {
      if (video && currentSecond > 0) {
        persistProgress(currentSecond);
      }
    };
  }, [currentSecond, persistProgress, video]);

  if (loading) {
    return (
      <View style={styles.container}>
        <PageHeader title={categoryName} subtitle="Video player" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member/tutorial-categories'))} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      </View>
    );
  }

  if (!video) {
    return (
      <View style={styles.container}>
        <PageHeader title={categoryName} subtitle="Video player" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member/tutorial-categories'))} />
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>Video not found.</Text>
        </View>
      </View>
    );
  }

  const activeVideoId = extractYoutubeVideoId(video.youtubeUrl || '');
  const activeDuration = Math.max(0, Math.floor(videoDuration || video.durationSeconds || 0));
  const activeProgress = activeDuration > 0 ? toPercent((currentSecond / activeDuration) * 100) : toPercent(video.progressPercent || 0);
  const activeProgressWidth = `${activeProgress}%` as `${number}%`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentWrap}>
      <PageHeader title={categoryName} subtitle="Video player" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member/tutorial-categories'))} />
      <View style={styles.innerWrap}>
        {category ? (
          <SurfaceCard>
            {category.thumbnailImageUrl ? (
              <Image source={{ uri: category.thumbnailImageUrl }} style={styles.categoryImage} resizeMode="cover" />
            ) : null}
            <Text style={styles.cardTitle}>{category.name}</Text>
          </SurfaceCard>
        ) : null}

        <SurfaceCard>
          {video.thumbnailImageUrl ? (
            <Image source={{ uri: video.thumbnailImageUrl }} style={styles.videoImage} resizeMode="cover" />
          ) : null}
          <Text style={styles.playerTitle}>{video.title}</Text>
          {!!video.description && <Text style={styles.cardSub}>{video.description}</Text>}

          {activeVideoId ? (
            <View style={styles.playerWrap}>
              <YoutubePlayer
                ref={playerRef}
                height={220}
                play={isPlaying}
                videoId={activeVideoId}
                initialPlayerParams={{
                  start: Math.floor(video.watchedSeconds || 0),
                  controls: true,
                  modestbranding: true,
                  rel: false,
                }}
                onChangeState={(state: string) => {
                  if (state === 'paused') {
                    setIsPlaying(false);
                    persistProgress(currentSecond);
                  }

                  if (state === 'playing') {
                    setIsPlaying(true);
                  }

                  if (state === 'ended') {
                    setIsPlaying(false);
                    setCurrentSecond(activeDuration || currentSecond);
                    persistProgress(activeDuration || currentSecond);
                  }
                }}
              />
            </View>
          ) : (
            <Text style={styles.invalidUrlText}>Invalid YouTube URL for this video.</Text>
          )}

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: activeProgressWidth }]} />
          </View>
          <View style={styles.progressMetaRow}>
            <Text style={styles.progressMetaText}>{formatDuration(currentSecond)}</Text>
            <Text style={styles.progressMetaText}>{activeProgress}%</Text>
            <Text style={styles.progressMetaText}>{formatDuration(activeDuration)}</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{formatDuration(activeDuration)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Watched</Text>
              <Text style={styles.statValue}>{formatDuration(currentSecond)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Completed</Text>
              <Text style={styles.statValue}>{video.completed ? 'Yes' : 'No'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Progress</Text>
              <Text style={styles.statValue}>{activeProgress}%</Text>
            </View>
          </View>
        </SurfaceCard>
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
  playerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 6,
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
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#e5e7eb',
  },
  playerWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginTop: 8,
    marginBottom: 12,
  },
  invalidUrlText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 10,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: AppColors.primary,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  progressMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  statCard: {
    flexBasis: '48%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '700',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '800',
  },
});
