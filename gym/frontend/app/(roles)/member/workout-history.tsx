import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { memberApi, WorkoutSession, WorkoutStats } from '@/lib/member-api';
import { AppColors } from '@/constants/theme';
import {
  PageHeader,
  SectionHeader,
  SurfaceCard,
} from '@/components/ui/trainer-dashboard';
import { StatsCard } from '@/components/ui/workout-components';

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatDurationWithSeconds(durationSeconds?: number, durationMinutes?: number) {
  let totalSeconds = 0;

  if (typeof durationSeconds === 'number' && durationSeconds >= 0) {
    totalSeconds = Math.round(durationSeconds);
  } else if (typeof durationMinutes === 'number' && durationMinutes > 0) {
    totalSeconds = Math.round(durationMinutes * 60);
  }

  const minutesPart = Math.floor(totalSeconds / 60);
  const secondsPart = totalSeconds % 60;

  return `${minutesPart} min ${secondsPart} sec`;
}

export default function WorkoutHistoryPage() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const authState = getAuthState();
      if (!authState?.token) {
        setWorkouts([]);
        setStats(null);
        setLoading(false);
        return;
      }

      const [workoutData, statsData] = await Promise.all([
        memberApi.listWorkouts(authState.token, page, 10),
        memberApi.getWorkoutStats(authState.token),
      ]);

      setWorkouts(workoutData.workouts || []);
      setTotalPages(workoutData.pagination.pages);
      setStats(statsData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load workout history';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [page, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  if (loading && workouts.length === 0) {
    return (
      <View style={styles.container}>
        <PageHeader title="Workout History" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <PageHeader title="Workout History" subtitle="Track your fitness progress" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />

      <View style={styles.contentWrap}>
        {stats ? (
          <>
            <SectionHeader title="Your Stats" />
            <View style={styles.statsGrid}>
              <StatsCard
                label="Total Workouts"
                value={stats.totalWorkouts}
                icon="💪"
              />
              <StatsCard
                label="Total Time"
                value={formatTime(stats.totalMinutes)}
                icon="⏱️"
              />
              <StatsCard
                label="Avg Duration"
                value={formatTime(stats.averageMinutesPerWorkout)}
                icon="📊"
              />
            </View>
          </>
        ) : null}

        <SectionHeader title="Completed Workouts" />

        {workouts.length > 0 ? (
          <>
            <FlatList
              scrollEnabled={false}
              data={workouts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SurfaceCard>
                  <View style={styles.workoutRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workoutEquipment}>{item.equipmentName}</Text>
                      <Text style={styles.workoutDate}>{formatDate(item.endTime || item.startTime)}</Text>
                      <Text style={styles.workoutDetails}>
                        Duration: {formatDurationWithSeconds(item.durationSeconds, item.durationMinutes)}
                      </Text>
                      {item.performanceMetrics.reps ? (
                        <Text style={styles.workoutDetails}>
                          {item.performanceMetrics.reps} reps × {item.performanceMetrics.sets} sets
                        </Text>
                      ) : null}
                      {item.performanceMetrics.distance ? (
                        <Text style={styles.workoutDetails}>
                          Distance: {item.performanceMetrics.distance} km
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.workoutCategory}>{item.equipmentCategory}</Text>
                  </View>
                </SurfaceCard>
              )}
            />

            {totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  disabled={page === 1}
                  style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}
                  onPress={handlePrevPage}
                >
                  <Text style={styles.paginationButtonText}>← PREV</Text>
                </TouchableOpacity>
                <Text style={styles.paginationText}>
                  Page {page} of {totalPages}
                </Text>
                <TouchableOpacity
                  disabled={page === totalPages}
                  style={[styles.paginationButton, page === totalPages && styles.paginationButtonDisabled]}
                  onPress={handleNextPage}
                >
                  <Text style={styles.paginationButtonText}>NEXT →</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : (
          <SurfaceCard>
            <Text style={styles.emptyText}>No completed workouts yet. Start one to begin tracking!</Text>
          </SurfaceCard>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workoutEquipment: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f252b',
    marginBottom: 6,
  },
  workoutDate: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '600',
    marginBottom: 6,
  },
  workoutDetails: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    marginBottom: 3,
    lineHeight: 16,
  },
  workoutCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
    textAlign: 'right',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: AppColors.primaryLight,
    borderRadius: 8,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    gap: 10,
  },
  paginationButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: AppColors.primary,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  paginationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 24,
  },
});
