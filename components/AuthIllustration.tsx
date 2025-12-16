import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar, Ticket, Star, Music, Users, MapPin, Heart, Sparkles } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface AuthIllustrationProps {
    variant?: 'login' | 'register';
}

export function AuthIllustration({ variant = 'login' }: AuthIllustrationProps) {
    return (
        <View style={styles.container}>
            {/* Main center icon */}
            <View style={styles.mainIconContainer}>
                <Sparkles size={56} color={colors.primary} strokeWidth={2} />
            </View>

            {/* Floating icons around */}
            <View style={[styles.floatingIcon, styles.topLeft]}>
                <Calendar size={24} color={colors.primary} />
            </View>

            <View style={[styles.floatingIcon, styles.topRight]}>
                <Ticket size={24} color={colors.accent} />
            </View>

            <View style={[styles.floatingIcon, styles.middleLeft]}>
                <Music size={20} color={colors.success} />
            </View>

            <View style={[styles.floatingIcon, styles.middleRight]}>
                <Star size={20} color={colors.warning} />
            </View>

            <View style={[styles.floatingIcon, styles.bottomLeft]}>
                <Heart size={18} color={colors.destructive} />
            </View>

            <View style={[styles.floatingIcon, styles.bottomRight]}>
                <MapPin size={22} color={colors.primary} />
            </View>

            {/* Decorative circles */}
            <View style={[styles.decorCircle, styles.circle1]} />
            <View style={[styles.decorCircle, styles.circle2]} />
            <View style={[styles.decorCircle, styles.circle3]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 220,
        width: '100%',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainIconContainer: {
        width: 110,
        height: 110,
        backgroundColor: colors.primary + '15',
        borderRadius: 55,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.primary + '30',
        zIndex: 10,
    },
    floatingIcon: {
        position: 'absolute',
        width: 48,
        height: 48,
        backgroundColor: colors.card,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.foreground,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    topLeft: {
        top: 20,
        left: 30,
    },
    topRight: {
        top: 10,
        right: 40,
    },
    middleLeft: {
        top: 90,
        left: 10,
    },
    middleRight: {
        top: 80,
        right: 15,
    },
    bottomLeft: {
        bottom: 30,
        left: 50,
    },
    bottomRight: {
        bottom: 20,
        right: 45,
    },
    decorCircle: {
        position: 'absolute',
        borderRadius: 100,
        backgroundColor: colors.primary + '08',
    },
    circle1: {
        width: 180,
        height: 180,
        top: 20,
    },
    circle2: {
        width: 240,
        height: 240,
        top: -10,
    },
    circle3: {
        width: 300,
        height: 300,
        top: -40,
    },
});