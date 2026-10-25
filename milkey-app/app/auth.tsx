import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal, FlatList } from 'react-native';
import { TextInput } from '@/components/ui/HapticTextInput';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, User, Phone, Gift, MapPin, ArrowLeft, CheckCircle, Camera, ChevronDown, X, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApiNew } from '@/lib/milkeyApi';
import { setAuthUser } from '@/lib/authStore';
import { SuccessModal } from '@/components/SuccessModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';

const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];
// NOTE: `expo-firebase-recaptcha` was removed (deprecated since Expo SDK 48).
// Phone OTP now flows through our own server: /api/auth/send-phone-otp + /api/auth/phone-login.
// Firebase JS SDK is still imported elsewhere for Google sign-in / future use.

// Google OAuth client IDs from milkey-app/google-services.json.
// Web Client ID is REQUIRED — it's what gives us the idToken to verify on the server.
// Native Android client ID does NOT need to be passed; the native SDK reads it from
// google-services.json automatically using the package name + SHA-1.
const GOOGLE_WEB_CLIENT_ID = '95043026756-b6i7gsmmq6vb4fu9d4eo1lsdle4ctb1t.apps.googleusercontent.com';
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const GOOGLE_STATUS_CODES = {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

let googleSigninModule: any | null | undefined;

const getGoogleSigninModule = () => {
    if (googleSigninModule !== undefined) return googleSigninModule;

    try {
        // Lazy require is intentional: a static import crashes the whole auth screen
        // when the installed Expo/dev APK does not contain RNGoogleSignin yet.
        googleSigninModule = require('@react-native-google-signin/google-signin');
        console.log('[auth][google] native module loaded');
    } catch (e: any) {
        googleSigninModule = null;
        console.error('[auth][google] native module missing:', {
            message: e?.message,
            executionEnvironment: Constants.executionEnvironment,
            platform: Platform.OS,
        });
    }

    return googleSigninModule;
};

const configureGoogleSignin = () => {
    if (IS_EXPO_GO) return false;

    const module = getGoogleSigninModule();
    if (!module?.GoogleSignin) return false;

    try {
        module.GoogleSignin.configure({
            webClientId: GOOGLE_WEB_CLIENT_ID,
            offlineAccess: true,
            scopes: ['profile', 'email'],
        });
        console.log('[auth][google] GoogleSignin.configure done');
        return true;
    } catch (e) {
        console.warn('[auth][google] GoogleSignin.configure failed:', e);
        return false;
    }
};

// Do not configure at module load. If the native module is missing, importing it
// at startup throws `RNGoogleSignin could not be found` before the auth UI renders.

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

const OtpBoxes = memo(({ value, onChange, colors, autoFocus }: { value: string; onChange: (v: string) => void; colors: any; autoFocus?: boolean }) => {
    const inputRef = useRef<any>(null);
    const digits = (value || '').padEnd(6, ' ').slice(0, 6).split('');

    useEffect(() => {
        if (autoFocus) {
            const t = setTimeout(() => inputRef.current?.focus(), 250);
            return () => clearTimeout(t);
        }
    }, [autoFocus]);

    const handleChange = (text: string) => {
        onChange(text.replace(/\D/g, '').slice(0, 6));
    };

    return (
        <Pressable onPress={() => inputRef.current?.focus()} style={{ marginVertical: 6 }}>
            <TextInput
                ref={inputRef}
                value={value}
                onChangeText={handleChange}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete={'sms-otp' as any}
                textContentType="oneTimeCode"
                importantForAutofill="yes"
                caretHidden
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <View
                        key={i}
                        style={{
                            width: 44,
                            height: 52,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: digits[i] !== ' ' ? colors.primary : colors.border,
                            backgroundColor: colors.input,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>
                            {digits[i] === ' ' ? '' : digits[i]}
                        </Text>
                    </View>
                ))}
            </View>
        </Pressable>
    );
});

const StatePickerModal = memo(({ visible, onClose, onSelect, selected, colors }: { visible: boolean; onClose: () => void; onSelect: (s: string) => void; selected: string; colors: any }) => {
    const [query, setQuery] = useState('');
    const filtered = INDIAN_STATES.filter(s => s.toLowerCase().includes(query.toLowerCase()));
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={onClose}>
                <Pressable style={{ marginTop: 'auto', backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '75%', paddingBottom: 20 }} onPress={() => { }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>Select State</Text>
                        <Pressable onPress={onClose} hitSlop={8}><X size={20} color={colors.foreground} /></Pressable>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, marginHorizontal: 12, marginTop: 10, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                        <Search size={14} color={colors.mutedForeground} />
                        <TextInput
                            placeholder="Search state..."
                            placeholderTextColor={colors.mutedForeground + '88'}
                            value={query}
                            onChangeText={setQuery}
                            style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: colors.foreground, fontSize: 13 }}
                        />
                    </View>
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => { onSelect(item); onClose(); }}
                                style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? colors.muted : 'transparent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' })}
                            >
                                <Text style={{ fontSize: 14, color: colors.foreground }}>{item}</Text>
                                {selected === item && <CheckCircle size={16} color={colors.primary} />}
                            </Pressable>
                        )}
                    />
                </Pressable>
            </Pressable>
        </Modal>
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

    // Register-details extras
    const [stateName, setStateName] = useState('');
    const [statePickerOpen, setStatePickerOpen] = useState(false);
    const [avatarUri, setAvatarUri] = useState('');
    const [avatarBase64, setAvatarBase64] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);
    // Google flow mode: 'login' (sign-in only) or 'verify' (verify+attach during register)
    const googleModeRef = useRef<'login' | 'verify'>('login');

    // (Firebase phone-auth refs removed — OTP is handled by our server now.)

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

    // ─── Send token / user info to our backend ───
    const finishGoogleLogin = async (idToken: string | null, userInfo: { email: string; name?: string; photo?: string | null }) => {
        try {
            // ─── Verify-email mode (used during register-details to attach a verified Google email) ───
            if (googleModeRef.current === 'verify') {
                console.log('[auth][google] verify-email mode for', userInfo.email);
                const check = await authApiNew.checkGoogleEmail({
                    idToken: idToken || undefined,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.photo || '',
                });
                if (!check.success || !check.response) {
                    showModal('Error', check.message || 'Could not verify email');
                    return;
                }
                if (check.response.exists) {
                    showModal('Email already in use', `${check.response.email} is already registered. Please use a different Google account.`);
                    return;
                }
                setEmail(check.response.email);
                setEmailVerified(true);
                if (!name && check.response.name) setName(check.response.name);
                if (!avatarUri && check.response.picture) setAvatarUri(check.response.picture);
                showModal('Verified', `Email ${check.response.email} verified successfully.`);
                return;
            }

            // ─── Login mode: only sign in existing accounts (registration must use phone OTP) ───
            // Prefer idToken — backend can verify it cryptographically with Google.
            if (idToken) {
                console.log('[auth][google] sending idToken to server');
                // First check that the email is already registered (don't auto-create).
                const check = await authApiNew.checkGoogleEmail({
                    idToken,
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.photo || '',
                });
                if (check.success && check.response && !check.response.exists) {
                    showModal('Not registered', 'This Google account is not registered. Please sign up with your phone number first.');
                    return;
                }
                const authResult = await authApiNew.googleLogin(idToken);
                console.log('[auth][google] server google-token result:', {
                    success: authResult.success,
                    message: authResult.message,
                    hasToken: !!authResult.response?.token,
                });
                if (authResult.success && authResult.response) {
                    await setAuthUser(authResult.response.token, authResult.response.user);
                    if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                    router.replace('/(tabs)');
                    return;
                }
                // fall through to userinfo path on server failure
                console.warn('[auth][google] idToken login failed, falling back to userinfo:', authResult.message);
            }

            // Fallback: send raw user info (server treats as trusted only if no idToken path)
            const checkInfo = await authApiNew.checkGoogleEmail({
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.photo || '',
            });
            if (checkInfo.success && checkInfo.response && !checkInfo.response.exists) {
                showModal('Not registered', 'This Google account is not registered. Please sign up with your phone number first.');
                return;
            }
            const authResult = await authApiNew.googleLoginWithInfo({
                email: userInfo.email,
                name: userInfo.name || userInfo.email.split('@')[0],
                picture: userInfo.photo || '',
            });
            console.log('[auth][google] server google-info result:', {
                success: authResult.success,
                message: authResult.message,
                hasToken: !!authResult.response?.token,
            });
            if (authResult.success && authResult.response) {
                await setAuthUser(authResult.response.token, authResult.response.user);
                if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                router.replace('/(tabs)');
            } else {
                showModal('Error', authResult.message || 'Google sign in failed');
            }
        } catch (err: any) {
            console.error('[auth][google] backend error:', err?.message, err);
            showModal('Error', 'Google sign in failed. Please try again.');
        } finally {
            setGoogleLoading(false);
            googleModeRef.current = 'login';
        }
    };

    // ─── Handlers ───

    const handleSendLoginOtp = useCallback(async () => {
        if (!phone || phone.length !== 10) { showModal('Error', 'Please enter a valid 10-digit phone number'); return; }

        console.log('[auth] sendOtp → requesting OTP from server for +91', phone);
        setLoading(true);
        try {
            const result = await authApiNew.sendPhoneOtp(phone);
            console.log('[auth] sendOtp → server response:', { success: result.success, message: result.message });

            if (result.success) {
                setScreen('login-otp');
                showModal('OTP Sent', `OTP sent to +91 ${phone}.\n\nTest OTP: 123456`);
            } else {
                showModal('Error', result.message || 'Failed to send OTP. Please try again.');
            }
        } catch (err: any) {
            console.error('[auth] sendOtp → network error:', err?.message, err);
            showModal('Error', 'Network error. Please check your internet and try again.');
        } finally { setLoading(false); }
    }, [phone, showModal]);

    const handleOtpLogin = useCallback(async () => {
        if (!otp || otp.length !== 6) { showModal('Error', 'Please enter a valid 6-digit OTP'); return; }

        setLoading(true);
        try {
            console.log('[auth] verifyOtp → calling /auth/phone-login for +91', phone);
            const result = await authApiNew.phoneLogin(phone, otp);
            console.log('[auth] verifyOtp → server response:', { success: result.success, code: (result as any).code });

            if (result.success && result.response) {
                if ((result.response as any).needsRegistration || (result as any).code === 'USER_NOT_FOUND') {
                    setOtp(''); setScreen('register-details'); return;
                }
                await setAuthUser(result.response.token, result.response.user);
                if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                router.replace('/(tabs)');
            } else {
                showModal('Error', result.message || 'Invalid OTP');
            }
        } catch (err: any) {
            console.error('[auth] verifyOtp → error:', err?.message, err);
            showModal('Error', 'Verification failed. Please try again.');
        } finally { setLoading(false); }
    }, [phone, otp, expoPushToken, showModal]);

    const handleCompleteRegistration = useCallback(async () => {
        if (!name) { showModal('Error', 'Please enter your name'); return; }
        if (!emailVerified || !email) { showModal('Error', 'Please verify your email with Google first'); return; }
        if (!stateName) { showModal('Error', 'Please select your state'); return; }
        setLoading(true);
        try {
            // Upload avatar first (optional)
            let avatarUrl = '';
            if (avatarBase64) {
                try {
                    // upload-avatar requires auth, so we'll send base64 inline via phoneRegister
                    avatarUrl = `data:image/jpeg;base64,${avatarBase64}`;
                } catch (e) { console.warn('avatar upload skipped', e); }
            } else if (avatarUri && avatarUri.startsWith('http')) {
                avatarUrl = avatarUri;
            }

            const result = await authApiNew.phoneRegister({
                phone,
                name,
                email,
                address: address || undefined,
                state: stateName || undefined,
                avatar: avatarUrl || undefined,
                referralCode: referralCode || undefined,
            });
            if (result.success && result.response) {
                await setAuthUser(result.response.token, result.response.user);
                if (expoPushToken) authApiNew.updatePushToken(expoPushToken).catch(console.error);
                router.replace('/(tabs)');
            } else showModal('Error', result.message || 'Registration failed');
        } catch { showModal('Error', 'Network error.'); }
        finally { setLoading(false); }
    }, [name, email, emailVerified, phone, address, stateName, avatarBase64, avatarUri, referralCode, expoPushToken, showModal]);

    const pickAvatar = useCallback(async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                showModal('Permission needed', 'Please allow gallery access to choose a profile photo.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
                base64: true,
            });
            if (!result.canceled && result.assets?.[0]) {
                const a = result.assets[0];
                setAvatarUri(a.uri);
                setAvatarBase64(a.base64 || '');
            }
        } catch (e: any) {
            showModal('Error', e?.message || 'Failed to pick image');
        }
    }, [showModal]);

    const handleGoogleAuth = useCallback(async () => {
        if (IS_EXPO_GO) {
            console.warn('[auth][google] blocked in Expo Go', {
                executionEnvironment: Constants.executionEnvironment,
                platform: Platform.OS,
            });
            showModal(
                'Google Sign-In unavailable in Expo Go',
                'Google Sign-In Expo Go me kaam nahi karega kyunki yeh native module use karta hai.\n\nDevelopment build ya installed APK use karo:\n\n  npx eas build -p android --profile production'
            );
            return;
        }

        const module = getGoogleSigninModule();
        const GoogleSignin = module?.GoogleSignin;
        const statusCodes = module?.statusCodes ?? GOOGLE_STATUS_CODES;

        if (!GoogleSignin) {
            console.error('[auth][google] blocked: RNGoogleSignin native module is not available in this installed app build');
            showModal(
                'Google Sign-In setup incomplete',
                'Is installed app build me Google Sign-In native module include nahi hai. Auth screen ab crash nahi hogi, lekin Google login ke liye APK ko rebuild/reinstall karna padega:\n\n  npx eas build -p android --profile production\n\nYa local dev ke liye:\n  npx expo prebuild --clean && npx expo run:android'
            );
            return;
        }

        configureGoogleSignin();
        setGoogleLoading(true);
        try {
            console.log('[auth][google] starting native sign-in', {
                platform: Platform.OS,
                executionEnvironment: Constants.executionEnvironment,
                webClientId: GOOGLE_WEB_CLIENT_ID,
            });

            // Make sure Google Play Services are present (Android only no-op on iOS).
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Sign out any cached account first so the chooser always shows. Optional but
            // helps avoid stale token issues during testing.
            try { await GoogleSignin.signOut(); } catch { /* ignore */ }

            const result: any = await GoogleSignin.signIn();
            console.log('[auth][google] signIn raw result keys:', Object.keys(result || {}));

            // v13+ wraps payload under `data`, older versions return it flat.
            const payload = result?.data ?? result;
            const idToken: string | null = payload?.idToken ?? null;
            const userObj = payload?.user ?? {};

            console.log('[auth][google] signIn parsed:', {
                hasIdToken: !!idToken,
                email: userObj?.email,
                name: userObj?.name,
            });

            if (!userObj?.email) {
                console.error('[auth][google] sign-in returned no email', payload);
                showModal('Error', 'Google sign in failed: email not returned.');
                setGoogleLoading(false);
                return;
            }

            await finishGoogleLogin(idToken, {
                email: userObj.email,
                name: userObj.name,
                photo: userObj.photo,
            });
        } catch (err: any) {
            setGoogleLoading(false);
            const code = err?.code;
            console.error('[auth][google] signIn error:', { code, message: err?.message, err });

            if (code === statusCodes.SIGN_IN_CANCELLED) {
                // User cancelled — silent.
                return;
            }
            if (code === statusCodes.IN_PROGRESS) {
                showModal('Please wait', 'Google sign-in is already in progress.');
                return;
            }
            if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                showModal('Error', 'Google Play Services not available on this device.');
                return;
            }
            if (code === statusCodes.SIGN_IN_REQUIRED) {
                showModal('Error', 'Sign-in required. Please try again.');
                return;
            }
            showModal('Error', `Google sign in failed.${err?.message ? `\n\n${err.message}` : ''}`);
        }
    }, [showModal, expoPushToken]);

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
                    <OtpBoxes value={otp} onChange={setOtp} colors={colors} autoFocus={!modalVisible} />
                    <View style={{ height: 8 }} />
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

                    {/* Profile image picker */}
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                        <Pressable onPress={pickAvatar} style={{
                            width: 84, height: 84, borderRadius: 42,
                            borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed',
                            backgroundColor: colors.input,
                            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        }}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <Camera size={28} color={colors.primary} />
                            )}
                        </Pressable>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6 }}>
                            {avatarUri ? 'Tap to change photo' : 'Add profile photo (optional)'}
                        </Text>
                    </View>

                    <InputField icon={User} placeholder="Full Name *" value={name} onChangeText={setName} colors={colors} />

                    {/* State picker */}
                    <Pressable onPress={() => setStatePickerOpen(true)} style={{
                        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input,
                        borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.border,
                        height: 44, paddingHorizontal: 10, gap: 8,
                    }}>
                        <MapPin size={16} color={colors.mutedForeground} />
                        <Text style={{ flex: 1, fontSize: 13, color: stateName ? colors.foreground : colors.mutedForeground + '88' }}>
                            {stateName || 'Select State *'}
                        </Text>
                        <ChevronDown size={16} color={colors.mutedForeground} />
                    </Pressable>

                    <InputField icon={MapPin} placeholder="Address (Optional)" value={address} onChangeText={setAddress} multiline colors={colors} />
                    <InputField icon={Gift} placeholder="Referral Code (Optional)" value={referralCode} onChangeText={handleReferralChange} autoCapitalize="characters" colors={colors} />

                    {/* Email — verified via Google only */}
                    {emailVerified ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.primary, height: 44, paddingHorizontal: 10, gap: 8 }}>
                            <Mail size={16} color={colors.primary} />
                            <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }} numberOfLines={1}>{email}</Text>
                            <CheckCircle size={16} color={colors.primary} />
                        </View>
                    ) : (
                        <View style={{ marginBottom: 6 }}>
                            <GoogleButton label="Verify Email with Google *" onPress={() => { googleModeRef.current = 'verify'; handleGoogleAuth(); }} />
                            <Text style={{ fontSize: 10, color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}>
                                Email is verified through your Google account
                            </Text>
                        </View>
                    )}
                    <View style={{ height: 6 }} />
                    <PrimaryButton
                        onPress={handleCompleteRegistration}
                        label="Save & Continue"
                        loading={loading}
                        disabled={!emailVerified || !name || !stateName}
                        colors={colors}
                    />
                </FormCard>
                <StatePickerModal
                    visible={statePickerOpen}
                    onClose={() => setStatePickerOpen(false)}
                    onSelect={setStateName}
                    selected={stateName}
                    colors={colors}
                />
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
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.input,
                    borderRadius: 10,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: colors.border,
                    height: 44,
                    overflow: 'hidden',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: '100%', backgroundColor: colors.muted, borderRightWidth: 1, borderRightColor: colors.border }}>
                        <Phone size={16} color={colors.mutedForeground} />
                        <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '700', color: colors.foreground }}>+91</Text>
                    </View>
                    <TextInput
                        style={{ flex: 1, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingHorizontal: 10, fontSize: 14, fontWeight: '600', letterSpacing: 0.5, color: colors.foreground }}
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
                        keyboardType="phone-pad"
                        maxLength={10}
                        placeholderTextColor={colors.mutedForeground + '88'}
                    />
                </View>
                <View style={{ height: 6 }} />
                <PrimaryButton onPress={handleSendLoginOtp} label="Send OTP" loading={loading && !googleLoading} colors={colors} />

                <Divider />

                <GoogleButton label="Sign in with Google" onPress={() => { googleModeRef.current = 'login'; handleGoogleAuth(); }} />
            </FormCard>

            <Text style={{ fontSize: 10, textAlign: 'center', marginTop: 12, color: colors.mutedForeground, paddingHorizontal: 16 }}>
                By continuing, you agree to our Terms & Privacy Policy
            </Text>
        </ScreenWrapper>
    );
}

// ════════════════════════════════════════════════════════════════
// GOOGLE SIGN-IN SETUP — using @react-native-google-signin/google-signin
// ════════════════════════════════════════════════════════════════
//
// 1. Web Client ID (GOOGLE_WEB_CLIENT_ID above) is the OAuth 2.0 client of
//    type "Web application" from Google Cloud Console. The native SDK uses it
//    to request an idToken that your backend can verify.
//
// 2. Android Client ID is read AUTOMATICALLY from google-services.json by the
//    native SDK using the package name (com.milkey.app) + SHA-1 fingerprint.
//    You do NOT need to pass it in JS, and you do NOT need any custom URI
//    scheme in app.json (Google has disabled custom URI schemes for Android
//    OAuth — that's what caused the earlier "invalid_request" error).
//
// 3. SHA-1 fingerprints that MUST be registered in Firebase Console
//    → Project Settings → Your Android app → "Add fingerprint":
//       • EAS production keystore SHA-1  (npx eas credentials -p android)
//       • EAS preview keystore SHA-1     (if you have a preview profile)
//       • Local debug SHA-1               (for `npx expo run:android`)
//    After adding, RE-DOWNLOAD google-services.json and replace the file at
//    milkey-app/google-services.json. Then rebuild the APK.
//
// 4. Build (cannot be tested in Expo Go — native module):
//       npx eas build -p android --profile production
//    Or for local dev: npx expo prebuild --clean && npx expo run:android
//
// 5. Phone OTP still uses server-side hardcoded OTP (123456). For production,
//    integrate Twilio/MSG91 in /api/auth/send-phone-otp.
// ════════════════════════════════════════════════════════════════
