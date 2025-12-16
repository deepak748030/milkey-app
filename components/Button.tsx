import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View, PressableProps } from 'react-native';
import { colors } from '@/lib/colors';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
}

export function Button({
  title,
  variant = 'primary',
  disabled = false,
  loading = false,
  onPress,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getSpinnerColor = () => {
    switch (variant) {
      case 'primary':
      case 'destructive':
        return colors.white;
      case 'secondary':
      case 'outline':
        return colors.primary;
      default:
        return colors.white;
    }
  };

  return (
    <Pressable
      style={[
        styles.button,
        styles[variant],
        isDisabled && styles.disabled
      ]}
      onPress={onPress}
      disabled={isDisabled}
      {...rest}
    >
      <View style={styles.contentContainer}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={getSpinnerColor()}
            style={styles.spinner}
          />
        )}
        <Text style={[
          styles.buttonText,
          styles[`${variant}Text` as keyof typeof styles],
          loading && styles.loadingText
        ]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destructive: {
    backgroundColor: colors.destructive,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    opacity: 0.9,
  },
  primaryText: {
    color: colors.primaryForeground,
  },
  secondaryText: {
    color: colors.primary,
  },
  destructiveText: {
    color: colors.white,
  },
  outlineText: {
    color: colors.foreground,
  },
});