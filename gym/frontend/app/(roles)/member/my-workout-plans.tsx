import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { getAuthState } from '@/lib/auth-state';
import { getWorkoutPlansForMember, type WorkoutPlan, type WorkoutPlanExercise } from '@/lib/workout-plan-api';
import { memberApi } from '@/lib/member-api';
import { AppColors } from '@/constants/theme';

const DIFF_COLORS = {
  Beginner: { bg: AppColors.successLight, text: AppColors.primaryDark },
  Intermediate: { bg: AppColors.warningLight, text: '#856404' },
  Advanced: { bg: AppColors.dangerLight, text: AppColors.error },
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Anytime'] as const;

function computeStatus(exercise: WorkoutPlanExercise) {
  const progress = exercise.progress || {};
  const scheduledDay = exercise.scheduledDay || 'Anytime';
  const today = WEEKDAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  if (progress.status === 'skipped') return 'skipped';
  if (progress.status === 'in_progress') return 'in_progress';
  if (progress.status === 'completed') {
    if (scheduledDay === 'Anytime') return 'completed';
    const lastCompleted = progress.lastCompletedAt ? new Date(progress.lastCompletedAt) : null;
    const lastCompletedDay = lastCompleted ? WEEKDAYS[lastCompleted.getDay() === 0 ? 6 : lastCompleted.getDay() - 1] : null;
    return today === scheduledDay && lastCompletedDay !== scheduledDay ? 'overdue' : 'completed';
  }
  return scheduledDay !== 'Anytime' && today === scheduledDay ? 'overdue' : 'not_started';
}

function statusColors(status: string) {
  switch (status) {
    case 'completed': return { bg: '#dcfce7', text: '#166534', icon: 'check-circle' };
    case 'in_progress': return { bg: '#dbeafe', text: '#1d4ed8', icon: 'progress-clock' };
    case 'overdue': return { bg: '#fee2e2', text: '#b91c1c', icon: 'alert-circle' };
    case 'skipped': return { bg: '#f3f4f6', text: '#6b7280', icon: 'skip-next-circle' };
    default: return { bg: '#fef3c7', text: '#92400e', icon: 'clock-outline' };
  }
}

function PlanCard({ plan, onPress }: { plan: WorkoutPlan; onPress: () => void }) {
  const diff = DIFF_COLORS[plan.difficulty] ?? DIFF_COLORS.Beginner;
  const completed = plan.exercises.filter((ex) => computeStatus(ex) === 'completed').length;
  const overdue = plan.exercises.filter((ex) => computeStatus(ex) === 'overdue').length;
  const progressPct = plan.exercises.length ? Math.round((completed / plan.exercises.length) * 100) : 0;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planCode}>{plan.planCode || ''}</Text>
          <Text style={styles.planName}>{plan.planName || 'Untitled Plan'}</Text>
        </View>
        <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
          <Text style={[styles.diffText, { color: diff.text }]}>{plan.difficulty}</Text>
        </View>
      </View>
      {!!plan.description && <Text style={styles.planDesc} numberOfLines={2}>{plan.description}</Text>}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}><MaterialCommunityIcons name="target" size={14} color={AppColors.textMuted} /><Text style={styles.metaText}>{plan.goal || '—'}</Text></View>
        <View style={styles.metaItem}><MaterialCommunityIcons name="calendar-range" size={14} color={AppColors.textMuted} /><Text style={styles.metaText}>{plan.durationWeeks} weeks</Text></View>
        <View style={styles.metaItem}><MaterialCommunityIcons name="dumbbell" size={14} color={AppColors.textMuted} /><Text style={styles.metaText}>{plan.exercises.length} exercises</Text></View>
      </View>
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressPct}%` }]} /></View>
        <Text style={styles.progressText}>{completed}/{plan.exercises.length} complete • {overdue} overdue</Text>
      </View>
    </TouchableOpacity>
  );
}

function ExerciseDetail({
  plan,
  onStartExercise,
  startingKey,
}: {
  plan: WorkoutPlan;
  onStartExercise: (exercise: WorkoutPlanExercise) => void;
  startingKey: string | null;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutPlanExercise[]>();
    for (const day of WEEKDAYS) map.set(day, []);
    for (const ex of plan.exercises) {
      const day = ex.scheduledDay || 'Anytime';
      map.set(day, [...(map.get(day) || []), ex]);
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [plan]);

  const completed = plan.exercises.filter((ex) => computeStatus(ex) === 'completed').length;
  const inProgress = plan.exercises.filter((ex) => computeStatus(ex) === 'in_progress').length;
  const overdue = plan.exercises.filter((ex) => computeStatus(ex) === 'overdue').length;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={styles.summaryHero}>
        <Text style={styles.detailTitle}>{plan.planName}</Text>
        <Text style={styles.detailSub}>Goal: {plan.goal} · {plan.durationWeeks} weeks · {plan.difficulty}</Text>
        {plan.description ? <Text style={styles.detailDesc}>{plan.description}</Text> : null}
        <View style={styles.summaryStats}>
          <View style={styles.summaryChip}><Text style={styles.summaryChipValue}>{completed}</Text><Text style={styles.summaryChipLabel}>Completed</Text></View>
          <View style={styles.summaryChip}><Text style={styles.summaryChipValue}>{inProgress}</Text><Text style={styles.summaryChipLabel}>In progress</Text></View>
          <View style={styles.summaryChip}><Text style={styles.summaryChipValue}>{overdue}</Text><Text style={styles.summaryChipLabel}>Overdue</Text></View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Weekly Schedule</Text>
      {grouped.map(([day, exercises]) => (
        <View key={day} style={styles.daySection}>
          <View style={styles.dayHeader}>
            <MaterialCommunityIcons name="calendar-week" size={18} color={AppColors.primary} />
            <Text style={styles.dayTitle}>{day}</Text>
            <Text style={styles.dayCount}>{exercises.length} exercise{exercises.length === 1 ? '' : 's'}</Text>
          </View>
          {exercises.map((ex, i) => {
            const derivedStatus = computeStatus(ex);
            const colors = statusColors(derivedStatus);
            const progress = ex.progress || {};
            const key = `${plan._id}:${ex.planExerciseId}`;
            return (
              <View key={ex.planExerciseId || `${day}-${i}`} style={styles.exCard}>
                <View style={styles.exHeader}>
                  <View style={styles.exNum}><Text style={styles.exNumText}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{ex.name || '—'}</Text>
                    <Text style={styles.exMeta}>{ex.muscleGroup || ''}{ex.equipment ? ` · ${ex.equipment}` : ''} · {ex.equipmentType || 'Other'}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
                    <MaterialCommunityIcons name={colors.icon as any} size={14} color={colors.text} />
                    <Text style={[styles.statusPillText, { color: colors.text }]}>{derivedStatus.replace('_', ' ')}</Text>
                  </View>
                </View>

                <View style={styles.exStats}>
                  <View style={styles.exStat}><Text style={styles.exStatNum}>{ex.sets}</Text><Text style={styles.exStatLabel}>Sets</Text></View>
                  <View style={styles.exDivider} />
                  <View style={styles.exStat}><Text style={styles.exStatNum}>{ex.reps || '—'}</Text><Text style={styles.exStatLabel}>Reps</Text></View>
                  <View style={styles.exDivider} />
                  <View style={styles.exStat}><Text style={styles.exStatNum}>{progress.completionCount || 0}</Text><Text style={styles.exStatLabel}>Sessions</Text></View>
                  <View style={styles.exDivider} />
                  <View style={styles.exStat}><Text style={styles.exStatNum}>{Math.round(progress.adherenceScore || 0)}%</Text><Text style={styles.exStatLabel}>Adherence</Text></View>
                </View>

                {!!ex.instructions && <Text style={styles.exInstructions}>{ex.instructions}</Text>}

                {!!progress.bestPerformance && (
                  <View style={styles.bestBox}>
                    <Text style={styles.bestTitle}>Best Performance</Text>
                    <Text style={styles.bestText}>
                      {progress.bestPerformance.weight ? `Weight ${progress.bestPerformance.weight} kg  ` : ''}
                      {progress.bestPerformance.distance ? `Distance ${progress.bestPerformance.distance} km  ` : ''}
                      {progress.bestPerformance.avgSpeed ? `Speed ${progress.bestPerformance.avgSpeed} km/h  ` : ''}
                      {progress.bestPerformance.volume ? `Volume ${Math.round(progress.bestPerformance.volume)}` : ''}
                    </Text>
                  </View>
                )}

                {!!ex.progressionSuggestion && (
                  <View style={styles.suggestionBox}>
                    <Text style={styles.suggestionTitle}>{ex.progressionSuggestion.label}</Text>
                    <Text style={styles.suggestionText}>{ex.progressionSuggestion.message}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.startExerciseBtn, startingKey === key && { opacity: 0.7 }]}
                  onPress={() => onStartExercise(ex)}
                  disabled={startingKey === key}
                >
                  <MaterialCommunityIcons name="play-circle" size={18} color="#fff" />
                  <Text style={styles.startExerciseBtnText}>{startingKey === key ? 'Starting...' : 'Start this exercise'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

export default function MyWorkoutPlansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const authState = getAuthState();
  const token = authState?.token || '';
  const userId = (authState?.user as any)?.id || (authState?.user as any)?._id || '';

  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkoutPlan | null>(null);
  const [startingKey, setStartingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    try {
      const res = await getWorkoutPlansForMember(userId, token);
      setPlans(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => { load(); }, [load]);

  const handleStartExercise = async (exercise: WorkoutPlanExercise) => {
    if (!selected || !exercise.planExerciseId) return;
    const key = `${selected._id}:${exercise.planExerciseId}`;
    setStartingKey(key);
    try {
      if (!token) {
        Alert.alert('Login required', 'Please sign in again and retry.');
        return;
      }
      const session = await memberApi.startWorkout('', token, {
        workoutPlanId: selected._id,
        planExerciseId: exercise.planExerciseId,
        linkedExerciseName: exercise.name,
        equipmentCategory: exercise.equipmentType || 'Other',
      });
      router.push(`/(roles)/member/active-workout?workoutId=${encodeURIComponent(String(session.id || ''))}&equipmentName=${encodeURIComponent(String(session.equipmentName || exercise.name || 'Exercise'))}&equipmentCategory=${encodeURIComponent(String(session.equipmentCategory || exercise.equipmentType || 'Other'))}&linkedExerciseName=${encodeURIComponent(String(exercise.name || 'Exercise'))}`);
    } catch (error: any) {
      Alert.alert('Unable to start', error.message || 'Could not start this assigned exercise.');
    } finally {
      setStartingKey(null);
    }
  };

  if (selected) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSelected(null); load(); }} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={AppColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plan Details</Text>
          <View style={{ width: 36 }} />
        </View>
        <ExerciseDetail plan={selected} onStartExercise={handleStartExercise} startingKey={startingKey} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Workout Plans</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={AppColors.primary} size="large" />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p._id}
          renderItem={({ item }) => (
            <PlanCard plan={item} onPress={() => setSelected(item)} />
          )}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="dumbbell" size={48} color={AppColors.neutralMedium} />
              <Text style={styles.emptyText}>No workout plans assigned yet.</Text>
              <Text style={styles.emptySubText}>Your trainer will assign plans here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: AppColors.neutralMedium },
  headerTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  planCode: { fontSize: 11, color: AppColors.textMuted, fontWeight: '600', marginBottom: 2 },
  planName: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  diffText: { fontSize: 11, fontWeight: '700' },
  planDesc: { fontSize: 13, color: AppColors.textSecondary, lineHeight: 18, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: AppColors.textMuted },
  progressWrap: { marginTop: 12, gap: 6 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: AppColors.primary, borderRadius: 999 },
  progressText: { fontSize: 12, color: AppColors.textMuted, fontWeight: '600' },
  emptyBox: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: AppColors.textSecondary },
  emptySubText: { fontSize: 13, color: AppColors.textMuted },
  summaryHero: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  detailTitle: { fontSize: 22, fontWeight: '800', color: AppColors.text },
  detailSub: { fontSize: 13, color: AppColors.textMuted, marginTop: 4 },
  detailDesc: { fontSize: 14, color: AppColors.textSecondary, lineHeight: 20 },
  summaryStats: { flexDirection: 'row', gap: 10, marginTop: 8 },
  summaryChip: { flex: 1, borderRadius: 14, backgroundColor: AppColors.primaryLight, paddingVertical: 12, alignItems: 'center' },
  summaryChipValue: { fontSize: 20, fontWeight: '800', color: AppColors.primaryDark },
  summaryChipLabel: { fontSize: 11, fontWeight: '700', color: AppColors.textMuted, marginTop: 3 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: AppColors.text, marginTop: 4 },
  daySection: { gap: 10 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  dayTitle: { fontSize: 15, fontWeight: '800', color: AppColors.text },
  dayCount: { marginLeft: 'auto', fontSize: 12, color: AppColors.textMuted, fontWeight: '700' },
  exCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, gap: 10 },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: AppColors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  exNumText: { fontSize: 13, fontWeight: '800', color: AppColors.primaryDark },
  exName: { fontSize: 15, fontWeight: '700', color: AppColors.text },
  exMeta: { fontSize: 12, color: AppColors.textMuted, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  exStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exStat: { alignItems: 'center', flex: 1 },
  exStatNum: { fontSize: 18, fontWeight: '800', color: AppColors.primary },
  exStatLabel: { fontSize: 11, color: AppColors.textMuted, marginTop: 2 },
  exDivider: { width: 1, height: 30, backgroundColor: AppColors.neutralMedium },
  exInstructions: { fontSize: 12, color: AppColors.textSecondary, lineHeight: 18 },
  bestBox: { borderRadius: 12, backgroundColor: '#f8fafc', padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  bestTitle: { fontSize: 12, fontWeight: '800', color: AppColors.text, marginBottom: 4 },
  bestText: { fontSize: 12, color: AppColors.textMuted, lineHeight: 18 },
  startExerciseBtn: { marginTop: 2, borderRadius: 12, backgroundColor: AppColors.primary, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  startExerciseBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
