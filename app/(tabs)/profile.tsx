import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { User, Settings, Bell, HelpCircle, LogOut, ChevronRight, Sun, Moon, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/hooks/useAuth';
import { authApiNew } from '@/lib/milkeyApi';
import { clearAuth } from '@/lib/authStore';

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  const styles = createStyles(colors, isDark);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await authApiNew.logout();
            } catch (error) {
              // Ignore API errors on logout
            }
            await clearAuth();
            router.replace('/auth' as any);
          },
        },
      ]
    );
  };

  const menuItems = [
    { id: '1', icon: Users, label: 'Referral Program', action: () => router.push('/referral') },
    { id: '2', icon: Settings, label: 'Settings', action: () => { } },
    { id: '3', icon: Bell, label: 'Notifications', action: () => router.push('/notifications') },
    { id: '4', icon: HelpCircle, label: 'Help & Support', action: () => router.push('/help-support') },
  ];

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <User size={40} color={colors.white} />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || 'Dairy Owner'}</Text>
          <Text style={styles.userRole}>{user?.role || 'Owner'}</Text>
          <View style={styles.contactInfo}>
            <Text style={styles.contactText}>{user?.phone || ''}</Text>
            <Text style={styles.contactText}>{user?.email || ''}</Text>
          </View>
          {user?.referralCode && (
            <View style={styles.referralBadge}>
              <Text style={styles.referralLabel}>Your Code:</Text>
              <Text style={styles.referralCode}>{user.referralCode}</Text>
            </View>
          )}
        </View>

        {/* Theme Toggle */}
        <Pressable style={styles.themeToggle} onPress={toggleTheme}>
          <View style={styles.themeIconContainer}>
            {isDark ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
          </View>
          <View style={styles.themeInfo}>
            <Text style={styles.themeLabel}>Appearance</Text>
            <Text style={styles.themeValue}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
          </View>
          <View style={[styles.themeBadge, { backgroundColor: isDark ? colors.primary : colors.success }]}>
            <Text style={styles.themeBadgeText}>{isDark ? 'Dark' : 'Light'}</Text>
          </View>
        </Pressable>

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
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  contactInfo: {
    alignItems: 'center',
  },
  contactText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  referralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary + '15',
    borderRadius: 20,
    gap: 6,
  },
  referralLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  referralCode: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  themeToggle: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  themeInfo: {
    flex: 1,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  themeValue: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  themeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  themeBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  menuSection: {
    backgroundColor: colors.card,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructive + '15',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.destructive + '30',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.destructive,
  },
});
