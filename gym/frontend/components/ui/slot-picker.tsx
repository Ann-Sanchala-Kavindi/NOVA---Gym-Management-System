import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, FlatList, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';
import { bookingApi, BookingSlot } from '@/lib/booking-api';
import { SurfaceCard } from './trainer-dashboard';

interface SlotPickerProps {
  trainerId: string;
  trainerName: string;
  date: string;
  token: string;
  onSlotSelected: (slot: BookingSlot) => void;
}

export function SlotPicker({ trainerId, trainerName, date, token, onSlotSelected }: SlotPickerProps) {
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);

  const loadSlots = useCallback(async () => {
    try {
      setLoading(true);
      const response = await bookingApi.getAvailableSlots(trainerId, date, token);
      setSlots(response.slots || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load slots';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [trainerId, date, token]);

  React.useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const handleSelectSlot = (slot: BookingSlot) => {
    setSelectedSlot(slot);
    onSlotSelected(slot);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Loading available slots...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-tie" size={20} color={AppColors.primary} />
        <Text style={styles.headerText}>{trainerName}</Text>
      </View>

      {slots.length > 0 ? (
        <FlatList
          scrollEnabled={false}
          data={slots}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.slotCard,
                selectedSlot?._id === item._id && styles.slotCardSelected,
              ]}
              onPress={() => handleSelectSlot(item)}
            >
              <View style={styles.slotContent}>
                <View style={styles.slotTime}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={AppColors.primary} />
                  <Text style={styles.slotTimeText}>
                    {item.startTime} - {item.endTime}
                  </Text>
                </View>
                <View style={styles.slotDuration}>
                  <Text style={styles.slotDurationText}>{item.slotDurationMinutes} mins</Text>
                </View>
              </View>

              {selectedSlot?._id === item._id && (
                <View style={styles.checkmark}>
                  <MaterialCommunityIcons name="check-circle" size={24} color={AppColors.primary} />
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      ) : (
        <SurfaceCard>
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color="#ddd" />
            <Text style={styles.emptyStateText}>No available slots for this date</Text>
          </View>
        </SurfaceCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2b33',
  },
  slotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  slotCardSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
  },
  slotContent: {
    flex: 1,
    gap: 8,
  },
  slotTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotTimeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2b33',
  },
  slotDuration: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotDurationText: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
  },
  checkmark: {
    marginLeft: 8,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 13,
    color: '#999999',
    fontWeight: '500',
  },
});
