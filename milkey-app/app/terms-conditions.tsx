import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, FileText, CheckCircle, CreditCard, User, Shield, AlertTriangle, RefreshCw, Mail } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function TermsConditionsScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const termsItems = [
        {
            icon: CheckCircle,
            title: '1. Service Description',
            description: 'Milkey is a subscription-based dairy management software that helps users manage milk purchase, selling, members, farmers, and reports digitally.',
        },
        {
            icon: CreditCard,
            title: '2. Subscription',
            description: 'Subscription is billed on a monthly basis (₹449/month). Subscription is auto-renewable unless cancelled by the user. User can cancel the subscription anytime from their account or by contacting support.',
        },
        {
            icon: User,
            title: '3. User Responsibility',
            description: 'User is responsible for the accuracy of data entered in the app. Milkey is not responsible for incorrect entries, financial losses due to wrong data, or disputes between users and third parties.',
        },
        {
            icon: Shield,
            title: '4. Account Usage',
            description: 'One account is intended for use by one dairy business only. Sharing accounts or misuse may lead to suspension without refund.',
        },
        {
            icon: RefreshCw,
            title: '5. Service Availability',
            description: 'We try to keep the app available at all times, but temporary downtime may occur due to maintenance, updates, or technical issues.',
        },
        {
            icon: AlertTriangle,
            title: '6. Termination',
            description: 'Milkey reserves the right to suspend or terminate accounts that violate these terms, misuse the service, or engage in illegal activities.',
        },
        {
            icon: FileText,
            title: '7. Changes to Terms',
            description: 'We may update these terms at any time. Continued use of the app means you accept the updated terms.',
        },
    ];

    const handleEmailPress = () => {
        Linking.openURL('mailto:support@milkey.app');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Custom Header */}
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <ArrowLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Terms & Conditions</Text>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {/* Hero Section */}
                    <View style={styles.heroSection}>
                        <View style={styles.heroIcon}>
                            <FileText size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.heroTitle}>Terms of Service</Text>
                        <Text style={styles.heroDescription}>
                            Welcome to Milkey. By using this App, you agree to the following terms and conditions.
                        </Text>
                    </View>

                    {/* Terms Sections */}
                    <View style={styles.policySections}>
                        {termsItems.map((item, index) => (
                            <View key={index} style={styles.policyCard}>
                                <View style={styles.policyIconContainer}>
                                    <item.icon size={20} color={colors.primary} />
                                </View>
                                <View style={styles.policyContent}>
                                    <Text style={styles.policyTitle}>{item.title}</Text>
                                    <Text style={styles.policyDescription}>{item.description}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Contact Information */}
                    <View style={styles.additionalInfo}>
                        <Text style={styles.additionalTitle}>Contact & Support</Text>
                        <Text style={styles.additionalText}>
                            For any questions or concerns regarding these terms, please contact us:
                        </Text>
                        <Pressable style={styles.emailButton} onPress={handleEmailPress}>
                            <Mail size={18} color={colors.primary} />
                            <Text style={styles.emailText}>support@milkey.app</Text>
                        </Pressable>
                        <Text style={styles.businessHours}>Business Hours: 10 AM – 7 PM (Mon–Sat)</Text>
                    </View>

                    {/* Last Updated */}
                    <Text style={styles.lastUpdated}>
                        Last updated: January 2025
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
        borderRadius: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.foreground,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 10,
        paddingVertical: 16,
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    heroIcon: {
        width: 64,
        height: 64,
        backgroundColor: colors.primary + '20',
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.foreground,
        marginBottom: 8,
    },
    heroDescription: {
        fontSize: 14,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 20,
    },
    policySections: {
        gap: 12,
        marginBottom: 24,
    },
    policyCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    policyIconContainer: {
        width: 40,
        height: 40,
        backgroundColor: colors.primary + '20',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    policyContent: {
        flex: 1,
    },
    policyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 6,
    },
    policyDescription: {
        fontSize: 13,
        color: colors.mutedForeground,
        lineHeight: 19,
    },
    additionalInfo: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    additionalTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 8,
    },
    additionalText: {
        fontSize: 13,
        color: colors.mutedForeground,
        lineHeight: 19,
        marginBottom: 12,
    },
    emailButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.primary + '15',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    emailText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    businessHours: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginTop: 4,
    },
    lastUpdated: {
        fontSize: 12,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginTop: 8,
    },
});
