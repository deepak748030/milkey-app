import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Image, Dimensions, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const { width } = Dimensions.get('window');

interface UpdateModalProps {
    visible: boolean;
    forceUpdate: boolean;
    message: string;
    storeLink: string;
    latestVersion: string;
    onSkip?: () => void;
}

export default function UpdateModal({ visible, forceUpdate, message, storeLink, latestVersion, onSkip }: UpdateModalProps) {
    const { colors } = useTheme();

    const handleUpdate = () => {
        if (storeLink) Linking.openURL(storeLink);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                <View style={[styles.container, { backgroundColor: colors.card }]}>
                    {/* Decorative top bar */}
                    <View style={[styles.topBar, { backgroundColor: colors.primary }]} />

                    {/* Icon */}
                    <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
                        <Image
                            source={require('@/assets/images/icon.png')}
                            style={styles.appIcon}
                            resizeMode="cover"
                        />
                    </View>

                    {/* Title */}
                    <Text style={[styles.title, { color: colors.foreground }]}>
                        {forceUpdate ? 'Update Required' : 'Update Available'}
                    </Text>

                    {/* Version badge */}
                    <View style={[styles.versionBadge, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.versionText, { color: colors.primary }]}>
                            v{latestVersion}
                        </Text>
                    </View>

                    {/* Message */}
                    <Text style={[styles.message, { color: colors.mutedForeground }]}>
                        {message}
                    </Text>

                    {/* Update Button */}
                    <TouchableOpacity
                        style={[styles.updateBtn, { backgroundColor: colors.primary }]}
                        onPress={handleUpdate}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.updateBtnText, { color: colors.primaryForeground }]}>
                            Update Now
                        </Text>
                    </TouchableOpacity>

                    {/* Skip / Later */}
                    {!forceUpdate && onSkip && (
                        <TouchableOpacity onPress={onSkip} style={styles.skipBtn} activeOpacity={0.7}>
                            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
                                Maybe Later
                            </Text>
                        </TouchableOpacity>
                    )}

                    {forceUpdate && (
                        <Text style={[styles.forceNote, { color: colors.destructive }]}>
                            You must update to continue using the app
                        </Text>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    container: {
        width: width - 60,
        borderRadius: 24,
        alignItems: 'center',
        paddingBottom: 28,
        overflow: 'hidden',
    },
    topBar: {
        width: '100%',
        height: 6,
    },
    iconWrap: {
        width: 80,
        height: 80,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 28,
        overflow: 'hidden',
    },
    appIcon: {
        width: 80,
        height: 80,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginTop: 18,
        letterSpacing: 0.5,
    },
    versionBadge: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 10,
    },
    versionText: {
        fontSize: 14,
        fontWeight: '700',
    },
    message: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        marginTop: 16,
        paddingHorizontal: 28,
    },
    updateBtn: {
        marginTop: 24,
        paddingVertical: 14,
        paddingHorizontal: 48,
        borderRadius: 14,
        width: '80%',
        alignItems: 'center',
    },
    updateBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    skipBtn: {
        marginTop: 14,
        paddingVertical: 8,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '500',
    },
    forceNote: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 12,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});
