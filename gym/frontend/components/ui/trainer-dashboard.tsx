import React from 'react';
import { Animated, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
function lightenHexColor(hexColor: string, amount = 0.18) {
  const normalized = hexColor.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return hexColor;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const toHex = (channel: number) => mix(channel).toString(16).padStart(2, '0');

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
}) {
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerStyle = [styles.pageHeaderWrap, { paddingTop: 12 + topInset }];

  return (
    <SafeAreaView style={headerStyle}>
      <View style={styles.pageHeaderTopRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        {rightAction ? <View>{rightAction}</View> : <View style={styles.backBtnGhost} />}
      </View>

      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
    </SafeAreaView>
  );
}

export function SectionHeader({
  title,
  actionText,
  onActionPress,
}: {
  title: string;
  actionText?: string;
  onActionPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionText && onActionPress ? (
        <TouchableOpacity onPress={onActionPress}>
          <Text style={styles.sectionAction}>{actionText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function StatCard({
  value,
  label,
  bg,
  icon,
}: {
  value: string | number;
  label: string;
  bg: string;
  icon?: string;
}) {
  return (
    <LinearGradient
      colors={[bg, lightenHexColor(bg, 0.2)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statCard}
    >
      <View style={styles.statTopRow}>
        <View style={styles.statIconBubble}>
          <Text style={styles.statIconText}>{icon || '✦'}</Text>
        </View>
        <View style={styles.statAccentBar} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </LinearGradient>
  );
}

export function ActionButton({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors?: [string, string];
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
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity style={styles.actionButtonOuter} onPress={onPress} activeOpacity={0.9} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <LinearGradient
          colors={colors || ['#173d29', '#2a8f4a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionButton}
        >
          <View style={styles.actionIconBox}>
            <Text style={styles.actionIcon}>{icon}</Text>
          </View>
          <Text style={styles.actionLabel}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function InfoPill({
  text,
  onPress,
}: {
  text: string;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <TouchableOpacity style={styles.infoPill} onPress={onPress}>
        <Text style={styles.infoPillText}>{text}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillText}>{text}</Text>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  rightText,
  onPress,
}: {
  title: string;
  subtitle?: string;
  rightText?: string;
  onPress?: () => void;
}) {
  const body = (
    <LinearGradient
      colors={['#ffffff', '#f5faff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.listRow}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSub}>{subtitle}</Text> : null}
      </View>
      {rightText ? <Text style={styles.listRowRight}>{rightText}</Text> : null}
    </LinearGradient>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{body}</TouchableOpacity>;
  }

  return body;
}

export function PrimaryWideButton({
  text,
  onPress,
  color,
  textColor,
}: {
  text: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
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

  const gradientBase = color || AppColors.primaryDark;
  const gradientEnd = color ? lightenHexColor(color, 0.16) : AppColors.primary;

  return (
    <Animated.View style={{ width: '100%', transform: [{ scale }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.primaryWideButtonOuter}>
        <LinearGradient
          colors={color ? [gradientBase, gradientEnd] : [AppColors.primaryDark, AppColors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryWideButton}
        >
          <Text style={[styles.primaryWideButtonText, textColor ? { color: textColor } : null]}>{text}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.choiceChip, selected ? styles.choiceChipActive : null]}
    >
      <Text style={[styles.choiceChipText, selected ? styles.choiceChipTextActive : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SurfaceCard({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={['#ffffff', '#f5f9ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.surfaceCard}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  pageHeaderWrap: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pageHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnGhost: {
    width: 34,
    height: 34,
  },
  backBtnText: {
    fontSize: 20,
    lineHeight: 20,
    color: '#2b2b2b',
  },
  pageTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    color: '#1f2b33',
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#5f6870',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2b33',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primaryDark,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 112,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 3,
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  statIconText: {
    fontSize: 18,
  },
  statAccentBar: {
    flex: 1,
    height: 10,
    marginLeft: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  statValue: {
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '900',
    color: '#101010',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#3f3f3f',
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 72,
  },
  actionButtonOuter: {
    flex: 1,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  actionIconBox: {
    width: 58,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.12)',
  },
  actionIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  actionLabel: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    paddingHorizontal: 10,
  },
  infoPill: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#1f2328',
    minHeight: 46,
    justifyContent: 'center',
  },
  infoPillText: {
    color: '#d8edc4',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  listRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e9ef',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  listRowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f252b',
  },
  listRowSub: {
    marginTop: 2,
    fontSize: 12,
    color: '#8a8a8a',
    fontWeight: '500',
  },
  listRowRight: {
    fontSize: 13,
    color: '#8a8a8a',
    fontWeight: '700',
    marginLeft: 8,
  },
  primaryWideButton: {
    width: '100%',
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryWideButtonOuter: {
    width: '100%',
    borderRadius: 26,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 7,
  },
  primaryWideButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  choiceChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfe3e7',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceChipActive: {
    borderColor: AppColors.primary,
    backgroundColor: '#dff4cd',
  },
  choiceChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3a4650',
  },
  choiceChipTextActive: {
    color: '#1d5e12',
  },
  surfaceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6edf6',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 4,
  },
});

