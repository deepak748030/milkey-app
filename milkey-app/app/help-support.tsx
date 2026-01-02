import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, FileQuestionMark as FileQuestion, MessageCircle, Mail, Phone, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const styles = createStyles(colors, isDark, insets);

  const handleEmailPress = () => {
    Linking.openURL('mailto:fresh.milkley@gmail.com');
  };

  const contactOptions = [
    {
      icon: MessageCircle,
      title: 'Live Chat',
      subtitle: 'Chat with our support team',
      onPress: () => router.push('/submit-form'),
    },
    {
      icon: Mail,
      title: 'Email Us',
      subtitle: 'fresh.milkley@gmail.com',
      onPress: handleEmailPress,
    },
  ];

  const faqs = [
    {
      question: 'How do I add a new farmer/member?',
      answer: 'Go to the Register tab, select the Farmers section, fill in the farmer code, name, mobile number, and address, then tap "Add Farmer" to save.',
    },
    {
      question: 'How do I record milk collection?',
      answer: 'Navigate to the Dairy tab, tap "Add Collection", select the farmer by code, enter quantity, FAT%, SNF%, and the rate will be auto-calculated based on your rate chart.',
    },
    {
      question: 'How does the rate calculation work?',
      answer: 'The app uses your configured rate chart to calculate the milk rate based on FAT and SNF values. You can customize the rate chart in the Dairy tab under "Rate Chart" section.',
    },
    {
      question: 'How do I make payments to farmers?',
      answer: 'Go to the Dairy tab, select "Settlement", enter the farmer code to see their pending amount. You can then process payment via cash, UPI, or bank transfer.',
    },
    {
      question: 'How do I record advances given to farmers?',
      answer: 'In the Register tab, go to "Advances" section. Enter the farmer code, amount, date, and optional note, then tap "Save Advance".',
    },
    {
      question: 'How can I export reports?',
      answer: 'Go to the Selling tab, navigate to Reports section, select your date range, and use the PDF or Export buttons to download your milk collection or payment reports.',
    },
    {
      question: 'How do I change my rate chart settings?',
      answer: 'In the Dairy tab, go to "Rate Chart" section and tap "Edit Settings". You can modify base rate, FAT rate, SNF rate, and other parameters.',
    },
    {
      question: 'Can multiple users access the same data?',
      answer: 'Currently, each account has its own separate data. Multi-user access and team features will be available in future updates.',
    },
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <View style={styles.container}>
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
              Find answers to common questions about dairy management or get in touch with our support team.
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
              Our support team is available to assist you with any questions about dairy management.
            </Text>
            <Pressable style={styles.contactButton} onPress={() => router.push('/submit-form')}>
              <MessageCircle size={18} color={colors.white} />
              <Text style={styles.contactButtonText}>Send Feedback</Text>
            </Pressable>
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
    paddingTop: insets.top,
  },
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    color: colors.white,
  },
});