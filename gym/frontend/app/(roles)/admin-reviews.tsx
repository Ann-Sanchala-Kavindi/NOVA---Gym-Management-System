import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';
import { getAuthState } from '@/lib/auth-state';
import {
  deleteReview,
  getReviewSummary,
  getReviews,
  replyToReview,
  updateReviewStatus,
  type Review,
  type ReviewSummary,
} from '@/lib/review-api';

type Visibility = 'all' | 'flagged' | 'reported' | 'unflagged';

function StarRow({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialCommunityIcons key={n} name={n <= value ? 'star' : 'star-outline'} size={16} color={n <= value ? AppColors.gold : '#d1d5db'} />
      ))}
    </View>
  );
}

export default function AdminReviewsPage() {
  const router = useRouter();
  const authState = getAuthState();
  const token = authState?.token || '';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('all');
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const load = useCallback(async (showLoader = true) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    try {
      const [reviewData, summaryData] = await Promise.all([
        getReviews('all', visibility, token),
        getReviewSummary(token),
      ]);
      setReviews(reviewData || []);
      setSummary(summaryData || null);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, visibility]);

  useEffect(() => { load(); }, [load]);

  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((item) =>
      `${item.userName} ${item.country} ${item.topic} ${item.comment}`.toLowerCase().includes(q)
    );
  }, [reviews, search]);

  const onRefresh = () => { setRefreshing(true); load(false); };

  const openReplyModal = (review: Review) => {
    setSelectedReview(review);
    setReplyMessage(review.reply?.message || '');
    setReplyModalVisible(true);
  };

  const handleReply = async () => {
    if (!token || !selectedReview) return;
    if (!replyMessage.trim()) {
      Alert.alert('Reply required', 'Please enter a reply message.');
      return;
    }
    setBusyId(selectedReview._id);
    try {
      await replyToReview(selectedReview._id, { message: replyMessage.trim() }, token);
      setReplyModalVisible(false);
      setSelectedReview(null);
      setReplyMessage('');
      load(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to reply');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (reviewId: string, status: 'visible' | 'flagged' | 'removed') => {
    setBusyId(reviewId);
    try {
      await updateReviewStatus(reviewId, status, token);
      load(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (review: Review) => {
    setSelectedReview(review);
    setDeleteReason(review.removalReason || '');
    setDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    if (!token || !selectedReview) return;
    setBusyId(selectedReview._id);
    try {
      await deleteReview(selectedReview._id, token, deleteReason.trim() || undefined);
      setDeleteModalVisible(false);
      setSelectedReview(null);
      setDeleteReason('');
      load(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to remove review');
    } finally {
      setBusyId(null);
    }
  };

  const summaryCards = [
    { label: 'Total', value: summary?.totalReviews || 0, icon: 'message-text-outline' },
    { label: 'Avg Rating', value: summary?.averageRating?.toFixed(1) || '0.0', icon: 'star-outline' },
    { label: 'Reported', value: summary?.reportedCount || 0, icon: 'flag-outline' },
    { label: 'Pending Replies', value: summary?.pendingReply || 0, icon: 'reply-outline' },
    { label: 'Unresolved', value: summary?.unresolvedCount || 0, icon: 'alert-circle-outline' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={AppColors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Ratings & Reviews</Text>
          <Text style={styles.headerSub}>Manage member reviews, replies, and moderation</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 80 }} color={AppColors.primary} size="large" />
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppColors.primary]} />}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 8 }}>
              <View style={styles.summaryGrid}>
                {summaryCards.map((item) => (
                  <View key={item.label} style={styles.summaryCard}>
                    <MaterialCommunityIcons name={item.icon as any} size={18} color={AppColors.primaryDark} />
                    <Text style={styles.summaryValue}>{item.value}</Text>
                    <Text style={styles.summaryLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.bigCard}>
                <Text style={styles.bigCardTitle}>Summary</Text>
                <Text style={styles.bigCardText}>{summary?.quickSummary || 'No summary available yet.'}</Text>
                <Text style={styles.bigCardSub}>Positive {summary?.positiveCount || 0} · Neutral {summary?.neutralCount || 0} · Negative {summary?.negativeCount || 0}</Text>
                {!!summary?.categoryBreakdown && Object.keys(summary.categoryBreakdown).length > 0 ? (
                  <Text style={styles.bigCardSub}>
                    {Object.entries(summary.categoryBreakdown)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' · ')}
                  </Text>
                ) : null}
                {!!summary?.featureBreakdown && Object.keys(summary.featureBreakdown).length > 0 ? (
                  <Text style={styles.bigCardSub}>
                    {Object.entries(summary.featureBreakdown)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' · ')}
                  </Text>
                ) : null}
              </View>

              <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Search by member, topic, or review text" />

              <View style={styles.filterRow}>
                {([
                  { key: 'all', label: 'All' },
                  { key: 'flagged', label: 'Flagged' },
                  { key: 'reported', label: 'Reported' },
                  { key: 'unflagged', label: 'Unflagged' },
                ] as const).map((item) => (
                  <TouchableOpacity key={item.key} style={[styles.filterChip, visibility === item.key && styles.filterChipActive]} onPress={() => setVisibility(item.key)}>
                    <Text style={[styles.filterChipText, visibility === item.key && styles.filterChipTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.userName || 'Member'}</Text>
                  <Text style={styles.meta}>{item.country || '—'} · {new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StarRow value={item.rating} />
                  <View style={[styles.statusPill, item.adminStatus === 'removed' ? styles.statusRemoved : item.adminStatus === 'flagged' ? styles.statusFlagged : styles.statusVisible]}>
                    <Text style={[styles.statusPillText, item.adminStatus === 'removed' ? { color: '#991b1b' } : item.adminStatus === 'flagged' ? { color: '#92400e' } : { color: '#166534' }]}>{item.adminStatus.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              {!!item.topic && <Text style={styles.topic}>{item.topic}</Text>}
              <Text style={styles.comment}>{item.comment}</Text>
              <Text style={styles.meta}>Category: {item.category || 'General'} · Sentiment: {item.sentiment} · Reports: {item.flagCount || 0} · Recommended: {item.recommended ? 'Yes' : 'No'}</Text>
              {item.flagReports?.length ? (
                <View style={styles.reportBox}>
                  <Text style={styles.reportTitle}>Member reports</Text>
                  {item.flagReports.map((report, idx) => (
                    <Text key={`${item._id}-report-${idx}`} style={styles.reportLine}>
                      • {report.category}{report.note ? ` — ${report.note}` : ''}
                    </Text>
                  ))}
                </View>
              ) : null}
              {item.reply?.message ? (
                <View style={styles.replyBox}>
                  <Text style={styles.replyLabel}>Management Reply</Text>
                  <Text style={styles.replyText}>{item.reply.message}</Text>
                </View>
              ) : null}
              {item.removalReason ? <Text style={styles.removalText}>Removal reason: {item.removalReason}</Text> : null}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openReplyModal(item)}>
                  <MaterialCommunityIcons name="reply-outline" size={18} color={AppColors.primaryDark} />
                  <Text style={styles.actionBtnText}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleStatus(item._id, 'visible')} disabled={busyId === item._id}>
                  <Text style={styles.actionBtnText}>Show</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleStatus(item._id, 'flagged')} disabled={busyId === item._id}>
                  <Text style={styles.actionBtnText}>Flag</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={() => confirmDelete(item)} disabled={busyId === item._id}>
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>{busyId === item._id ? 'Working...' : 'Remove'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>No reviews found.</Text></View>}
        />
      )}

      <Modal visible={replyModalVisible} transparent animationType="slide" onRequestClose={() => setReplyModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reply to Review</Text>
          <TextInput style={[styles.input, styles.textarea]} value={replyMessage} onChangeText={setReplyMessage} placeholder="Write your reply" multiline />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setReplyModalVisible(false)}><Text style={styles.secondaryBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleReply} disabled={busyId === selectedReview?._id}><Text style={styles.primaryBtnText}>{busyId === selectedReview?._id ? 'Saving...' : 'Save Reply'}</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={deleteModalVisible} transparent animationType="slide" onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Remove Review</Text>
          <TextInput style={[styles.input, styles.textarea]} value={deleteReason} onChangeText={setDeleteReason} placeholder="Optional reason shown to the member" multiline />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setDeleteModalVisible(false)}><Text style={styles.secondaryBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, styles.dangerBtn]} onPress={handleDelete} disabled={busyId === selectedReview?._id}><Text style={styles.primaryBtnText}>{busyId === selectedReview?._id ? 'Removing...' : 'Remove Review'}</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: AppColors.neutralMedium, gap: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: AppColors.text },
  headerSub: { fontSize: 12, color: AppColors.textMuted, marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexGrow: 1, minWidth: '22%', backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: AppColors.primaryDark },
  summaryLabel: { fontSize: 11, color: AppColors.textMuted, textAlign: 'center' },
  bigCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  bigCardTitle: { fontSize: 15, fontWeight: '800', color: AppColors.text, marginBottom: 8 },
  bigCardText: { fontSize: 13, color: AppColors.textSecondary, lineHeight: 20 },
  bigCardSub: { fontSize: 12, color: AppColors.textMuted, marginTop: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: AppColors.neutralMedium, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: AppColors.text },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderWidth: 1, borderColor: AppColors.neutralMedium, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: AppColors.primaryLight, borderColor: AppColors.primary },
  filterChipText: { fontSize: 12, color: AppColors.textSecondary, fontWeight: '700' },
  filterChipTextActive: { color: AppColors.primaryDark },
  reviewCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { fontSize: 15, fontWeight: '800', color: AppColors.text },
  meta: { fontSize: 12, color: AppColors.textMuted, marginTop: 3 },
  topic: { fontSize: 14, fontWeight: '700', color: AppColors.textSecondary },
  comment: { fontSize: 13, color: AppColors.textSecondary, lineHeight: 19 },
  replyBox: { backgroundColor: AppColors.primaryLight, borderRadius: 12, padding: 12 },
  replyLabel: { fontSize: 11, fontWeight: '800', color: AppColors.primaryDark, marginBottom: 4 },
  replyText: { fontSize: 13, color: AppColors.text },
  removalText: { fontSize: 12, color: AppColors.error },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusVisible: { backgroundColor: '#dcfce7' },
  statusFlagged: { backgroundColor: '#fef3c7' },
  statusRemoved: { backgroundColor: '#fee2e2' },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: AppColors.neutralMedium, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: AppColors.textSecondary },
  dangerBtn: { backgroundColor: AppColors.error, borderColor: AppColors.error },
  emptyBox: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: AppColors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: AppColors.text },
  modalActions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: AppColors.neutralMedium, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: AppColors.textSecondary, fontWeight: '700' },
  primaryBtn: { flex: 1, backgroundColor: AppColors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
