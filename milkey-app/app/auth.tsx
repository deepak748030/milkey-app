import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, User, Phone, Gift, MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApiNew } from '@/lib/milkeyApi';
import { setAuthUser } from '@/lib/authStore';
import { SuccessModal } from '@/components/SuccessModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function AuthScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { expoPushToken } = usePushNotifications();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [address, setAddress] = useState('');
    const [referralCode, setReferralCode] = useState('');

    // OTP state
    const [showOtpScreen, setShowOtpScreen] = useState(false);
    const [otp, setOtp] = useState('');
    const [tempEmail, setTempEmail] = useState('');

    // Forgot password state
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showForgotOtpScreen, setShowForgotOtpScreen] = useState(false);
    const [showResetPasswordScreen, setShowResetPasswordScreen] = useState(false);
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');

    const styles = createStyles(colors, isDark, insets);

    const showModal = (title: string, message: string) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalVisible(true);
    };

    const handleAuth = async () => {
        if (isLogin) {
            if (!email || !password) {
                showModal('Error', 'Please enter email and password');
                return;
            }
        } else {
            if (!name || !email || !phone || !password) {
                showModal('Error', 'Please fill all required fields');
                return;
            }
            if (password.length < 6) {
                showModal('Error', 'Password must be at least 6 characters');
                return;
            }
            if (phone.length !== 10) {
                showModal('Error', 'Please enter a valid 10-digit phone number');
                return;
            }
        }

        setLoading(true);
        try {
            if (isLogin) {
                const result = await authApiNew.login(email, password);
                if (result.success && result.response) {
                    await setAuthUser(result.response.token, result.response.user);
                    // Send push token after login
                    if (expoPushToken) {
                        authApiNew.updatePushToken(expoPushToken).catch(console.error);
                    }
                    router.replace('/(tabs)');
                } else {
                    showModal('Error', result.message || 'Invalid email or password');
                }
            } else {
                // For registration, send OTP first
                const otpResult = await authApiNew.sendOtp(email);
                if (otpResult.success) {
                    setTempEmail(email);
                    setShowOtpScreen(true);
                    showModal('OTP Sent', 'Please check your email for the verification code');
                } else {
                    showModal('Error', otpResult.message || 'Failed to send OTP');
                }
            }
        } catch (error) {
            showModal('Error', 'Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length !== 6) {
            showModal('Error', 'Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const verifyResult = await authApiNew.verifyOtp(tempEmail, otp);
            if (verifyResult.success) {
                // OTP verified, now register
                const result = await authApiNew.register({
                    name,
                    email: tempEmail,
                    phone,
                    password,
                    address: address || undefined,
                    referralCode: referralCode || undefined,
                });

                if (result.success && result.response) {
                    await setAuthUser(result.response.token, result.response.user);
                    // Send push token after registration
                    if (expoPushToken) {
                        authApiNew.updatePushToken(expoPushToken).catch(console.error);
                    }
                    router.replace('/(tabs)');
                } else {
                    showModal('Error', result.message || 'Registration failed');
                }
            } else {
                showModal('Error', verifyResult.message || 'Invalid OTP');
            }
        } catch (error) {
            showModal('Error', 'Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setLoading(true);
        try {
            const result = await authApiNew.sendOtp(tempEmail);
            if (result.success) {
                showModal('Success', 'OTP resent to your email');
            } else {
                showModal('Error', result.message || 'Failed to resend OTP');
            }
        } catch (error) {
            showModal('Error', 'Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    // Forgot password handlers
    const handleForgotPassword = async () => {
        if (!email) {
            showModal('Error', 'Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            const result = await authApiNew.forgotPassword(email);
            if (result.success) {
                setTempEmail(email);
                setShowForgotPassword(false);
                setShowForgotOtpScreen(true);
                showModal('OTP Sent', 'Password reset OTP sent to your email');
            } else {
                showModal('Error', result.message || 'Failed to send OTP');
            }
        } catch (error) {
            showModal('Error', 'Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyForgotOtp = async () => {
        if (!otp || otp.length !== 6) {
            showModal('Error', 'Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const result = await authApiNew.verifyForgotPasswordOtp(tempEmail, otp);
            if (result.success && result.response) {
                setResetToken(result.response.resetToken);
                setShowForgotOtpScreen(false);
                setShowResetPasswordScreen(true);
                setOtp('');
            } else {
                showModal('Error', result.message || 'Invalid OTP');
            }
        } catch (error) {
            showModal('Error', 'Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            showModal('Error', 'Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            showModal('Error', 'Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const result = await authApiNew.resetPassword(tempEmail, resetToken, newPassword);
            if (result.success) {
                showModal('Success', 'Password reset successfully! You can now login.');
                // Reset all states
                setShowResetPasswordScreen(false);
                setTempEmail('');
                setResetToken('');
                setNewPassword('');
                setConfirmPassword('');
                setIsLogin(true);
            } else {
                showModal('Error', result.message || 'Failed to reset password');
            }
        } catch (error) {
            showModal('Error', 'Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendForgotOtp = async () => {
        setLoading(true);
        try {
            const result = await authApiNew.forgotPassword(tempEmail);
            if (result.success) {
                showModal('Success', 'OTP resent to your email');
            } else {
                showModal('Error', result.message || 'Failed to resend OTP');
            }
        } catch (error) {
            showModal('Error', 'Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const resetForgotPasswordFlow = () => {
        setShowForgotPassword(false);
        setShowForgotOtpScreen(false);
        setShowResetPasswordScreen(false);
        setTempEmail('');
        setOtp('');
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
    };

    // Forgot Password - Enter Email Screen
    if (showForgotPassword) {
        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <LinearGradient
                    colors={[colors.primary + '20', colors.background]}
                    style={styles.gradient}
                />

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.logoContainer}>
                        <View style={[styles.logo, { backgroundColor: colors.destructive }]}>
                            <Text style={styles.logoEmoji}>🔐</Text>
                        </View>
                        <Text style={styles.appName}>Forgot Password</Text>
                        <Text style={styles.tagline}>Enter your email to reset password</Text>
                    </View>

                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Reset Password</Text>
                        <Text style={styles.formSubtitle}>We'll send you a verification code</Text>

                        <View style={styles.inputContainer}>
                            <Mail size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>

                        <Pressable
                            style={[styles.authButton, loading && styles.authButtonDisabled]}
                            onPress={handleForgotPassword}
                            disabled={loading}
                        >
                            <Text style={styles.authButtonText}>
                                {loading ? 'Sending...' : 'Send OTP'}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.backButton}
                            onPress={() => {
                                setShowForgotPassword(false);
                                setEmail('');
                            }}
                        >
                            <Text style={styles.backButtonText}>← Back to Login</Text>
                        </Pressable>
                    </View>
                </ScrollView>

                <SuccessModal
                    isVisible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    title={modalTitle}
                    message={modalMessage}
                    autoClose={false}
                />
            </KeyboardAvoidingView>
        );
    }

    // Forgot Password - OTP Verification Screen
    if (showForgotOtpScreen) {
        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <LinearGradient
                    colors={[colors.primary + '20', colors.background]}
                    style={styles.gradient}
                />

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.logoContainer}>
                        <View style={[styles.logo, { backgroundColor: colors.destructive }]}>
                            <Text style={styles.logoEmoji}>📧</Text>
                        </View>
                        <Text style={styles.appName}>Verify OTP</Text>
                        <Text style={styles.tagline}>Enter the 6-digit code sent to {tempEmail}</Text>
                    </View>

                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Enter OTP</Text>
                        <Text style={styles.formSubtitle}>Check your email inbox</Text>

                        <View style={styles.inputContainer}>
                            <Mail size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="6-digit OTP"
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>

                        <Pressable
                            style={[styles.authButton, loading && styles.authButtonDisabled]}
                            onPress={handleVerifyForgotOtp}
                            disabled={loading}
                        >
                            <Text style={styles.authButtonText}>
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </Text>
                        </Pressable>

                        <View style={styles.switchContainer}>
                            <Text style={styles.switchText}>Didn't receive the code? </Text>
                            <Pressable onPress={handleResendForgotOtp} disabled={loading}>
                                <Text style={styles.switchLink}>Resend OTP</Text>
                            </Pressable>
                        </View>

                        <Pressable
                            style={styles.backButton}
                            onPress={resetForgotPasswordFlow}
                        >
                            <Text style={styles.backButtonText}>← Back to Login</Text>
                        </Pressable>
                    </View>
                </ScrollView>

                <SuccessModal
                    isVisible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    title={modalTitle}
                    message={modalMessage}
                    autoClose={false}
                />
            </KeyboardAvoidingView>
        );
    }

    // Reset Password Screen
    if (showResetPasswordScreen) {
        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <LinearGradient
                    colors={[colors.primary + '20', colors.background]}
                    style={styles.gradient}
                />

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.logoContainer}>
                        <View style={[styles.logo, { backgroundColor: colors.success || colors.primary }]}>
                            <Text style={styles.logoEmoji}>🔑</Text>
                        </View>
                        <Text style={styles.appName}>New Password</Text>
                        <Text style={styles.tagline}>Create a strong password</Text>
                    </View>

                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Set New Password</Text>
                        <Text style={styles.formSubtitle}>Minimum 6 characters</Text>

                        <View style={styles.inputContainer}>
                            <Lock size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="New Password"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showNewPassword}
                                placeholderTextColor={colors.mutedForeground}
                            />
                            <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                                {showNewPassword ? (
                                    <EyeOff size={18} color={colors.mutedForeground} />
                                ) : (
                                    <Eye size={18} color={colors.mutedForeground} />
                                )}
                            </Pressable>
                        </View>

                        <View style={styles.inputContainer}>
                            <Lock size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showNewPassword}
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>

                        <Pressable
                            style={[styles.authButton, loading && styles.authButtonDisabled]}
                            onPress={handleResetPassword}
                            disabled={loading}
                        >
                            <Text style={styles.authButtonText}>
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.backButton}
                            onPress={resetForgotPasswordFlow}
                        >
                            <Text style={styles.backButtonText}>← Cancel</Text>
                        </Pressable>
                    </View>
                </ScrollView>

                <SuccessModal
                    isVisible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    title={modalTitle}
                    message={modalMessage}
                    autoClose={false}
                />
            </KeyboardAvoidingView>
        );
    }

    // OTP Screen
    if (showOtpScreen) {
        return (
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <LinearGradient
                    colors={[colors.primary + '20', colors.background]}
                    style={styles.gradient}
                />

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.logoContainer}>
                        <View style={styles.logo}>
                            <Text style={styles.logoEmoji}>📧</Text>
                        </View>
                        <Text style={styles.appName}>Verify Email</Text>
                        <Text style={styles.tagline}>Enter the 6-digit code sent to {tempEmail}</Text>
                    </View>

                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Enter OTP</Text>
                        <Text style={styles.formSubtitle}>Check your email inbox</Text>

                        <View style={styles.inputContainer}>
                            <Mail size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="6-digit OTP"
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>

                        <Pressable
                            style={[styles.authButton, loading && styles.authButtonDisabled]}
                            onPress={handleVerifyOtp}
                            disabled={loading}
                        >
                            <Text style={styles.authButtonText}>
                                {loading ? 'Verifying...' : 'Verify & Register'}
                            </Text>
                        </Pressable>

                        <View style={styles.switchContainer}>
                            <Text style={styles.switchText}>Didn't receive the code? </Text>
                            <Pressable onPress={handleResendOtp} disabled={loading}>
                                <Text style={styles.switchLink}>Resend OTP</Text>
                            </Pressable>
                        </View>

                        <Pressable
                            style={styles.backButton}
                            onPress={() => {
                                setShowOtpScreen(false);
                                setOtp('');
                            }}
                        >
                            <Text style={styles.backButtonText}>← Back to Sign Up</Text>
                        </Pressable>
                    </View>
                </ScrollView>

                <SuccessModal
                    isVisible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    title={modalTitle}
                    message={modalMessage}
                    autoClose={false}
                />
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <LinearGradient
                colors={[colors.primary + '20', colors.background]}
                style={styles.gradient}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <View style={styles.logo}>
                        <Text style={styles.logoEmoji}>🥛</Text>
                    </View>
                    <Text style={styles.appName}>Milkey</Text>
                    <Text style={styles.tagline}>Your Complete Dairy Solution</Text>
                </View>

                {/* Form Card */}
                <View style={styles.formCard}>
                    <Text style={styles.formTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
                    <Text style={styles.formSubtitle}>
                        {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
                    </Text>

                    {!isLogin && (
                        <View style={styles.inputContainer}>
                            <User size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                value={name}
                                onChangeText={setName}
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <Mail size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email Address"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>

                    {!isLogin && (
                        <View style={styles.inputContainer}>
                            <Phone size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Phone Number (10 digits)"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                maxLength={10}
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <Lock size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            placeholderTextColor={colors.mutedForeground}
                        />
                        <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                            {showPassword ? (
                                <EyeOff size={18} color={colors.mutedForeground} />
                            ) : (
                                <Eye size={18} color={colors.mutedForeground} />
                            )}
                        </Pressable>
                    </View>

                    {!isLogin && (
                        <>
                            <View style={styles.inputContainer}>
                                <MapPin size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Address (Optional)"
                                    value={address}
                                    onChangeText={setAddress}
                                    placeholderTextColor={colors.mutedForeground}
                                    multiline
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Gift size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Referral Code (Optional)"
                                    value={referralCode}
                                    onChangeText={(text) => setReferralCode(text.toUpperCase())}
                                    autoCapitalize="characters"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                            </View>
                        </>
                    )}

                    {isLogin && (
                        <Pressable
                            style={styles.forgotPasswordButton}
                            onPress={() => setShowForgotPassword(true)}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </Pressable>
                    )}

                    <Pressable
                        style={[styles.authButton, loading && styles.authButtonDisabled]}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        <Text style={styles.authButtonText}>
                            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Continue')}
                        </Text>
                    </Pressable>

                    <View style={styles.switchContainer}>
                        <Text style={styles.switchText}>
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                        </Text>
                        <Pressable onPress={() => setIsLogin(!isLogin)}>
                            <Text style={styles.switchLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
                        </Pressable>
                    </View>
                </View>
            </ScrollView>

            <SuccessModal
                isVisible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={modalTitle}
                message={modalMessage}
                autoClose={false}
            />
        </KeyboardAvoidingView>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 300,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: insets.top + 40,
        paddingBottom: 40,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    logoEmoji: {
        fontSize: 40,
    },
    appName: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.foreground,
        letterSpacing: 1,
    },
    tagline: {
        fontSize: 13,
        color: colors.mutedForeground,
        marginTop: 4,
    },
    formCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    formTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.foreground,
        textAlign: 'center',
    },
    formSubtitle: {
        fontSize: 13,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 24,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.secondary,
        borderRadius: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputIcon: {
        marginLeft: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 10,
        fontSize: 14,
        color: colors.foreground,
    },
    eyeIcon: {
        padding: 12,
    },
    authButton: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    authButtonDisabled: {
        opacity: 0.6,
    },
    authButtonText: {
        color: colors.white,
        fontSize: 15,
        fontWeight: '700',
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    switchText: {
        fontSize: 13,
        color: colors.mutedForeground,
    },
    switchLink: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '600',
    },
    backButton: {
        marginTop: 16,
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 13,
        color: colors.mutedForeground,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginTop: -4,
        marginBottom: 8,
    },
    forgotPasswordText: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '500',
    },
});
