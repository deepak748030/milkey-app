import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, ActivityIndicator, Platform, Keyboard, Animated } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ArrowLeft, Send, Check, CheckCheck, Clock } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { chatApi, ChatMessage as ApiChatMessage, getStoredUser } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';

type MessageStatus = 'pending' | 'sent' | 'delivered' | 'seen';

interface DisplayMessage {
  id: string;
  message: string;
  timestamp: string;
  isVendor: boolean;
  status?: MessageStatus;
}

// Message Status Icon Component
const MessageStatusIcon = ({ status }: { status?: MessageStatus }) => {
  switch (status) {
    case 'pending':
      return <Clock size={12} color={colors.primaryForeground} style={{ opacity: 0.7 }} />;
    case 'sent':
      return <Check size={12} color={colors.primaryForeground} style={{ opacity: 0.7 }} />;
    case 'delivered':
      return <CheckCheck size={12} color={colors.primaryForeground} style={{ opacity: 0.7 }} />;
    case 'seen':
      return <CheckCheck size={12} color="#34B7F1" />;
    default:
      return <Check size={12} color={colors.primaryForeground} style={{ opacity: 0.7 }} />;
  }
};

export default function ChatScreen() {
  const { id, vendorName, vendorAvatar } = useLocalSearchParams<{ id: string; vendorName?: string; vendorAvatar?: string }>();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  const {
    isConnected,
    connect,
    sendMessage: socketSendMessage,
    onNewMessage,
    onMessagesRead,
    startTyping,
    stopTyping,
    markAsRead,
    typingUsers
  } = useSocket();

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

  // Keyboard handling - properly reset position when keyboard closes
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? 250 : 100,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 250 : 100,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [keyboardHeight]);

  // Connect socket and load messages
  useEffect(() => {
    connect();
    loadMessages();
  }, [connect]);

  // Mark messages as read when entering chat
  useEffect(() => {
    if (isConnected && currentUserId && id) {
      const convId = [currentUserId, id].sort().join('_');
      markAsRead(convId, id);
    }
  }, [isConnected, currentUserId, id, markAsRead]);

  // Listen for real-time events
  useEffect(() => {
    if (!isConnected || !id) return;

    const unsubNewMessage = onNewMessage((apiMessage: ApiChatMessage) => {
      // Only add if it's for this conversation
      const conversationId = [currentUserId, id].sort().join('_');
      if (apiMessage.conversationId === conversationId) {
        const displayMessage: DisplayMessage = {
          id: apiMessage._id,
          message: apiMessage.message,
          timestamp: apiMessage.createdAt,
          isVendor: apiMessage.senderModel === 'Vendor',
          status: apiMessage.isRead ? 'seen' : 'delivered'
        };
        setMessages(prev => [...prev, displayMessage]);

        // Mark as read if from vendor
        if (apiMessage.senderModel === 'Vendor' && currentUserId && apiMessage.sender?._id) {
          markAsRead(conversationId, apiMessage.sender._id);
        }
      }
    });

    const unsubMessagesRead = onMessagesRead((data) => {
      const conversationId = [currentUserId, id].sort().join('_');
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.map(m =>
          !m.isVendor ? { ...m, status: 'seen' as MessageStatus } : m
        ));
      }
    });

    return () => {
      unsubNewMessage();
      unsubMessagesRead();
    };
  }, [isConnected, id, currentUserId, onNewMessage, onMessagesRead, markAsRead]);

  // Check if vendor is typing
  const conversationId = currentUserId && id ? [currentUserId, id].sort().join('_') : '';
  const vendorTyping = typingUsers.get(conversationId);

  const loadMessages = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const response = await chatApi.getConversation(id);

      // Handle both response formats: { data: [...] } or { response: { data: [...] } }
      const data = (response as any).data || response.response?.data;
      if (response.success && data) {
        const displayMessages: DisplayMessage[] = data.map((msg: ApiChatMessage) => ({
          id: msg._id,
          message: msg.message,
          timestamp: msg.createdAt,
          isVendor: msg.senderModel === 'Vendor',
          status: msg.isRead ? 'seen' : 'delivered'
        }));
        setMessages(displayMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id || isSending) return;

    setIsSending(true);
    const messageId = Date.now().toString();
    const messageText = newMessage.trim();

    // Add pending message to UI
    const pendingMessage: DisplayMessage = {
      id: messageId,
      message: messageText,
      timestamp: new Date().toISOString(),
      isVendor: false,
      status: 'pending',
    };
    setMessages(prev => [...prev, pendingMessage]);
    setNewMessage('');

    // Stop typing indicator
    if (conversationId && id) {
      stopTyping(conversationId, id);
    }

    try {
      // Try socket first
      if (isConnected) {
        const result = await socketSendMessage(id, messageText);
        if (result.success && result.data) {
          setMessages(prev => prev.map(m =>
            m.id === messageId
              ? { ...m, id: result.data!._id, status: 'delivered' as MessageStatus }
              : m
          ));
          setIsSending(false);
          return;
        }
      }

      // Fallback to REST API
      const response = await chatApi.sendMessage({ receiverId: id, message: messageText });
      // Handle both response formats: { data: {...} } or { response: {...} }
      const msgData = (response as any).data || response.response;
      if (response.success && msgData) {
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, id: msgData._id, status: 'delivered' as MessageStatus }
            : m
        ));
      } else {
        // Mark as sent but not delivered
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, status: 'sent' as MessageStatus } : m
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, status: 'sent' as MessageStatus } : m
      ));
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);

    if (conversationId && id && isConnected) {
      if (!isTyping) {
        setIsTyping(true);
        startTyping(conversationId, id);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        stopTyping(conversationId, id);
      }, 2000);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  };

  const displayName = vendorName || 'Vendor';
  const displayAvatar = vendorAvatar || '';

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 12;

  return (
    <View style={styles.container}>
      {/* Glassmorphism Background */}
      <LinearGradient
        colors={[colors.primary + '20', colors.background, colors.primary + '10']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header with Glassmorphism */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="light" style={styles.headerBlur} />
        <View style={styles.headerContent}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <View style={styles.avatarContainer}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.vendorName}>{displayName}</Text>
            {vendorTyping && (
              <Text style={styles.typingText}>Typing...</Text>
            )}
          </View>
        </View>
      </View>

      {/* Connection Status */}
      {!isConnected && (
        <View style={styles.connectionStatus}>
          <Text style={styles.connectionText}>Connecting...</Text>
        </View>
      )}

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={styles.messagesContent}>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
              </View>
            ) : (
              <View style={styles.messagesList}>
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageContainer,
                      message.isVendor ? styles.vendorMessage : styles.userMessage
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        message.isVendor ? styles.vendorBubble : styles.userBubble
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          message.isVendor ? styles.vendorMessageText : styles.userMessageText
                        ]}
                      >
                        {message.message}
                      </Text>
                      <View style={styles.messageFooter}>
                        <Text
                          style={[
                            styles.messageTime,
                            message.isVendor ? styles.vendorMessageTime : styles.userMessageTime
                          ]}
                        >
                          {formatTime(message.timestamp)}
                        </Text>
                        {!message.isVendor && (
                          <View style={styles.statusIcon}>
                            <MessageStatusIcon status={message.status} />
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Input Area with Glassmorphism - Animated for keyboard */}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            paddingBottom: bottomPadding,
            transform: [{ translateY: Animated.multiply(keyboardHeight, -1) }]
          }
        ]}
      >
        <BlurView intensity={80} tint="light" style={styles.inputBlur} />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={newMessage}
            onChangeText={handleTyping}
            multiline
            maxLength={2000}
            editable={!isSending}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!newMessage.trim() || isSending) && styles.disabledSendButton
            ]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Send size={18} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundGradient: {
    // ...StyleSheet.absoluteFillObject,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
    position: 'relative',
    overflow: 'hidden',
  },
  headerBlur: {
    // ...StyleSheet.absoluteFillObject,

  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,

  },
  backButton: {
    padding: 4,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryForeground,
  },
  headerInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  typingText: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  connectionStatus: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  connectionText: {
    fontSize: 12,
    color: colors.warning,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContentContainer: {
    flexGrow: 1,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  messagesList: {
    gap: 12,
  },
  messageContainer: {
    flexDirection: 'row',
  },
  vendorMessage: {
    justifyContent: 'flex-start',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  vendorBubble: {
    backgroundColor: colors.muted,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  vendorMessageText: {
    color: colors.foreground,
  },
  userMessageText: {
    color: colors.primaryForeground,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  vendorMessageTime: {
    color: colors.mutedForeground,
  },
  userMessageTime: {
    color: colors.primaryForeground,
    opacity: 0.8,
  },
  statusIcon: {
    marginLeft: 2,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border + '40',

    paddingTop: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  inputBlur: {
    // ...StyleSheet.absoluteFillObject,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    opacity: 0.5,
  },
});
