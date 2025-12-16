import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken, getSocketUrl, ChatMessage } from '@/lib/api';

interface TypingUser {
    userId: string;
    userName: string;
}

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());

    const connect = useCallback(async () => {
        if (socketRef.current?.connected) return;

        const token = await getToken();
        if (!token) {
            console.log('No token available for socket connection');
            return;
        }

        const socketUrl = getSocketUrl();
        console.log('Connecting to socket:', socketUrl);

        socketRef.current = io(socketUrl, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        socketRef.current.on('connect_error', (error: Error) => {
            console.error('Socket connection error:', error.message);
            setIsConnected(false);
        });

        socketRef.current.on('typing', (data: { conversationId: string; userId: string; userName: string }) => {
            setTypingUsers((prev) => {
                const newMap = new Map(prev);
                newMap.set(data.conversationId, { userId: data.userId, userName: data.userName });
                return newMap;
            });
        });

        socketRef.current.on('typing_stopped', (data: { conversationId: string; userId: string }) => {
            setTypingUsers((prev) => {
                const newMap = new Map(prev);
                newMap.delete(data.conversationId);
                return newMap;
            });
        });
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        }
    }, []);

    const sendMessage = useCallback(
        (receiverId: string, message: string, messageType: 'text' | 'image' | 'file' = 'text'): Promise<{ success: boolean; data?: ChatMessage; error?: string }> => {
            return new Promise((resolve) => {
                if (!socketRef.current?.connected) {
                    resolve({ success: false, error: 'Socket not connected' });
                    return;
                }

                socketRef.current.emit(
                    'send_message',
                    { receiverId, message, messageType },
                    (response: { success: boolean; data?: ChatMessage; error?: string }) => {
                        resolve(response);
                    }
                );
            });
        },
        []
    );

    const joinConversation = useCallback((conversationId: string) => {
        socketRef.current?.emit('join_conversation', conversationId);
    }, []);

    const leaveConversation = useCallback((conversationId: string) => {
        socketRef.current?.emit('leave_conversation', conversationId);
    }, []);

    const startTyping = useCallback((conversationId: string, receiverId: string) => {
        socketRef.current?.emit('typing_start', { conversationId, receiverId });
    }, []);

    const stopTyping = useCallback((conversationId: string, receiverId: string) => {
        socketRef.current?.emit('typing_stop', { conversationId, receiverId });
    }, []);

    const markAsRead = useCallback((conversationId: string, senderId: string) => {
        socketRef.current?.emit('mark_read', { conversationId, senderId });
    }, []);

    const onNewMessage = useCallback((callback: (message: ChatMessage) => void) => {
        socketRef.current?.on('new_message', callback);
        return () => {
            socketRef.current?.off('new_message', callback);
        };
    }, []);

    const onMessagesRead = useCallback((callback: (data: { conversationId: string; readBy: string }) => void) => {
        socketRef.current?.on('messages_read', callback);
        return () => {
            socketRef.current?.off('messages_read', callback);
        };
    }, []);

    const onUserOnline = useCallback((callback: (data: { userId: string }) => void) => {
        socketRef.current?.on('user_online', callback);
        return () => {
            socketRef.current?.off('user_online', callback);
        };
    }, []);

    const onUserOffline = useCallback((callback: (data: { userId: string }) => void) => {
        socketRef.current?.on('user_offline', callback);
        return () => {
            socketRef.current?.off('user_offline', callback);
        };
    }, []);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        typingUsers,
        connect,
        disconnect,
        sendMessage,
        joinConversation,
        leaveConversation,
        startTyping,
        stopTyping,
        markAsRead,
        onNewMessage,
        onMessagesRead,
        onUserOnline,
        onUserOffline,
    };
};
