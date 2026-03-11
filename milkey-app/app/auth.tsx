import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
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

    const s = createStyles(colors, isDark, insets);

    const showModal = (title: string, message: string) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalVisible(true);
    };

    const handleAuth = async () => {
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
                    if (expoPushToken) { authApiNew.updatePushToken(expoPushToken).catch(console.error); }
                    router.replace('/(tabs)');
                } else { showModal('Error', result.message || 'Invalid email or password'); }
            } else {
                const otpResult = await authApiNew.sendOtp(email);
                if (otpResult.success) {
                    setTempEmail(email);
                    setShowOtpScreen(true);
                    showModal('OTP Sent', 'Please check your email for the verification code');
                } else { showModal('Error', otpResult.message || 'Failed to send OTP'); }
            }
        } catch (error) { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length !== 6) { showModal('Error', 'Please enter a valid 6-digit OTP'); return; }
        setLoading(true);
        try {
            const verifyResult = await authApiNew.verifyOtp(tempEmail, otp);
            if (verifyResult.success) {
                const result = await authApiNew.register({ name, email: tempEmail, phone, password, address: address || undefined, referralCode: referralCode || undefined });
                if (result.success && result.response) {
                    await setAuthUser(result.response.token, result.response.user);
                    if (expoPushToken) { authApiNew.updatePushToken(expoPushToken).catch(console.error); }
                    router.replace('/(tabs)');
                } else { showModal('Error', result.message || 'Registration failed'); }
            } else { showModal('Error', verifyResult.message || 'Invalid OTP'); }
        } catch (error) { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    };

    const handleResendOtp = async () => {
        setLoading(true);
        try {
            const result = await authApiNew.sendOtp(tempEmail);
            if (result.success) { showModal('Success', 'OTP resent to your email'); }
            else { showModal('Error', result.message || 'Failed to resend OTP'); }
        } catch (error) { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    };

    const handleForgotPassword = async () => {
        if (!email) { showModal('Error', 'Please enter your email address'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.forgotPassword(email);
            if (result.success) {
                setTempEmail(email);
                setShowForgotPassword(false);
                setShowForgotOtpScreen(true);
                showModal('OTP Sent', 'Password reset OTP sent to your email');
            } else { showModal('Error', result.message || 'Failed to send OTP'); }
        } catch (error) { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    };

    const handleVerifyForgotOtp = async () => {
        if (!otp || otp.length !== 6) { showModal('Error', 'Please enter a valid 6-digit OTP'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.verifyForgotPasswordOtp(tempEmail, otp);
            if (result.success && result.response) {
                setResetToken(result.response.resetToken);
                setShowForgotOtpScreen(false);
                setShowResetPasswordScreen(true);
                setOtp('');
            } else { showModal('Error', result.message || 'Invalid OTP'); }
        } catch (error) { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    };

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) { showModal('Error', 'Password must be at least 6 characters'); return; }
        if (newPassword !== confirmPassword) { showModal('Error', 'Passwords do not match'); return; }
        setLoading(true);
        try {
            const result = await authApiNew.resetPassword(tempEmail, resetToken, newPassword);
            if (result.success) {
                showModal('Success', 'Password reset successfully! You can now login.');
                setShowResetPasswordScreen(false); setTempEmail(''); setResetToken(''); setNewPassword(''); setConfirmPassword(''); setIsLogin(true);
            } else { showModal('Error', result.message || 'Failed to reset password'); }
        } catch (error) { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    };

    const handleResendForgotOtp = async () => {
        setLoading(true);
        try {
            const result = await authApiNew.forgotPassword(tempEmail);
            if (result.success) { showModal('Success', 'OTP resent to your email'); }
            else { showModal('Error', result.message || 'Failed to resend OTP'); }
        } catch (error) { showModal('Error', 'Network error. Please check your connection.'); }
        finally { setLoading(false); }
    };

    const resetForgotPasswordFlow = () => {
        setShowForgotPassword(false); setShowForgotOtpScreen(false); setShowResetPasswordScreen(false);
        setTempEmail(''); setOtp(''); setResetToken(''); setNewPassword(''); setConfirmPassword('');
    };

    // Reusable input
    const InputField = ({ icon: Icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, maxLength, autoCapitalize, multiline, showToggle, toggleValue, onToggle }: any) => (
        <View style={[s.inputContainer, { borderColor: colors.border }]}>
            <Icon size={16} color={colors.mutedForeground} style={s.inputIcon} />
            <TextInput
                style={s.input}
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                maxLength={maxLength}
                autoCapitalize={autoCapitalize || 'none'}
                placeholderTextColor={colors.mutedForeground}
                multiline={multiline}
            />
            {showToggle && (
                <Pressable onPress={onToggle} style={s.eyeIcon}>
                    {toggleValue ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
                </Pressable>
            )}
        </View>
    );

    // Reusable button with spinner
    const AuthButton = ({ onPress, label, disabled }: { onPress: () => void; label: string; disabled?: boolean }) => (
        <Pressable
            style={[s.authButton, (loading || disabled) && s.authButtonDisabled]}
            onPress={onPress}
            disabled={loading || disabled}
        >
            {loading ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={s.authButtonText}>{label}</Text>}
        </Pressable>
    );

    // Logo header
    const LogoHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
        <View style={s.logoContainer}>
            <Image source={require('@/assets/images/icon.png')} style={s.logoImage} resizeMode="contain" />
            <Text style={[s.appName, { color: colors.foreground }]}>{title}</Text>
            <Text style={[s.tagline, { color: colors.mutedForeground }]}>{subtitle}</Text>
        </View>
    );

    // Forgot Password - Enter Email
    if (showForgotPassword) {
        return (
            <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <LinearGradient colors={[colors.primary + '15', colors.background, colors.background]} style={s.gradient} />
                <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <LogoHeader title="Forgot Password" subtitle="Enter your email to reset password" />
                    <View style={s.formCard}>
                        <Text style={[s.formTitle, { color: colors.foreground }]}>Reset Password</Text>
                        <Text style={[s.formSubtitle, { color: colors.mutedForeground }]}>We'll send you a verification code</Text>
                        <InputField icon={Mail} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" />
                        <AuthButton onPress={handleForgotPassword} label="Send OTP" />
                        <Pressable style={s.backButton} onPress={() => { setShowForgotPassword(false); setEmail(''); }}>
                            <Text style={[s.backButtonText, { color: colors.mutedForeground }]}>← Back to Login</Text>
                        </Pressable>
                    </View>
                </ScrollView>
                <SuccessModal isVisible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle} message={modalMessage} autoClose={false} />
            </KeyboardAvoidingView>
        );
    }

    // Forgot Password - OTP
    if (showForgotOtpScreen) {
        return (
            <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <LinearGradient colors={[colors.primary + '15', colors.background, colors.background]} style={s.gradient} />
                <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <LogoHeader title="Verify OTP" subtitle={`Enter the 6-digit code sent to ${tempEmail}`} />
                    <View style={s.formCard}>
                        <Text style={[s.formTitle, { color: colors.foreground }]}>Enter OTP</Text>
                        <Text style={[s.formSubtitle, { color: colors.mutedForeground }]}>Check your email inbox</Text>
                        <InputField icon={Mail} placeholder="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                        <AuthButton onPress={handleVerifyForgotOtp} label="Verify OTP" />
                        <View style={s.switchContainer}>
                            <Text style={[s.switchText, { color: colors.mutedForeground }]}>Didn't receive the code? </Text>
                            <Pressable onPress={handleResendForgotOtp} disabled={loading}><Text style={[s.switchLink, { color: colors.primary }]}>Resend OTP</Text></Pressable>
                        </View>
                        <Pressable style={s.backButton} onPress={resetForgotPasswordFlow}>
                            <Text style={[s.backButtonText, { color: colors.mutedForeground }]}>← Back to Login</Text>
                        </Pressable>
                    </View>
                </ScrollView>
                <SuccessModal isVisible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle} message={modalMessage} autoClose={false} />
            </KeyboardAvoidingView>
        );
    }

    // Reset Password
    if (showResetPasswordScreen) {
        return (
            <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <LinearGradient colors={[colors.primary + '15', colors.background, colors.background]} style={s.gradient} />
                <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <LogoHeader title="New Password" subtitle="Create a strong password" />
                    <View style={s.formCard}>
                        <Text style={[s.formTitle, { color: colors.foreground }]}>Set New Password</Text>
                        <Text style={[s.formSubtitle, { color: colors.mutedForeground }]}>Minimum 6 characters</Text>
                        <InputField icon={Lock} placeholder="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showNewPassword} showToggle onToggle={() => setShowNewPassword(!showNewPassword)} toggleValue={showNewPassword} />
                        <InputField icon={Lock} placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showNewPassword} />
                        <AuthButton onPress={handleResetPassword} label="Reset Password" />
                        <Pressable style={s.backButton} onPress={resetForgotPasswordFlow}>
                            <Text style={[s.backButtonText, { color: colors.mutedForeground }]}>← Cancel</Text>
                        </Pressable>
                    </View>
                </ScrollView>
                <SuccessModal isVisible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle} message={modalMessage} autoClose={false} />
            </KeyboardAvoidingView>
        );
    }

    // OTP Screen
    if (showOtpScreen) {
        return (
            <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <LinearGradient colors={[colors.primary + '15', colors.background, colors.background]} style={s.gradient} />
                <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <LogoHeader title="Verify Email" subtitle={`Enter the 6-digit code sent to ${tempEmail}`} />
                    <View style={s.formCard}>
                        <Text style={[s.formTitle, { color: colors.foreground }]}>Enter OTP</Text>
                        <Text style={[s.formSubtitle, { color: colors.mutedForeground }]}>Check your email inbox</Text>
                        <InputField icon={Mail} placeholder="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                        <AuthButton onPress={handleVerifyOtp} label="Verify & Create Account" />
                        <View style={s.switchContainer}>
                            <Text style={[s.switchText, { color: colors.mutedForeground }]}>Didn't receive the code? </Text>
                            <Pressable onPress={handleResendOtp} disabled={loading}><Text style={[s.switchLink, { color: colors.primary }]}>Resend OTP</Text></Pressable>
                        </View>
                        <Pressable style={s.backButton} onPress={() => { setShowOtpScreen(false); setOtp(''); }}>
                            <Text style={[s.backButtonText, { color: colors.mutedForeground }]}>← Back to Sign Up</Text>
                        </Pressable>
                    </View>
                </ScrollView>
                <SuccessModal isVisible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle} message={modalMessage} autoClose={false} />
            </KeyboardAvoidingView>
        );
    }

    // Main Login / Sign Up
    return (
        <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <LinearGradient colors={[colors.primary + '15', colors.background, colors.background]} style={s.gradient} />
            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <LogoHeader
                    title="Milkey"
                    subtitle={isLogin ? 'Welcome back! Sign in to continue' : 'Create your account to get started'}
                />

                <View style={s.formCard}>
                    {/* Tab Switcher */}
                    <View style={s.tabContainer}>
                        <Pressable style={[s.tab, isLogin && s.tabActive]} onPress={() => setIsLogin(true)}>
                            <Text style={[s.tabText, isLogin && s.tabTextActive, { color: isLogin ? colors.white : colors.mutedForeground }]}>Login</Text>
                        </Pressable>
                        <Pressable style={[s.tab, !isLogin && s.tabActive]} onPress={() => setIsLogin(false)}>
                            <Text style={[s.tabText, !isLogin && s.tabTextActive, { color: !isLogin ? colors.white : colors.mutedForeground }]}>Sign Up</Text>
                        </Pressable>
                    </View>

                    {!isLogin && (
                        <InputField icon={User} placeholder="Full Name" value={name} onChangeText={setName} />
                    )}

                    <InputField icon={Mail} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" />

                    {!isLogin && (
                        <InputField icon={Phone} placeholder="Phone Number (10 digits)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
                    )}

                    <InputField
                        icon={Lock}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        showToggle
                        onToggle={() => setShowPassword(!showPassword)}
                        toggleValue={showPassword}
                    />

                    {!isLogin && (
                        <>
                            <InputField icon={MapPin} placeholder="Address (Optional)" value={address} onChangeText={setAddress} multiline />
                            <InputField icon={Gift} placeholder="Referral Code (Optional)" value={referralCode} onChangeText={(t: string) => setReferralCode(t.toUpperCase())} autoCapitalize="characters" />
                        </>
                    )}

                    {isLogin && (
                        <Pressable style={s.forgotPasswordButton} onPress={() => setShowForgotPassword(true)}>
                            <Text style={[s.forgotPasswordText, { color: colors.primary }]}>Forgot Password?</Text>
                        </Pressable>
                    )}

                    <AuthButton
                        onPress={handleAuth}
                        label={isLogin ? 'Login' : 'Create Account'}
                    />

                    <View style={s.switchContainer}>
                        <Text style={[s.switchText, { color: colors.mutedForeground }]}>
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                        </Text>
                        <Pressable onPress={() => setIsLogin(!isLogin)}>
                            <Text style={[s.switchLink, { color: colors.primary }]}>{isLogin ? 'Sign Up' : 'Login'}</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Footer */}
                <Text style={[s.footer, { color: colors.mutedForeground }]}>
                    By continuing, you agree to our Terms & Privacy Policy
                </Text>
            </ScrollView>

            <SuccessModal isVisible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle} message={modalMessage} autoClose={false} />
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
        height: 350,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 6,
        paddingTop: insets.top + 30,
        paddingBottom: 30,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logoImage: {
        width: 90,
        height: 90,
        borderRadius: 22,
        marginBottom: 10,
    },
    appName: {
        fontSize: 30,
        fontWeight: '800',
        letterSpacing: 2,
    },
    tagline: {
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    formCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginHorizontal: 6,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.muted,
        borderRadius: 10,
        padding: 3,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabActive: {
        backgroundColor: colors.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        fontWeight: '700',
    },
    formTitle: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    formSubtitle: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 2,
        marginBottom: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.input,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
    },
    inputIcon: {
        marginLeft: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 8,
        fontSize: 13,
        color: colors.foreground,
    },
    eyeIcon: {
        padding: 10,
    },
    authButton: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 13,
        alignItems: 'center',
        marginTop: 6,
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
        marginTop: 14,
    },
    switchText: {
        fontSize: 13,
    },
    switchLink: {
        fontSize: 13,
        fontWeight: '600',
    },
    backButton: {
        marginTop: 12,
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 13,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginTop: -2,
        marginBottom: 6,
    },
    forgotPasswordText: {
        fontSize: 12,
        fontWeight: '500',
    },
    footer: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 16,
        paddingHorizontal: 20,
    },
});
