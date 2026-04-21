import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { clearAuthState, getAuthState } from '@/lib/auth-state';
import { memberApi, MemberProfile, MembershipUpgradeRequest } from '@/lib/member-api';
import { PageHeader, PrimaryWideButton, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { AppColors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function MemberProfilePage() {
  const router = useRouter();
  const authState = getAuthState();
  const user = authState.user;
  const token = authState.token;

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [upgradeRequest, setUpgradeRequest] = useState<MembershipUpgradeRequest>(null);

  const memberType = profile?.memberType || user?.memberType || 'normal';
  const canRequestPremium = memberType === 'normal' && (!upgradeRequest || upgradeRequest.status !== 'pending');
  const upgradeStatusText = useMemo(() => {
    if (!upgradeRequest) return '';
    if (upgradeRequest.status === 'pending') return 'Premium request pending review';
    if (upgradeRequest.status === 'approved') return 'Your premium request was approved';
    if (upgradeRequest.status === 'rejected') return 'Your premium request was rejected';
    return '';
  }, [upgradeRequest]);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        Alert.alert('Login required', 'Please log in again to load your profile.');
        return;
      }

      memberApi
        .getProfile(token)
        .then((profileData) => {
          setProfile(profileData || null);
          return memberApi.getMembershipUpgradeRequest(token);
        })
        .then((upgradeReq) => {
          setUpgradeRequest(upgradeReq || null);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Failed to load profile data';
          Alert.alert('Error', message);
        });
    }, [token])
  );

  const handleLogout = () => {
    clearAuthState();
    router.replace('/(auth)/login');
  };

  const initials = useMemo(() => {
    const source = profile?.name || user?.name || 'Member';
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }, [profile, user]);

  const memberAccent = memberType === 'premium' ? ['#0f172a', '#2563eb'] : ['#111827', '#6366f1'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <PageHeader
        title="Profile"
        subtitle="Your account and personalization"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))}
      />
      <View style={styles.contentWrap}>
        <LinearGradient colors={memberAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing} />
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
              <View style={styles.avatarBadge}>
                <MaterialCommunityIcons name="check" size={12} color="#ffffff" />
              </View>
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{profile?.name || user?.name || 'Member'}</Text>
              <Text style={styles.heroEmail}>{profile?.email || user?.email || 'No email available'}</Text>
              <View style={styles.heroBadgesRow}>
                <View style={styles.heroPill}>
                  <MaterialCommunityIcons name="star-circle" size={14} color="#fbbf24" />
                  <Text style={styles.heroPillText}>{profile?.points ?? user?.points ?? 0} pts</Text>
                </View>
                <View style={[styles.heroPill, memberType === 'premium' ? styles.heroPillPremium : styles.heroPillNormal]}>
                  <MaterialCommunityIcons name="crown" size={14} color={memberType === 'premium' ? '#92400e' : '#4f46e5'} />
                  <Text style={styles.heroPillText}>{memberType.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <MaterialCommunityIcons name="account-check" size={18} color="#ffffff" />
              <Text style={styles.heroStatLabel}>Onboarding</Text>
              <Text style={styles.heroStatValue}>{profile?.onboardingCompleted || user?.onboardingCompleted ? 'Done' : 'Pending'}</Text>
            </View>
            <View style={styles.heroStatCard}>
              <MaterialCommunityIcons name="weight-lifter" size={18} color="#ffffff" />
              <Text style={styles.heroStatLabel}>Trainer</Text>
              <Text style={styles.heroStatValue}>{profile?.assignedTrainerName || 'None'}</Text>
            </View>
          </View>
        </LinearGradient>

        {upgradeStatusText ? (
          <SurfaceCard>
            <View style={styles.noticeRow}>
              <MaterialCommunityIcons name="information-outline" size={20} color={AppColors.primaryDark} />
              <Text style={styles.noticeText}>{upgradeStatusText}</Text>
            </View>
          </SurfaceCard>
        ) : null}

        <SurfaceCard>
          <Text style={styles.sectionTitle}>Member Details</Text>
          <View style={styles.detailList}>
            <DetailRow icon="email-outline" label="Email" value={profile?.email || user?.email || 'No email available'} />
            <DetailRow icon="account-outline" label="Member Type" value={memberType.toUpperCase()} />
            <DetailRow icon="account-tie-outline" label="Assigned Trainer" value={profile?.assignedTrainerName || 'Not assigned yet'} />
            {!!profile?.assignedTrainerEmail && (
              <DetailRow icon="at" label="Trainer Email" value={profile.assignedTrainerEmail} />
            )}
            {!!profile?.assignedTrainerSpecialization && (
              <DetailRow icon="dumbbell" label="Specialization" value={profile.assignedTrainerSpecialization} />
            )}
          </View>
        </SurfaceCard>

        {memberType === 'normal' && (
          <SurfaceCard>
            <Text style={styles.sectionTitle}>Premium Access</Text>
            <Text style={styles.sectionText}>
              Upgrade to premium to unlock trainer assignment and extra member features.
            </Text>
            <View style={{ marginTop: 10 }}>
              <PrimaryWideButton
                text={
                  canRequestPremium
                    ? 'REQUEST PREMIUM'
                    : upgradeRequest?.status === 'pending'
                    ? 'PREMIUM REQUESTED'
                    : 'PREMIUM STATUS'
                }
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
                color={AppColors.gold}
                textColor="#1f2937"
              />
            </View>
          </SurfaceCard>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#8a1f1f" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <MaterialCommunityIcons name={icon} size={16} color={AppColors.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f6fb' },
  contentWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  heroCard: {
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2b33',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4f46e5',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 2,
  },
  heroEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: 10,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroPillPremium: {
    backgroundColor: 'rgba(254, 243, 199, 0.96)',
  },
  heroPillNormal: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroStatLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
  },
  heroStatValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#25303a',
    fontWeight: '600',
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1f2b33',
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 13,
    color: '#5f6870',
    lineHeight: 19,
  },
  detailList: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 2,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2b33',
    fontWeight: '700',
    lineHeight: 19,
  },
  logoutButton: {
    marginTop: 4,
    backgroundColor: '#fff1f0',
    borderWidth: 1,
    borderColor: '#ffd7d5',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  logoutButtonText: { color: '#8a1f1f', fontWeight: '800' },
});
