import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Linking, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { AVAILABLE_LANGUAGES, LanguageCode } from '@/lib/translations';
import { User, Bell, LogOut, ChevronRight, Sun, Moon, Users, Package, FileEdit, Edit2, MapPin, CreditCard, HelpCircle, Wallet, FileText, Shield, Phone, Mail, ExternalLink, Globe, Check, Printer } from 'lucide-react-native';
import { router } from 'expo-router';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/hooks/useAuth';
import { authApiNew, socialLinksApi, SocialLink } from '@/lib/milkeyApi';
import { clearAuth } from '@/lib/authStore';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { EditProfileModal } from '@/components/EditProfileModal';

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, language, changeLanguage } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialLinksLoading, setSocialLinksLoading] = useState(true);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useEffect(() => {
    const fetchSocialLinks = async () => {
      try {
        const res = await socialLinksApi.getAll();
        if (res.success && res.response) {
          setSocialLinks(res.response);
        }
      } catch (e) {
        // silent
      } finally {
        setSocialLinksLoading(false);
      }
    };
    fetchSocialLinks();
  }, []);

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

  const handleLanguageSelect = async (code: LanguageCode) => {
    await changeLanguage(code);
    setShowLanguagePicker(false);
  };

  const currentLangOption = AVAILABLE_LANGUAGES.find(l => l.code === language);

  const menuItems = [
    { id: '0', icon: Package, label: t.profile.myOrders, action: () => router.push('/orders' as any) },
    { id: '1', icon: CreditCard, label: t.profile.mySubscriptions, action: () => router.push('/subscriptions' as any) },
    { id: '2', icon: Printer, label: 'Print Settings', action: () => router.push('/print-settings' as any) },
    { id: '3', icon: FileEdit, label: t.profile.submitForm, action: () => router.push('/submit-form' as any) },
    { id: '4', icon: Users, label: t.profile.referralProgram, action: () => router.push('/referral') },
    { id: '5', icon: Wallet, label: t.profile.withdraw, action: () => router.push('/withdraw' as any) },
    { id: '6', icon: Bell, label: t.profile.notifications, action: () => router.push('/notifications') },
    { id: '7', icon: HelpCircle, label: t.profile.helpSupport, action: () => router.push('/help-support' as any) },
    { id: '8', icon: FileText, label: t.profile.termsConditions, action: () => router.push('/terms-conditions' as any) },
    { id: '9', icon: Shield, label: t.profile.privacyPolicy, action: () => router.push('/privacy-policy' as any) },
  ];

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.banner}>
            <Pressable style={styles.editButton} onPress={() => setShowEditModal(true)}>
              <Edit2 size={14} color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <User size={26} color={colors.white} />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name || t.profile.dairyOwner}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.userRole}>{user?.role || t.profile.owner}</Text>
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
                <Text style={styles.referralLabel}>{t.profile.referralCode}</Text>
                <Text style={styles.referralCode}>{user.referralCode}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Theme Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingIconContainer}>
            {isDark ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>{t.profile.appearance}</Text>
            <Text style={styles.settingValue}>{isDark ? t.profile.darkMode : t.profile.lightMode}</Text>
          </View>
          <Pressable style={styles.themeSwitcher} onPress={toggleTheme}>
            <View style={[styles.switchTrack, isDark && styles.switchTrackActive]}>
              <View style={[styles.switchThumb, isDark && styles.switchThumbActive]} />
            </View>
          </Pressable>
        </View>

        {/* Language Selector */}
        <Pressable style={styles.settingRow} onPress={() => setShowLanguagePicker(!showLanguagePicker)}>
          <View style={styles.settingIconContainer}>
            <Globe size={20} color={colors.primary} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>{t.profile.language}</Text>
            <Text style={styles.settingValue}>{currentLangOption?.label} ({currentLangOption?.englishLabel})</Text>
          </View>
          <ChevronRight size={18} color={colors.mutedForeground} style={{ transform: [{ rotate: showLanguagePicker ? '90deg' : '0deg' }] }} />
        </Pressable>

        {/* Language Options (expandable) */}
        {showLanguagePicker && (
          <View style={styles.languageOptions}>
            {AVAILABLE_LANGUAGES.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.languageItem, isSelected && styles.languageItemSelected]}
                  onPress={() => handleLanguageSelect(lang.code)}
                >
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <View style={styles.languageTextWrap}>
                    <Text style={[styles.languageNative, isSelected && styles.languageNativeSelected]}>{lang.label}</Text>
                    <Text style={styles.languageEnglish}>{lang.englishLabel}</Text>
                  </View>
                  {isSelected && <Check size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        )}

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

        {/* Follow Us On */}
        {(socialLinksLoading || socialLinks.length > 0) && (
          <View style={styles.followSection}>
            <Text style={styles.followTitle}>{t.profile.followUs}</Text>
            {socialLinksLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.followGrid}>
                {socialLinks.map((link) => (
                  <Pressable
                    key={link._id}
                    style={styles.followItem}
                    onPress={() => Linking.openURL(link.link)}
                  >
                    <Image source={{ uri: link.image }} style={styles.followImage} />
                    <Text style={styles.followLabel} numberOfLines={1}>{link.title}</Text>
                    <ExternalLink size={10} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Logout Button */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={colors.destructive} />
          <Text style={styles.logoutText}>{t.profile.logout}</Text>
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
        title={t.profile.logout}
        message={t.profile.logoutConfirm}
        confirmText={t.profile.logout}
        cancelText={t.common.cancel}
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
  // Settings rows (theme, language)
  settingRow: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  settingValue: {
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
  // Language picker
  languageOptions: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  languageItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  languageFlag: {
    fontSize: 22,
  },
  languageTextWrap: {
    flex: 1,
  },
  languageNative: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  languageNativeSelected: {
    color: colors.primary,
  },
  languageEnglish: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  // Menu
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
  followSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 10,
  },
  followGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  followItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  followImage: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  followLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    maxWidth: 80,
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
