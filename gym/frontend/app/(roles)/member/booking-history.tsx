import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { bookingApi } from '@/lib/booking-api';
import { AppColors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PageHeader, SectionHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';

interface BookingRecordLocal {
  _id: string;
  trainerId: {
    _id: string;
    name: string;
    email: string;
    specialization?: string;
  };
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  sessionName: string;
  cancellationReason?: string;
  cancelledBy?: 'trainer' | 'member' | 'admin';
  bookedAt: string;
}

export default function MemberBookingHistoryPage() {
  const router = useRouter();
  const token = getAuthState().token;
  const [bookings, setBookings] = useState<BookingRecordLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecordLocal | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const response = await bookingApi.getMemberBookings(token, status);
      setBookings(Array.isArray(response) ? response : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load bookings';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, token]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const handleCancelBooking = async () => {
    if (!selectedBooking || !token) return;

    try {
      setCancelling(true);
      await bookingApi.cancelBooking(
        selectedBooking._id,
        cancellationReason || 'Cancelled by member',
        token
      );
      Alert.alert('Success', 'Booking cancelled');
      setShowCancelModal(false);
      setCancellationReason('');
      setSelectedBooking(null);
      loadBookings();
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const filteredBookings = bookings.filter(
    (b) => statusFilter === 'all' || b.status === statusFilter
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f39c12';
      case 'confirmed':
        return '#3498db';
      case 'completed':
        return '#27ae60';
      case 'cancelled':
        return '#e74c3c';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'clock-outline';
      case 'confirmed':
        return 'clock-check';
      case 'completed':
        return 'check-circle';
      case 'cancelled':
        return 'cancel';
      default:
        return 'circle';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <PageHeader
        title="My Bookings"
        subtitle="View your session history"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))}
      />

      {/* Filters */}
      <View style={styles.contentWrap}>
        <SectionHeader title="Filter by Status" />
        <View style={styles.filterRow}>
          {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                statusFilter === status && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === status && styles.filterButtonTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#fff3cd' }]}>
            <Text style={styles.statIcon}>⏳</Text>
            <Text style={styles.statValue}>{bookings.filter(b => b.status === 'pending').length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
            <Text style={styles.statIcon}>📅</Text>
            <Text style={styles.statValue}>{bookings.filter(b => b.status === 'confirmed').length}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
            <Text style={styles.statIcon}>✓</Text>
            <Text style={styles.statValue}>{bookings.filter(b => b.status === 'completed').length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Bookings List */}
        <SectionHeader title={`${filteredBookings.length} ${statusFilter === 'all' ? 'Total' : statusFilter} Booking${filteredBookings.length !== 1 ? 's' : ''}`} />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : filteredBookings.length > 0 ? (
          <FlatList
            scrollEnabled={false}
            data={filteredBookings}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <SurfaceCard>
                <View style={styles.bookingRow}>
                  <View style={styles.bookingLeft}>
                    <View style={styles.trainerAvatar}>
                      <MaterialCommunityIcons name="dumbbell" size={20} color={AppColors.primary} />
                    </View>
                    <View style={styles.bookingInfo}>
                      <Text style={styles.trainerName}>
                        {item.trainerId.name}
                      </Text>
                      <Text style={styles.sessionName}>{item.sessionName}</Text>
                      <Text style={styles.dateTime}>
                        {item.date} • {item.startTime}-{item.endTime}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) + '20' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={getStatusIcon(item.status)}
                        size={14}
                        color={getStatusColor(item.status)}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(item.status) },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>

                    {(item.status === 'pending' || item.status === 'confirmed') && (
                      <TouchableOpacity
                        style={styles.cancelActionButton}
                        onPress={() => {
                          setSelectedBooking(item);
                          setShowCancelModal(true);
                        }}
                      >
                        <MaterialCommunityIcons
                          name="delete-outline"
                          size={16}
                          color="#e74c3c"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {item.cancellationReason && (
                  <View style={styles.cancellationNote}>
                    <Text style={styles.cancellationLabel}>Cancellation Reason:</Text>
                    <Text style={styles.cancellationText}>{item.cancellationReason}</Text>
                  </View>
                )}
              </SurfaceCard>
            )}
          />
        ) : (
          <SurfaceCard>
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="calendar-blank" size={48} color="#ddd" />
              <Text style={styles.emptyStateText}>
                No {statusFilter === 'all' ? '' : statusFilter} bookings
              </Text>
            </View>
          </SurfaceCard>
        )}
      </View>

      {/* Cancel Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Booking</Text>
            <Text style={styles.modalSubtitle}>
              with {selectedBooking?.trainerId.name}
              {'\n'}
              {selectedBooking?.date} • {selectedBooking?.startTime}-{selectedBooking?.endTime}
            </Text>

            <Text style={styles.reasonLabel}>Reason (Optional)</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Why are you cancelling this session?"
              value={cancellationReason}
              onChangeText={setCancellationReason}
              multiline
              numberOfLines={3}
              placeholderTextColor="#ccc"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#e9ecef' }]}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                  setSelectedBooking(null);
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
                  {cancelling ? '...' : 'CANCEL BOOKING'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  filterButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1f2b33',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  bookingLeft: {
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
  bookingInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2b33',
    marginBottom: 2,
  },
  sessionName: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateTime: {
    fontSize: 11,
    color: '#999',
  },
  bookingRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cancelActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancellationNote: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  cancellationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cancellationText: {
    fontSize: 12,
    color: '#e74c3c',
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 13,
    color: '#999999',
    fontWeight: '500',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2b33',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#1f2b33',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
