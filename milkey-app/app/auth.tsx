import React, { useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, User, Phone, Gift, MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApiNew } from '@/lib/milkeyApi';
import { setAuthUser } from '@/lib/authStore';
import { SuccessModal } from '@/components/SuccessModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Extracted & memoized sub-components (prevents keyboard dismiss) ───

const InputField = memo(({ icon: Icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, maxLength, autoCapitalize, multiline, showToggle, toggleValue, onToggle, colors }: any) => (
    <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.input,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    }}>
        <Icon size={18} color={colors.mutedForeground} style={{ marginLeft: 12 }} />
        <TextInput
            style={{
                flex: 1,
                paddingVertical: Platform.OS === 'ios' ? 13 : 10,
                paddingHorizontal: 10,
                fontSize: 14,
                color: colors.foreground,
            }}
            placeholder={placeholder}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize || 'none'}
            placeholderTextColor={colors.mutedForeground + '99'}
            multiline={multiline}
        />
        {showToggle && (
            <Pressable onPress={onToggle} hitSlop={8} style={{ padding: 12 }}>
                {toggleValue ? <EyeOff size={18} color={colors.mutedForeground} /> : <Eye size={18} color={colors.mutedForeground} />}
            </Pressable>
        )}
    </View>
));

const AuthButton = memo(({ onPress, label, disabled, loading, colors }: any) => (
    <Pressable
        style={({ pressed }) => ({
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center' as const,
            marginTop: 8,
            opacity: (loading || disabled) ? 0.6 : pressed ? 0.85 : 1,
        })}
        onPress={onPress}
        disabled={loading || disabled}
    >
        {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
        }
    </Pressable>
));

const LogoHeader = memo(({ title, subtitle, colors, compact }: any) => (
    <View style={{ alignItems: 'center', marginBottom: compact ? 14 : 20 }}>
        <View style={{
            width: compact ? 70 : 88,
            height: compact ? 70 : 88,
            borderRadius: compact ? 18 : 22,
            overflow: 'hidden',
            marginBottom: 8,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
        }}>
            <Image
                source={require('@/assets/images/icon.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
            />
        </View>
        <Text style={{ fontSize: compact ? 24 : 28, fontWeight: '800', letterSpacing: 1.5, color: colors.foreground }}>{title}</Text>
        <Text style={{ fontSize: 13, marginTop: 3, textAlign: 'center', color: colors.mutedForeground, paddingHorizontal: 20 }}>{subtitle}</Text>
    </View>
));

export default function AuthScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { expoPushToken } = usePushNotifications();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [address, setAddress] = useState('');
    const [referralCode, setReferralCode] = useState('');

    const [showOtpScreen, setShowOtpScreen] = useState(false);
    const [otp, setOtp] = useState('');
    const [tempEmail, setTempEmail] = useState('');

    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showForgotOtpScreen, setShowForgotOtpScreen] = useState(false);
    const [showResetPasswordScreen, setShowResetPasswordScreen] = useState(false);
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');

    const showModal = useCallback((title: string, message: string) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalVisible(true);
    }, []);

    // ─── Stable callbacks to prevent re-renders ───
    const togglePassword = useCallback(() => setShowPassword(v => !v), []);
    const toggleNewPassword = useCallback(() => setShowNewPassword(v => !v), []);
    const handleReferralChange = useCallback((t: string) => setReferralCode(t.toUpperCase()), []);

    const handleAuth = useCallback(async () => {
        if (isLogin) {
            if (!email || !password) { showModal('Error', 'Please enter email and password'); return; }
        } else {
            if (!name || !email || !phone || !password) { showModal('Error', 'Please fill all required fields'); return; }
            if (password.length < 6) { showModal('Error', 'Password must be at least 6 characters'); return; }
            if (phone.length !== 10) { showModal('Error', 'Please enter a valid 10-digit phone number'); return; }
        }
        setLoading(true);
        try {
            if (isLogin) {
                const result = await authApiNew.login(email, password);
                if (result.success && result.response) {
                    await setAuthUser(result.response.token, result.response.user);
                    if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                    router.replace('/(tabs)');
                } else showModal('Error', result.message || 'Invalid email or password');
            } else {
                const otpResult = await authApiNew.sendOtp(email);
                if (otpResult.success) {
                    setTempEmail(email);
                    setShowOtpScreen(true);
                    showModal('OTP Sent', 'Please check your email for the verification code');
                } else showModal('Error', otpResult.message || 'Failed to send OTP');
            }
        } catch { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    }, [isLogin, email, password, name, phone, expoPushToken, showModal]);

    const handleVerifyOtp = useCallback(async () => {
        if (!otp || otp.length !== 6) { showModal('Error', 'Please enter a valid 6-digit OTP'); return; }
        setLoading(true);
        try {
            const verifyResult = await authApiNew.verifyOtp(tempEmail, otp);
            if (verifyResult.success) {
                const result = await authApiNew.register({ name, email: tempEmail, phone, password, address: address || undefined, referralCode: referralCode || undefined });
                if (result.success && result.response) {
                    await setAuthUser(result.response.token, result.response.user);
                    if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                    router.replace('/(tabs)');
                } else showModal('Error', result.message || 'Registration failed');
            } else showModal('Error', verifyResult.message || 'Invalid OTP');
        } catch { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    }, [otp, tempEmail, name, phone, password, address, referralCode, expoPushToken, showModal]);

    const handleResendOtp = useCallback(async () => {
        setLoading(true);
        try {
            const result = await authApiNew.sendOtp(tempEmail);
            if (result.success) showModal('Success', 'OTP resent to your email');
            else showModal('Error', result.message || 'Failed to resend OTP');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [tempEmail, showModal]);

    const handleForgotPassword = useCallback(async () => {
        if (!email) { showModal('Error', 'Please enter your email address'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.forgotPassword(email);
            if (result.success) {
                setTempEmail(email);
                setShowForgotPassword(false);
                setShowForgotOtpScreen(true);
                showModal('OTP Sent', 'Password reset OTP sent to your email');
            } else showModal('Error', result.message || 'Failed to send OTP');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [email, showModal]);

    const handleVerifyForgotOtp = useCallback(async () => {
        if (!otp || otp.length !== 6) { showModal('Error', 'Please enter a valid 6-digit OTP'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.verifyForgotPasswordOtp(tempEmail, otp);
            if (result.success && result.response) {
                setResetToken(result.response.resetToken);
                setShowForgotOtpScreen(false);
                setShowResetPasswordScreen(true);
                setOtp('');
            } else showModal('Error', result.message || 'Invalid OTP');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [otp, tempEmail, showModal]);

    const handleResetPassword = useCallback(async () => {
        if (!newPassword || newPassword.length < 6) { showModal('Error', 'Password must be at least 6 characters'); return; }
        if (newPassword !== confirmPassword) { showModal('Error', 'Passwords do not match'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.resetPassword(tempEmail, resetToken, newPassword);
            if (result.success) {
                showModal('Success', 'Password reset successfully! You can now login.');
                setShowResetPasswordScreen(false); setTempEmail(''); setResetToken(''); setNewPassword(''); setConfirmPassword(''); setIsLogin(true);
            } else showModal('Error', result.message || 'Failed to reset password');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [newPassword, confirmPassword, tempEmail, resetToken, showModal]);

    const handleResendForgotOtp = useCallback(async () => {
        setLoading(true);
        try {
            const result = await authApiNew.forgotPassword(tempEmail);
            if (result.success) showModal('Success', 'OTP resent to your email');
            else showModal('Error', result.message || 'Failed to resend OTP');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [tempEmail, showModal]);

    const resetForgotPasswordFlow = useCallback(() => {
        setShowForgotPassword(false); setShowForgotOtpScreen(false); setShowResetPasswordScreen(false);
        setTempEmail(''); setOtp(''); setResetToken(''); setNewPassword(''); setConfirmPassword('');
    }, []);

    // ─── Shared wrapper for all screens ───
    const ScreenWrapper = useCallback(({ children }: { children: React.ReactNode }) => (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <LinearGradient
                colors={[colors.primary + '18', colors.primary + '08', colors.background]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
            />
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 6, paddingTop: insets.top + 20, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                bounces={false}
            >
                {children}
            </ScrollView>
            <SuccessModal isVisible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle} message={modalMessage} autoClose={false} />
        </KeyboardAvoidingView>
    ), [colors, insets, modalVisible, modalTitle, modalMessage]);

    const FormCard = useCallback(({ children }: { children: React.ReactNode }) => (
        <View style={{
            backgroundColor: colors.card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
        }}>
            {children}
        </View>
    ), [colors]);

    // ─── Forgot Password - Enter Email ───
    if (showForgotPassword) {
        return (
            <ScreenWrapper>
                <LogoHeader title="Forgot Password" subtitle="Enter your email to reset password" colors={colors} compact />
                <FormCard>
                    <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center', color: colors.foreground }}>Reset Password</Text>
                    <Text style={{ fontSize: 12, textAlign: 'center', color: colors.mutedForeground, marginTop: 2, marginBottom: 14 }}>We'll send you a verification code</Text>
                    <InputField icon={Mail} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" colors={colors} />
                    <AuthButton onPress={handleForgotPassword} label="Send OTP" loading={loading} colors={colors} />
                    <Pressable style={{ marginTop: 14, alignItems: 'center' }} onPress={() => { setShowForgotPassword(false); setEmail(''); }}>
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>← Back to Login</Text>
                    </Pressable>
                </FormCard>
            </ScreenWrapper>
        );
    }

    // ─── Forgot Password - OTP ───
    if (showForgotOtpScreen) {
        return (
            <ScreenWrapper>
                <LogoHeader title="Verify OTP" subtitle={`Code sent to ${tempEmail}`} colors={colors} compact />
                <FormCard>
                    <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center', color: colors.foreground }}>Enter OTP</Text>
                    <Text style={{ fontSize: 12, textAlign: 'center', color: colors.mutedForeground, marginTop: 2, marginBottom: 14 }}>Check your email inbox</Text>
                    <InputField icon={Mail} placeholder="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} colors={colors} />
                    <AuthButton onPress={handleVerifyForgotOtp} label="Verify OTP" loading={loading} colors={colors} />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14 }}>
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Didn't receive? </Text>
                        <Pressable onPress={handleResendForgotOtp} disabled={loading}><Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Resend</Text></Pressable>
                    </View>
                    <Pressable style={{ marginTop: 10, alignItems: 'center' }} onPress={resetForgotPasswordFlow}>
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>← Back to Login</Text>
                    </Pressable>
                </FormCard>
            </ScreenWrapper>
        );
    }

    // ─── Reset Password ───
    if (showResetPasswordScreen) {
        return (
            <ScreenWrapper>
                <LogoHeader title="New Password" subtitle="Create a strong password" colors={colors} compact />
                <FormCard>
                    <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center', color: colors.foreground }}>Set New Password</Text>
                    <Text style={{ fontSize: 12, textAlign: 'center', color: colors.mutedForeground, marginTop: 2, marginBottom: 14 }}>Minimum 6 characters</Text>
                    <InputField icon={Lock} placeholder="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showNewPassword} showToggle onToggle={toggleNewPassword} toggleValue={showNewPassword} colors={colors} />
                    <InputField icon={Lock} placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showNewPassword} colors={colors} />
                    <AuthButton onPress={handleResetPassword} label="Reset Password" loading={loading} colors={colors} />
                    <Pressable style={{ marginTop: 14, alignItems: 'center' }} onPress={resetForgotPasswordFlow}>
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>← Cancel</Text>
                    </Pressable>
                </FormCard>
            </ScreenWrapper>
        );
    }

    // ─── OTP Screen ───
    if (showOtpScreen) {
        return (
            <ScreenWrapper>
                <LogoHeader title="Verify Email" subtitle={`Code sent to ${tempEmail}`} colors={colors} compact />
                <FormCard>
                    <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center', color: colors.foreground }}>Enter OTP</Text>
                    <Text style={{ fontSize: 12, textAlign: 'center', color: colors.mutedForeground, marginTop: 2, marginBottom: 14 }}>Check your email inbox</Text>
                    <InputField icon={Mail} placeholder="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} colors={colors} />
                    <AuthButton onPress={handleVerifyOtp} label="Verify & Create Account" loading={loading} colors={colors} />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14 }}>
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Didn't receive? </Text>
                        <Pressable onPress={handleResendOtp} disabled={loading}><Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Resend</Text></Pressable>
                    </View>
                    <Pressable style={{ marginTop: 10, alignItems: 'center' }} onPress={() => { setShowOtpScreen(false); setOtp(''); }}>
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>← Back to Sign Up</Text>
                    </Pressable>
                </FormCard>
            </ScreenWrapper>
        );
    }

    // ─── Main Login / Sign Up ───
    return (
        <ScreenWrapper>
            <LogoHeader
                title="Milkey"
                subtitle={isLogin ? 'Welcome back! Sign in to continue' : 'Create your account to get started'}
                colors={colors}
            />

            <FormCard>
                {/* Tab Switcher */}
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: colors.muted,
                    borderRadius: 12,
                    padding: 3,
                    marginBottom: 14,
                }}>
                    <Pressable
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            alignItems: 'center',
                            borderRadius: 10,
                            backgroundColor: isLogin ? colors.primary : 'transparent',
                        }}
                        onPress={() => setIsLogin(true)}
                    >
                        <Text style={{ fontSize: 14, fontWeight: isLogin ? '700' : '600', color: isLogin ? '#fff' : colors.mutedForeground }}>{t.auth.login}</Text>
                    </Pressable>
                    <Pressable
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            alignItems: 'center',
                            borderRadius: 10,
                            backgroundColor: !isLogin ? colors.primary : 'transparent',
                        }}
                        onPress={() => setIsLogin(false)}
                    >
                        <Text style={{ fontSize: 14, fontWeight: !isLogin ? '700' : '600', color: !isLogin ? '#fff' : colors.mutedForeground }}>{t.auth.signup}</Text>
                    </Pressable>
                </View>

                {!isLogin && (
                    <InputField icon={User} placeholder="Full Name" value={name} onChangeText={setName} colors={colors} />
                )}

                <InputField icon={Mail} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" colors={colors} />

                {!isLogin && (
                    <InputField icon={Phone} placeholder="Phone Number (10 digits)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} colors={colors} />
                )}

                <InputField
                    icon={Lock}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    showToggle
                    onToggle={togglePassword}
                    toggleValue={showPassword}
                    colors={colors}
                />

                {!isLogin && (
                    <>
                        <InputField icon={MapPin} placeholder="Address (Optional)" value={address} onChangeText={setAddress} multiline colors={colors} />
                        <InputField icon={Gift} placeholder="Referral Code (Optional)" value={referralCode} onChangeText={handleReferralChange} autoCapitalize="characters" colors={colors} />
                    </>
                )}

                {isLogin && (
                    <Pressable style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 4 }} onPress={() => setShowForgotPassword(true)}>
                        <Text style={{ fontSize: 12, fontWeight: '500', color: colors.primary }}>{t.auth.forgotPassword}</Text>
                    </Pressable>
                )}

                <AuthButton
                    onPress={handleAuth}
                    label={isLogin ? t.auth.login : t.auth.createAccount}
                    loading={loading}
                    colors={colors}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14 }}>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                        {isLogin ? t.auth.dontHaveAccount + ' ' : t.auth.alreadyHaveAccount + ' '}
                    </Text>
                    <Pressable onPress={() => setIsLogin(!isLogin)}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{isLogin ? t.auth.signup : t.auth.login}</Text>
                    </Pressable>
                </View>
            </FormCard>

            <Text style={{ fontSize: 11, textAlign: 'center', marginTop: 14, color: colors.mutedForeground, paddingHorizontal: 20 }}>
                By continuing, you agree to our Terms & Privacy Policy
            </Text>
        </ScreenWrapper>
    );
}
