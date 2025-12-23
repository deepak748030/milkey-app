import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { authApi, getToken } from '@/lib/api';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface PushNotificationState {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    error: string | null;
}

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [error, setError] = useState<string | null>(null);
    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    async function registerForPushNotificationsAsync(): Promise<string | null> {
        let token: string | null = null;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#22C55E',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                setError('Permission not granted for push notifications');
                return null;
            }

            try {
                const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

                if (!projectId) {
                    token = `ExponentPushToken[dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}]`;
                } else {
                    const pushTokenData = await Notifications.getExpoPushTokenAsync({
                        projectId,
                    });
                    token = pushTokenData.data;
                }
            } catch (e: any) {
                token = `ExponentPushToken[dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}]`;
            }
        } else {
            token = `ExponentPushToken[simulator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}]`;
        }

        return token;
    }

    async function updatePushTokenOnServer(token: string) {
        try {
            const authToken = await getToken();
            if (authToken) {
                const result = await authApi.updatePushToken(token);
                if (result.success) {
                    console.log('Push token updated on server');
                } else {
                    console.error('Failed to update push token:', result.message);
                }
            }
        } catch (error) {
            console.error('Error updating push token on server:', error);
        }
    }

    useEffect(() => {
        registerForPushNotificationsAsync().then((token) => {
            if (token) {
                setExpoPushToken(token);
                updatePushTokenOnServer(token);
            }
        });

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            // Navigate to notifications screen on tap
            router.push('/notifications' as any);
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, []);

    return {
        expoPushToken,
        notification,
        error,
        updatePushTokenOnServer,
    };
}

export async function sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data || {},
        },
        trigger: null,
    });
}
