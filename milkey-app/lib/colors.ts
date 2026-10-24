// Design System Colors for React Native
// Light Theme: White + Green
// Dark Theme: Black + Green

export const lightColors = {
  // Base Colors
  background: '#FFFFFF',
  foreground: '#0F172A',
  card: '#FFFFFF',
  cardForeground: '#0F172A',

  // Primary Colors (Green)
  primary: '#16A34A',
  primaryForeground: '#FFFFFF',

  // Secondary Colors
  secondary: '#F0FDF4',
  secondaryForeground: '#16A34A',

  // Muted Colors
  muted: '#F8FAFC',
  mutedForeground: '#64748B',

  // Accent Colors
  accent: '#15803D',
  accentForeground: '#FFFFFF',

  // Status Colors
  destructive: '#EF4444',
  success: '#16A34A',
  warning: '#EAB308',

  // Border & Input
  border: '#DCFCE7',
  input: '#FFFFFF',
  ring: '#16A34A',

  // Stat Card Colors
  statCard1: '#DCFCE7',
  statCard2: '#BBF7D0',

  // Additional helper colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const darkColors = {
  // Base Colors — Pure Black + Green
  background: '#000000',
  foreground: '#FFFFFF',
  card: '#111111',
  cardForeground: '#FFFFFF',

  // Primary Colors (Green pops on black)
  primary: '#22C55E',
  primaryForeground: '#000000',

  // Secondary Colors
  secondary: '#0A1A0F',
  secondaryForeground: '#22C55E',

  // Muted Colors
  muted: '#1A1A1A',
  mutedForeground: '#A3A3A3',

  // Accent Colors
  accent: '#16A34A',
  accentForeground: '#FFFFFF',

  // Status Colors
  destructive: '#EF4444',
  success: '#22C55E',
  warning: '#EAB308',

  // Border & Input — subtle green-tinted dark
  border: '#262626',
  input: '#1A1A1A',
  ring: '#22C55E',

  // Stat Card Colors — black base with green tint
  statCard1: '#0F1F11',
  statCard2: '#122615',

  // Additional helper colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Default export for backward compatibility
export const colors = darkColors;
