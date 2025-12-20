import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Dimensions } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Share2, Users, Wallet, Gift, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

const { width } = Dimensions.get('window');

const mockReferralData = {
    code: 'DAIRY2024',
    totalReferrals: 12,
    activeUsers: 8,
    totalEarnings: 2450,
    pendingEarnings: 320,
    commissionRate: 5,
    referrals: [
        { id: '1', name: 'Mohan Kumar', date: '15 Dec 2024', earnings: 450, status: 'active' },
        { id: '2', name: 'Suresh Patel', date: '12 Dec 2024', earnings: 380, status: 'active' },
        { id: '3', name: 'Raj Singh', date: '10 Dec 2024', earnings: 520, status: 'active' },
        { id: '4', name: 'Amit Sharma', date: '08 Dec 2024', earnings: 0, status: 'pending' },
    ],
};

export default function ReferralScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [copied, setCopied] = useState(false);

    const styles = createStyles(colors, isDark, insets);

    const copyCode = async () => {
        await Clipboard.setStringAsync(mockReferralData.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareCode = async () => {
        try {
            await Share.share({
                message: `Join our dairy app using my referral code: ${mockReferralData.code} and get exciting rewards! Download now.`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Referral Program</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Commission Banner */}
                <View style={styles.commissionBanner}>
                    <Gift size={28} color={colors.white} />
                    <View style={styles.commissionInfo}>
                        <Text style={styles.commissionTitle}>Earn {mockReferralData.commissionRate}% Commission</Text>
                        <Text style={styles.commissionSubtitle}>On every purchase by your referrals</Text>
                    </View>
                </View>

                {/* Referral Code Card */}
                <View style={styles.codeCard}>
                    <Text style={styles.codeLabel}>Your Referral Code</Text>
                    <View style={styles.codeContainer}>
                        <Text style={styles.codeText}>{mockReferralData.code}</Text>
                        <Pressable onPress={copyCode} style={styles.copyBtn}>
                            <Copy size={18} color={colors.primary} />
                            <Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy'}</Text>
                        </Pressable>
                    </View>
                    <Pressable onPress={shareCode} style={styles.shareBtn}>
                        <Share2 size={18} color={colors.white} />
                        <Text style={styles.shareBtnText}>Share with Friends</Text>
                    </Pressable>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Users size={20} color={colors.primary} />
                        <Text style={styles.statValue}>{mockReferralData.totalReferrals}</Text>
                        <Text style={styles.statLabel}>Total Referrals</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Users size={20} color={colors.success} />
                        <Text style={styles.statValue}>{mockReferralData.activeUsers}</Text>
                        <Text style={styles.statLabel}>Active Users</Text>
                    </View>
                </View>

                {/* Earnings Card */}
                <View style={styles.earningsCard}>
                    <View style={styles.earningsHeader}>
                        <Wallet size={22} color={colors.primary} />
                        <Text style={styles.earningsTitle}>Your Earnings</Text>
                    </View>
                    <View style={styles.earningsRow}>
                        <View style={styles.earningItem}>
                            <Text style={styles.earningLabel}>Total Earned</Text>
                            <Text style={styles.earningValue}>₹{mockReferralData.totalEarnings}</Text>
                        </View>
                        <View style={styles.earningDivider} />
                        <View style={styles.earningItem}>
                            <Text style={styles.earningLabel}>Pending</Text>
                            <Text style={[styles.earningValue, { color: colors.warning }]}>₹{mockReferralData.pendingEarnings}</Text>
                        </View>
                    </View>
                </View>

                {/* Referral History */}
                <Text style={styles.sectionTitle}>Referral History</Text>
                <View style={styles.historyCard}>
                    {mockReferralData.referrals.map((referral, index) => (
                        <View key={referral.id} style={[styles.historyItem, index < mockReferralData.referrals.length - 1 && styles.historyItemBorder]}>
                            <View style={styles.historyAvatar}>
                                <Text style={styles.historyAvatarText}>{referral.name.charAt(0)}</Text>
                            </View>
                            <View style={styles.historyInfo}>
                                <Text style={styles.historyName}>{referral.name}</Text>
                                <Text style={styles.historyDate}>{referral.date}</Text>
                            </View>
                            <View style={styles.historyEarnings}>
                                <Text style={[styles.historyStatus, { color: referral.status === 'active' ? colors.success : colors.warning }]}>
                                    {referral.status === 'active' ? 'Active' : 'Pending'}
                                </Text>
                                <Text style={styles.historyAmount}>₹{referral.earnings}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* How It Works */}
                <Text style={styles.sectionTitle}>How It Works</Text>
                <View style={styles.howItWorksCard}>
                    <View style={styles.step}>
                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                        <Text style={styles.stepText}>Share your referral code with friends</Text>
                    </View>
                    <View style={styles.step}>
                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                        <Text style={styles.stepText}>They sign up using your code</Text>
                    </View>
                    <View style={styles.step}>
                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                        <Text style={styles.stepText}>Earn 5% on their every purchase</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 8,
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    placeholder: {
        width: 36,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 12,
        paddingBottom: 30,
    },
    commissionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        gap: 12,
    },
    commissionInfo: {
        flex: 1,
    },
    commissionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.white,
    },
    commissionSubtitle: {
        fontSize: 11,
        color: colors.white,
        opacity: 0.9,
    },
    codeCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    codeLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginBottom: 8,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.secondary,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    codeText: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.primary,
        letterSpacing: 2,
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    copyText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        borderRadius: 8,
        padding: 10,
        gap: 8,
    },
    shareBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.white,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.foreground,
        marginTop: 6,
    },
    statLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    earningsCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    earningsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    earningsTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
    },
    earningsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    earningItem: {
        flex: 1,
        alignItems: 'center',
    },
    earningLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    earningValue: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.success,
    },
    earningDivider: {
        width: 1,
        height: 36,
        backgroundColor: colors.border,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 8,
    },
    historyCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    historyItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    historyAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    historyAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.white,
    },
    historyInfo: {
        flex: 1,
    },
    historyName: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    historyDate: {
        fontSize: 11,
        color: colors.mutedForeground,
    },
    historyEarnings: {
        alignItems: 'flex-end',
    },
    historyStatus: {
        fontSize: 10,
        fontWeight: '600',
    },
    historyAmount: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.foreground,
    },
    howItWorksCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 10,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.white,
    },
    stepText: {
        flex: 1,
        fontSize: 12,
        color: colors.foreground,
    },
});
