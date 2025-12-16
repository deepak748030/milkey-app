import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, User, Phone } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { authApi, getStoredUser } from '@/lib/api';
import { setAuthUser, User as UserType } from '@/lib/mockData';
import { SuccessModal } from '@/components/SuccessModal';
import { TabSwitcher } from '@/components/TabSwitcher';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/Button';
import { AuthIllustration } from '@/components/AuthIllustration';
import { OTPInput } from '@/components/OTPInput';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

type AuthStep = 'form' | 'otp';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();

  const [isRegister, setIsRegister] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setModalTitle('Permission Denied');
      setModalMessage('Sorry, we need camera roll permissions to make this work!');
      setShowSuccessModal(true);
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [(ImagePicker as any).MediaType?.Image ?? 'images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const validateForm = () => {
    if (!phone || phone.length !== 10) {
      setModalTitle('Error');
      setModalMessage('Please enter a valid 10-digit mobile number');
      setShowSuccessModal(true);
      return false;
    }

    if (isRegister) {
      if (!name) {
        setModalTitle('Error');
        setModalMessage('Please enter your name');
        setShowSuccessModal(true);
        return false;
      }

      if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        setModalTitle('Error');
        setModalMessage('Please enter a valid email address');
        setShowSuccessModal(true);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      let result;

      if (isRegister) {
        result = await authApi.register({
          name,
          email,
          phone,
          avatar: selectedImage || undefined,
        });
      } else {
        result = await authApi.login(phone);
      }

      setIsLoading(false);

      if (result.success) {
        setAuthStep('otp');
        setModalTitle('OTP Sent');
        setModalMessage('Please enter the OTP sent to your mobile number. Use 123456 for testing.');
        setShowSuccessModal(true);
      } else {
        setModalTitle('Error');
        setModalMessage(result.message || 'Something went wrong');
        setShowSuccessModal(true);
      }
    } catch (error) {
      setIsLoading(false);
      setModalTitle('Error');
      setModalMessage('Network error. Please check your connection.');
      setShowSuccessModal(true);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setModalTitle('Error');
      setModalMessage('Please enter a valid 6-digit OTP');
      setShowSuccessModal(true);
      return;
    }

    setIsLoading(true);

    try {
      const result = await authApi.verifyOtp(phone, otp);

      if (result.success && result.response) {
        const apiUser = result.response.user;

        // Check if user is blocked
        if (apiUser.isBlocked) {
          setIsLoading(false);
          setModalTitle('Account Blocked');
          setModalMessage('Your account has been blocked. Please contact support.');
          setShowSuccessModal(true);
          return;
        }

        // Save user data
        const user: UserType = {
          id: apiUser.id,
          name: apiUser.name,
          email: apiUser.email,
          phone: apiUser.phone,
          avatar: apiUser.avatar,
          memberSince: apiUser.memberSince,
        };

        await setAuthUser(user);
        setIsLoading(false);

        setModalTitle(isRegister ? 'Account Created!' : 'Welcome Back!');
        setModalMessage(isRegister ? 'Your account has been created successfully!' : 'You have been logged in successfully!');
        setShowSuccessModal(true);
      } else {
        setIsLoading(false);
        setModalTitle('Error');
        setModalMessage(result.message || 'Invalid OTP. Please try again.');
        setShowSuccessModal(true);
      }
    } catch (error) {
      setIsLoading(false);
      setModalTitle('Error');
      setModalMessage('Network error. Please try again.');
      setShowSuccessModal(true);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);

    try {
      const result = await authApi.resendOtp(phone);
      setIsLoading(false);

      if (result.success) {
        setModalTitle('OTP Resent');
        setModalMessage('A new OTP has been sent to your mobile number. Use 123456 for testing.');
        setShowSuccessModal(true);
      } else {
        setModalTitle('Error');
        setModalMessage(result.message || 'Failed to resend OTP');
        setShowSuccessModal(true);
      }
    } catch (error) {
      setIsLoading(false);
      setModalTitle('Error');
      setModalMessage('Network error. Please try again.');
      setShowSuccessModal(true);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);

    if (modalTitle === 'Account Created!' || modalTitle === 'Welcome Back!') {
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    }
  };

  const resetForm = () => {
    setAuthStep('form');
    setOtp('');
  };

  const renderOTPScreen = () => (
    <View style={styles.otpContainer}>
      <Text style={styles.otpTitle}>Verify OTP</Text>
      <Text style={styles.otpSubtitle}>
        Enter the 6-digit OTP sent to +91 {phone}
      </Text>
      <Text style={styles.testHint}>Use 123456 for testing</Text>

      <View style={styles.otpInputContainer}>
        <OTPInput
          value={otp}
          onChange={setOtp}
          length={6}
        />
      </View>

      <Pressable onPress={handleResendOTP} disabled={isLoading}>
        <Text style={styles.resendText}>
          Didn't receive OTP? <Text style={styles.resendLink}>Resend</Text>
        </Text>
      </Pressable>

      <View style={styles.otpButtons}>
        <Button
          title={isRegister ? 'Verify & Register' : 'Verify & Login'}
          onPress={handleVerifyOTP}
          disabled={isLoading || otp.length !== 6}
          loading={isLoading}
        />
        <Pressable onPress={resetForm} style={styles.backButton}>
          <Text style={styles.backButtonText}>
            {isRegister ? 'Back to Registration' : 'Back to Login'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderForm = () => (
    <>
      <AuthIllustration variant={isRegister ? 'register' : 'login'} />

      <View style={styles.headerSection}>
        <Text style={styles.welcomeTitle}>
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </Text>
        <Text style={styles.welcomeSubtitle}>
          {isRegister
            ? 'Join us to discover amazing events'
            : 'Sign in to continue your journey'
          }
        </Text>
      </View>

      <TabSwitcher
        tabs={[
          { id: 'login', label: 'Login' },
          { id: 'register', label: 'Register' }
        ]}
        activeTab={isRegister ? 'register' : 'login'}
        onTabChange={(tab) => {
          setIsRegister(tab === 'register');
          resetForm();
        }}
      />

      {isRegister && (
        <View style={styles.avatarSection}>
          <AvatarUpload
            imageUri={selectedImage}
            onPickImage={pickImage}
            label="Add Profile Photo"
          />
        </View>
      )}

      <View style={styles.fieldsContainer}>
        {isRegister && (
          <>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconContainer}>
                <User size={18} color={colors.mutedForeground} />
              </View>
              <TextInput
                style={styles.inputWithIcon}
                placeholder="Full Name *"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputWrapper}>
              <View style={styles.inputIconContainer}>
                <Mail size={18} color={colors.mutedForeground} />
              </View>
              <TextInput
                style={styles.inputWithIcon}
                placeholder="Email Address *"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        <View style={styles.inputWrapper}>
          <View style={styles.inputIconContainer}>
            <Phone size={18} color={colors.mutedForeground} />
          </View>
          <Text style={styles.countryCodePrefix}>+91</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="Mobile Number *"
            placeholderTextColor={colors.mutedForeground}
            value={phone}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, '');
              if (cleaned.length <= 10) {
                setPhone(cleaned);
              }
            }}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {authStep === 'otp' ? renderOTPScreen() : renderForm()}
        </ScrollView>

        {authStep === 'form' && (
          <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
            <Button
              title={isRegister ? 'Register & Get OTP' : 'Get OTP'}
              onPress={handleSubmit}
              disabled={isLoading}
              loading={isLoading}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      <SuccessModal
        isVisible={showSuccessModal}
        onClose={handleSuccessClose}
        title={modalTitle}
        message={modalMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 15,
    paddingBottom: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 6,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  avatarSection: {
    marginBottom: 20,
    marginTop: 16,
  },
  fieldsContainer: {
    gap: 14,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIconContainer: {
    marginRight: 10,
  },
  inputWithIcon: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
    padding: 0,
  },
  countryCodePrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginLeft: 10,
    marginRight: 8,
    minWidth: 30,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
    padding: 0,
  },
  bottomContainer: {
    paddingHorizontal: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  // OTP Screen styles
  otpContainer: {
    flex: 1,
    paddingTop: 60,
    alignItems: 'center',
  },
  otpTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 12,
  },
  otpSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 8,
  },
  testHint: {
    fontSize: 13,
    color: colors.primary,
    marginBottom: 32,
  },
  otpInputContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 40,
  },
  resendLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  otpButtons: {
    width: '100%',
    paddingHorizontal: 8,
    gap: 16,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});
