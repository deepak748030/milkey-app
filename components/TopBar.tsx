import React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellRing, MapPinned, ChevronDown } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { router } from 'expo-router';
import { notificationsApi, getStoredUser } from '@/lib/api';
import { getLocationState, subscribeToLocation } from '@/lib/locationStore';
import { LinearGradient } from 'expo-linear-gradient';

export default function TopBar() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [locationName, setLocationName] = useState(getLocationState().locationName);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const result = await notificationsApi.getNotifications({ limit: 1 });
        if (result.success) {
          const data = (result as any).data || result.response;
          setUnreadCount(data?.unreadCount || (result as any).unreadCount || 0);
        } else {
          setUnreadCount(0);
        }
      } catch (error) {
        setUnreadCount(0);
      }
    };

    const loadUser = async () => {
      try {
        const user = await getStoredUser();
        if (user) {
          setUserAvatar(user.avatar || null);
          setUserName(user.name || '');
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };

    loadNotifications();
    loadUser();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToLocation((state) => {
      setLocationName(state.locationName);
    });
    setLocationName(getLocationState().locationName);
    return unsubscribe;
  }, []);

  const handleNotificationPress = () => {
    router.push('/notifications');
  };

  const handleAvatarPress = () => {
    router.push('/profile');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.locationContainer} onPress={() => { }}>
        <LinearGradient
          colors={[colors.primary + '30', colors.primary + '10']}
          style={styles.locationIconContainer}
        >
          <MapPinned size={18} color={colors.primary} strokeWidth={2.5} />
        </LinearGradient>
        <View style={styles.locationTextContainer}>
          <Text style={styles.locationLabel}>Your Location</Text>
          <View style={styles.locationValueRow}>
            <Text style={styles.locationValue} numberOfLines={1}>{locationName}</Text>
            <ChevronDown size={14} color={colors.mutedForeground} />
          </View>
        </View>
      </Pressable>

      <View style={styles.rightSection}>
        <Pressable
          style={styles.notificationButton}
          onPress={handleNotificationPress}
        >
          <LinearGradient
            colors={[colors.card, colors.secondary]}
            style={styles.iconButtonGradient}
          >
            <BellRing size={20} color={colors.foreground} strokeWidth={2} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable onPress={handleAvatarPress} style={styles.avatarButton}>
          <LinearGradient
            colors={[colors.primary, '#A78BFA']}
            style={styles.avatarGradient}
          >
            {userAvatar ? (
              <Image
                source={{ uri: userAvatar }}
                style={styles.avatar}
              />
            ) : (
              <Text style={styles.avatarInitials}>{getInitials(userName || 'U')}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  locationValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
    maxWidth: 150,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    position: 'relative',
  },
  iconButtonGradient: {
    width: 42,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    backgroundColor: colors.destructive,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.card,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.white,
  },
  avatarButton: {
    borderRadius: 16,
  },
  avatarGradient: {
    borderRadius: 14,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },
});
