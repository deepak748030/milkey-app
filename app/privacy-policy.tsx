import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Shield, Database, Lock, Eye, UserCheck, CreditCard, Bell, Trash2 } from 'lucide-react-native';
import { colors } from '@/lib/colors';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const policyItems = [
    {
      icon: Database,
      title: 'Information We Collect',
      description: 'We collect your name, email, phone number, and profile photo to create your account. For bookings, we store event preferences, booking history, and payment information to process your reservations.',
    },
    {
      icon: Lock,
      title: 'Data Security',
      description: 'Your personal information is encrypted using industry-standard SSL/TLS protocols. Payment data is processed through secure payment gateways and is never stored on our servers. We implement regular security audits to protect your data.',
    },
    {
      icon: Eye,
      title: 'How We Use Your Data',
      description: 'We use your information to: process event bookings and payments, connect you with event vendors, send booking confirmations and reminders, improve our services, and provide customer support. We never sell your data to third parties.',
    },
    {
      icon: Bell,
      title: 'Notifications & Communications',
      description: 'We send essential notifications about your bookings, event updates, and important service announcements. You can manage your notification preferences in your profile settings. Marketing communications require your explicit consent.',
    },
    {
      icon: CreditCard,
      title: 'Payment Information',
      description: 'Payment processing is handled by trusted third-party providers. We only store transaction IDs and booking references. Your card details are never stored on our systems. All transactions are protected with bank-level security.',
    },
    {
      icon: UserCheck,
      title: 'Your Rights',
      description: 'You have the right to: access your personal data, request corrections to your information, download your data, delete your account and associated data, and opt-out of marketing communications. Contact support for any data-related requests.',
    },
    {
      icon: Trash2,
      title: 'Data Retention & Deletion',
      description: 'We retain booking data for 3 years for legal and tax compliance. You can request account deletion anytime, which removes personal data within 30 days. Some anonymized data may be kept for analytics purposes.',
    },
  ];

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
              At EventBook, we are committed to protecting your personal information. This policy explains how we collect, use, and safeguard your data when you use our event booking platform.
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

          {/* Third Party Services */}
          <View style={styles.additionalInfo}>
            <Text style={styles.additionalTitle}>Third-Party Services</Text>
            <Text style={styles.additionalText}>
              Our app integrates with trusted third-party services for payments, analytics, and vendor communications. These services have their own privacy policies. We only share minimal necessary data with these partners.
            </Text>
          </View>

          {/* Contact Information */}
          <View style={styles.additionalInfo}>
            <Text style={styles.additionalTitle}>Contact Us</Text>
            <Text style={styles.additionalText}>
              For privacy concerns, data requests, or questions about this policy, please contact our Data Protection Team at privacy@eventbook.app or through the Help & Support section in the app.
            </Text>
          </View>

          {/* Last Updated */}
          <Text style={styles.lastUpdated}>
            Last updated: December 1, 2025
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  lastUpdated: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },
});