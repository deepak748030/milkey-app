// components/SuccessModal.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { CircleCheck as CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SuccessModalProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  autoClose?: boolean;
  duration?: number;
}

export function SuccessModal({ isVisible, onClose, title, message, autoClose = true, duration = 2000 }: SuccessModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isError = title.toLowerCase().includes('error') || title.toLowerCase().includes('failed');
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onClose());
      }, autoClose ? duration : 3000);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-120);
      opacity.setValue(0);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const accentColor = isError ? colors.destructive : colors.success;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: Platform.OS === 'ios'
              ? (colors.card + 'CC')
              : colors.card,
            borderColor: accentColor + '40',
            ...(Platform.OS === 'ios' ? {} : { elevation: 8 }),
          },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <View style={[styles.iconWrap, { backgroundColor: accentColor + '20' }]}>
          {isError ? (
            <AlertCircle size={20} color={accentColor} />
          ) : (
            <CheckCircle2 size={20} color={accentColor} />
          )}
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]} numberOfLines={2}>{message}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
});
