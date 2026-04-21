import { AppColors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
  TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightIcon?: React.ReactNode;
}

export function AppInput({
  label,
  error,
  containerStyle,
  rightIcon,
  ...props
}: AppInputProps) {
  const [focused, setFocused] = useState(false);
  const isSecureField = !!props.secureTextEntry;
  const [showSecureValue, setShowSecureValue] = useState(false);
  const secureTextEntry = isSecureField ? !showSecureValue : props.secureTextEntry;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputContainer,
          focused && styles.inputContainerFocused,
          !!error && styles.inputContainerError,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={AppColors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
          secureTextEntry={secureTextEntry}
        />
        {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
        {isSecureField ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={showSecureValue ? 'Hide password' : 'Show password'}
            onPress={() => setShowSecureValue((prev) => !prev)}
            style={styles.rightIcon}
          >
            <MaterialCommunityIcons
              name={showSecureValue ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={AppColors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    height: 56,
  },
  inputContainerFocused: {
    borderColor: AppColors.inputBorder,
  },
  inputContainerError: {
    borderColor: AppColors.error,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: AppColors.text,
    paddingVertical: 0,
  },
  rightIcon: {
    marginLeft: 8,
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: AppColors.error,
  },
});
