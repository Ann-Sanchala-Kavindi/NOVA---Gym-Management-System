import React, { useState, useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, TextInput, Image } from 'react-native';
import { AppColors } from '@/constants/theme';
import { Equipment, PerformanceMetrics } from '@/lib/member-api';
import { LinearGradient } from 'expo-linear-gradient';
import { getImageUrl } from '@/lib/image-utils';

export function EquipmentCard({
  equipment,
  onPress,
  loading = false,
}: {
  equipment: Equipment;
  onPress: () => void;
  loading?: boolean;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  const categoryIcons: Record<string, string> = {
    Cardio: '🏃',
    Strength: '💪',
    Flexibility: '🧘',
    Other: '⚙️',
  };

  const statusColors: Record<string, string> = {
    Good: '#2ecc40',
    NeedsMaintenance: '#ff9500',
    OutOfOrder: '#ff3b30',
  };

  return (
    <View style={styles.equipmentCard}>
      <View style={styles.equipmentCardTop}>
        {equipment.imageUrl ? (
          <Image
            source={{ uri: getImageUrl(equipment.imageUrl) }}
            style={styles.equipmentImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.equipmentIconWrap}>
            <Text style={styles.equipmentIcon}>{categoryIcons[equipment.category] || '⚙️'}</Text>
          </View>
        )}
        <Text style={styles.equipmentName}>{equipment.name}</Text>
      </View>
      <Text style={styles.equipmentCategory}>{equipment.category}</Text>
      {equipment.location ? (
        <Text style={styles.equipmentLocation}>📍 {equipment.location}</Text>
      ) : null}
      <View style={styles.equipmentStatus}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: statusColors[equipment.maintenanceStatus] || '#999' },
          ]}
        />
        <Text style={styles.statusText}>{equipment.maintenanceStatus}</Text>
      </View>

      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={styles.startMiniButtonOuter}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={loading}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#1b8f2f', '#56d47d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startMiniButton}>
            <Text style={styles.startMiniButtonText}>{loading ? 'STARTING...' : 'START'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export function WorkoutTimer({
  elapsedSeconds,
  isRunning,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  elapsedSeconds: number;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <View style={styles.timerContainer}>
      <Text style={styles.timerDisplay}>{formatTime(elapsedSeconds)}</Text>
      <View style={styles.timerControls}>
        {!isRunning && elapsedSeconds === 0 ? (
          <GradientTimerButton label="START" colors={['#1b8f2f', '#56d47d']} onPress={onStart} />
        ) : null}

        {isRunning ? (
          <GradientTimerButton label="PAUSE" colors={['#ea8c0b', '#ffb74d']} onPress={onPause} />
        ) : null}

        {!isRunning && elapsedSeconds > 0 ? (
          <>
            <GradientTimerButton label="RESUME" colors={['#1b8f2f', '#56d47d']} onPress={onResume} />
            <GradientTimerButton label="STOP" colors={['#d93025', '#ff6b6b']} onPress={onStop} />
          </>
        ) : null}
      </View>
    </View>
  );
}

function GradientTimerButton({
  label,
  colors,
  onPress,
}: {
  label: string;
  colors: [string, string];
  onPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={styles.timerButtonOuter} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={0.9}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.timerButton}>
          <Text style={styles.timerButtonText}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function PerformanceForm({
  equipmentCategory,
  initialMetrics,
  onMetricsChange,
}: {
  equipmentCategory: 'Cardio' | 'Strength' | 'Weights' | 'Flexibility' | 'Other';
  initialMetrics?: Partial<PerformanceMetrics>;
  onMetricsChange: (metrics: Partial<PerformanceMetrics>) => void;
}) {
  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>(initialMetrics || { notes: '' });

  const handleChange = (key: keyof PerformanceMetrics, value: any) => {
    const updated = { ...metrics, [key]: value };
    setMetrics(updated);
    onMetricsChange(updated);
  };

  return (
    <View style={styles.performanceForm}>
      {(equipmentCategory === 'Strength' || equipmentCategory === 'Weights' || equipmentCategory === 'Other') && (
        <>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Reps</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g., 10"
              keyboardType="number-pad"
              value={metrics.reps ? String(metrics.reps) : ''}
              onChangeText={(val) => handleChange('reps', val ? parseInt(val) : null)}
            />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Sets</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g., 3"
              keyboardType="number-pad"
              value={metrics.sets ? String(metrics.sets) : ''}
              onChangeText={(val) => handleChange('sets', val ? parseInt(val) : null)}
            />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g., 20"
              keyboardType="decimal-pad"
              value={metrics.weight ? String(metrics.weight) : ''}
              onChangeText={(val) => handleChange('weight', val ? parseFloat(val) : null)}
            />
          </View>
        </>
      )}

      {(equipmentCategory === 'Cardio' || equipmentCategory === 'Other') && (
        <>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Distance (km)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g., 5"
              keyboardType="decimal-pad"
              value={metrics.distance ? String(metrics.distance) : ''}
              onChangeText={(val) => handleChange('distance', val ? parseFloat(val) : null)}
            />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Calories</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g., 250"
              keyboardType="number-pad"
              value={metrics.calories ? String(metrics.calories) : ''}
              onChangeText={(val) => handleChange('calories', val ? parseInt(val) : null)}
            />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Avg Speed (km/h)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g., 10"
              keyboardType="decimal-pad"
              value={metrics.avgSpeed ? String(metrics.avgSpeed) : ''}
              onChangeText={(val) => handleChange('avgSpeed', val ? parseFloat(val) : null)}
            />
          </View>
        </>
      )}

      <View style={styles.formRow}>
        <Text style={styles.formLabel}>Notes</Text>
        <TextInput
          style={[styles.formInput, styles.notesInput]}
          placeholder="How did you feel? Any observations?"
          multiline
          numberOfLines={3}
          value={metrics.notes || ''}
          onChangeText={(val) => handleChange('notes', val)}
        />
      </View>
    </View>
  );
}

export function StatsCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
}) {
  return (
    <View style={styles.statsCard}>
      {icon ? <Text style={styles.statsIcon}>{icon}</Text> : null}
      <Text style={styles.statsValue}>{value}</Text>
      {unit ? <Text style={styles.statsUnit}>{unit}</Text> : null}
      <Text style={styles.statsLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  equipmentCard: {
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: '#ffffff',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 220,
  },
  equipmentCardTop: {
    alignItems: 'center',
    marginBottom: 10,
  },
  equipmentImage: {
    width: '100%',
    height: 110,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: '#eef1f4',
  },
  equipmentIconWrap: {
    width: '100%',
    height: 110,
    borderRadius: 14,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef1f4',
  },
  equipmentIcon: {
    fontSize: 32,
  },
  equipmentName: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#1f252b',
  },
  equipmentCategory: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '600',
    marginBottom: 6,
  },
  equipmentLocation: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  equipmentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  startMiniButton: {
    marginTop: 'auto',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  startMiniButtonOuter: {
    marginTop: 'auto',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  startMiniButtonDisabled: {
    opacity: 0.6,
  },
  startMiniButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: '900',
    color: AppColors.primary,
    fontFamily: 'Courier New',
    marginBottom: 20,
  },
  timerControls: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  timerButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    overflow: 'hidden',
  },
  timerButtonOuter: {
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  timerButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  performanceForm: {
    paddingVertical: 12,
    gap: 14,
  },
  formRow: {
    marginBottom: 4,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2b33',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#dfe3e7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#1f2b33',
    backgroundColor: '#f8f9fa',
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  statsCard: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  statsIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '900',
    color: AppColors.primary,
  },
  statsUnit: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '600',
  },
  statsLabel: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});
