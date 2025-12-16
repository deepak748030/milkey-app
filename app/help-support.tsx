import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, FileQuestionMark as FileQuestion, MessageCircle, Mail, Phone, ChevronRight, ChevronDown } from 'lucide-react-native';
import { colors } from '@/lib/colors';

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const contactOptions = [
    {
      icon: MessageCircle,
      title: 'Live Chat',
      subtitle: 'Chat with our support team',
      onPress: () => { },
    },
    {
      icon: Mail,
      title: 'Email Us',
      subtitle: 'support@eventapp.com',
      onPress: () => { },
    },
    {
      icon: Phone,
      title: 'Call Us',
      subtitle: '+91 1800 123 4567',
      onPress: () => { },
    },
  ];

  const faqs = [
    {
      question: 'How do I book an event?',
      answer: 'To book an event, browse through our event listings, select the event you want, choose your preferred date, and proceed with the payment. You will receive a confirmation once the booking is complete.',
    },
    {
      question: 'Can I cancel my booking?',
      answer: 'Yes, you can cancel your booking from the "My Bookings" section. Cancellation policies may vary depending on the event and vendor. Please check the specific terms before canceling.',
    },
    {
      question: 'How do I get my tickets?',
      answer: 'After successful payment, you will receive a booking confirmation with all the details. You can also view your booking details in the "My Bookings" section of the app.',
    },
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept UPI payments, credit/debit cards, and digital wallets like Paytm, PhonePe, and Google Pay. All payments are processed securely.',
    },
    {
      question: 'How can I contact the vendor?',
      answer: 'You can chat with vendors directly through our in-app messaging system. Go to your booking details and tap on "Chat with Vendor" to start a conversation.',
    },
    {
      question: 'What if I need to change my booking date?',
      answer: 'Date changes depend on vendor availability and policies. Contact the vendor through the chat feature to discuss possible date modifications.',
    },
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroIcon}>
              <FileQuestion size={32} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>How can we help?</Text>
            <Text style={styles.heroDescription}>
              Find answers to common questions or get in touch with our support team for personalized assistance.
            </Text>
          </View>

          {/* Contact Options */}
          <View style={styles.contactSection}>
            <Text style={styles.sectionTitle}>Get in Touch</Text>
            <View style={styles.contactOptions}>
              {contactOptions.map((option, index) => (
                <Pressable key={index} style={styles.contactOption} onPress={option.onPress}>
                  <View style={styles.contactLeft}>
                    <View style={styles.contactIconContainer}>
                      <option.icon size={20} color={colors.primary} />
                    </View>
                    <View style={styles.contactText}>
                      <Text style={styles.contactTitle}>{option.title}</Text>
                      <Text style={styles.contactSubtitle}>{option.subtitle}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          </View>

          {/* FAQs */}
          <View style={styles.faqSection}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            <View style={styles.faqContainer}>
              {faqs.map((faq, index) => (
                <View key={index} style={styles.faqItem}>
                  <Pressable style={styles.faqQuestion} onPress={() => toggleFaq(index)}>
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    <ChevronDown
                      size={18}
                      color={colors.mutedForeground}
                      style={[
                        styles.faqIcon,
                        expandedFaq === index && styles.faqIconExpanded
                      ]}
                    />
                  </Pressable>
                  {expandedFaq === index && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Additional Help */}
          <View style={styles.additionalHelp}>
            <Text style={styles.additionalTitle}>Still need help?</Text>
            <Text style={styles.additionalText}>
              Our support team is available 24/7 to assist you with any questions or issues you may have.
            </Text>
            <Pressable style={styles.contactButton}>
              <MessageCircle size={18} color={colors.primaryForeground} />
              <Text style={styles.contactButtonText}>Contact Support</Text>
            </Pressable>
          </View>
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
    paddingVertical: 1,
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
    paddingBottom: 90,
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 32,
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
  contactSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  contactOptions: {
    gap: 8,
  },
  contactOption: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: colors.primary + '20',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  faqSection: {
    marginBottom: 32,
  },
  faqContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqQuestion: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    flex: 1,
    marginRight: 12,
  },
  faqIcon: {
    transform: [{ rotate: '0deg' }],
  },
  faqIconExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  faqAnswerText: {
    fontSize: 12,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  additionalHelp: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  additionalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  additionalText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});