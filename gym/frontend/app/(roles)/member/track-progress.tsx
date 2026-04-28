import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { memberApi, MonthlyProgress, WorkoutStats } from '@/lib/member-api';
import { AppColors } from '@/constants/theme';
import { PageHeader, SectionHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { LinearGradient } from 'expo-linear-gradient';

type TrendPoint = {
  label: string;
  workouts: number;
  minutes: number;
};

type DailyPoint = {
  label: string;
  count: number;
};

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });
}

function BarChart({
  points,
  keyName,
  color,
}: {
  points: TrendPoint[];
  keyName: 'workouts' | 'minutes';
  color: string;
}) {
  const max = Math.max(1, ...points.map((p) => p[keyName]));

  return (
    <View style={styles.chartWrap}>
      <View style={styles.barRow}>
        {points.map((p) => {
          const value = p[keyName];
          const heightPct = (value / max) * 100;
          return (
            <View key={`${keyName}-${p.label}`} style={styles.barItem}>
              <View style={[styles.barValuePill, { borderColor: `${color}33`, backgroundColor: `${color}11` }]}>
                <Text style={[styles.barValue, { color }]}>{Number(value.toFixed(2))}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${heightPct}%`, backgroundColor: color }]} />
                <View style={[styles.barCap, { bottom: `${Math.max(0, heightPct - 8)}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.barLabel}>{p.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DailyLineChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));

  return (
    <View style={styles.lineChartWrap}>
      <View style={styles.lineChartGlow} />
      <View style={styles.lineChartArea}>
        {points.map((p) => {
          const heightPct = (p.count / max) * 100;
          const reached = p.count > 0;
          return (
            <View key={`daily-${p.label}`} style={styles.linePointCol}>
              <View style={[styles.linePointValuePill, reached && styles.linePointValuePillActive]}>
                <Text style={[styles.linePointValue, reached && styles.linePointValueActive]}>{p.count}</Text>
              </View>
              <View style={styles.linePointTrack}>
                <View style={[styles.linePointFill, { height: `${heightPct}%` }]} />
                {reached ? <View style={[styles.linePointGlow, { bottom: `${Math.max(0, heightPct - 8)}%` }]} /> : null}
              </View>
              <Text style={styles.linePointLabel}>{p.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function GoalRing({ completed, target }: { completed: number; target: number }) {
  const safeTarget = Math.max(1, target);
  const percent = Math.min(100, Math.round((completed / safeTarget) * 100));
  const remaining = Math.max(0, safeTarget - completed);

  return (
    <View style={styles.goalWrap}>
      <View style={styles.goalRingOuter}>
        <View style={styles.goalRingInner}>
          <Text style={styles.goalPercent}>{percent}%</Text>
          <Text style={styles.goalSub}>complete</Text>
        </View>
      </View>
      <View style={styles.goalDetails}>
        <Text style={styles.goalDetailText}>Target: {safeTarget} workouts</Text>
        <Text style={styles.goalDetailText}>Completed: {completed}</Text>
        <Text style={styles.goalDetailText}>Remaining: {remaining}</Text>
      </View>
    </View>
  );
}

export default function TrackProgressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyProgress | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  const auth = getAuthState();
  const memberType = auth?.user?.memberType === 'premium' ? 'premium' : 'normal';

  const loadData = useCallback(async () => {
    const auth = getAuthState();
    if (!auth?.token) {
      setLoading(false);
      return;
    }

    try {
      const now = new Date();
      const requests: Promise<MonthlyProgress>[] = [];
      const months: Array<{ year: number; month: number }> = [];

      for (let i = 5; i >= 0; i -= 1) {
        const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ year: dt.getFullYear(), month: dt.getMonth() + 1 });
        requests.push(memberApi.getMonthlyProgress(auth.token, dt.getFullYear(), dt.getMonth() + 1));
      }

      const [statsData, currentMonth, ...otherMonths] = await Promise.all([
        memberApi.getWorkoutStats(auth.token),
        memberApi.getMonthlyProgress(auth.token),
        ...requests,
      ]);

      setStats(statsData || null);
      setMonthly(currentMonth || null);

      const allMonths = otherMonths;
      const trendData: TrendPoint[] = allMonths.map((m, idx) => ({
        label: monthLabel(months[idx].year, months[idx].month),
        workouts: m.totalWorkouts || 0,
        minutes: m.totalMinutes || 0,
      }));

      setTrend(trendData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const growth = useMemo(() => {
    if (trend.length < 2) return { workouts: 0, minutes: 0 };
    const prev = trend[trend.length - 2];
    const curr = trend[trend.length - 1];
    return {
      workouts: curr.workouts - prev.workouts,
      minutes: Number((curr.minutes - prev.minutes).toFixed(2)),
    };
  }, [trend]);

  const dailyTrend = useMemo(() => {
    if (!monthly?.daily) return [] as DailyPoint[];
    const keys = Object.keys(monthly.daily).sort();
    const recent = keys.slice(-7);
    return recent.map((dayKey) => {
      const day = Number(dayKey.split('-').pop() || dayKey);
      return {
        label: Number.isNaN(day) ? dayKey.slice(-2) : String(day),
        count: monthly.daily[dayKey]?.count || 0,
      };
    });
  }, [monthly]);

  const monthlyGoalTarget = 12;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[AppColors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Track Progress" subtitle="Visualize your workout growth" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))} />

      <View style={styles.heroWrap}>
        <LinearGradient colors={['#0f172a', '#143d29']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>Workout Progress</Text>
            <Text style={styles.heroTitle}>{monthly?.totalWorkouts || 0} sessions completed</Text>
            <Text style={styles.heroSubtitle}>{monthly?.totalMinutes || 0} minutes tracked this month</Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>Growth</Text>
            <Text style={styles.heroBadgeValue}>{growth.workouts >= 0 ? '+' : ''}{growth.workouts}</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.badgeWrap}>
        <Text style={styles.badgeLabel}>Member Type</Text>
        <View
          style={[
            styles.badgePill,
            memberType === 'premium' ? styles.badgePremium : styles.badgeNormal,
          ]}
        >
          <Text style={styles.badgePillText}>{memberType === 'premium' ? 'Premium' : 'Normal'}</Text>
        </View>
      </View>

      <View style={styles.contentWrap}>
        <SectionHeader title="Overview" />
        <View style={styles.overviewGrid}>
          <SurfaceCard>
            <Text style={styles.statLabel}>Total Workouts</Text>
            <Text style={styles.statValue}>{stats?.totalWorkouts || 0}</Text>
          </SurfaceCard>
          <SurfaceCard>
            <Text style={styles.statLabel}>Total Minutes</Text>
            <Text style={styles.statValue}>{Number((stats?.totalMinutes || 0).toFixed(2))}</Text>
          </SurfaceCard>
          <SurfaceCard>
            <Text style={styles.statLabel}>Monthly Growth</Text>
            <Text style={[styles.statValue, { color: growth.workouts >= 0 ? '#2ecc71' : '#e74c3c' }]}>
              {growth.workouts >= 0 ? '+' : ''}{growth.workouts} workouts
            </Text>
          </SurfaceCard>
          <SurfaceCard>
            <Text style={styles.statLabel}>Minutes Growth</Text>
            <Text style={[styles.statValue, { color: growth.minutes >= 0 ? '#2ecc71' : '#e74c3c' }]}>
              {growth.minutes >= 0 ? '+' : ''}{growth.minutes}
            </Text>
          </SurfaceCard>
        </View>

        <SectionHeader title="Workout Count Trend (Last 6 Months)" />
        <SurfaceCard>
          <BarChart points={trend} keyName="workouts" color={AppColors.primary} />
        </SurfaceCard>

        <SectionHeader title="Workout Minutes Trend (Last 6 Months)" />
        <SurfaceCard>
          <BarChart points={trend} keyName="minutes" color="#3498db" />
        </SurfaceCard>

        <SectionHeader title="Daily Streak (Last 7 Active Days)" />
        <SurfaceCard>
          {dailyTrend.length > 0 ? (
            <DailyLineChart points={dailyTrend} />
          ) : (
            <Text style={styles.emptyText}>No daily workout data yet for this month.</Text>
          )}
        </SurfaceCard>

        <SectionHeader title="Goal Progress" />
        <SurfaceCard>
          <GoalRing completed={monthly?.totalWorkouts || 0} target={monthlyGoalTarget} />
        </SurfaceCard>

        <SectionHeader title="Current Month" />
        <SurfaceCard>
          <Text style={styles.monthlyText}>Workouts: {monthly?.totalWorkouts || 0}</Text>
          <Text style={styles.monthlyText}>Minutes: {Number((monthly?.totalMinutes || 0).toFixed(2))}</Text>
          <Text style={styles.monthlyText}>Daily active days: {monthly ? Object.keys(monthly.daily || {}).length : 0}</Text>
        </SurfaceCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  badgeWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e6edf2',
  },
  badgeLabel: {
    fontSize: 13,
    color: '#60707d',
    fontWeight: '700',
  },
  badgePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgePremium: {
    backgroundColor: '#fef3c7',
  },
  badgeNormal: {
    backgroundColor: '#e5e7eb',
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1f2937',
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#7a8792',
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2b33',
  },
  chartWrap: {
    paddingTop: 4,
  },
  heroWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroEyebrow: {
    color: '#9be4c0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    lineHeight: 18,
  },
  heroBadge: {
    minWidth: 88,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  heroBadgeLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroBadgeValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 180,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
  },
  barValuePill: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '700',
  },
  barTrack: {
    width: '100%',
    maxWidth: 28,
    height: 120,
    borderRadius: 999,
    backgroundColor: '#edf1f4',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 999,
    minHeight: 2,
  },
  barCap: {
    position: 'absolute',
    left: 3,
    right: 3,
    height: 6,
    borderRadius: 999,
    opacity: 0.95,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 11,
    color: '#66717a',
    fontWeight: '700',
  },
  lineChartWrap: {
    paddingTop: 2,
    position: 'relative',
  },
  lineChartGlow: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 30,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#e9f8ef',
    opacity: 0.8,
  },
  lineChartArea: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  linePointCol: {
    flex: 1,
    alignItems: 'center',
  },
  linePointValue: {
    fontSize: 10,
    fontWeight: '700',
  },
  linePointValuePill: {
    minWidth: 28,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  linePointValuePillActive: {
    backgroundColor: '#d1fae5',
  },
  linePointValueActive: {
    color: '#166534',
  },
  linePointTrack: {
    width: '100%',
    maxWidth: 20,
    height: 90,
    borderRadius: 999,
    backgroundColor: '#eef2f6',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  linePointFill: {
    width: '100%',
    minHeight: 3,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  linePointGlow: {
    position: 'absolute',
    left: 2,
    right: 2,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#86efac',
    opacity: 0.95,
  },
  linePointLabel: {
    marginTop: 8,
    fontSize: 11,
    color: '#6a7782',
    fontWeight: '700',
  },
  goalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  goalRingOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 10,
    borderColor: '#d1fae5',
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRingInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPercent: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f766e',
    lineHeight: 24,
  },
  goalSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  goalDetails: {
    flex: 1,
    gap: 6,
  },
  goalDetailText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  monthlyText: {
    fontSize: 14,
    color: '#2f3942',
    fontWeight: '600',
    marginBottom: 6,
  },
});
