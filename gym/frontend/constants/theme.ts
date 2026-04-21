/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const AppColors = {
  primary: '#2ECC40',
  primaryDark: '#1a9e2e',
  primaryLight: '#e8f8eb',
  primaryGradientStart: '#3ddc5c',
  primaryGradientEnd: '#1db33c',
  white: '#FFFFFF',
  black: '#000000',
  text: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',
  inputBg: '#f0faf2',
  inputBorder: '#2ECC40',
  inputBorderInactive: 'transparent',
  shadow: '#b7f5c4',
  error: '#e53935',
  // New modern colors
  accent1: '#FF6B6B',
  accent2: '#4ECDC4',
  accent3: '#FFE66D',
  accent4: '#95E1D3',
  neutralLight: '#f8f9fa',
  neutralMedium: '#e9ecef',
  neutralDark: '#495057',
  successLight: '#d4edda',
  warningLight: '#fff3cd',
  dangerLight: '#f8d7da',
  // Material Design 3 colors
  background: '#FAFAFA',
  primaryContainer: '#e8f8eb',
  onPrimaryContainer: '#1a9e2e',
  onSurface: '#1a1a1a',
  onSurfaceVariant: '#666666',
  surfaceContainer: '#f0faf2',
  surface: '#FFFFFF',
  gold: '#FFC107',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
