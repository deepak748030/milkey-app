import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Bell, CheckCheck, Trash2 } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { notificationsApi, ServerNotification } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NotificationsScreen() {
  const { expoPushToken } = usePushNotifications();
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await notificationsApi.getNotifications({ limit: 50 });
      console.log('Notifications API response:', JSON.stringify(result));

      if (result.success) {
        const notificationsData = (result as any).data || [];
        const unread = (result as any).unreadCount || 0;
        setNotifications(notificationsData);
        setUnreadCount(unread);
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

  const handleNotificationPress = async (notification: ServerNotification) => {
    if (!notification.read) {
      try {
        await notificationsApi.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    return <Bell size={24} color={colors.primary} />;
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
              <Pressable style={styles.actionButton} onPress={handleClearAll}>
                <Trash2 size={16} color={colors.destructive} />
                <Text style={[styles.actionButtonText, { color: colors.destructive }]}>Clear all</Text>
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
              {notifications.map((notification) => (
                <Pressable
                  key={notification.id}
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
                        {formatTime(notification.timestamp)}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingVertical: 0,
    paddingHorizontal: 10,
    paddingBottom: 90,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  notificationsList: {
    gap: 4,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 10,
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
    fontSize: 14,
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
    marginTop: 2,
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
