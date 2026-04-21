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
import {
  getFoodSubstitutions,
  getMealPlanProgress,
  getMealPlansForMember,
  trackMealProgress,
  type FoodSubstitution,
  type MealCompletionStatus,
  type MealPlan,
  type MealPlanProgressSummary,
  type MealSlot,
} from '@/lib/meal-plan-api';
import { AppColors } from '@/constants/theme';

const todayKey = () => new Date().toISOString().slice(0, 10);

function MacroBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.macroBadge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.macroNum, { color }]}>{value}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ status, active, onPress }: { status: MealCompletionStatus; active: boolean; onPress: () => void }) {
  const map = {
    completed: { label: 'Done', bg: '#dcfce7', color: '#166534' },
    partial: { label: 'Partial', bg: '#fef3c7', color: '#92400e' },
    skipped: { label: 'Skipped', bg: '#fee2e2', color: '#991b1b' },
  } as const;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.statusPill, { backgroundColor: active ? map[status].bg : '#f3f4f6' }]}>
      <Text style={[styles.statusPillText, { color: active ? map[status].color : AppColors.textMuted }]}>{map[status].label}</Text>
    </TouchableOpacity>
  );
}

function MealSlotCard({
  slot,
  currentStatus,
  onStatusChange,
  onLoadSubstitutions,
  substitutions,
  substitutionStrategy,
}: {
  slot: MealSlot;
  currentStatus?: MealCompletionStatus | null;
  onStatusChange: (status: MealCompletionStatus) => void;
  onLoadSubstitutions?: (foodName: string, foodCategory?: string, calories?: number, protein?: number) => void;
  substitutions?: Record<string, FoodSubstitution[]>;
  substitutionStrategy: 'balanced' | 'high-protein' | 'budget' | 'local';
}) {
  const totalCals = slot.foods.reduce((sum, f) => sum + (f.calories || 0), 0);
  const totalProtein = slot.foods.reduce((sum, f) => sum + (f.protein || 0), 0);
  const totalCarbs = slot.foods.reduce((sum, f) => sum + (f.carbs || 0), 0);
  const totalFat = slot.foods.reduce((sum, f) => sum + (f.fat || 0), 0);

  return (
    <View style={styles.slotCard}>
      <View style={styles.slotHeader}>
        <View>
          <Text style={styles.slotName}>{slot.name || ''}</Text>
          <Text style={styles.slotTime}>{slot.timeLabel || ''}</Text>
        </View>
        <Text style={styles.slotCals}>{totalCals} kcal</Text>
      </View>

      {slot.foods.length > 0 ? (
        <>
          {slot.foods.map((food, i) => (
            <View key={i}>
              <View style={styles.foodRow}>
                <MaterialCommunityIcons name="food-apple-outline" size={14} color={AppColors.textMuted} />
                <Text style={styles.foodName} numberOfLines={1}>{food.name || '—'}</Text>
                <Text style={styles.foodServing}>{food.servingText || ''}</Text>
              </View>
              <TouchableOpacity style={styles.subsBtn} onPress={() => onLoadSubstitutions?.(food.name || '', food.category || '', food.calories || 0, food.protein || 0)}>
                <Text style={styles.subsBtnText}>Find substitutions ({substitutionStrategy})</Text>
              </TouchableOpacity>
              {Array.isArray(substitutions?.[food.name || '']) && substitutions![food.name || ''].length > 0 ? (
                <View style={styles.subsWrap}>
                  {substitutions![food.name || ''].slice(0, 2).map((alt, subIdx) => (
                    <Text key={`${food.name}-${subIdx}`} style={styles.subsText}>• {alt.name} · {alt.calories} kcal · {alt.substitutionReason || 'Alternative'}{Array.isArray(alt.tags) && alt.tags.length ? ` · ${alt.tags.slice(0, 2).join(', ')}` : ''}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          <View style={styles.macroRow}>
            <MacroBadge label="Protein" value={Math.round(totalProtein)} color="#e74c3c" />
            <MacroBadge label="Carbs" value={Math.round(totalCarbs)} color="#f39c12" />
            <MacroBadge label="Fat" value={Math.round(totalFat)} color="#9b59b6" />
          </View>
        </>
      ) : (
        <Text style={styles.emptySlot}>No foods added yet</Text>
      )}

      <View style={styles.statusRow}>
        {(['completed', 'partial', 'skipped'] as MealCompletionStatus[]).map((item) => (
          <StatusPill key={item} status={item} active={currentStatus === item} onPress={() => onStatusChange(item)} />
        ))}
      </View>
    </View>
  );
}

function PlanCard({ plan, adherence, onPress }: { plan: MealPlan; adherence?: number; onPress: () => void }) {
  const totalDailyCals = plan.meals.reduce((sum, slot) => sum + slot.foods.reduce((s, f) => s + (f.calories || 0), 0), 0);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planCode}>{plan.planCode || ''}</Text>
          <Text style={styles.planName}>{plan.planName || 'Untitled Plan'}</Text>
        </View>
        <View style={styles.calsBadge}>
          <Text style={styles.calsNum}>{totalDailyCals}</Text>
          <Text style={styles.calsLabel}>kcal/day</Text>
        </View>
      </View>
      {!!plan.description && <Text style={styles.planDesc} numberOfLines={2}>{plan.description}</Text>}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}><MaterialCommunityIcons name="target" size={14} color={AppColors.textMuted} /><Text style={styles.metaText}>{plan.goal || '—'}</Text></View>
        <View style={styles.metaItem}><MaterialCommunityIcons name="calendar-range" size={14} color={AppColors.textMuted} /><Text style={styles.metaText}>{plan.durationWeeks} weeks</Text></View>
        <View style={styles.metaItem}><MaterialCommunityIcons name="silverware-fork-knife" size={14} color={AppColors.textMuted} /><Text style={styles.metaText}>{plan.meals.length} meals</Text></View>
      </View>
      <View style={styles.adherenceBarWrap}><View style={[styles.adherenceBar, { width: `${adherence || 0}%` }]} /></View>
      <Text style={styles.adherenceText}>Today&apos;s meal adherence: {adherence || 0}%</Text>
    </TouchableOpacity>
  );
}

function PlanDetail({ plan, token }: { plan: MealPlan; token: string }) {
  const [summary, setSummary] = useState<MealPlanProgressSummary | null>(null);
  const [busyMeal, setBusyMeal] = useState<string | null>(null);
  const [substitutions, setSubstitutions] = useState<Record<string, FoodSubstitution[]>>({});
  const [substitutionStrategy, setSubstitutionStrategy] = useState<'balanced' | 'high-protein' | 'budget' | 'local'>('balanced');
  const dateKey = todayKey();

  const totals = useMemo(() => {
    const totalCals = plan.meals.reduce((sum, slot) => sum + slot.foods.reduce((s, f) => s + (f.calories || 0), 0), 0);
    const totalProtein = plan.meals.reduce((sum, slot) => sum + slot.foods.reduce((s, f) => s + (f.protein || 0), 0), 0);
    const totalCarbs = plan.meals.reduce((sum, slot) => sum + slot.foods.reduce((s, f) => s + (f.carbs || 0), 0), 0);
    const totalFat = plan.meals.reduce((sum, slot) => sum + slot.foods.reduce((s, f) => s + (f.fat || 0), 0), 0);
    return { totalCals, totalProtein, totalCarbs, totalFat };
  }, [plan]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await getMealPlanProgress(plan._id, token, dateKey);
      setSummary(res.data);
    } catch {
      // ignore initial empty state
    }
  }, [plan._id, token, dateKey]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const slotStatuses = useMemo(() => {
    const day = summary?.logs?.[0];
    const map: Record<string, MealCompletionStatus> = {};
    (day?.slots || []).forEach((slot) => {
      map[slot.mealName] = slot.status;
    });
    return map;
  }, [summary]);

  const handleStatusChange = async (mealName: string, status: MealCompletionStatus) => {
    setBusyMeal(mealName);
    try {
      const res = await trackMealProgress(plan._id, { dateKey, mealName, status }, token);
      setSummary(res.summary);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save meal progress.');
    } finally {
      setBusyMeal(null);
    }
  };

  const handleLoadSubstitutions = async (foodName: string, category?: string, calories?: number, protein?: number) => {
    try {
      const res = await getFoodSubstitutions(plan._id, { mealName: plan.planName, foodName, category, calories, protein }, token);
      setSubstitutions((prev) => ({ ...prev, [foodName]: res.data || [] }));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load substitutions');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={styles.detailTitle}>{plan.planName}</Text>
      <Text style={styles.detailSub}>Goal: {plan.goal} · {plan.durationWeeks} weeks · {plan.difficulty}</Text>
      {!!plan.description && <Text style={styles.detailDesc}>{plan.description}</Text>}

      <View style={styles.progressHero}>
        <Text style={styles.totalsTitle}>Today&apos;s adherence</Text>
        <Text style={styles.progressHeroValue}>{summary?.adherenceScore || 0}%</Text>
        <Text style={styles.progressHeroSub}>Completed {summary?.completedCount || 0} · Partial {summary?.partialCount || 0} · Skipped {summary?.skippedCount || 0}</Text>
      </View>

      <View style={styles.totalsCard}>
        <Text style={styles.totalsTitle}>Daily Totals</Text>
        <View style={styles.totalsRow}>
          <View style={styles.totalItem}><Text style={styles.totalNum}>{totals.totalCals}</Text><Text style={styles.totalLabel}>kcal</Text></View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}><Text style={[styles.totalNum, { color: '#e74c3c' }]}>{Math.round(totals.totalProtein)}g</Text><Text style={styles.totalLabel}>Protein</Text></View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}><Text style={[styles.totalNum, { color: '#f39c12' }]}>{Math.round(totals.totalCarbs)}g</Text><Text style={styles.totalLabel}>Carbs</Text></View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}><Text style={[styles.totalNum, { color: '#9b59b6' }]}>{Math.round(totals.totalFat)}g</Text><Text style={styles.totalLabel}>Fat</Text></View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Track today&apos;s meals</Text>
      {plan.meals.map((slot, i) => (
        <View key={i} style={{ opacity: busyMeal === slot.name ? 0.6 : 1 }}>
          <MealSlotCard slot={slot} currentStatus={slotStatuses[slot.name]} onStatusChange={(status) => handleStatusChange(slot.name, status)} onLoadSubstitutions={handleLoadSubstitutions} substitutions={substitutions} substitutionStrategy={substitutionStrategy} />
        </View>
      ))}
    </ScrollView>
  );
}

export default function MyMealPlansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const authState = getAuthState();
  const token = authState?.token || '';
  const userId = authState?.user?.id || authState?.user?._id || '';
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MealPlan | null>(null);
  const [todaySummaries, setTodaySummaries] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    try {
      const res = await getMealPlansForMember(userId, token);
      setPlans(res.data);
      const entries = await Promise.all((res.data || []).map(async (plan) => {
        try {
          const progress = await getMealPlanProgress(plan._id, token, todayKey());
          return [plan._id, progress.data.adherenceScore || 0] as const;
        } catch {
          return [plan._id, 0] as const;
        }
      }));
      setTodaySummaries(Object.fromEntries(entries));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSelected(null); load(); }} style={styles.backBtn}><MaterialCommunityIcons name="arrow-left" size={22} color={AppColors.text} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Plan Details</Text>
          <View style={{ width: 36 }} />
        </View>
        <PlanDetail plan={selected} token={token} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><MaterialCommunityIcons name="arrow-left" size={22} color={AppColors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>My Meal Plans</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={AppColors.primary} size="large" />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p._id}
          renderItem={({ item }) => <PlanCard plan={item} adherence={todaySummaries[item._id]} onPress={() => setSelected(item)} />}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={<View style={styles.emptyBox}><MaterialCommunityIcons name="food-variant" size={48} color={AppColors.neutralMedium} /><Text style={styles.emptyText}>No meal plans assigned yet.</Text><Text style={styles.emptySubText}>Your trainer will assign plans here.</Text></View>}
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
  calsBadge: { alignItems: 'center', backgroundColor: AppColors.primaryLight, borderRadius: 12, padding: 8 },
  calsNum: { fontSize: 18, fontWeight: '800', color: AppColors.primaryDark },
  calsLabel: { fontSize: 10, color: AppColors.primaryDark },
  planDesc: { fontSize: 13, color: AppColors.textSecondary, lineHeight: 18, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: AppColors.textMuted },
  emptyBox: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: AppColors.textSecondary },
  emptySubText: { fontSize: 13, color: AppColors.textMuted },
  adherenceBarWrap: { marginTop: 12, height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  adherenceBar: { height: '100%', backgroundColor: AppColors.primary, borderRadius: 999 },
  adherenceText: { marginTop: 8, fontSize: 12, fontWeight: '600', color: AppColors.textMuted },
  detailTitle: { fontSize: 22, fontWeight: '800', color: AppColors.text },
  detailSub: { fontSize: 13, color: AppColors.textMuted },
  detailDesc: { fontSize: 14, color: AppColors.textSecondary, lineHeight: 20 },
  progressHero: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  progressHeroValue: { fontSize: 28, fontWeight: '800', color: AppColors.primaryDark, marginTop: 4 },
  progressHeroSub: { fontSize: 12, color: AppColors.textMuted, marginTop: 4 },
  totalsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  totalsTitle: { fontSize: 13, fontWeight: '700', color: AppColors.textSecondary, marginBottom: 12 },
  totalsRow: { flexDirection: 'row', alignItems: 'center' },
  totalItem: { flex: 1, alignItems: 'center' },
  totalNum: { fontSize: 20, fontWeight: '800', color: AppColors.text },
  totalLabel: { fontSize: 11, color: AppColors.textMuted, marginTop: 2 },
  totalDivider: { width: 1, height: 36, backgroundColor: AppColors.neutralMedium },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  slotCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  slotName: { fontSize: 15, fontWeight: '700', color: AppColors.text },
  slotTime: { fontSize: 12, color: AppColors.textMuted },
  slotCals: { fontSize: 15, fontWeight: '700', color: AppColors.primary },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  foodName: { flex: 1, fontSize: 13, color: AppColors.text },
  foodServing: { fontSize: 12, color: AppColors.textMuted },
  macroRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  macroBadge: { flex: 1, borderRadius: 8, padding: 6, alignItems: 'center' },
  macroNum: { fontSize: 14, fontWeight: '700' },
  macroLabel: { fontSize: 10, color: AppColors.textMuted },
  emptySlot: { fontSize: 13, color: AppColors.textMuted, fontStyle: 'italic', paddingVertical: 4 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
});
