import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, User, Phone, Gift } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setToken, setStoredUser } from '@/lib/api';

const API_BASE_URL = 'http://localhost:5000/api';

export default function AuthScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');

    const styles = createStyles(colors, isDark, insets);

    const handleAuth = async () => {
        if (isLogin) {
            if (!email || !password) {
                Alert.alert('Error', 'Please enter email and password');
                return;
            }
        } else {
            if (!name || !email || !phone || !password) {
                Alert.alert('Error', 'Please fill all required fields');
                return;
            }
            if (password.length < 6) {
                Alert.alert('Error', 'Password must be at least 6 characters');
                return;
            }
        }

        setLoading(true);
        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const body = isLogin
                ? { email, password }
                : { name, email, phone, password, referralCode: referralCode || undefined };

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (data.success) {
                await setToken(data.response.token);
                await setStoredUser(data.response.user);
                router.replace('/(tabs)');
            } else {
                Alert.alert('Error', data.message || 'Authentication failed');
            }
        } catch (error) {
            Alert.alert('Error', 'Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

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
                    )}

                    <Pressable
                        style={[styles.authButton, loading && styles.authButtonDisabled]}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        <Text style={styles.authButtonText}>
                            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
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
});
