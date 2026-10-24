import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { authApi, getToken } from '@/lib/api';

// Lazy / safe import — Expo Go on Android SDK 53+ does not include native push module
let Notifications: any = null;
let notificationsAvailable = false;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
    notificationsAvailable = true;
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch (e) {
}

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export interface PushNotificationState {
    expoPushToken: string | null;
    notification: any | null;
    error: string | null;
}

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const notificationListener = useRef<any | null>(null);
    const responseListener = useRef<any | null>(null);

    async function registerForPushNotificationsAsync(): Promise<string | null> {
        if (!notificationsAvailable || !Notifications || IS_EXPO_GO) {
            return null;
        }
        let token: string | null = null;

        if (Platform.OS === 'android') {
            try {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#22C55E',
                });
            } catch {}
        }

        if (Device.isDevice) {
            try {
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
                    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

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
            } catch {
                return null;
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
                await authApi.updatePushToken(token);
            }
        } catch {}
    }

    useEffect(() => {
        if (!notificationsAvailable || !Notifications || IS_EXPO_GO) {
            return;
        }
        registerForPushNotificationsAsync().then((token) => {
            if (token) {
                setExpoPushToken(token);
                updatePushTokenOnServer(token);
            }
        });

        try {
            notificationListener.current = Notifications.addNotificationReceivedListener((n: any) => {
                setNotification(n);
            });

            responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
                router.push('/notifications' as any);
            });
        } catch {}

        return () => {
            try {
                if (notificationListener.current) {
                    notificationListener.current.remove();
                }
                if (responseListener.current) {
                    responseListener.current.remove();
                }
            } catch {}
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
    if (!notificationsAvailable || !Notifications || IS_EXPO_GO) {
        return;
    }
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: data || {},
            },
            trigger: null,
        });
    } catch (e) {
    }
}
