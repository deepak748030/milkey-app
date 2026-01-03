import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, CheckCheck, Trash2, ChevronLeft, Gift, CreditCard, AlertCircle, Package, Users } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { notificationsApiNew, Notification } from '@/lib/milkeyApi';
import { router } from 'expo-router';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await notificationsApiNew.getAll();
      console.log('Notifications API response:', JSON.stringify(result));

      // Handle both response formats: { success, response: { data } } and { success, data }
      let notificationsData: Notification[] = [];

      if (result.success) {
        // Check for data in response.data or direct data property
        if (result.response?.data) {
          notificationsData = result.response.data;
        } else if ((result as any).data) {
          notificationsData = (result as any).data;
        }

        setNotifications(notificationsData);
        // Calculate unread count from response or from data
        const serverUnreadCount = result.response?.unreadCount ?? (result as any).unreadCount;
        if (typeof serverUnreadCount === 'number') {
          setUnreadCount(serverUnreadCount);
        } else {
          const unread = notificationsData.filter((n: Notification) => !n.read).length;
          setUnreadCount(unread);
        }
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await notificationsApiNew.markAsRead(notification._id);
        setNotifications(prev =>
          prev.map(n => n._id === notification._id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApiNew.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await notificationsApiNew.clearAll();
      // Clear notifications locally regardless of response
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'commission':
      case 'commission_earned':
        return <Gift size={24} color={colors.primary} />;
      case 'withdrawal':
      case 'withdrawal_success':
      case 'withdrawal_status':
        return <CreditCard size={24} color="#10b981" />;
      case 'subscription_expiring':
      case 'subscription_expired':
        return <AlertCircle size={24} color={colors.destructive} />;
      case 'subscription_purchased':
        return <Package size={24} color={colors.primary} />;
      case 'referral_signup':
        return <Users size={24} color="#8b5cf6" />;
      case 'product_status':
      case 'order_status':
        return <Package size={24} color="#f59e0b" />;
      case 'admin_broadcast':
      case 'admin_message':
      case 'broadcast':
        return <Bell size={24} color="#ef4444" />;
      case 'payment_received':
        return <CreditCard size={24} color={colors.primary} />;
      case 'milk_collection':
        return <Package size={24} color="#22c55e" />;
      default:
        return <Bell size={24} color={colors.primary} />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        <View style={styles.content}>
          {notifications.length > 0 && (
            <View style={styles.actionButtons}>
              {unreadCount > 0 && (
                <Pressable style={styles.actionButton} onPress={handleMarkAllRead}>
                  <CheckCheck size={16} color={colors.primary} />
                  <Text style={styles.actionButtonText}>Mark all read</Text>
                </Pressable>
              )}
              <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleClearAll}>
                <Trash2 size={16} color={colors.destructive} />
                <Text style={styles.deleteButtonText}>Clear all</Text>
              </Pressable>
            </View>
          )}

          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Bell size={48} color={colors.mutedForeground} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubtext}>
                We'll notify you when there are updates
              </Text>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {notifications.map((notification, index) => (
                <Pressable
                  key={notification._id || notification.id || `notification-${index}`}
                  style={[
                    styles.notificationCard,
                    { opacity: notification.read ? 0.6 : 1 }
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                >
                  <View style={styles.notificationContent}>
                    {getNotificationIcon(notification.type)}
                    <View style={styles.notificationText}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>
                          {notification.title}
                        </Text>
                        {!notification.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notificationMessage}>
                        {notification.message}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {formatTime(notification.createdAt)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      padding: 4,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.foreground,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 6,
      paddingVertical: 16,
      paddingBottom: 90,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginBottom: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deleteButton: {},
    actionButtonText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    deleteButtonText: {
      fontSize: 13,
      color: colors.destructive,
      fontWeight: '600',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.mutedForeground,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
    notificationsList: {
      gap: 8,
    },
    notificationCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notificationContent: {
      flexDirection: 'row',
      gap: 12,
    },
    notificationText: {
      flex: 1,
    },
    notificationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    notificationTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
      flex: 1,
    },
    unreadDot: {
      width: 8,
      height: 8,
      backgroundColor: colors.primary,
      borderRadius: 4,
      marginLeft: 8,
      marginTop: 4,
    },
    notificationMessage: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginBottom: 8,
      lineHeight: 20,
    },
    notificationTime: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
  });
