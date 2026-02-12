import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { User, Bell, LogOut, ChevronRight, Sun, Moon, Users, Package, FileEdit, Edit2, MapPin, CreditCard, HelpCircle, Wallet, FileText, Shield, Phone, Mail } from 'lucide-react-native';
import { router } from 'expo-router';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/hooks/useAuth';
import { authApiNew } from '@/lib/milkeyApi';
import { clearAuth, updateAuthUser } from '@/lib/authStore';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { EditProfileModal } from '@/components/EditProfileModal';

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, refreshUser } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const styles = createStyles(colors, isDark);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authApiNew.logout();
    } catch (error) {
      // Ignore API errors on logout
    }
    await clearAuth();
    setShowLogoutModal(false);
    setIsLoggingOut(false);
    router.replace('/auth' as any);
  };

  const menuItems = [
    { id: '0', icon: Package, label: 'My Orders', action: () => router.push('/orders' as any) },
    { id: '1', icon: CreditCard, label: 'My Subscriptions', action: () => router.push('/subscriptions' as any) },
    { id: '2', icon: FileEdit, label: 'Submit Form', action: () => router.push('/submit-form' as any) },
    { id: '3', icon: Users, label: 'Referral Program', action: () => router.push('/referral') },
    { id: '4', icon: Wallet, label: 'Withdraw', action: () => router.push('/withdraw' as any) },
    { id: '5', icon: Bell, label: 'Notifications', action: () => router.push('/notifications') },
    { id: '6', icon: HelpCircle, label: 'Help & Support', action: () => router.push('/help-support' as any) },
    { id: '7', icon: FileText, label: 'Terms & Conditions', action: () => router.push('/terms-conditions' as any) },
    { id: '8', icon: Shield, label: 'Privacy Policy', action: () => router.push('/privacy-policy' as any) },
  ];

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Banner */}
          <View style={styles.banner}>
            <Pressable style={styles.editButton} onPress={() => setShowEditModal(true)}>
              <Edit2 size={14} color={colors.white} />
            </Pressable>
          </View>
          {/* Avatar overlapping banner */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <User size={26} color={colors.white} />
            </View>
          </View>
          {/* Info */}
          <View style={styles.profileInfo}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Dairy Owner'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.userRole}>{user?.role || 'Owner'}</Text>
            </View>
            <View style={styles.contactRow}>
              {user?.phone ? (
                <View style={styles.contactItem}>
                  <Phone size={13} color={colors.primary} />
                  <Text style={styles.contactText}>{user.phone}</Text>
                </View>
              ) : null}
              {user?.email ? (
                <View style={styles.contactItem}>
                  <Mail size={13} color={colors.primary} />
                  <Text style={styles.contactText} numberOfLines={1}>{user.email}</Text>
                </View>
              ) : null}
            </View>
            {user?.address ? (
              <View style={styles.addressContainer}>
                <MapPin size={13} color={colors.primary} />
                <Text style={styles.addressText} numberOfLines={2}>{user.address}</Text>
              </View>
            ) : null}
            {user?.referralCode && (
              <View style={styles.referralBadge}>
                <Text style={styles.referralLabel}>Referral Code:</Text>
                <Text style={styles.referralCode}>{user.referralCode}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Theme Toggle with Switcher */}
        <View style={styles.themeToggle}>
          <View style={styles.themeIconContainer}>
            {isDark ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
          </View>
          <View style={styles.themeInfo}>
            <Text style={styles.themeLabel}>Appearance</Text>
            <Text style={styles.themeValue}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
          </View>
          <Pressable style={styles.themeSwitcher} onPress={toggleTheme}>
            <View style={[styles.switchTrack, isDark && styles.switchTrackActive]}>
              <View style={[styles.switchThumb, isDark && styles.switchThumbActive]} />
            </View>
          </Pressable>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Pressable key={item.id} style={styles.menuItem} onPress={item.action}>
                <View style={styles.menuIconContainer}>
                  <IconComponent size={20} color={colors.primary} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>

        {/* Logout Button */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={colors.destructive} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <EditProfileModal
        isVisible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={() => {
          refreshUser?.();
        }}
      />

      <ConfirmationModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        confirmDestructive
        isLoading={isLoggingOut}
      />
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 80,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  banner: {
    height: 60,
    backgroundColor: colors.primary,
    position: 'relative',
  },
  editButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: {
    alignItems: 'center',
    marginTop: -30,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
  },
  profileInfo: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.foreground,
  },
  roleBadge: {
    backgroundColor: colors.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    marginBottom: 6,
  },
  userRole: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactText: {
    fontSize: 13,
    color: colors.foreground,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  addressText: {
    fontSize: 12,
    color: colors.foreground,
  },
  referralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primary + '12',
    borderRadius: 14,
    gap: 6,
  },
  referralLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  referralCode: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  themeToggle: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  themeInfo: {
    flex: 1,
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  themeValue: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  themeSwitcher: {
    padding: 2,
  },
  switchTrack: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchTrackActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  menuSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructive + '15',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.destructive + '30',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.destructive,
  },
});
