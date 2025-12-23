import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { AlertTriangle, X } from 'lucide-react-native';

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDestructive = false,
  isLoading = false,
}: ConfirmationModalProps) {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark, confirmDestructive);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={20} color={colors.mutedForeground} />
          </Pressable>

          <View style={styles.iconContainer}>
            <AlertTriangle size={32} color={confirmDestructive ? colors.destructive : colors.warning} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isLoading}>
              <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={onConfirm} disabled={isLoading}>
              <Text style={styles.confirmBtnText}>
                {isLoading ? 'Please wait...' : confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, confirmDestructive: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: confirmDestructive ? colors.destructive + '15' : colors.warning + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: confirmDestructive ? colors.destructive : colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
