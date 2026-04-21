import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { clearAuthState } from '@/lib/auth-state';
import { memberApi, MemberProfile, MemberSession, MonthlyProgress, TrainerAvailability, WorkoutStats, MembershipUpgradeRequest, MemberLeaderboardEntry } from '@/lib/member-api';
import { AppColors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ListRow, PrimaryWideButton, SectionHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { CarouselHeader, CarouselSlide } from '@/components/ui/carousel-header';
import { LinearGradient } from 'expo-linear-gradient';

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addHour = (time: string) => {
  const [h, m] = String(time || '06:00').split(':').map(Number);
  const minutes = (h * 60 + m + 60) % (24 * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

type SparkPoint = { label: string; value: number };

const Sparkline = ({ points }: { points: SparkPoint[] }) => {
  const width = 260;
  const height = 80;
  const max = Math.max(1, ...points.map((p) => p.value));
  const safeCount = Math.max(1, points.length - 1);

  const normalized = points.map((p, idx) => {
    const x = (idx / safeCount) * width;
    const y = height - (p.value / max) * height;
    return { ...p, x, y };
  });

  return (
    <View style={[styles.sparkContainer, { width, height }] }>
      <View style={styles.sparkBackdrop} />
      {normalized.map((pt, idx) => {
        if (idx === 0) return null;
        const prev = normalized[idx - 1];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy) || 1;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`line-${idx}`}
            style={{
              position: 'absolute',
              left: prev.x,
              top: prev.y,
              width: length,
              height: 2,
              backgroundColor: '#7ad7a1',
              transform: [{ translateY: -1 }, { rotate: `${angle}deg` }],
            }}
          />
        );
      })}

      {normalized.map((pt, idx) => (
        <View
          key={`blob-${idx}`}
          style={[
            styles.sparkBlob,
            {
              left: Math.max(0, pt.x - 10),
              top: Math.max(0, pt.y - 10),
              opacity: 0.18 + (pt.value / max) * 0.35,
            },
          ]}
        />
      ))}

      {normalized.map((pt, idx) => (
        <View key={`dot-${idx}`} style={[styles.sparkDot, { left: pt.x - 4, top: pt.y - 4 }]} />
      ))}

      <View style={styles.sparkLabels}>
        {normalized.map((pt) => (
          <Text key={`lbl-${pt.label}`} style={styles.sparkLabel}>{pt.label}</Text>
        ))}
      </View>
    </View>
  );
};

const QuickActionButton = ({
  iconName,
  label,
  subtitle,
  onPress,
  colors,
}: {
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  colors?: [string, string];
}) => {
  const safeColors: [string, string] = Array.isArray(colors) && colors.length >= 2 ? colors : ['#16A34A', '#34D399'];
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.quickActionBtnOuter}
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient
          colors={safeColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quickActionBtn}
        >
          <View style={styles.quickActionIconWrap}>
            <MaterialCommunityIcons name={iconName} size={22} color="#ffffff" />
          </View>
          <View style={styles.quickActionTextWrap}>
            <Text style={styles.quickActionBtnText} numberOfLines={1} ellipsizeMode="tail">
              {label}
            </Text>
            <Text style={styles.quickActionBtnSubtext} numberOfLines={2} ellipsizeMode="tail">
              {subtitle}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function MemberHomePage() {
  const router = useRouter();
  const { authState, clearAuthState } = useAuth();
  const token = authState.token;
  const user = authState.user;

  const [sessions, setSessions] = useState<MemberSession[]>([]);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [availability, setAvailability] = useState<TrainerAvailability[]>([]);
  const [workoutStats, setWorkoutStats] = useState<WorkoutStats | null>(null);
  const [monthlyProgress, setMonthlyProgress] = useState<MonthlyProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<MemberLeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingTrainerId, setBookingTrainerId] = useState<string | null>(null);
  const [upgradeRequest, setUpgradeRequest] = useState<MembershipUpgradeRequest>(null);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      Alert.alert('Login required', 'Please log in again to load member dashboard.');
      setLoading(false);
      return;
    }

    try {
      const today = toLocalDateString(new Date());
      const [
        profileData,
        sessionData,
        availabilityData,
        statsData,
        monthlyData,
        upgradeReq,
        leaderboardData,
      ] = await Promise.all([
        memberApi.getProfile(token),
        memberApi.listSessions(token, today),
        memberApi.getTrainerAvailability(today, token),
        memberApi.getWorkoutStats(token),
        memberApi.getMonthlyProgress(token),
        memberApi.getMembershipUpgradeRequest(token),
        memberApi.getPointsLeaderboard(token),
      ]);

      setProfile(profileData || null);
      setSessions(sessionData || []);
      setAvailability(availabilityData || []);
      setWorkoutStats(statsData || null);
      setMonthlyProgress(monthlyData || null);
      setUpgradeRequest(upgradeReq || null);
      setLeaderboard(leaderboardData?.leaderboard || []);
      setMyRank(leaderboardData?.myRank ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load member dashboard';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleLogout = () => {
    clearAuthState();
    router.replace('/(auth)/login');
  };

  const handleBookFirstSlot = async (trainer: TrainerAvailability) => {
    if (!token) return;

    const date = toLocalDateString(new Date());
    const startTime = trainer.availability.startTime;
    const endTime = addHour(startTime);

    setBookingTrainerId(String(trainer.trainerId));
    try {
      await memberApi.createBooking(
        {
          trainerId: String(trainer.trainerId),
          date,
          startTime,
          endTime,
          name: `Personal Session - ${user?.name || 'Member'}`,
          notes: 'Booked by member from dashboard',
        },
        token
      );
      Alert.alert('Success', `Session booked with ${trainer.trainerName}`);
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Booking failed';
      Alert.alert('Error', message);
    } finally {
      setBookingTrainerId(null);
    }
  };

  const memberType = profile?.memberType || user?.memberType || 'normal';
  const canRequestPremium = memberType === 'normal' && (!upgradeRequest || upgradeRequest.status !== 'pending');
  const upgradeStatusText = useMemo(() => {
    if (!upgradeRequest) return '';
    if (upgradeRequest.status === 'pending') return 'Premium request pending review';
    if (upgradeRequest.status === 'approved') return 'Your premium request was approved';
    if (upgradeRequest.status === 'rejected') return 'Your premium request was rejected';
    return '';
  }, [upgradeRequest]);

  const monthlySummaryText = useMemo(() => {
    if (!monthlyProgress) return 'No monthly data yet';
    return `${monthlyProgress.totalWorkouts} workouts • ${monthlyProgress.totalMinutes} mins`;
  }, [monthlyProgress]);

  const dailySparkPoints = useMemo(() => {
    if (!monthlyProgress?.daily) return [] as SparkPoint[];
    const keys = Object.keys(monthlyProgress.daily).sort();
    const recent = keys.slice(-10);
    return recent.map((dayKey) => {
      const day = Number(dayKey.split('-').pop() || dayKey);
      return {
        label: Number.isNaN(day) ? dayKey.slice(-2) : String(day),
        value: monthlyProgress.daily[dayKey]?.count || 0,
      };
    });
  }, [monthlyProgress]);



  const heroSlides = useMemo<CarouselSlide[]>(
    () => [
      {
        id: 'workout',
        title: 'Crush today\'s session',
        subtitle: 'Jump into your planned workout',
        icon: 'lightning-bolt',
        bgColor: '#E8F7F0',
        textColor: '#0f1f17',
        iconColor: AppColors.primary,
        image: require('../../../assets/images/image1.png'),
        route: '/(roles)/member/workout',
      },
      {
        id: 'profile',
        title: 'Stay on track',
        subtitle: 'Review progress and preferences',
        icon: 'account-star',
        bgColor: '#FFF5E8',
        textColor: '#2a1f14',
        iconColor: '#FF9800',
        image: require('../../../assets/images/image2.png'),
        route: '/(roles)/member/profile',
      },
      {
        id: 'shop',
        title: 'Gear up faster',
        subtitle: 'Shop essentials picked by trainers',
        icon: 'cart-outline',
        bgColor: '#E8F4FF',
        textColor: '#0f2847',
        iconColor: '#2196F3',
        image: require('../../../assets/images/image3.png'),
        route: '/(roles)/member/shop',
      },
    ],
    []
  );


  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Modern Carousel Header */}
      <CarouselHeader
        slides={heroSlides}
        userGreeting={getGreeting()}
        memberName={profile?.name || user?.name || 'Member'}
        trainerName={profile?.assignedTrainerName}
        rightBadges={(
          <View style={styles.topRightBadgesRow}>
            {memberType === 'premium' && (
              <View style={styles.premiumPill}>
                <MaterialCommunityIcons name="crown" size={16} color="#92400e" />
                <Text style={styles.premiumLabel}>PREMIUM</Text>
              </View>
            )}
            <View style={styles.pointsPill}>
              <MaterialCommunityIcons name="star-circle" size={16} color={AppColors.gold} />
              <Text style={styles.pointsLabel}>POINTS</Text>
              <Text style={styles.pointsValue}>{profile?.points ?? 0}</Text>
            </View>
          </View>
        )}
        autoScroll={true}
        autoScrollInterval={5000}
        onSlidePress={(slide) => {
          if (slide.route) {
            router.push(slide.route as any);
          }
        }}
      />

      <View style={styles.contentWrap}>
        {/* Membership card (now redundant with header badges) intentionally hidden */}

        {/* Quick Action Buttons */}
        <View style={styles.quickActionsContainer}>
          <QuickActionButton
            iconName="calendar-plus"
            label="Book Session"
            subtitle="Schedule your workout"
            onPress={() => router.push('/(roles)/member/book-session')}
            colors={['#16A34A', '#34D399']}
          />
          <QuickActionButton
            iconName="clipboard-list"
            label="My Bookings"
            subtitle="View your sessions"
            onPress={() => router.push('/(roles)/member/my-bookings')}
            colors={['#2563EB', '#60A5FA']}
          />
        </View>

        {memberType === 'normal' && (
          <View style={styles.quickActionsContainer}>
            <QuickActionButton
              iconName="star-circle"
              label={canRequestPremium ? 'Request Premium' : upgradeRequest?.status === 'pending' ? 'Premium Requested' : 'Premium Status'}
              subtitle={canRequestPremium ? 'Upgrade your access' : 'Check your request status'}
              colors={['#f59e0b', '#fbbf24']}
              onPress={async () => {
                if (!token) {
                  Alert.alert('Login required', 'Please log in again to request premium.');
                  return;
                }
                if (!canRequestPremium) {
                  Alert.alert('Premium request', upgradeStatusText || 'No active request.');
                  return;
                }
                try {
                  const result = await memberApi.createMembershipUpgradeRequest(token);
                  setUpgradeRequest(result.request);
                  Alert.alert('Request sent', 'Your premium membership request has been submitted to the admin.');
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to submit request';
                  Alert.alert('Error', message);
                }
              }}
            />
          </View>
        )}

        <View style={styles.quickActionsContainer}>
          <QuickActionButton
            iconName="play-circle-outline"
            label="Tutorial Videos"
            subtitle="Watch training videos"
            onPress={() => router.push('/(roles)/member/tutorial-categories' as any)}
            colors={['#7C3AED', '#C084FC']}
          />
        </View>

        {/* Quick Stats Header */}
        <View style={styles.quickStatsHeader}>
          <Text style={styles.quickStatsTitle}>Your Fitness Overview</Text>
          <TouchableOpacity onPress={() => router.push('/(roles)/member/track-progress')}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={AppColors.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats Cards */}
        <View style={styles.quickStatsGrid}>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatIcon}>💪</Text>
            <Text style={styles.quickStatValue}>{workoutStats?.totalWorkouts || 0}</Text>
            <Text style={styles.quickStatLabel}>Workouts</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatIcon}>🔥</Text>
            <Text style={styles.quickStatValue}>{workoutStats?.totalMinutes || 0}</Text>
            <Text style={styles.quickStatLabel}>Minutes</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Text style={styles.quickStatIcon}>👤</Text>
            <Text style={styles.quickStatValue}>{profile?.assignedTrainerId ? '✓' : '−'}</Text>
            <Text style={styles.quickStatLabel}>Trainer</Text>
          </View>
        </View>

        <SectionHeader title="Fitness Hub" />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(roles)/member/my-workout-plans' as any)}
            style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: 18, padding: 16 }}
          >
            <Text style={{ fontSize: 24, marginBottom: 8 }}>💪</Text>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>Workout Plans</Text>
            <Text style={{ color: '#cbd5e1', marginTop: 4, fontSize: 12 }}>View your schedule and exercise progress</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(roles)/member/my-meal-plans' as any)}
            style={{ flex: 1, backgroundColor: '#14532d', borderRadius: 18, padding: 16 }}
          >
            <Text style={{ fontSize: 24, marginBottom: 8 }}>🥗</Text>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>Meal Plans</Text>
            <Text style={{ color: '#d1fae5', marginTop: 4, fontSize: 12 }}>See meal slots, foods, and daily totals</Text>
          </TouchableOpacity>
        </View>
        <SectionHeader title="Today's Sessions" />
        {sessions.length > 0 ? (
          <FlatList
            scrollEnabled={false}
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ListRow
                title={item.name}
                subtitle={`${item.startTime} - ${item.endTime} • ${item.trainerName || 'Trainer'}`}
                rightText={item.status.toUpperCase()}
              />
            )}
          />
        ) : (
          <SurfaceCard>
            <Text style={styles.smallText}>No sessions for today.</Text>
          </SurfaceCard>
        )}

        <View style={{ marginTop: 12 }}>
          <PrimaryWideButton
            text="VIEW ALL SESSIONS"
            onPress={() => router.push('/(roles)/member/sessions')}
            color="#0369a1"
            textColor="#ffffff"
          />
        </View>

        <SectionHeader title="Meal Plans" actionText="Open" onActionPress={() => router.push('/(roles)/member/my-meal-plans' as any)} />
        <SurfaceCard>
          <Text style={styles.cardTitle}>Your nutrition plans</Text>
          <Text style={styles.smallText}>Open the new Meal Plans screen to see assigned plans, meal slots, foods, and nutrition totals.</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              style={[styles.ctaButton, { flex: 1, backgroundColor: '#ecfdf5', borderColor: '#86efac' }]}
              onPress={() => router.push('/(roles)/member/my-meal-plans' as any)}
            >
              <MaterialCommunityIcons name="food-apple-outline" size={20} color="#166534" />
              <Text style={[styles.ctaButtonText, { color: '#166534' }]}>Open Meal Plans</Text>
            </TouchableOpacity>
          </View>
        </SurfaceCard>

        <SectionHeader title="Workout Progress" actionText="Track" onActionPress={() => router.push('/(roles)/member/track-progress')} />
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(roles)/member/track-progress')}>
          <SurfaceCard>
            {dailySparkPoints.length > 0 ? (
              <>
                <View style={styles.sparkHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>Workout Momentum</Text>
                    <Text style={styles.smallText}>Last {dailySparkPoints.length} active days • Tap for the detailed view</Text>
                  </View>
                  <Text style={styles.sparkStat}>{dailySparkPoints[dailySparkPoints.length - 1]?.value || 0} today</Text>
                </View>

                <Sparkline points={dailySparkPoints} />

                <View style={styles.sparkFooterRow}>
                  <View style={styles.sparkFooterPill}>
                    <Text style={styles.sparkFooterLabel}>This Month</Text>
                    <Text style={styles.sparkFooterValue}>{monthlyProgress?.totalWorkouts || 0} workouts</Text>
                  </View>
                  <View style={styles.sparkFooterPill}>
                    <Text style={styles.sparkFooterLabel}>Total Minutes</Text>
                    <Text style={styles.sparkFooterValue}>{Number((workoutStats?.totalMinutes || 0).toFixed(1))} min</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.smallText}>No workout data yet. Start a session to see your trend.</Text>
            )}
          </SurfaceCard>
        </TouchableOpacity>

        {/* Leaderboard Section */}
        <SectionHeader title="Leaderboard" />
        <SurfaceCard>
          <View style={styles.leaderboardHeaderRow}>
            <Text style={styles.cardTitle}>Points Leaderboard</Text>
            <Text style={styles.leaderboardSubtitle}>
              {myRank ? `You are #${myRank}` : 'Earn points from your trainer to rank up'}
            </Text>
          </View>
          {leaderboard.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              {leaderboard.map((entry) => {
                const currentId = profile?.id || user?.id || (user as any)?._id;
                const isMe = currentId && String(entry.id) === String(currentId);
                return (
                  <LinearGradient
                    key={entry.id}
                    colors={isMe ? ['#e7f7ef', '#d6f3e3'] : entry.rank === 1 ? ['#fff7e6', '#ffe7b8'] : entry.rank === 2 ? ['#f6f8ff', '#e8ecff'] : ['#f8f3ff', '#ecdfff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.leaderboardRow,
                      isMe && styles.leaderboardRowSelf,
                    ]}
                  >
                    <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaderboardName}>{entry.name || 'Member'}</Text>
                      <Text style={styles.leaderboardEmail}>{entry.email}</Text>
                    </View>
                    <View style={styles.leaderboardPointsPill}>
                      <MaterialCommunityIcons name="trophy" size={13} color="#f59e0b" />
                      <Text style={styles.leaderboardPoints}>{entry.points}</Text>
                    </View>
                  </LinearGradient>
                );
              })}
            </View>
          ) : (
            <Text style={styles.smallText}>No leaderboard data yet.</Text>
          )}
        </SurfaceCard>

        <SectionHeader title="Ratings & Reviews" actionText="Open" onActionPress={() => router.push('/(roles)/member/reviews' as any)} />
        <SurfaceCard>
          <Text style={styles.cardTitle}>Share your gym experience</Text>
          <Text style={styles.smallText}>Use Ratings & Reviews to leave a star rating, write a review, and see management replies in one place.</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              style={[styles.ctaButton, { flex: 1, backgroundColor: '#fff7ed', borderColor: '#fdba74' }]}
              onPress={() => router.push('/(roles)/member/reviews' as any)}
            >
              <MaterialCommunityIcons name="star-outline" size={20} color="#c2410c" />
              <Text style={[styles.ctaButtonText, { color: '#c2410c' }]}>Open Reviews</Text>
            </TouchableOpacity>
          </View>
        </SurfaceCard>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#ff3b30" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  memberTypeWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6edf2',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  memberTypeLabel: {
    fontSize: 13,
    color: '#60707d',
    fontWeight: '700',
  },
  memberTypeStatusText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    marginTop: 6,
  },
  // Quick Stats Styles
  quickStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickStatsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2b33',
  },
  quickStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  quickStatIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: AppColors.primary,
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '600',
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2b33',
    marginBottom: 8,
  },
  smallText: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 6,
    lineHeight: 18,
  },
  mealPlanHero: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 104,
  },
  mealPlanEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#86efac',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  mealPlanTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 26,
    marginBottom: 6,
  },
  mealPlanSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.84)',
  },
  mealPlanTargetBadge: {
    width: 88,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealPlanTargetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.74)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  mealPlanTargetValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  mealMacroGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  mealMacroCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e7ecf3',
  },
  mealMacroValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: 8,
  },
  mealMacroTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  mealMacroFill: {
    height: '100%',
    borderRadius: 999,
  },
  mealTotalsCard: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#f6f8f2',
    borderWidth: 1,
    borderColor: '#e5edd8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mealTotalsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  mealTotalsValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0f172a',
  },
  mealTotalsMeta: {
    fontSize: 12,
    fontWeight: '800',
    color: '#14532d',
    textAlign: 'right',
    flexShrink: 1,
  },
  mealRowTag: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e8f5ec',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  mealRowTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#166534',
  },
  mealName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  mealMacroText: {
    color: AppColors.primaryDark,
    fontWeight: '800',
    fontSize: 13,
  },
  topRightBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  premiumLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400e',
    letterSpacing: 0.4,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  pointsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
  },
  pointsValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#92400e',
  },
  bigText: {
    fontSize: 32,
    fontWeight: '900',
    color: AppColors.primary,
    marginBottom: 4,
  },
  sparkContainer: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    position: 'relative',
  },
  sparkBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 18,
    bottom: 18,
    borderRadius: 18,
    backgroundColor: '#eef8f1',
  },
  sparkBlob: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8be0a9',
  },
  sparkDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1f2b33',
  },
  sparkLabels: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sparkLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '700',
  },
  sparkHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sparkStat: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.primaryDark,
  },
  sparkFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  sparkFooterPill: {
    flex: 1,
    backgroundColor: '#f5f7ff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e1e7ff',
  },
  sparkFooterLabel: {
    fontSize: 11,
    color: AppColors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sparkFooterValue: {
    fontSize: 13,
    color: AppColors.text,
    fontWeight: '800',
    marginTop: 2,
  },
  progressGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  leaderboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leaderboardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6eaf0',
    marginBottom: 8,
  },
  leaderboardRowSelf: {
    borderColor: '#bfe8d0',
  },
  leaderboardRank: {
    width: 36,
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.primaryDark,
  },
  leaderboardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  leaderboardEmail: {
    fontSize: 11,
    color: '#6b7280',
  },
  leaderboardPoints: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f2b33',
  },
  leaderboardPointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: '#e7e7e7',
  },
  // Quick Action Buttons
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  quickActionBtnOuter: {
    flex: 1,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
  },
  quickActionBtn: {
    minHeight: 104,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  quickActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  quickActionTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  quickActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'left',
    marginBottom: 2,
    lineHeight: 18,
  },
  quickActionBtnSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 13,
  },
  mealSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  mealPill: {
    flex: 1,
    backgroundColor: '#f5f7ff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e1e7ff',
  },
  mealPillAlt: {
    flex: 1,
    backgroundColor: '#f6f8f2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5edd8',
  },
  mealPillLabel: {
    fontSize: 11,
    color: AppColors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mealPillValue: {
    fontSize: 12,
    color: AppColors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealMacroText: {
    color: AppColors.textSecondary,
    fontWeight: '700',
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    fontSize: 13,
    color: '#1f2b33',
  },
  feedbackLatestBox: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e7ecf3',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  feedbackLatestTitle: { fontSize: 12, fontWeight: '800', color: AppColors.textMuted, textTransform: 'uppercase' },
  feedbackLatestMessage: { fontSize: 13, color: '#1f2b33', lineHeight: 18 },
  feedbackMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feedbackStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  feedbackAuthor: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  feedbackReplyBox: {
    borderWidth: 1,
    borderColor: '#d0f0c0',
    backgroundColor: '#f3fff5',
    borderRadius: 10,
    padding: 10,
  },
  feedbackReplyLabel: { fontSize: 12, fontWeight: '800', color: '#1e5a27', marginBottom: 4 },
  feedbackReplyText: { fontSize: 12, color: '#23412a', lineHeight: 18 },
  pendingReply: { fontSize: 12, color: '#999999', fontStyle: 'italic' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  feedbackActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  feedbackActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedbackActionText: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  viewAllLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllLinkText: { color: AppColors.primary, fontWeight: '800', fontSize: 13 },
  ctaButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: AppColors.text,
  },
  logoutButton: {
    marginTop: 16,
    backgroundColor: '#fff1f0',
    borderWidth: 1,
    borderColor: '#ffd7d5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  logoutButtonText: { color: '#ff3b30', fontWeight: '800' },
});

