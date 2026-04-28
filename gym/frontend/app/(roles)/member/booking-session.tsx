import React, { useCallback, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Modal,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { bookingApi, BookingSlot } from '@/lib/booking-api';
import { memberApi } from '@/lib/member-api';
import { AppColors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type BookingStep = 'trainer-selection' | 'date-selection' | 'slot-selection' | 'confirmation';

interface Trainer {
  _id: string;
  firstName: string;
  lastName: string;
  specialization?: string;
  image?: string;
}

export default function MemberBookingFlow() {
  const router = useRouter();
  const { token, user } = getAuthState();
  const MAX_BOOKING_SLOTS = 4;

  // Flow state
  const [currentStep, setCurrentStep] = useState<BookingStep>('trainer-selection');
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<BookingSlot[]>([]);
  const [sessionName, setSessionName] = useState('');

  // Data state
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [availableSlots, setAvailableSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingTrainers, setLoadingTrainers] = useState(true);

  // Load assigned trainer for this member
  useEffect(() => {
    if (!token) return;

    const loadTrainer = async () => {
      try {
        setLoadingTrainers(true);
        const profile = await memberApi.getProfile(token);

        if (profile?.assignedTrainerId) {
          const fullName = profile.assignedTrainerName || 'Assigned Trainer';
          const [firstName, ...rest] = fullName.split(' ');
          setTrainers([
            {
              _id: String(profile.assignedTrainerId),
              firstName: firstName || fullName,
              lastName: rest.join(' '),
              specialization: profile.assignedTrainerSpecialization || 'Personal Training',
            },
          ]);
        } else {
          setTrainers([]);
        }
      } catch (error) {
        setTrainers([]);
      } finally {
        setLoadingTrainers(false);
      }
    };

    loadTrainer();
  }, [token]);

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleSelectTrainer = (trainer: Trainer) => {
    setSelectedTrainer(trainer);
    setSelectedSlots([]);
    setCurrentStep('date-selection');
  };

  const handleSelectDate = async (date?: Date) => {
    if (date) setSelectedDate(date);
    setShowDatePicker(false);

    if (!selectedTrainer || !token) return;

    try {
      setLoading(true);
      const response = await bookingApi.getAvailableSlots(
        selectedTrainer._id,
        formatDate(date || selectedDate),
        token
      );
      setAvailableSlots(response.slots || []);
      setSelectedSlots([]);
      setCurrentStep('slot-selection');
    } catch (error) {
      Alert.alert('Error', 'Failed to load available slots');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSlot = (slot: BookingSlot) => {
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => s._id === slot._id);
      if (exists) {
        return prev.filter((s) => s._id !== slot._id);
      }

      if (prev.length >= MAX_BOOKING_SLOTS) {
        Alert.alert(
          'Selection limit reached',
          `You can select up to ${MAX_BOOKING_SLOTS} slots for one booking request.`
        );
        return prev;
      }

      return [...prev, slot].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
  };

  const bookingStartTime = selectedSlots.length > 0 ? selectedSlots[0].startTime : null;
  const bookingEndTime = selectedSlots.length > 0 ? selectedSlots[selectedSlots.length - 1].endTime : null;
  const totalMinutes = selectedSlots.reduce((sum, slot) => sum + (slot.slotDurationMinutes || 0), 0);

  const handleConfirmBooking = async () => {
    if (selectedSlots.length === 0 || !token) return;

    try {
      setLoading(true);
      await bookingApi.bookSlots(
        selectedSlots.map((slot) => slot._id),
        sessionName || 'Regular Session',
        token
      );
      Alert.alert('Success', 'Booking request sent. Waiting for trainer approval.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to book slot';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Trainer Selection
  if (currentStep === 'trainer-selection') {
    const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
    const headerStyle = [styles.header, { paddingTop: 12 + topInset, paddingBottom: 12 }];

    return (
      <SafeAreaView style={styles.container}>
        <View style={headerStyle}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={AppColors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Trainer</Text>
          <Text style={styles.headerTitle} />
        </View>

        <ScrollView contentContainerStyle={styles.contentWrap}>
          <Text style={styles.stepDescription}>Choose a trainer for your session</Text>

          {loadingTrainers ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={AppColors.primary} />
            </View>
          ) : trainers.length > 0 ? (
            trainers.map((trainer) => (
              <TouchableOpacity
                key={trainer._id}
                style={styles.trainerCard}
                onPress={() => handleSelectTrainer(trainer)}
                activeOpacity={0.7}
              >
                <View style={styles.trainerAvatar}>
                  <MaterialCommunityIcons name="dumbbell" size={28} color={AppColors.primary} />
                </View>
                <View style={styles.trainerInfo}>
                  <Text style={styles.trainerName}>
                    {trainer.firstName} {trainer.lastName}
                  </Text>
                  <Text style={styles.trainerSpecialty}>{trainer.specialization}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-off" size={48} color="#ddd" />
              <Text style={styles.emptyStateText}>No trainer assigned yet. Please contact support.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 2: Date Selection
  if (currentStep === 'date-selection') {
    const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
    const headerStyle = [styles.header, { paddingTop: 12 + topInset, paddingBottom: 12 }];

    return (
      <SafeAreaView style={styles.container}>
        <View style={headerStyle}>
          <TouchableOpacity onPress={() => setCurrentStep('trainer-selection')}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={AppColors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Date</Text>
          <Text style={styles.headerTitle} />
        </View>

        <ScrollView contentContainerStyle={styles.contentWrap}>
          <Text style={styles.stepDescription}>
            Choose a date for your session with {selectedTrainer?.firstName}
          </Text>

          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <MaterialCommunityIcons name="calendar" size={20} color={AppColors.primary} />
            <Text style={styles.datePickerText}>{formatDate(selectedDate)}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="spinner"
              onChange={(_, date) => date && handleSelectDate(date)}
            />
          )}

          <PrimaryButton
            text="CONTINUE"
            onPress={() => handleSelectDate()}
            loading={loading}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 3: Slot Selection
  if (currentStep === 'slot-selection') {
    const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
    const headerStyle = [styles.header, { paddingTop: 12 + topInset, paddingBottom: 12 }];

    return (
      <SafeAreaView style={styles.container}>
        <View style={headerStyle}>
          <TouchableOpacity onPress={() => setCurrentStep('date-selection')}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={AppColors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Time</Text>
          <Text style={styles.headerTitle} />
        </View>

        <ScrollView contentContainerStyle={styles.contentWrap}>
          <Text style={styles.stepDescription}>
            Available slots on {formatDate(selectedDate)}
          </Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={AppColors.primary} />
            </View>
          ) : availableSlots.length > 0 ? (
            <>
              <Text style={styles.multiSelectHint}>Tap up to 4 consecutive slots to create one longer session.</Text>
              {availableSlots.map((slot) => (
                <TouchableOpacity
                  key={slot._id}
                  style={[
                    styles.slotCard,
                    selectedSlots.some((s) => s._id === slot._id) && styles.slotCardSelected,
                  ]}
                  onPress={() => handleToggleSlot(slot)}
                  activeOpacity={0.7}
                >
                  <View style={styles.slotCardLeft}>
                    <Text style={styles.slotTime}>
                      {slot.startTime} — {slot.endTime}
                    </Text>
                    <Text style={styles.slotDuration}>{slot.slotDurationMinutes} minutes</Text>
                  </View>
                  {selectedSlots.some((s) => s._id === slot._id) && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={AppColors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}

              {selectedSlots.length > 0 && (
                <View style={styles.selectionSummary}>
                  <Text style={styles.selectionSummaryText}>
                    Selected: {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.selectionSummaryText}>
                    Time: {bookingStartTime} — {bookingEndTime}
                  </Text>
                  <Text style={styles.selectionSummaryText}>Duration: {totalMinutes} minutes</Text>
                </View>
              )}

              <PrimaryButton
                text="CONTINUE"
                onPress={() => setCurrentStep('confirmation')}
                disabled={selectedSlots.length === 0}
              />
            </>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="calendar-blank" size={48} color="#ddd" />
              <Text style={styles.emptyStateText}>No available slots on this date</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 4: Confirmation
  if (currentStep === 'confirmation') {
    const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
    const headerStyle = [styles.header, { paddingTop: 12 + topInset, paddingBottom: 12 }];

    return (
      <SafeAreaView style={styles.container}>
        <View style={headerStyle}>
          <TouchableOpacity onPress={() => setCurrentStep('slot-selection')}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={AppColors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <Text style={styles.headerTitle} />
        </View>

        <ScrollView contentContainerStyle={styles.contentWrap}>
          <View style={styles.confirmationCard}>
            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationLabel}>Trainer</Text>
              <View style={styles.confirmationRow}>
                <View style={styles.trainerAvatar}>
                  <MaterialCommunityIcons name="dumbbell" size={24} color={AppColors.primary} />
                </View>
                <Text style={styles.confirmationValue}>
                  {selectedTrainer?.firstName} {selectedTrainer?.lastName}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationLabel}>Date</Text>
              <Text style={styles.confirmationValue}>{formatDate(selectedDate)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationLabel}>Time</Text>
              <Text style={styles.confirmationValue}>
                {bookingStartTime} — {bookingEndTime}
              </Text>
              <Text style={styles.confirmationSubText}>
                {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} ({totalMinutes} minutes)
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.confirmationSection}>
              <Text style={styles.confirmationLabel}>Session Name (Optional)</Text>
              <TextInput
                style={styles.sessionInput}
                placeholder="e.g., Chest & Triceps"
                value={sessionName}
                onChangeText={setSessionName}
                placeholderTextColor="#ccc"
              />
            </View>
          </View>

          <View style={styles.actionButtons}>
            <PrimaryButton
              text={loading ? 'Booking...' : 'CONFIRM BOOKING'}
              onPress={handleConfirmBooking}
              loading={loading}
              color={AppColors.primary}
            />
            <PrimaryButton
              text="BACK"
              onPress={() => setCurrentStep('slot-selection')}
              color="#e9ecef"
              textColor="#666"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

function PrimaryButton({
  text,
  onPress,
  loading,
  disabled,
  color = AppColors.primary,
  textColor = '#fff',
}: {
  text: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  textColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.primaryButton,
        { backgroundColor: color, opacity: disabled ? 0.5 : 1 },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.primaryButtonText, { color: textColor }]}>{text}</Text>
      )}
    </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2b33',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 100,
    gap: 16,
  },
  stepDescription: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginBottom: 8,
  },
  trainerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  trainerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainerInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2b33',
    marginBottom: 2,
  },
  trainerSpecialty: {
    fontSize: 12,
    color: '#999',
  },
  datePickerButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  datePickerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2b33',
  },
  slotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  slotCardSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
  },
  slotCardLeft: {
    flex: 1,
  },
  slotTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2b33',
    marginBottom: 4,
  },
  slotDuration: {
    fontSize: 12,
    color: '#999',
  },
  multiSelectHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  selectionSummary: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfe3e7',
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  selectionSummaryText: {
    fontSize: 12,
    color: '#2b3640',
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: 60,
    justifyContent: 'center',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  confirmationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  confirmationSection: {
    marginBottom: 12,
  },
  confirmationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  confirmationValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2b33',
  },
  confirmationSubText: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  confirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 12,
  },
  sessionInput: {
    borderWidth: 1,
    borderColor: '#dfe3e7',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1f2b33',
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  actionButtons: {
    marginTop: 20,
  },
});
