import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { memberApi, PerformanceMetrics, WorkoutCompletionQuality } from '@/lib/member-api';
import { AppColors } from '@/constants/theme';
import { PageHeader, SectionHeader, PrimaryWideButton, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { WorkoutTimer, PerformanceForm } from '@/components/ui/workout-components';

const QUALITY_OPTIONS: Array<{ key: WorkoutCompletionQuality; label: string }> = [
  { key: 'as_prescribed', label: 'As prescribed' },
  { key: 'partial', label: 'Partial' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'pain_stop', label: 'Stopped for pain' },
];

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { authState } = useAuth();
  const { workoutId, equipmentId, equipmentName: routeEquipmentName, equipmentCategory: routeEquipmentCategory, challengeId, challengeTitle, challengeGoalType, challengeTargetValue, challengeTargetUnit } = useLocalSearchParams();

  const [equipmentName, setEquipmentName] = useState('');
  const [equipmentCategory, setEquipmentCategory] = useState<'Cardio' | 'Strength' | 'Weights' | 'Flexibility' | 'Other'>('Other');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<Partial<PerformanceMetrics>>({ notes: '' });
  const [finishing, setFinishing] = useState(false);
  const [completionQuality, setCompletionQuality] = useState<WorkoutCompletionQuality>('as_prescribed');
  const [difficultyRating, setDifficultyRating] = useState(3);
  const [discomfortLevel, setDiscomfortLevel] = useState(0);
  const [painNote, setPainNote] = useState('');
  const autoFinishedRef = useRef(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goalType = String(challengeGoalType || 'none') as 'none' | 'duration-minutes' | 'reps' | 'sets';
  const hasGuidedChallenge = Boolean(challengeId) && goalType !== 'none';
  const targetValue = Number(challengeTargetValue || 0);
  const targetUnit = String(challengeTargetUnit || '');
  const targetSeconds = goalType === 'duration-minutes' && targetValue > 0 ? Math.floor(targetValue * 60) : 0;
  const remainingSeconds = targetSeconds > 0 ? Math.max(0, targetSeconds - elapsedSeconds) : 0;

  const handleFinish = useCallback(async () => {
    if (finishing) return;
    try {
      setFinishing(true);
      setIsRunning(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (!authState?.token) return;

      const payload = {
        performanceMetrics: {
          ...performanceMetrics,
          notes: performanceMetrics.notes || '',
          completionQuality,
          difficultyRating,
          discomfortLevel,
          painNote,
        } as any,
        status: 'completed',
        elapsedSeconds,
      };

      await memberApi.updateWorkout(String(workoutId), payload, authState.token);
      const finishResult = await memberApi.finishWorkout(String(workoutId), authState.token);

      const challengeSummary = (finishResult.challengeUpdates || [])
        .map((item: any) => `${item.title}: +${item.addedProgress} (${item.progressValue}/${item.targetValue})`)
        .join('\n');

      Alert.alert('Success', challengeSummary ? `Workout completed and saved.\n\nChallenge updates:\n${challengeSummary}` : 'Workout completed and saved!', [
        { text: 'View History', onPress: () => router.replace('/(roles)/member/workout-history') },
        { text: 'Back to Workouts', onPress: () => router.replace('/(roles)/member/workout') },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to finish workout';
      Alert.alert('Error', message);
    } finally {
      setFinishing(false);
      autoFinishedRef.current = true;
    }
  }, [completionQuality, difficultyRating, discomfortLevel, elapsedSeconds, painNote, performanceMetrics, router, workoutId, finishing]);

  useEffect(() => {
    if (!workoutId) {
      Alert.alert('Error', 'No workout session found');
      router.back();
      return;
    }
    if (routeEquipmentName) setEquipmentName(String(routeEquipmentName));
    if (routeEquipmentCategory) setEquipmentCategory(String(routeEquipmentCategory) as any);
    setIsRunning(true);
  }, [workoutId, router, routeEquipmentName, routeEquipmentCategory]);

  useEffect(() => {
    if (goalType !== 'duration-minutes' || targetSeconds <= 0) {
      autoFinishedRef.current = false;
      return;
    }
    if (remainingSeconds === 0 && isRunning && !finishing && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      void handleFinish();
    }
  }, [goalType, handleFinish, isRunning, remainingSeconds, finishing, targetSeconds]);

  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (isRunning && !finishing) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isRunning, finishing]);

  const handleMetricsChange = (metrics: Partial<PerformanceMetrics>) => setPerformanceMetrics(metrics);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <PageHeader title="Active Workout" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />

      <View style={styles.contentWrap}>
        {hasGuidedChallenge && (
          <SurfaceCard>
            <Text style={styles.challengeLabel}>Guided Challenge</Text>
            <Text style={styles.challengeTitle}>{String(challengeTitle || 'Challenge')}</Text>
            <Text style={styles.challengeGoal}>Goal: {goalType.toUpperCase()} • Target {targetValue} {targetUnit}</Text>
            {goalType === 'duration-minutes' && targetSeconds > 0 && <Text style={styles.challengeTimer}>Remaining: {Math.floor(remainingSeconds / 60)}m {remainingSeconds % 60}s</Text>}
          </SurfaceCard>
        )}

        <View style={styles.equipmentCard}>
          <Text style={styles.equipmentName}>{equipmentName || 'Equipment'}</Text>
          <Text style={styles.equipmentCategory}>{equipmentCategory}</Text>
        </View>

        <SurfaceCard>
          <WorkoutTimer elapsedSeconds={elapsedSeconds} isRunning={isRunning && !finishing} onStart={() => !finishing && setIsRunning(true)} onPause={() => setIsRunning(false)} onResume={() => !finishing && setIsRunning(true)} onStop={() => { if (finishing) return; setElapsedSeconds(0); setIsRunning(false); setPerformanceMetrics({ notes: '' }); }} />
          {finishing ? <Text style={styles.finishHelper}>Saving your workout and stopping the timer…</Text> : null}
        </SurfaceCard>

        <SectionHeader title="Performance Metrics" />
        <SurfaceCard>
          <PerformanceForm equipmentCategory={equipmentCategory} initialMetrics={performanceMetrics} onMetricsChange={handleMetricsChange} />
        </SurfaceCard>

        <SectionHeader title="Workout quality" />
        <SurfaceCard>
          <Text style={styles.fieldLabel}>How did this session go?</Text>
          <View style={styles.qualityWrap}>
            {QUALITY_OPTIONS.map((item) => (
              <TouchableOpacity key={item.key} style={[styles.qualityChip, completionQuality === item.key && styles.qualityChipActive]} onPress={() => setCompletionQuality(item.key)}>
                <Text style={[styles.qualityChipText, completionQuality === item.key && styles.qualityChipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Difficulty (1-5)</Text>
          <View style={styles.scaleRow}>{[1,2,3,4,5].map((n) => <TouchableOpacity key={n} style={[styles.scaleChip, difficultyRating === n && styles.scaleChipActive]} onPress={() => setDifficultyRating(n)}><Text style={[styles.scaleChipText, difficultyRating === n && styles.scaleChipTextActive]}>{n}</Text></TouchableOpacity>)}</View>

          <Text style={styles.fieldLabel}>Discomfort level (0-5)</Text>
          <View style={styles.scaleRow}>{[0,1,2,3,4,5].map((n) => <TouchableOpacity key={n} style={[styles.scaleChip, discomfortLevel === n && styles.scaleChipActive]} onPress={() => setDiscomfortLevel(n)}><Text style={[styles.scaleChipText, discomfortLevel === n && styles.scaleChipTextActive]}>{n}</Text></TouchableOpacity>)}</View>

          <TextInput value={painNote} onChangeText={setPainNote} placeholder="Pain/discomfort note (optional)" style={styles.noteInput} multiline />
        </SurfaceCard>

        <View style={styles.actions}>
          <View style={{ flex: 1 }}><PrimaryWideButton text="CANCEL" onPress={() => { if (finishing) return; if (isRunning && elapsedSeconds > 0) { Alert.alert('Leave workout?', 'Your current workout is still in progress.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => router.back() }]); return; } router.back(); }} color="#e8ecef" textColor="#25313b" /></View>
          <View style={{ flex: 1 }}><PrimaryWideButton text={finishing ? 'SAVING...' : 'FINISH & SAVE'} onPress={handleFinish} color={AppColors.primary} /></View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  contentWrap: { paddingHorizontal: 16, paddingTop: 16 },
  equipmentCard: { borderRadius: 14, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, padding: 16, marginBottom: 16 },
  equipmentName: { fontSize: 18, fontWeight: '800', color: '#1f2b33', marginBottom: 6 },
  equipmentCategory: { fontSize: 13, color: '#666666', fontWeight: '600' },
  challengeLabel: { fontSize: 12, fontWeight: '800', color: '#1d4ed8', marginBottom: 4, textTransform: 'uppercase' },
  challengeTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginBottom: 4 },
  challengeGoal: { fontSize: 13, color: '#4b5563' },
  challengeTimer: { fontSize: 13, color: AppColors.primaryDark, marginTop: 6, fontWeight: '700' },
  finishHelper: { marginTop: 10, fontSize: 12, color: AppColors.textMuted, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: AppColors.textSecondary, marginBottom: 8, marginTop: 8 },
  qualityWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  qualityChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f3f4f6' },
  qualityChipActive: { backgroundColor: AppColors.primaryLight },
  qualityChipText: { fontSize: 12, fontWeight: '700', color: AppColors.textSecondary },
  qualityChipTextActive: { color: AppColors.primaryDark },
  scaleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  scaleChip: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  scaleChipActive: { backgroundColor: AppColors.primary },
  scaleChipText: { fontSize: 12, fontWeight: '700', color: AppColors.textSecondary },
  scaleChipTextActive: { color: '#fff' },
  noteInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 12, minHeight: 84, textAlignVertical: 'top' },
});
