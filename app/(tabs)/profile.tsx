import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Pencil, AtSign, Smartphone, BellRing, ShieldCheck, CircleHelp, LogOut, ReceiptText } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { authApi, getStoredUser, AuthUser } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { EditProfileModal } from '@/components/EditProfileModal';
import { InfoRow } from '@/components/InfoRow';
import { MenuItem } from '@/components/MenuItem';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      // First try to get from API
      const result = await authApi.getMe();
      if (result.success && result.response) {
        setUser(result.response);
      } else {
        // Fallback to stored user
        const storedUser = await getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      // Fallback to stored user on error
      const storedUser = await getStoredUser();
      setUser(storedUser);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setLoading(true);

      (async () => {
        try {
          // First try to get from API
          const result = await authApi.getMe();
          if (!isActive) return;

          if (result.success && result.response) {
            setUser(result.response);

            // Check if user is blocked
            if (result.response.isBlocked) {
              Alert.alert('Account Blocked', 'Your account has been blocked. Please contact support.');
              await authApi.logout();
              router.replace('/auth');
              return;
            }
          } else {
            // Fallback to stored user
            const storedUser = await getStoredUser();
            if (!isActive) return;

            if (storedUser) {
              setUser(storedUser);
            } else {
              router.replace('/auth');
              return;
            }
          }
        } catch (error) {
          if (!isActive) return;
          // Fallback to stored user
          const storedUser = await getStoredUser();
          if (storedUser) {
            setUser(storedUser);
          } else {
            router.replace('/auth');
          }
        } finally {
          if (!isActive) return;
          setLoading(false);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleLogoutPress = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    setLoggingOut(true);
    try {
      const result = await authApi.logout();
      if (result.success) {
        router.replace('/auth');
      } else {
        Alert.alert('Logout Failed', result.message || 'Failed to logout. Please try again.');
        setLoggingOut(false);
      }
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'An error occurred while logging out.');
      setLoggingOut(false);
    }
  };

  const handleCloseLogoutModal = () => {
    setShowLogoutModal(false);
  };

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleEditSave = () => {
    loadUser();
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUser();
    setRefreshing(false);
  }, [loadUser]);

  const menuItems = [
    {
      icon: ReceiptText,
      title: 'Transaction History',
      subtitle: 'View payments and refunds',
      onPress: () => router.push('/transactions' as any),
    },
    {
      icon: BellRing,
      title: 'Notifications',
      subtitle: 'Manage notification preferences',
      onPress: () => router.push('/notifications'),
    },
    {
      icon: ShieldCheck,
      title: 'Privacy & Security',
      subtitle: 'Control your account security',
      onPress: () => router.push('/privacy-policy'),
    },
    {
      icon: CircleHelp,
      title: 'Help & Support',
      subtitle: 'Get help with your bookings',
      onPress: () => router.push('/help-support'),
    },
  ];

  // Show loading state while checking auth
  if (loading) {
    return (
      <View style={styles.container}>
        <TopBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // If no user after loading, don't render anything (redirect will happen)
  if (!user) {
    return (
      <View style={styles.container}>
        <TopBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.content}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
                <Pressable style={styles.editAvatarButton} onPress={handleEditProfile}>
                  <Pencil size={14} color={colors.primaryForeground} />
                </Pressable>
              </View>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.memberSince}>Member since {user.memberSince}</Text>
            </View>

            {/* Separator */}
            <View style={styles.separator} />

            {/* Personal Info */}
            <View style={styles.personalInfo}>
              <Text style={styles.sectionTitle}>Personal Information</Text>

              <InfoRow icon={AtSign} label="Email" value={user.email} />
              <InfoRow icon={Smartphone} label="Phone" value={user.phone} />
            </View>

            {/* Edit Profile Button */}
            <Pressable style={styles.editButton} onPress={handleEditProfile}>
              <Pencil size={18} color={colors.foreground} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>
          </View>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            {menuItems.map((item, index) => (
              <MenuItem
                key={index}
                icon={item.icon}
                title={item.title}
                subtitle={item.subtitle}
                onPress={item.onPress}
              />
            ))}
          </View>

          {/* Logout Button */}
          <Pressable
            style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
            onPress={handleLogoutPress}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <LogOut size={18} color={colors.white} />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </>
            )}
          </Pressable>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appName}>Plenify</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      <EditProfileModal
        isVisible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleEditSave}
      />

      <ConfirmationModal
        isVisible={showLogoutModal}
        onClose={handleCloseLogoutModal}
        onConfirm={handleConfirmLogout}
        title="Logout?"
        message="Are you sure you want to logout from your account?"
        confirmText="Yes, Logout"
        cancelText="No, Stay Logged In"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingVertical: 0,
    paddingHorizontal: 10,
    paddingBottom: 90,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.card,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  personalInfo: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  menuSection: {
    gap: 8,
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: colors.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    minHeight: 52,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 16,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  appVersion: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
});