import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { memberApi, Equipment, MemberChallenge, MemberChallengesDashboard } from '@/lib/member-api';
import { AppColors } from '@/constants/theme';
import { PageHeader, PrimaryWideButton, SectionHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { EquipmentCard } from '@/components/ui/workout-components';

const EMPTY_CHALLENGES_DASHBOARD: MemberChallengesDashboard = {
  summary: {
    challengePointsEarned: 0,
    completedChallenges: 0,
    currentLeaderboardRank: null,
  },
  activeChallenges: [],
  completedChallenges: [],
  upcomingChallenges: [],
  expiredChallenges: [],
};

export default function WorkoutPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [startingWorkout, setStartingWorkout] = useState<string | null>(null);
  const [startingChallengeId, setStartingChallengeId] = useState<string | null>(null);
  const [challengeDashboard, setChallengeDashboard] = useState<MemberChallengesDashboard>(EMPTY_CHALLENGES_DASHBOARD);

  const categories = ['Cardio', 'Strength', 'Flexibility', 'Other'];

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const authState = getAuthState();
      if (!authState?.token) {
        setEquipment([]);
        setChallengeDashboard(EMPTY_CHALLENGES_DASHBOARD);
        return;
      }

      const [equipmentResult, challengeResult] = await Promise.allSettled([
        memberApi.listEquipment(authState.token),
        memberApi.getChallenges(authState.token),
      ]);

      if (equipmentResult.status === 'fulfilled') {
        setEquipment(equipmentResult.value || []);
      } else {
        setEquipment([]);
      }

      if (challengeResult.status === 'fulfilled') {
        setChallengeDashboard(challengeResult.value || EMPTY_CHALLENGES_DASHBOARD);
      } else {
        setChallengeDashboard(EMPTY_CHALLENGES_DASHBOARD);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load workout dashboard';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const summary = challengeDashboard.summary || EMPTY_CHALLENGES_DASHBOARD.summary;
  const activeChallenges = challengeDashboard.activeChallenges || [];
  const filteredEquipment = selectedCategory ? equipment.filter((item) => item.category === selectedCategory) : equipment;

  const getStatusColor = (status: MemberChallenge['status']) => {
    if (status === 'completed') return '#1e7d31';
    if (status === 'expired') return '#d32f2f';
    if (status === 'pending-approval') return '#a16207';
    return '#ca8a04';
  };

  const startNormalWorkout = async (item: Equipment) => {
    try {
      setStartingWorkout(item.id);
      const authState = getAuthState();
      if (!authState?.token) return;

      const workout = await memberApi.startWorkout(item.id, authState.token);
      router.push({
        pathname: './active-workout',
        params: {
          workoutId: workout.id,
          equipmentName: workout.equipmentName,
          equipmentCategory: workout.equipmentCategory,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start workout';
      Alert.alert('Error', message);
    } finally {
      setStartingWorkout(null);
    }
  };

  const startChallengeWorkout = async (challenge: MemberChallenge) => {
    try {
      if (!challenge.equipmentId) {
        Alert.alert('Challenge Setup', 'This challenge does not have equipment assigned yet.');
        return;
      }

      setStartingChallengeId(challenge.id);
      const authState = getAuthState();
      if (!authState?.token) return;

      await memberApi.startChallenge(challenge.id, authState.token);
      const workout = await memberApi.startWorkout(challenge.equipmentId, authState.token);

      router.push({
        pathname: './active-workout',
        params: {
          workoutId: workout.id,
          equipmentName: workout.equipmentName,
          equipmentCategory: workout.equipmentCategory,
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeGoalType: challenge.workoutGoalType,
          challengeTargetValue: String(challenge.targetValue || 1),
          challengeTargetUnit: challenge.targetUnit || '',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start challenge';
      Alert.alert('Error', message);
    } finally {
      setStartingChallengeId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <PageHeader title="Workout" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <PageHeader title="Workout" subtitle="Start a challenge or a normal workout" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />

      <View style={styles.contentWrap}>
        <PrimaryWideButton text="OPEN WORKOUT HISTORY" onPress={() => router.push('./workout-history')} color="#e9f7de" textColor="#1e5b12" />

        <SectionHeader title="Challenge Summary" />
        <View style={styles.summaryRow}>
          <SurfaceCard>
            <Text style={styles.summaryLabel}>Challenge Points</Text>
            <Text style={styles.summaryValue}>{summary.challengePointsEarned}</Text>
          </SurfaceCard>
          <SurfaceCard>
            <Text style={styles.summaryLabel}>Completed</Text>
            <Text style={styles.summaryValue}>{summary.completedChallenges}</Text>
          </SurfaceCard>
          <SurfaceCard>
            <Text style={styles.summaryLabel}>Rank</Text>
            <Text style={styles.summaryValue}>{summary.currentLeaderboardRank ? `#${summary.currentLeaderboardRank}` : '-'}</Text>
          </SurfaceCard>
        </View>

        <SectionHeader title={`Active Challenges (${activeChallenges.length})`} />
        {activeChallenges.length === 0 ? (
          <SurfaceCard>
            <Text style={styles.emptyText}>No active challenges available.</Text>
          </SurfaceCard>
        ) : (
          <View style={styles.challengeListWrap}>
            {activeChallenges.map((challenge) => (
              <SurfaceCard key={challenge.id}>
                <View style={styles.challengeHeaderRow}>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <Text style={styles.challengePoints}>+{challenge.pointsReward} pts</Text>
                </View>
                {!!challenge.description && <Text style={styles.challengeDescription}>{challenge.description}</Text>}
                <Text style={styles.challengeMetaText}>
                  {challenge.workoutGoalType === 'none' ? 'WORKOUT' : challenge.workoutGoalType.toUpperCase()} • Equipment: {challenge.equipmentName || 'N/A'}
                </Text>
                <Text style={styles.challengeMetaText}>
                  Target: {challenge.targetValue} {challenge.targetUnit}
                </Text>
                <View style={styles.challengeMetaRow}>
                  <Text style={[styles.challengeStatusText, { color: getStatusColor(challenge.status) }]}>
                    {challenge.status.toUpperCase()}
                  </Text>
                  <TouchableOpacity
                    style={styles.startButton}
                    disabled={startingChallengeId === challenge.id}
                    onPress={() => startChallengeWorkout(challenge)}
                  >
                    <Text style={styles.actionButtonText}>
                      {startingChallengeId === challenge.id ? 'Starting...' : 'Start Challenge'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </SurfaceCard>
            ))}
          </View>
        )}

        <SectionHeader title="Equipment" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}>
          <View style={styles.categoryRow}>
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              style={[styles.categoryChip, selectedCategory === null ? styles.categoryChipActive : null]}
            >
              <Text style={[styles.categoryChipText, selectedCategory === null ? styles.categoryChipTextActive : null]}>
                All
              </Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[styles.categoryChip, selectedCategory === category ? styles.categoryChipActive : null]}
              >
                <Text style={[styles.categoryChipText, selectedCategory === category ? styles.categoryChipTextActive : null]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.equipmentGrid}>
          {filteredEquipment.length === 0 ? (
            <SurfaceCard>
              <Text style={styles.emptyText}>No equipment available.</Text>
            </SurfaceCard>
          ) : (
            filteredEquipment.map((item) => (
              <EquipmentCard
                key={item.id}
                equipment={item}
                onPress={() => startNormalWorkout(item)}
              />
            ))
          )}
        </View>
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
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2937',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontWeight: '600',
    paddingVertical: 20,
  },
  challengeListWrap: {
    gap: 12,
    marginBottom: 16,
  },
  challengeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  challengeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
  challengePoints: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.primaryDark,
  },
  challengeDescription: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 6,
  },
  challengeMetaText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
    marginTop: 2,
  },
  challengeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  challengeStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  startButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 6,
  },
  categoryChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfe3e7',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryChipActive: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
    shadowColor: AppColors.primary,
    shadowOpacity: 0.15,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3a4650',
  },
  categoryChipTextActive: {
    color: AppColors.primaryDark,
  },
  equipmentGrid: {
    gap: 12,
    marginTop: 6,
  },
});
