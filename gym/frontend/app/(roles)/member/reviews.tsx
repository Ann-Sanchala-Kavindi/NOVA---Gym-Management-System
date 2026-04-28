import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { getAuthState } from '@/lib/auth-state';
import {
  createReview,
  deleteReview,
  getReviewSummary,
  getReviews,
  reportReview,
  type FlagCategory,
  type Review,
  type ReviewCategory,
  type ReviewSummary,
} from '@/lib/review-api';
import { memberApi } from '@/lib/member-api';
import { AppColors } from '@/constants/theme';

const FLAG_CATEGORIES: FlagCategory[] = [
  'Inappropriate Language',
  'Harassment / Abuse',
  'Hate / Discrimination',
  'Sexual / Explicit Content',
  'Spam / Misleading',
  'Other',
];



const REVIEW_CATEGORIES: ReviewCategory[] = [
  'Equipment',
  'Cleanliness',
  'Trainer Support',
  'Meal Guidance',
  'Class Experience',
  'App Experience',
  'General',
];

const getRelatedFeature = (category: ReviewCategory) => {
  switch (category) {
    case 'Equipment':
      return 'equipment';
    case 'Meal Guidance':
      return 'meal-plan';
    case 'Trainer Support':
      return 'workout-plan';
    default:
      return 'general';
  }
};

type ReviewNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange?.(n)} disabled={!onChange}>
          <MaterialCommunityIcons
            name={n <= value ? 'star' : 'star-outline'}
            size={24}
            color={n <= value ? AppColors.gold : '#ccc'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SentimentBadge({ sentiment }: { sentiment: Review['sentiment'] }) {
  const map = {
    positive: { color: AppColors.primary, bg: AppColors.successLight, label: 'Positive' },
    neutral: { color: '#856404', bg: AppColors.warningLight, label: 'Neutral' },
    negative: { color: AppColors.error, bg: AppColors.dangerLight, label: 'Negative' },
  };
  const s = map[sentiment];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function RemovedReviewCard({ review }: { review: Review }) {
  return (
    <View style={[styles.card, styles.removedCard]}>
      <View style={styles.removedHeader}>
        <View style={styles.removedIconWrap}>
          <MaterialCommunityIcons name="shield-alert-outline" size={18} color={AppColors.error} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.removedTitle}>Removed by admin</Text>
          <Text style={styles.removedSubtitle}>
            {review.removedAt ? new Date(review.removedAt).toLocaleString() : 'Recently removed'}
          </Text>
        </View>
      </View>

      <View style={styles.reviewMetaRow}><View style={styles.categoryPill}><Text style={styles.categoryPillText}>{review.category || 'General'}</Text></View></View>
      <Text style={styles.cardTopic}>{review.topic || 'Review'}</Text>
      <Text style={styles.removedReason}>
        {review.removalReason?.trim()
          ? `Reason: ${review.removalReason}`
          : 'Your review was removed because it did not meet the review guidelines.'}
      </Text>

      {review.reply?.message ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Management Reply</Text>
          <Text style={styles.replyText}>{review.reply.message}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewCard({
  review,
  token,
  role,
  currentUserId,
  onAction,
}: {
  review: Review;
  token: string;
  role?: string;
  currentUserId?: string | null;
  onAction: () => void;
}) {
  const [showFlag, setShowFlag] = useState(false);
  const [flagCat, setFlagCat] = useState<FlagCategory>('Other');
  const [flagNote, setFlagNote] = useState('');
  const [flagging, setFlagging] = useState(false);

  const normalizedCurrentUserId = currentUserId ? String(currentUserId) : '';
  const normalizedReviewUserId = review.userId ? String(review.userId) : '';
  const normalizedReviewUserName = (review.userName || '').trim().toLowerCase();
  const isOwner = !!(
    (normalizedReviewUserId && normalizedCurrentUserId && normalizedReviewUserId === normalizedCurrentUserId) ||
    (!normalizedReviewUserId && normalizedReviewUserName && normalizedReviewUserName === String(currentUserId || '').trim().toLowerCase())
  );

  const handleFlag = async () => {
    setFlagging(true);
    try {
      if (!token) {
        Alert.alert('Login required', 'Please log in again to report this review.');
        return;
      }
      await reportReview(review._id, { category: flagCat, note: flagNote }, token);
      Alert.alert('Reported', 'Thank you for your report. Our team will review it.');
      setShowFlag(false);
      onAction();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setFlagging(false);
    }
  };

  const performDelete = async () => {
    try {
      const reason = role === 'admin' ? 'Removed by admin moderation.' : undefined;
      await deleteReview(review._id, token, reason);
      onAction();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDelete = () => {
    const title = role === 'admin' ? 'Remove Review' : 'Delete Review';
    const promptText = role === 'admin'
      ? 'Are you sure you want to remove this review?'
      : 'Delete your review? This cannot be undone.';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`${title}

${promptText}`);
      if (confirmed) {
        void performDelete();
      }
      return;
    }

    Alert.alert(title, promptText, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: role === 'admin' ? 'Remove' : 'Delete',
        style: 'destructive',
        onPress: () => {
          void performDelete();
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{review.userName || 'Anonymous'}</Text>
          <Text style={styles.cardCountry}>{review.country || ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <StarRating value={review.rating} />
          <SentimentBadge sentiment={review.sentiment} />
        </View>
      </View>

      <View style={styles.reviewMetaRow}><View style={styles.categoryPill}><Text style={styles.categoryPillText}>{review.category || 'General'}</Text></View></View>
      <Text style={styles.cardTopic}>{review.topic || ''}</Text>
      <Text style={styles.cardComment}>{review.comment || ''}</Text>

      {review.recommended && (
        <View style={styles.recommendedRow}>
          <MaterialCommunityIcons name="thumb-up" size={14} color={AppColors.primary} />
          <Text style={styles.recommendedText}>Recommends this gym</Text>
        </View>
      )}

      {review.reply?.message && (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Management Reply</Text>
          <Text style={styles.replyText}>{review.reply.message}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {role !== 'admin' && !isOwner && (
            <TouchableOpacity
              onPress={() => {
                if (review.hasReportedByCurrentUser) {
                  Alert.alert('Already reported', 'You have already reported this review.');
                  return;
                }
                setShowFlag(true);
              }}
              style={[styles.iconBtn, review.hasReportedByCurrentUser && { opacity: 0.55 }]}
            >
              <MaterialCommunityIcons name={review.hasReportedByCurrentUser ? 'flag' : 'flag-outline'} size={18} color={review.hasReportedByCurrentUser ? AppColors.error : AppColors.textMuted} />
            </TouchableOpacity>
          )}
          {(role === 'admin' || isOwner) && (
            <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={AppColors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal visible={showFlag} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Report Review</Text>
            {FLAG_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catRow, flagCat === cat && styles.catRowActive]}
                onPress={() => setFlagCat(cat)}
              >
                <MaterialCommunityIcons
                  name={flagCat === cat ? 'radiobox-marked' : 'radiobox-blank'}
                  size={18}
                  color={flagCat === cat ? AppColors.primary : '#999'}
                />
                <Text style={styles.catLabel}>{cat}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.noteInput}
              placeholder="Additional note (optional)"
              value={flagNote}
              onChangeText={setFlagNote}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFlag(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleFlag} disabled={flagging}>
                <Text style={styles.submitBtnText}>{flagging ? 'Sending…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const authState = getAuthState();
  const token = authState?.token || '';
  const role = authState?.user?.role || 'member';
  const userName = authState?.user?.name || authState?.user?.fullName || 'Member';
  const currentUserId = (authState?.user as any)?._id || (authState?.user as any)?.id || null;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRemovedReviews, setMyRemovedReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviewNotifications, setReviewNotifications] = useState<ReviewNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationBusyId, setNotificationBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');

  const [showWrite, setShowWrite] = useState(false);
  const [category, setCategory] = useState<ReviewCategory>('General');
  const [topic, setTopic] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const data = await memberApi.getNotifications(token);
      const reviewRelatedTypes = new Set(['review-reply', 'review-removed', 'review-flagged']);
      const reviewRelated = (data.notifications || [])
        .filter((item) => {
          if (reviewRelatedTypes.has(item.type)) return true;
          const blob = `${item.title} ${item.message}`.toLowerCase();
          return blob.includes('review');
        });
      setReviewNotifications(reviewRelated);
    } catch {
      // ignore notification load failures in this screen
    }
  }, [token]);

  const loadData = useCallback(async () => {
    try {
      const jobs: Promise<any>[] = [getReviews(filter, 'public', token), getReviewSummary(token)];
      if (token) {
        jobs.push(getReviews('all', 'mine', token));
      }
      const result = await Promise.all(jobs);
      const publicReviews = result[0] as Review[];
      const reviewSummary = result[1] as ReviewSummary;
      const mine = (result[2] as Review[] | undefined) || [];

      setReviews(publicReviews);
      setSummary(reviewSummary);
      setMyRemovedReviews(mine.filter((item) => item.adminStatus === 'removed'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }, [filter, token]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadData(), loadNotifications()]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [loadData, loadNotifications]);

  useEffect(() => {
    setLoading(true);
    refreshAll();
  }, [refreshAll]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  const handleSubmitReview = async () => {
    if (!topic.trim() || !comment.trim() || rating === 0) {
      Alert.alert('Missing fields', 'Please fill in topic, comment and rating.');
      return;
    }
    setSubmitting(true);
    try {
      await createReview({ userName, category, relatedFeature: getRelatedFeature(category), topic, comment, rating }, token);
      Alert.alert('Thank you!', 'Your review has been submitted.');
      setShowWrite(false);
      setCategory('General');
      setTopic('');
      setComment('');
      setRating(0);
      refreshAll();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'positive', label: '😊 Positive' },
    { key: 'neutral', label: '😐 Neutral' },
    { key: 'negative', label: '😞 Negative' },
  ];

  const unreadReviewNotificationCount = useMemo(
    () => reviewNotifications.filter((item) => !item.isRead).length,
    [reviewNotifications]
  );

  const handleToggleNotification = async (item: ReviewNotification) => {
    if (!token) return;

    setNotificationBusyId(item.id);
    try {
      await memberApi.setNotificationReadState(item.id, !item.isRead, token);
      setReviewNotifications((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: !item.isRead } : entry))
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update notification.');
    } finally {
      setNotificationBusyId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Reviews & Ratings</Text>
          {unreadReviewNotificationCount > 0 ? (
            <Text style={styles.headerSubtext}>
              {unreadReviewNotificationCount} new review update{unreadReviewNotificationCount > 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={styles.headerSubtextMuted}>Your review updates and community ratings are here</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.notificationBell} onPress={() => setShowNotifications(true)}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={AppColors.primary} />
            {unreadReviewNotificationCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadReviewNotificationCount > 9 ? '9+' : unreadReviewNotificationCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity style={styles.writeBtn} onPress={() => setShowWrite(true)}>
            <MaterialCommunityIcons name="pencil-plus" size={18} color="#fff" />
            <Text style={styles.writeBtnText}>Write</Text>
          </TouchableOpacity>
        </View>
      </View>

      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryRating}>
              <Text style={styles.summaryRatingNum}>{summary.averageRating.toFixed(1)}</Text>
              <StarRating value={Math.round(summary.averageRating)} />
              <Text style={styles.summaryTotal}>{summary.totalReviews} reviews</Text>
            </View>
            <View style={styles.summaryStats}>
              <Text style={styles.summaryStatItem}>
                <Text style={{ color: AppColors.primary }}>●</Text> {summary.positiveCount} Positive
              </Text>
              <Text style={styles.summaryStatItem}>
                <Text style={{ color: '#856404' }}>●</Text> {summary.neutralCount} Neutral
              </Text>
              <Text style={styles.summaryStatItem}>
                <Text style={{ color: AppColors.error }}>●</Text> {summary.negativeCount} Negative
              </Text>
              <Text style={styles.summaryStatItem}>👍 {summary.recommendationPercentage}% recommend</Text>
            </View>
          </View>
          {summary.quickSummary ? <Text style={styles.summaryAI}>{summary.quickSummary}</Text> : null}
          {!!summary.categoryBreakdown && Object.keys(summary.categoryBreakdown).length > 0 ? (
            <View style={styles.categoryBreakdownWrap}>
              {Object.entries(summary.categoryBreakdown).map(([key, value]) => (
                <View key={key} style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>{key}: {value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}

      {myRemovedReviews.length > 0 && (
        <View style={styles.removedSection}>
          <Text style={styles.removedSectionTitle}>Updates on your reviews</Text>
          <Text style={styles.removedSectionSubtitle}>
            These reviews are hidden from the public because an admin removed them.
          </Text>
          {myRemovedReviews.map((review) => (
            <RemovedReviewCard key={review._id} review={review} />
          ))}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={AppColors.primary} size="large" />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r._id}
          renderItem={({ item }) => (
            <ReviewCard review={item} token={token} role={role} currentUserId={currentUserId} onAction={refreshAll} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={AppColors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No public reviews yet. Be the first!</Text>}
        />
      )}

      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.notificationModalBox]}>
            <View style={styles.notificationModalHeader}>
              <View>
                <Text style={styles.modalTitle}>Review Notifications</Text>
                <Text style={styles.notificationModalSubtitle}>
                  Tap a notification to mark it as read or unread.
                </Text>
              </View>
              <TouchableOpacity style={styles.closeIconBtn} onPress={() => setShowNotifications(false)}>
                <MaterialCommunityIcons name="close" size={20} color={AppColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {reviewNotifications.length === 0 ? (
              <View style={styles.notificationEmptyState}>
                <MaterialCommunityIcons name="bell-off-outline" size={28} color={AppColors.textMuted} />
                <Text style={styles.notificationEmptyTitle}>No review notifications yet</Text>
                <Text style={styles.notificationEmptyText}>
                  When your reviews get replies, updates, or moderation actions, they will appear here.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.notificationList}>
                  {reviewNotifications.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.notificationItemCard, !item.isRead && styles.notificationItemCardUnread]}
                    >
                      <View style={styles.notificationItemTopRow}>
                        <View style={[styles.notificationDot, !item.isRead && styles.notificationDotUnread]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.notificationTitle}>{item.title}</Text>
                          <Text style={styles.notificationTime}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.markBtn, item.isRead && styles.markBtnMuted]}
                          onPress={() => handleToggleNotification(item)}
                          disabled={notificationBusyId === item.id}
                        >
                          <Text style={[styles.markBtnText, item.isRead && styles.markBtnTextMuted]}>
                            {notificationBusyId === item.id
                              ? 'Saving…'
                              : item.isRead
                              ? 'Mark unread'
                              : 'Mark read'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.notificationMessage}>{item.message}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showWrite} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Write a Review</Text>

              <Text style={styles.fieldLabel}>Your Rating *</Text>
              <StarRating value={rating} onChange={setRating} />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChooser}>
                {REVIEW_CATEGORIES.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.filterChip, category === item && styles.filterChipActive]}
                    onPress={() => setCategory(item)}
                  >
                    <Text style={[styles.filterChipText, category === item && styles.filterChipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Topic *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Amazing trainers, Great equipment…"
                value={topic}
                onChangeText={setTopic}
                maxLength={60}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Your Review *</Text>
              <TextInput
                style={[styles.textInput, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Share your experience…"
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={500}
              />
              <Text style={styles.charCount}>{comment.length}/500</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowWrite(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitReview} disabled={submitting}>
                  <Text style={styles.submitBtnText}>{submitting ? 'Submitting…' : 'Submit'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: AppColors.neutralMedium,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: AppColors.text },
  headerSubtext: { marginTop: 2, fontSize: 12, color: AppColors.primaryDark, fontWeight: '600' },
  headerSubtextMuted: { marginTop: 2, fontSize: 12, color: AppColors.textMuted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationBell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AppColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: AppColors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppColors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  writeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  notificationModalBox: { maxHeight: '78%', paddingTop: 20 },
  notificationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  notificationModalSubtitle: { fontSize: 12, color: AppColors.textMuted, marginTop: -8 },
  closeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: AppColors.neutralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationList: { gap: 10 },
  notificationItemCard: {
    backgroundColor: AppColors.neutralLight,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.neutralMedium,
  },
  notificationItemCardUnread: {
    backgroundColor: '#eef6ff',
    borderColor: AppColors.primaryLight,
  },
  notificationItemTopRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notificationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppColors.neutralMedium,
    marginTop: 5,
  },
  notificationDotUnread: { backgroundColor: AppColors.primary },
  notificationTitle: { fontSize: 13, fontWeight: '700', color: AppColors.text },
  notificationTime: { fontSize: 11, color: AppColors.textMuted, marginTop: 2 },
  notificationMessage: { fontSize: 12, color: AppColors.textSecondary, lineHeight: 18, marginTop: 2 },
  markBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: AppColors.primary,
  },
  markBtnMuted: {
    backgroundColor: AppColors.neutralMedium,
  },
  markBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markBtnTextMuted: { color: AppColors.textSecondary },
  notificationEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
    paddingHorizontal: 10,
  },
  notificationEmptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.text,
  },
  notificationEmptyText: {
    marginTop: 8,
    fontSize: 12,
    color: AppColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  summaryCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  summaryRating: { alignItems: 'center', gap: 4 },
  summaryRatingNum: { fontSize: 36, fontWeight: '800', color: AppColors.text },
  summaryTotal: { fontSize: 12, color: AppColors.textMuted, marginTop: 2 },
  summaryStats: { flex: 1, gap: 4 },
  summaryStatItem: { fontSize: 13, color: AppColors.textSecondary },
  summaryAI: {
    marginTop: 12,
    fontSize: 13,
    color: AppColors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: AppColors.neutralMedium,
    paddingTop: 10,
  },
  removedSection: {
    marginHorizontal: 16,
    marginBottom: 6,
    gap: 10,
  },
  removedSectionTitle: { fontSize: 15, fontWeight: '800', color: AppColors.text },
  removedSectionSubtitle: { fontSize: 12, color: AppColors.textMuted, lineHeight: 18 },
  removedCard: {
    borderWidth: 1,
    borderColor: AppColors.dangerLight,
    backgroundColor: '#fff7f7',
  },
  removedHeader: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  removedIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removedTitle: { fontSize: 14, fontWeight: '800', color: AppColors.error },
  removedSubtitle: { fontSize: 12, color: AppColors.textMuted, marginTop: 2 },
  removedReason: { fontSize: 13, color: AppColors.textSecondary, lineHeight: 20 },
  filterRow: { maxHeight: 48, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AppColors.neutralMedium,
  },
  filterChipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  filterChipText: { fontSize: 13, color: AppColors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: AppColors.text },
  cardCountry: { fontSize: 12, color: AppColors.textMuted, marginTop: 2 },
  cardTopic: { fontSize: 14, fontWeight: '700', color: AppColors.primary, marginBottom: 4 },
  cardComment: { fontSize: 14, color: AppColors.textSecondary, lineHeight: 20 },
  recommendedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  recommendedText: { fontSize: 12, color: AppColors.primary, fontWeight: '600' },
  replyBox: {
    marginTop: 10,
    backgroundColor: AppColors.primaryLight,
    borderRadius: 10,
    padding: 10,
  },
  replyLabel: { fontSize: 11, fontWeight: '700', color: AppColors.primaryDark, marginBottom: 4 },
  replyText: { fontSize: 13, color: AppColors.text, lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  cardDate: { fontSize: 12, color: AppColors.textMuted },
  iconBtn: { padding: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: AppColors.textMuted, marginTop: 40, fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: AppColors.text, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: AppColors.text, marginBottom: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: AppColors.neutralMedium,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: AppColors.text,
    backgroundColor: AppColors.neutralLight,
  },
  charCount: { fontSize: 11, color: AppColors.textMuted, textAlign: 'right', marginTop: 4 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  catRowActive: { backgroundColor: AppColors.primaryLight },
  catLabel: { fontSize: 13, color: AppColors.textSecondary },
  noteInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: AppColors.neutralMedium,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    color: AppColors.text,
    backgroundColor: AppColors.neutralLight,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.neutralMedium,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: AppColors.textSecondary },
  submitBtn: {
    flex: 1,
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
