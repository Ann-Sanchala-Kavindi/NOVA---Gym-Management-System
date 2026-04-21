import { AppInput } from './ui/app-input';
import { AppColors } from '@/constants/theme';
import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { adminApi, Trainer, TrainerCreateInput, TrainerUpdateInput } from '@/lib/admin-api';

interface TrainerModalProps {
  visible: boolean;
  token: string;
  mode: 'create' | 'edit';
  trainerToEdit?: Trainer | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export function TrainerModal({
  visible,
  token,
  mode,
  trainerToEdit,
  onClose,
  onSuccess,
}: TrainerModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced' | null>(null);
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!visible) return;

    if (mode === 'edit' && trainerToEdit) {
      setName(trainerToEdit.name || '');
      setEmail(trainerToEdit.email || '');
      setPassword('');
      setSpecialization(trainerToEdit.specialization || '');
      setExperienceLevel(trainerToEdit.experienceLevel || null);
      setBio(trainerToEdit.bio || '');
      setHourlyRate(
        trainerToEdit.hourlyRate === null || trainerToEdit.hourlyRate === undefined
          ? ''
          : String(trainerToEdit.hourlyRate)
      );
      setErrors({});
      return;
    }

    resetForm();
  }, [visible, mode, trainerToEdit]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Name is required.';
    if (!email.trim()) newErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Enter a valid email.';
    }
    if (mode === 'create') {
      if (!password) newErrors.password = 'Password is required.';
      else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters.';
    } else if (password && password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    if (!specialization.trim()) newErrors.specialization = 'Specialization is required.';

    if (hourlyRate && isNaN(Number(hourlyRate))) {
      newErrors.hourlyRate = 'Hourly rate must be a number.';
    } else if (hourlyRate && Number(hourlyRate) < 0) {
      newErrors.hourlyRate = 'Hourly rate cannot be negative.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (mode === 'edit' && trainerToEdit) {
        const input: TrainerUpdateInput = {
          name: name.trim(),
          email: email.trim(),
          specialization: specialization.trim(),
          experienceLevel,
          bio: bio.trim(),
          hourlyRate: hourlyRate ? Number(hourlyRate) : null,
          ...(password ? { password } : {}),
        };

        await adminApi.updateTrainer(trainerToEdit.id, input, token);

        Alert.alert('Success', `Trainer ${name} updated successfully.`);
        resetForm();
        onSuccess();
        return;
      }

      const input: TrainerCreateInput = {
        name: name.trim(),
        email: email.trim(),
        password,
        specialization: specialization.trim(),
        experienceLevel,
        bio: bio.trim(),
        hourlyRate: hourlyRate ? Number(hourlyRate) : null,
      };

      await adminApi.createTrainer(input, token);

      Alert.alert('Success', `Trainer ${name} created successfully.`);
      resetForm();
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create trainer.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setSpecialization('');
    setExperienceLevel(null);
    setBio('');
    setHourlyRate('');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={loading}>
            <MaterialCommunityIcons name="close" size={24} color={AppColors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{mode === 'edit' ? 'Edit Trainer' : 'Create Trainer'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AppInput
            label="Name"
            placeholder="Trainer full name"
            value={name}
            onChangeText={(v: string) => {
              setName(v);
              if (errors.name) setErrors((p) => ({ ...p, name: '' }));
            }}
            error={errors.name}
            editable={!loading}
          />
          <AppInput
            label="Email"
            placeholder="trainer@gym.com"
            value={email}
            onChangeText={(v: string) => {
              setEmail(v);
              if (errors.email) setErrors((p) => ({ ...p, email: '' }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            editable={!loading}
          />
          <AppInput
            label="Password"
            placeholder={mode === 'edit' ? 'Leave empty to keep current password' : 'Min 6 characters'}
            value={password}
            onChangeText={(v: string) => {
              setPassword(v);
              if (errors.password) setErrors((p) => ({ ...p, password: '' }));
            }}
            secureTextEntry
            error={errors.password}
            editable={!loading}
          />
          <AppInput
            label="Specialization"
            placeholder="e.g., Strength & Conditioning"
            value={specialization}
            onChangeText={(v: string) => {
              setSpecialization(v);
              if (errors.specialization) setErrors((p) => ({ ...p, specialization: '' }));
            }}
            error={errors.specialization}
            editable={!loading}
          />

          <Text style={styles.label}>Experience Level</Text>
          <View style={styles.chipGroup}>
            {EXPERIENCE_LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.chip, experienceLevel === level && styles.chipActive]}
                onPress={() => setExperienceLevel(level as any)}
                disabled={loading}
              >
                <Text style={[styles.chipText, experienceLevel === level && styles.chipTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <AppInput
            label="Bio (Optional)"
            placeholder="Short bio or specialties"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
          <AppInput
            label="Hourly Rate (Optional)"
            placeholder="e.g., 50"
            value={hourlyRate}
            onChangeText={(v: string) => {
              setHourlyRate(v);
              if (errors.hourlyRate) setErrors((p) => ({ ...p, hourlyRate: '' }));
            }}
            keyboardType="decimal-pad"
            error={errors.hourlyRate}
            editable={!loading}
          />

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={AppColors.white} />
              ) : (
                <Text style={styles.submitButtonText}>{mode === 'edit' ? 'Save Changes' : 'Create Trainer'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.white,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  form: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 8,
    marginTop: 4,
  },
  chipGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  chipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  chipTextActive: {
    color: AppColors.white,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
  },
  submitButton: {
    backgroundColor: AppColors.primary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.white,
  },
});
