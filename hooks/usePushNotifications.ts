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

// Set notification category with reply action
Notifications.setNotificationCategoryAsync('chat', [
    {
        identifier: 'reply',
        buttonTitle: 'Reply',
        textInput: {
            submitButtonTitle: 'Send',
            placeholder: 'Type your message...',
        },
    },
]);

export interface PushNotificationState {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    error: string | null;
}

// Handle notification navigation
function handleNotificationNavigation(data: Record<string, unknown>) {
    if (data?.type === 'chat') {
        // Handle chat notification - navigate to chat with sender
        const senderId = data.senderId as string;
        const senderName = data.senderName as string;
        if (senderId) {
            router.push({
                pathname: '/chat/[id]',
                params: {
                    id: senderId,
                    vendorName: senderName || 'Vendor',
                    vendorAvatar: ''
                }
            });
        }
    } else if (data?.type === 'booking' && data?.bookingId) {
        router.push(`/booking-details/${data.bookingId}`);
    } else if (data?.type === 'booking_confirmed' && data?.bookingId) {
        router.push(`/booking-details/${data.bookingId}`);
    } else if (data?.type === 'booking_cancelled' && data?.bookingId) {
        router.push(`/booking-details/${data.bookingId}`);
    } else if (data?.type === 'event' && data?.eventId) {
        router.push(`/event/${data.eventId}`);
    }
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
            await Notifications.setNotificationChannelAsync('chat', {
                name: 'Chat Messages',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#7C3AED',
                sound: 'notification.mp3',
            });

            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#7C3AED',
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

    // Function to update push token on server
    async function updatePushTokenOnServer(token: string) {
        try {
            const authToken = await getToken();
            if (authToken) {
                const result = await authApi.updatePushToken(token);
                if (result.success) {
                    console.log('Push token updated on server');

                    // Check if user is blocked
                    if (result.response?.isBlocked) {
                        console.warn('User is blocked');
                        await authApi.logout();
                        router.replace('/');
                    }
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
                // Update token on server if user is logged in
                updatePushTokenOnServer(token);
            }
        });

        // Check if app was opened from a notification
        Notifications.getLastNotificationResponseAsync().then((response) => {
            if (response) {
                const data = response.notification.request.content.data;
                handleNotificationNavigation(data);
            }
        });

        // Listen for notifications when app is in foreground
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
        });

        // Listen for notification tap/response
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;

            if (response.actionIdentifier === 'reply' && response.userText) {
                return;
            }

            handleNotificationNavigation(data);
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

// Function to send a chat notification with proper deep linking
export async function sendChatNotification(
    senderName: string,
    message: string,
    eventId: string,
    vendorId: string
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: senderName,
            body: message,
            data: {
                type: 'chat',
                eventId,
                vendorId,
            },
            sound: 'notification.mp3',
            categoryIdentifier: 'chat',
        },
        trigger: null,
    });
}

// Function to send a local notification with custom sound and category
export async function sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    categoryIdentifier?: string
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data || {},
            sound: 'notification.mp3',
            categoryIdentifier: categoryIdentifier || undefined,
        },
        trigger: null,
    });
}

// Function to handle notification response (reply action)
export function setupNotificationResponseHandler(onReply: (vendorId: string, message: string) => void) {
    return Notifications.addNotificationResponseReceivedListener((response) => {
        if (response.actionIdentifier === 'reply') {
            const userText = response.userText;
            const vendorId = response.notification.request.content.data.vendorId as string;

            if (userText && vendorId) {
                onReply(vendorId, userText);
            }
        }
    });
}