import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ActivityIndicator, RefreshControl, Modal, Alert } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle, Bell, Trash2, X } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { chatApi, ChatConversation, ChatMessage, getStoredUser } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';

export default function ChatListScreen() {
    const insets = useSafeAreaInsets();
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [totalUnread, setTotalUnread] = useState(0);
    const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    const { isConnected, connect, onNewMessage, onMessagesRead, onUserOnline, onUserOffline } = useSocket();

    // Get current user ID
    useEffect(() => {
        const loadUser = async () => {
            const user = await getStoredUser();
            if (user) {
                setCurrentUserId(user.id);
            }
        };
        loadUser();
    }, []);

    // Connect socket on mount
    useEffect(() => {
        connect();
    }, [connect]);

    // Listen for real-time updates
    useEffect(() => {
        if (!isConnected || !currentUserId) return;

        const unsubNewMessage = onNewMessage((message: ChatMessage) => {
            // Update conversation list with new message
            setConversations(prev => {
                const existingIndex = prev.findIndex(c => c.conversationId === message.conversationId);

                if (existingIndex >= 0) {
                    // Update existing conversation
                    const updated = [...prev];
                    const isFromVendor = message.senderModel === 'Vendor';
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        lastMessage: message.message.length > 50
                            ? message.message.substring(0, 50) + '...'
                            : message.message,
                        lastMessageTime: message.createdAt,
                        unreadCount: isFromVendor
                            ? (updated[existingIndex].unreadCount || 0) + 1
                            : updated[existingIndex].unreadCount
                    };
                    // Move to top
                    const [conv] = updated.splice(existingIndex, 1);
                    updated.unshift(conv);
                    return updated;
                } else {
                    // New conversation - reload to get proper partner info
                    loadConversations();
                    return prev;
                }
            });

            // Update total unread count
            if (message.senderModel === 'Vendor') {
                setTotalUnread(prev => prev + 1);
            }
        });

        const unsubMessagesRead = onMessagesRead((data: { conversationId: string; readBy: string }) => {
            // When our messages are read, no need to update unread count
            // This is for when the vendor reads our messages
        });

        const unsubUserOnline = onUserOnline((data: { userId: string }) => {
            setOnlineUsers(prev => new Set([...prev, data.userId]));
        });

        const unsubUserOffline = onUserOffline((data: { userId: string }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.userId);
                return newSet;
            });
        });

        return () => {
            unsubNewMessage();
            unsubMessagesRead();
            unsubUserOnline();
            unsubUserOffline();
        };
    }, [isConnected, currentUserId, onNewMessage, onMessagesRead, onUserOnline, onUserOffline]);

    const loadConversations = useCallback(async () => {
        try {
            const user = await getStoredUser();
            if (!user) {
                setConversations([]);
                return;
            }

            const response = await chatApi.getConversations();
            const data = (response as any).data || response.response?.data;
            if (response.success && data) {
                // Filter to only show conversations with actual messages
                const validConversations = data.filter((conv: ChatConversation) =>
                    conv.partner && conv.lastMessage
                );
                setConversations(validConversations);

                // Calculate total unread count
                const unread = validConversations.reduce((acc: number, conv: ChatConversation) =>
                    acc + (conv.unreadCount || 0), 0
                );
                setTotalUnread(unread);
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Load conversations when screen is focused
    useFocusEffect(
        useCallback(() => {
            loadConversations();
        }, [loadConversations])
    );

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadConversations();
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).toUpperCase();
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('en-IN', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        }
    };

    const navigateToChat = (conversation: ChatConversation) => {
        // Reset unread count locally when opening chat
        if (conversation.unreadCount > 0) {
            setConversations(prev => prev.map(c =>
                c.conversationId === conversation.conversationId
                    ? { ...c, unreadCount: 0 }
                    : c
            ));
            setTotalUnread(prev => Math.max(0, prev - (conversation.unreadCount || 0)));
        }

        router.push({
            pathname: '/chat/[id]',
            params: {
                id: conversation.partner.id,
                vendorName: conversation.partner.name,
                vendorAvatar: conversation.partner.avatar || ''
            }
        });
    };

    const handleLongPress = (conversation: ChatConversation) => {
        setSelectedConversation(conversation);
        setShowDeleteModal(true);
    };

    const handleDeleteConversation = async () => {
        if (!selectedConversation) return;

        setIsDeleting(true);
        try {
            const response = await chatApi.deleteConversation(selectedConversation.partner.id);
            if (response.success) {
                // Remove from local state
                setConversations(prev =>
                    prev.filter(c => c.conversationId !== selectedConversation.conversationId)
                );
                setShowDeleteModal(false);
                setSelectedConversation(null);
            } else {
                Alert.alert('Error', response.message || 'Failed to delete conversation');
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            Alert.alert('Error', 'Failed to delete conversation');
        } finally {
            setIsDeleting(false);
        }
    };

    const renderConversation = ({ item }: { item: ChatConversation }) => {
        const isOnline = onlineUsers.has(item.partner.id);

        return (
            <Pressable
                style={styles.conversationItem}
                onPress={() => navigateToChat(item)}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={500}
            >
                <View style={styles.avatarContainer}>
                    {item.partner.avatar ? (
                        <Image source={{ uri: item.partner.avatar }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>
                                {item.partner.name.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.onlineIndicator, isOnline ? styles.online : styles.offline]} />
                </View>

                <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                        <Text style={styles.vendorName} numberOfLines={1}>
                            {item.partner.name}
                        </Text>
                        <Text style={[
                            styles.timestamp,
                            item.unreadCount > 0 && styles.timestampUnread
                        ]}>
                            {formatTime(item.lastMessageTime)}
                        </Text>
                    </View>
                    <View style={styles.messageRow}>
                        <Text
                            style={[
                                styles.lastMessage,
                                item.unreadCount > 0 && styles.unreadMessage
                            ]}
                            numberOfLines={1}
                        >
                            {item.lastMessage}
                        </Text>
                        {item.unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>
                                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Pressable>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <MessageCircle size={64} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
                Start chatting with vendors to see your conversations here
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header - Similar to TopBar */}
            <View style={[styles.header, { paddingTop: insets.top }]}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MessageCircle size={20} color={colors.primary} />
                    </View>
                    <View>
                        <Text style={styles.headerLabel}>Messages</Text>
                        <Text style={styles.headerTitle}>Chats</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    {totalUnread > 0 && (
                        <View style={styles.headerBadge}>
                            <Text style={styles.headerBadgeText}>
                                {totalUnread > 99 ? '99+' : totalUnread}
                            </Text>
                        </View>
                    )}
                    <Pressable
                        style={styles.notificationButton}
                        onPress={() => router.push('/notifications')}
                    >
                        <Bell size={20} color={colors.foreground} />
                    </Pressable>
                </View>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    renderItem={renderConversation}
                    keyExtractor={(item) => item.conversationId}
                    contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconContainer}>
                                <Trash2 size={24} color={colors.destructive} />
                            </View>
                            <Pressable
                                style={styles.modalCloseButton}
                                onPress={() => setShowDeleteModal(false)}
                            >
                                <X size={20} color={colors.mutedForeground} />
                            </Pressable>
                        </View>

                        <Text style={styles.modalTitle}>Delete Conversation</Text>
                        <Text style={styles.modalDescription}>
                            Are you sure you want to delete your conversation with{' '}
                            <Text style={styles.modalVendorName}>
                                {selectedConversation?.partner.name}
                            </Text>
                            ? This will only delete the chat from your side.
                        </Text>

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                                onPress={handleDeleteConversation}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <Text style={styles.deleteButtonText}>Delete</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: 8,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.foreground,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerBadge: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.primaryForeground,
    },
    notificationButton: {
        padding: 8,
        borderRadius: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        // paddingVertical: 4,
    },
    emptyContainer: {
        flex: 1,
    },
    conversationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 10,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 26,
    },
    avatarPlaceholder: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.primaryForeground,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: colors.card,
    },
    online: {
        backgroundColor: colors.success,
    },
    offline: {
        backgroundColor: colors.mutedForeground,
    },
    conversationContent: {
        flex: 1,
        marginLeft: 14,
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    vendorName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.foreground,
        flex: 1,
        marginRight: 8,
    },
    timestamp: {
        fontSize: 12,
        color: colors.mutedForeground,
    },
    timestampUnread: {
        color: colors.primary,
        fontWeight: '600',
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 14,
        color: colors.mutedForeground,
        flex: 1,
        marginRight: 8,
    },
    unreadMessage: {
        fontWeight: '600',
        color: colors.foreground,
    },
    unreadBadge: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        minWidth: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: colors.primaryForeground,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 64,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.foreground,
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.mutedForeground,
        textAlign: 'center',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 340,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    modalIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.destructive + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.foreground,
        marginBottom: 8,
    },
    modalDescription: {
        fontSize: 14,
        color: colors.mutedForeground,
        lineHeight: 20,
        marginBottom: 20,
    },
    modalVendorName: {
        fontWeight: '600',
        color: colors.foreground,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: colors.muted,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    deleteButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: colors.destructive,
        alignItems: 'center',
    },
    deleteButtonDisabled: {
        opacity: 0.6,
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.white,
    },
});
