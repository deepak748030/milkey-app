import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Shield, Database, Lock, Eye, UserCheck, CreditCard, RefreshCw, XCircle, AlertCircle, CheckCircle, Mail } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const policyItems = [
    {
      icon: Database,
      title: '1. Data We Collect',
      description: 'We may collect: Name, phone number, email. Dairy-related data (milk purchase, selling, members, farmers, reports). Payment status (subscription info only, no card/UPI details stored).',
    },
    {
      icon: Eye,
      title: '2. How Data Is Used',
      description: 'Your data is used only to: Provide app functionality, generate reports, manage subscriptions, and improve the app experience.',
    },
    {
      icon: Lock,
      title: '3. Data Storage & Security',
      description: 'Data is stored securely using cloud infrastructure. We do not sell, share, or rent user data to third parties.',
    },
    {
      icon: CreditCard,
      title: '4. Third-Party Services',
      description: 'We use trusted third-party services such as payment gateways (e.g., Razorpay) and cloud services. These services follow their own privacy standards.',
    },
    {
      icon: UserCheck,
      title: '5. User Control',
      description: 'You can request data deletion by contacting support. After account deletion, data may be permanently removed.',
    },
    {
      icon: RefreshCw,
      title: '6. Policy Updates',
      description: 'This policy may be updated periodically. Continued use of the app indicates acceptance of changes.',
    },
    {
      icon: XCircle,
      title: '7. Subscription Cancellation',
      description: 'Users can cancel their subscription anytime. Cancellation stops future billing, not the current active period.',
    },
    {
      icon: AlertCircle,
      title: '8. Refund Policy',
      description: 'No refunds are provided for the current billing cycle once the subscription is activated. This applies to monthly and promotional plans. If payment fails, app access may be restricted until payment is completed. No data is deleted due to failed payments.',
    },
    {
      icon: CheckCircle,
      title: '9. Exceptional Refund Cases',
      description: 'Refunds may be considered only if payment is deducted but service is not activated, or due to technical error from our side. Such requests must be raised within 7 days of payment.',
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroIcon}>
              <Shield size={32} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Your Privacy Matters</Text>
            <Text style={styles.heroDescription}>
              Milkey values your privacy. This policy explains how we collect and use your data.
            </Text>
          </View>

          {/* Policy Sections */}
          <View style={styles.policySections}>
            {policyItems.map((item, index) => (
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
            <Text style={styles.additionalTitle}>Contact Us</Text>
            <Text style={styles.additionalText}>
              For privacy concerns, data requests, or questions about this policy, please contact us:
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
