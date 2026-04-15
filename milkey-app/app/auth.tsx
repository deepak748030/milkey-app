import React, { useState, useCallback, memo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, User, Phone, Gift, MapPin, ArrowLeft, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApiNew } from '@/lib/milkeyApi';
import { setAuthUser } from '@/lib/authStore';
import { SuccessModal } from '@/components/SuccessModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// ─── Sub-components ───

const InputField = memo(({ icon: Icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, maxLength, autoCapitalize, multiline, showToggle, toggleValue, onToggle, colors }: any) => (
    <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.input,
        borderRadius: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: colors.border,
        height: multiline ? undefined : 44,
    }}>
        <Icon size={16} color={colors.mutedForeground} style={{ marginLeft: 10 }} />
        <TextInput
            style={{
                flex: 1,
                paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                paddingHorizontal: 8,
                fontSize: 13,
                color: colors.foreground,
            }}
            placeholder={placeholder}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize || 'none'}
            placeholderTextColor={colors.mutedForeground + '88'}
            multiline={multiline}
        />
        {showToggle && (
            <Pressable onPress={onToggle} hitSlop={8} style={{ padding: 10 }}>
                {toggleValue ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
            </Pressable>
        )}
    </View>
));

const PrimaryButton = memo(({ onPress, label, disabled, loading, colors, style, variant }: any) => {
    const isMuted = variant === 'muted';
    return (
        <Pressable
            style={({ pressed }) => ({
                backgroundColor: isMuted ? colors.muted : colors.primary,
                borderRadius: 10,
                height: 44,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
                opacity: (loading || disabled) ? 0.6 : pressed ? 0.85 : 1,
                borderWidth: isMuted ? 1 : 0,
                borderColor: isMuted ? colors.border : 'transparent',
                ...style,
            })}
            onPress={onPress}
            disabled={loading || disabled}
        >
            {loading
                ? <ActivityIndicator size="small" color={isMuted ? colors.foreground : '#fff'} />
                : <Text style={{ color: isMuted ? colors.foreground : '#fff', fontSize: 14, fontWeight: '700' }}>{label}</Text>
            }
        </Pressable>
    );
});

const LogoHeader = memo(({ title, subtitle, colors, compact }: any) => (
    <View style={{ alignItems: 'center', marginBottom: compact ? 12 : 18 }}>
        <View style={{
            width: compact ? 60 : 76,
            height: compact ? 60 : 76,
            borderRadius: compact ? 16 : 20,
            overflow: 'hidden',
            marginBottom: 8,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 4,
        }}>
            <Image
                source={require('@/assets/images/icon.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
            />
        </View>
        <Text style={{ fontSize: compact ? 22 : 26, fontWeight: '800', letterSpacing: 1, color: colors.foreground }}>{title}</Text>
        <Text style={{ fontSize: 12, marginTop: 2, textAlign: 'center', color: colors.mutedForeground, paddingHorizontal: 16 }}>{subtitle}</Text>
    </View>
));

export default function AuthScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { expoPushToken } = usePushNotifications();

    // Screens: 'login' | 'login-otp' | 'register-details' | 'forgot' | 'forgot-otp' | 'reset-password'
    const [screen, setScreen] = useState<'login' | 'login-otp' | 'register-details' | 'forgot' | 'forgot-otp' | 'reset-password'>('login');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [resetToken, setResetToken] = useState('');

    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');

    const showModal = useCallback((title: string, message: string) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalVisible(true);
    }, []);

    const togglePassword = useCallback(() => setShowPassword(v => !v), []);
    const toggleNewPassword = useCallback(() => setShowNewPassword(v => !v), []);
    const handleReferralChange = useCallback((t: string) => setReferralCode(t.toUpperCase()), []);

    // ─── Handlers ───

    const handleSendLoginOtp = useCallback(async () => {
        if (!phone || phone.length !== 10) { showModal('Error', 'Please enter a valid 10-digit phone number'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.sendPhoneOtp(phone);
            if (result.success) {
                setScreen('login-otp');
                showModal('OTP Sent', 'OTP sent to your phone number');
            } else showModal('Error', result.message || 'Failed to send OTP');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [phone, showModal]);

    const handleOtpLogin = useCallback(async () => {
        if (!otp || otp.length !== 6) { showModal('Error', 'Please enter a valid 6-digit OTP'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.phoneLogin(phone, otp);
            if (result.success && result.response) {
                // Check if user needs registration
                if (result.response.needsRegistration || result.code === 'USER_NOT_FOUND') {
                    // Phone verified but no account - show registration form
                    setOtp('');
                    setScreen('register-details');
                    return;
                }
                // User exists - login
                await setAuthUser(result.response.token, result.response.user);
                if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                router.replace('/(tabs)');
            } else showModal('Error', result.message || 'Login failed');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [phone, otp, expoPushToken, showModal]);

    const handleCompleteRegistration = useCallback(async () => {
        if (!name) { showModal('Error', 'Please enter your name'); return; }
        if (!email) { showModal('Error', 'Please enter your email'); return; }
        if (!password || password.length < 6) { showModal('Error', 'Password must be at least 6 characters'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.phoneRegister({
                phone,
                name,
                email,
                password,
                address: address || undefined,
                referralCode: referralCode || undefined,
            });
            if (result.success && result.response) {
                await setAuthUser(result.response.token, result.response.user);
                if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                router.replace('/(tabs)');
            } else showModal('Error', result.message || 'Registration failed');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [name, email, phone, password, address, referralCode, expoPushToken, showModal]);

    const handleGoogleAuth = useCallback(async () => {
        setGoogleLoading(true);
        try {
            const redirectUri = 'https://auth.expo.io/@milkey/milkey';
            const clientId = '835983322060-placeholder.apps.googleusercontent.com';
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20email%20profile&nonce=${Math.random().toString(36).substring(7)}`;
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            if (result.type === 'success' && result.url) {
                const urlParams = new URLSearchParams(result.url.split('#')[1] || '');
                const idToken = urlParams.get('id_token');
                if (idToken) {
                    const authResult = await authApiNew.googleLogin(idToken);
                    if (authResult.success && authResult.response) {
                        await setAuthUser(authResult.response.token, authResult.response.user);
                        if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                        router.replace('/(tabs)');
                    } else showModal('Error', authResult.message || 'Google sign in failed');
                } else showModal('Error', 'Failed to get Google token');
            }
        } catch { showModal('Error', 'Google sign in failed. Please try again.'); }
        setGoogleLoading(false);
    }, [expoPushToken, showModal]);

    const handleForgotPassword = useCallback(async () => {
        if (!email) { showModal('Error', 'Please enter your email address'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.forgotPassword(email);
            if (result.success) { setScreen('forgot-otp'); showModal('OTP Sent', 'Password reset OTP sent to your email'); }
            else showModal('Error', result.message || 'Failed to send OTP');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [email, showModal]);

    const handleVerifyForgotOtp = useCallback(async () => {
        if (!otp || otp.length !== 6) { showModal('Error', 'Please enter a valid 6-digit OTP'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.verifyForgotPasswordOtp(email, otp);
            if (result.success && result.response) { setResetToken(result.response.resetToken); setScreen('reset-password'); setOtp(''); }
            else showModal('Error', result.message || 'Invalid OTP');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [otp, email, showModal]);

    const handleResetPassword = useCallback(async () => {
        if (!newPassword || newPassword.length < 6) { showModal('Error', 'Password must be at least 6 characters'); return; }
        if (newPassword !== confirmPassword) { showModal('Error', 'Passwords do not match'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.resetPassword(email, resetToken, newPassword);
            if (result.success) {
                showModal('Success', 'Password reset successfully!');
                setScreen('login'); setNewPassword(''); setConfirmPassword(''); setResetToken('');
            } else showModal('Error', result.message || 'Failed to reset password');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [newPassword, confirmPassword, email, resetToken, showModal]);

    // ─── Shared UI pieces ───

    const ScreenWrapper = useCallback(({ children }: { children: React.ReactNode }) => (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <LinearGradient
                colors={[colors.primary + '14', colors.primary + '06', colors.background]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260 }}
            />
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 6, paddingTop: insets.top + 12, paddingBottom: 20 }}
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
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
        }}>
            {children}
        </View>
    ), [colors]);

    const BackButton = useCallback(({ onPress }: { onPress: () => void }) => (
        <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 4 }}>
            <ArrowLeft size={16} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Back</Text>
        </Pressable>
    ), [colors]);

    const Divider = useCallback(() => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 10, color: colors.mutedForeground, paddingHorizontal: 10, fontWeight: '500' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
    ), [colors]);

    const GoogleButton = useCallback(({ label, onPress }: { label: string; onPress: () => void }) => (
        <Pressable
            style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.background,
                borderRadius: 10,
                height: 44,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
                opacity: googleLoading ? 0.6 : pressed ? 0.85 : 1,
            })}
            onPress={onPress}
            disabled={googleLoading || loading}
        >
            {googleLoading ? (
                <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
                <>
                    <Image
                        source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                        style={{ width: 18, height: 18 }}
                        resizeMode="contain"
                    />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{label}</Text>
                </>
            )}
        </Pressable>
    ), [colors, googleLoading, loading]);

    // ═══════════════════════════════════════
    // SCREENS
    // ═══════════════════════════════════════

    if (screen === 'forgot') {
        return (
            <ScreenWrapper>
                <BackButton onPress={() => setScreen('login')} />
                <LogoHeader title="Forgot Password" subtitle="Enter your email to reset password" colors={colors} compact />
                <FormCard>
                    <InputField icon={Mail} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" colors={colors} />
                    <View style={{ height: 6 }} />
                    <PrimaryButton onPress={handleForgotPassword} label="Send OTP" loading={loading} colors={colors} />
                </FormCard>
            </ScreenWrapper>
        );
    }

    if (screen === 'forgot-otp') {
        return (
            <ScreenWrapper>
                <BackButton onPress={() => setScreen('forgot')} />
                <LogoHeader title="Verify OTP" subtitle={`Code sent to ${email}`} colors={colors} compact />
                <FormCard>
                    <InputField icon={Mail} placeholder="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} colors={colors} />
                    <View style={{ height: 6 }} />
                    <PrimaryButton onPress={handleVerifyForgotOtp} label="Verify OTP" loading={loading} colors={colors} />
                    <Pressable style={{ marginTop: 10, alignItems: 'center' }} onPress={handleForgotPassword}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Resend OTP</Text>
                    </Pressable>
                </FormCard>
            </ScreenWrapper>
        );
    }

    if (screen === 'reset-password') {
        return (
            <ScreenWrapper>
                <BackButton onPress={() => setScreen('login')} />
                <LogoHeader title="New Password" subtitle="Create a strong password" colors={colors} compact />
                <FormCard>
                    <InputField icon={Lock} placeholder="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showNewPassword} showToggle onToggle={toggleNewPassword} toggleValue={showNewPassword} colors={colors} />
                    <InputField icon={Lock} placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showNewPassword} colors={colors} />
                    <View style={{ height: 6 }} />
                    <PrimaryButton onPress={handleResetPassword} label="Reset Password" loading={loading} colors={colors} />
                </FormCard>
            </ScreenWrapper>
        );
    }

    if (screen === 'login-otp') {
        return (
            <ScreenWrapper>
                <BackButton onPress={() => { setScreen('login'); setOtp(''); }} />
                <LogoHeader title="Verify OTP" subtitle={`OTP sent to +91 ${phone}`} colors={colors} compact />
                <FormCard>
                    <Text style={{ fontSize: 14, fontWeight: '700', textAlign: 'center', color: colors.foreground, marginBottom: 2 }}>Enter OTP</Text>
                    <Text style={{ fontSize: 11, textAlign: 'center', color: colors.mutedForeground, marginBottom: 10 }}>Enter the OTP sent to your phone</Text>
                    <InputField icon={Lock} placeholder="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} colors={colors} />
                    <View style={{ height: 6 }} />
                    <PrimaryButton onPress={handleOtpLogin} label="Verify & Continue" loading={loading} colors={colors} />
                    <Pressable style={{ marginTop: 10, alignItems: 'center' }} onPress={handleSendLoginOtp}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Resend OTP</Text>
                    </Pressable>
                </FormCard>
            </ScreenWrapper>
        );
    }

    // ─── Register Details (shown when phone verified but no account) ───
    if (screen === 'register-details') {
        return (
            <ScreenWrapper>
                <BackButton onPress={() => { setScreen('login'); setOtp(''); }} />
                <LogoHeader title="Complete Profile" subtitle={`Phone +91 ${phone} verified ✓\nPlease fill your details to continue`} colors={colors} compact />
                <FormCard>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, padding: 8, backgroundColor: colors.primary + '10', borderRadius: 8, borderWidth: 1, borderColor: colors.primary + '20' }}>
                        <CheckCircle size={16} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.foreground }}>Phone Verified</Text>
                            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>+91 {phone}</Text>
                        </View>
                    </View>

                    <InputField icon={User} placeholder="Full Name *" value={name} onChangeText={setName} colors={colors} />
                    <InputField icon={Mail} placeholder="Email Address *" value={email} onChangeText={setEmail} keyboardType="email-address" colors={colors} />
                    <InputField icon={Lock} placeholder="Create Password (min 6 chars) *" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} showToggle onToggle={togglePassword} toggleValue={showPassword} colors={colors} />
                    <InputField icon={MapPin} placeholder="Address (Optional)" value={address} onChangeText={setAddress} multiline colors={colors} />
                    <InputField icon={Gift} placeholder="Referral Code (Optional)" value={referralCode} onChangeText={handleReferralChange} autoCapitalize="characters" colors={colors} />
                    <View style={{ height: 6 }} />
                    <PrimaryButton onPress={handleCompleteRegistration} label="Create Account & Continue" loading={loading} colors={colors} />
                </FormCard>
            </ScreenWrapper>
        );
    }

    // ═══════════════════════════════════════
    // ─── MAIN LOGIN SCREEN ───
    // ═══════════════════════════════════════
    return (
        <ScreenWrapper>
            <LogoHeader title="Milkey" subtitle="Welcome! Sign in or create your account" colors={colors} />

            <FormCard>
                <Text style={{ fontSize: 16, fontWeight: '700', textAlign: 'center', color: colors.foreground, marginBottom: 10 }}>Login / Register</Text>

                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.mutedForeground, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Enter your Mobile Number</Text>
                <InputField icon={Phone} placeholder="Phone Number (10 digits)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} colors={colors} />
                <View style={{ height: 6 }} />
                <PrimaryButton onPress={handleSendLoginOtp} label="Send OTP" loading={loading && !googleLoading} colors={colors} />
                <Text style={{ fontSize: 10, textAlign: 'center', color: colors.mutedForeground, marginTop: 4 }}>
                    If registered → Login, If new → Create Account
                </Text>

                <Divider />

                <GoogleButton label="Continue with Google" onPress={handleGoogleAuth} />

                <Pressable style={{ alignSelf: 'center', marginTop: 10 }} onPress={() => setScreen('forgot')}>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: colors.primary }}>Forgot Password?</Text>
                </Pressable>
            </FormCard>

            <Text style={{ fontSize: 10, textAlign: 'center', marginTop: 12, color: colors.mutedForeground, paddingHorizontal: 16 }}>
                By continuing, you agree to our Terms & Privacy Policy
            </Text>
        </ScreenWrapper>
    );
}
