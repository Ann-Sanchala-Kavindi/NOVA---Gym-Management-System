import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';
import { getAuthState } from '@/lib/auth-state';
import { bookingApi, type BookingRecord } from '@/lib/booking-api';
import { memberApi, type MemberProfile } from '@/lib/member-api';
import { PageHeader } from '@/components/ui/trainer-dashboard';

type TabType = 'pending-requests' | 'my-bookings';

export default function MyBookingsPage() {
  const router = useRouter();
  const { token } = getAuthState();
  const [activeTab, setActiveTab] = useState<TabType>('pending-requests');
  const [loading, setLoading] = useState(false);
  const [assignedTrainer, setAssignedTrainer] = useState<{ name: string; specialization?: string } | null>(null);
  const [pendingBookings, setPendingBookings] = useState<BookingRecord[]>([]);
  const [confirmedBookings, setConfirmedBookings] = useState<BookingRecord[]>([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    try {
      setLoading(true);
      const profile = (await memberApi.getProfile(token)) as MemberProfile;
      if (profile?.assignedTrainerName) {
        setAssignedTrainer({
          name: profile.assignedTrainerName,
          specialization: profile.assignedTrainerSpecialization || undefined,
        });
      }

      const [pending, confirmed] = await Promise.all([
        bookingApi.getMemberBookings(token, 'pending'),
        bookingApi.getMemberBookings(token, 'confirmed'),
      ]);

      setPendingBookings(Array.isArray(pending) ? pending : []);
      setConfirmedBookings(Array.isArray(confirmed) ? confirmed : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load bookings';
      if (!message.toLowerCase().includes('assigned trainer')) {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const openCancelModal = (booking: BookingRecord) => {
    setSelectedBooking(booking);
    setShowCancelModal(true);
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking || !token) return;

    try {
      setCancelling(true);
      await bookingApi.cancelBooking(
        selectedBooking._id,
        cancellationReason.trim() || 'Cancelled by member',
        token
      );
      Alert.alert('Success', 'Booking cancelled');
      setShowCancelModal(false);
      setSelectedBooking(null);
      setCancellationReason('');
      loadBookings();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel booking';
      Alert.alert('Error', message);
    } finally {
      setCancelling(false);
    }
  };

  const renderBooking = (booking: BookingRecord) => {
    const isPending = booking.status === 'pending';
    const statusLabel = isPending ? 'Pending Request' : 'Confirmed';
    const statusColor = isPending ? '#f39c12' : '#3498db';

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.bookingTitleWrap}>
            <View style={styles.trainerAvatar}>
              <MaterialCommunityIcons name="dumbbell" size={18} color={AppColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trainerName}>{booking.trainerId?.name || 'Trainer'}</Text>
              <Text style={styles.sessionName}>{booking.sessionName}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <MaterialCommunityIcons name={isPending ? 'clock-outline' : 'check-circle'} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="calendar" size={14} color="#999" />
            <Text style={styles.detailText}>{booking.date}</Text>
          </View>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="clock" size={14} color="#999" />
            <Text style={styles.detailText}>{booking.startTime} - {booking.endTime}</Text>
          </View>
        </View>

        {booking.status === 'pending' && (
          <View style={styles.pendingNote}>
            <MaterialCommunityIcons name="information-outline" size={14} color="#9a6700" />
            <Text style={styles.pendingNoteText}>Waiting for trainer approval.</Text>
          </View>
        )}

        <TouchableOpacity style={styles.cancelButton} onPress={() => openCancelModal(booking)}>
          <MaterialCommunityIcons name="close" size={14} color="#e74c3c" />
          <Text style={styles.cancelButtonText}>Cancel Booking</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const currentBookings = activeTab === 'pending-requests' ? pendingBookings : confirmedBookings;

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title="My Bookings"
        subtitle={
          assignedTrainer
            ? `with ${assignedTrainer.name}${assignedTrainer.specialization ? ` • ${assignedTrainer.specialization}` : ''}`
            : 'No assigned trainer yet'
        }
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))}
      />

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending-requests' && styles.tabActive]}
          onPress={() => setActiveTab('pending-requests')}
        >
          <Text style={[styles.tabText, activeTab === 'pending-requests' && styles.tabTextActive]}>
            Pending Requests ({pendingBookings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-bookings' && styles.tabActive]}
          onPress={() => setActiveTab('my-bookings')}
        >
          <Text style={[styles.tabText, activeTab === 'my-bookings' && styles.tabTextActive]}>
            My Bookings ({confirmedBookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <View style={styles.contentPadding}>
            {currentBookings.length > 0 ? (
              <FlatList
                scrollEnabled={false}
                data={currentBookings}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => renderBooking(item)}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              />
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank" size={48} color="#ddd" />
                <Text style={styles.emptyStateText}>
                  {activeTab === 'pending-requests' ? 'No pending requests yet' : 'No confirmed bookings yet'}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  {activeTab === 'pending-requests'
                    ? 'When you book a session, it will appear here until your trainer confirms it.'
                    : 'Confirmed bookings will appear here after your trainer approves them.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancel Booking</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCancelModal(false);
                  setSelectedBooking(null);
                  setCancellationReason('');
                }}
              >
                <MaterialCommunityIcons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <>
                <View style={styles.bookingDetailBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Trainer</Text>
                    <Text style={styles.detailValue}>{selectedBooking.trainerId?.name || 'Trainer'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time</Text>
                    <Text style={styles.detailValue}>
                      {selectedBooking.date} • {selectedBooking.startTime}-{selectedBooking.endTime}
                    </Text>
                  </View>
                </View>

                <View style={styles.reasonContainer}>
                  <Text style={styles.reasonLabel}>Reason for Cancellation (Optional)</Text>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="Why are you cancelling this booking?"
                    value={cancellationReason}
                    onChangeText={setCancellationReason}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#ccc"
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#e9ecef' }]}
                    onPress={() => {
                      setShowCancelModal(false);
                      setSelectedBooking(null);
                      setCancellationReason('');
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: '#666' }]}>DISMISS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#e74c3c' }]}
                    onPress={handleCancelBooking}
                    disabled={cancelling}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                      {cancelling ? 'CANCELLING...' : 'CANCEL BOOKING'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2b33',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  trainerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  trainerInfoText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: AppColors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: AppColors.primary,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 4,
    textAlign: 'center',
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  bookingTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  trainerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  trainerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2b33',
    marginBottom: 2,
  },
  sessionName: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  pendingNote: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  pendingNoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9a6700',
  },
  cancelButton: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e74c3c',
  },
  modalButtonText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2b33',
    marginBottom: 4,
  },
  bookingDetailBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2b33',
  },
  reasonContainer: {
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2b33',
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    fontWeight: '700',
  },
  cancelButtonStyle: {
    backgroundColor: '#e9ecef',
  },
  cancelButtonTextStyle: {
    color: '#666',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmButtonStyle: {
    backgroundColor: AppColors.primary,
  },
  confirmButtonTextStyle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
