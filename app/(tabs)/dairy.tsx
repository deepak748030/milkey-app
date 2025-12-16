import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function DairyScreen() {
    const insets = useSafeAreaInsets();

    return (
        <LinearGradient colors={[colors.background, colors.card]} style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <Text style={styles.title}>Dairy</Text>
            </View>
            <View style={styles.content}>
                <Text style={styles.text}>Dairy Records</Text>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.foreground,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 16,
        color: colors.mutedForeground,
    },
});
