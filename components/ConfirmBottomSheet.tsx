import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Dimensions } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';

interface ConfirmBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
}

export default function ConfirmBottomSheet({
    visible,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    destructive = false,
}: ConfirmBottomSheetProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const styles = createStyles(colors, isDark, insets, destructive);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />

                    <View style={styles.iconContainer}>
                        <AlertTriangle size={28} color={destructive ? colors.destructive : colors.primary} />
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttons}>
                        <Pressable style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>{cancelText}</Text>
                        </Pressable>
                        <Pressable style={styles.confirmBtn} onPress={onConfirm}>
                            <Text style={styles.confirmBtnText}>{confirmText}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any, destructive: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 20,
        paddingTop: 10,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: colors.muted,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: destructive
            ? (isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)')
            : (isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)'),
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: colors.muted,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    confirmBtn: {
        flex: 1,
        backgroundColor: destructive ? colors.destructive : colors.primary,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
    },
    confirmBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.white,
    },
});