import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Camera, User as UserIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { authApi, getStoredUser } from '@/lib/api';
import { authApiNew } from '@/lib/milkeyApi';
import { updateAuthUser } from '@/lib/authStore';
import { SuccessModal } from './SuccessModal';

interface EditProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function EditProfileModal({ isVisible, onClose, onSave }: EditProfileModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

  useEffect(() => {
    if (isVisible) {
      loadUserData();
    }
  }, [isVisible]);

  const loadUserData = async () => {
    try {
      const result = await authApi.getMe();
      if (result.success && result.response) {
        setName(result.response.name);
        setEmail(result.response.email);
        setPhone(result.response.phone);
        setAddress(result.response.address || '');
        setAvatar((result.response as any).avatar || '');
      } else {
        const user = await getStoredUser();
        if (user) {
          setName(user.name);
          setEmail(user.email);
          setPhone(user.phone);
          setAddress((user as any).address || '');
          setAvatar((user as any).avatar || '');
        }
      }
    } catch (error) {
      const user = await getStoredUser();
      if (user) {
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone);
        setAddress((user as any).address || '');
        setAvatar((user as any).avatar || '');
      }
    }
  };

  const handlePickAvatar = async () => {
    if (uploadingAvatar) return;
    try {
      // Request permission
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow photo library access to change your profile picture.');
        return;
      }

      // Instagram-like: square crop, then we render in a circle
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || !result.assets[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Error', 'Could not read image data.');
        return;
      }

      setUploadingAvatar(true);
      const uploadRes = await authApiNew.uploadAvatar(asset.base64);
      if (uploadRes.success && uploadRes.response) {
        const newUrl = uploadRes.response.avatar || '';
        setAvatar(newUrl);
        // Persist to local auth store so the profile screen circle updates instantly
        await updateAuthUser({ avatar: newUrl });
        // Notify parent so the profile screen refreshes immediately
        onSave();
      } else {
        Alert.alert('Upload failed', uploadRes.message || 'Could not upload profile picture.');
      }
    } catch (e: any) {
      console.error('Avatar upload error:', e);
      Alert.alert('Error', e?.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }

    setLoading(true);

    try {
      const updateData: { name?: string; address?: string } = {};

      if (name.trim()) updateData.name = name.trim();
      updateData.address = address.trim();

      const result = await authApi.updateProfile(updateData);

      if (result.success) {
        setSuccessMessage({ title: 'Success', message: 'Profile updated successfully!' });
        setShowSuccessModal(true);
      } else {
        setSuccessMessage({ title: 'Update Failed', message: result.message || 'Failed to update profile. Please try again.' });
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Error saving user data:', error);
      setSuccessMessage({ title: 'Error', message: 'An error occurred while updating your profile.' });
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    if (successMessage.title === 'Success') {
      onSave();
      onClose();
    }
  };

  const handleCancel = () => {
    loadUserData();
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 20 + Math.max(insets.bottom, 0),
    },
    modal: {
      backgroundColor: colors.card,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      maxHeight: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: { padding: 4 },
    title: { fontSize: 18, fontWeight: 'bold', color: colors.foreground },
    placeholder: { width: 32 },
    content: { padding: 20 },
    // Avatar (Instagram-like circular)
    avatarSection: {
      alignItems: 'center',
      marginBottom: 20,
    },
    avatarRing: {
      width: 116,
      height: 116,
      borderRadius: 58,
      padding: 3,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInner: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: colors.muted,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.card,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    cameraBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.card,
    },
    avatarHint: {
      marginTop: 8,
      fontSize: 12,
      color: colors.mutedForeground,
    },
    uploadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 55,
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: { gap: 16, marginBottom: 24 },
    fieldContainer: { gap: 8 },
    label: { fontSize: 14, fontWeight: '500', color: colors.foreground },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      backgroundColor: colors.background,
      color: colors.foreground,
    },
    disabledInput: { backgroundColor: colors.muted, color: colors.mutedForeground },
    addressInput: { minHeight: 80, paddingTop: 12 },
    helperText: { fontSize: 12, color: colors.mutedForeground },
    footer: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12 + Math.max(insets.bottom, 8),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    buttonRow: { flexDirection: 'row', gap: 12 },
    cancelButton: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    cancelButtonText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    saveButton: {
      flex: 1.4,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    disabledButton: { backgroundColor: colors.muted },
    saveButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  });

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.closeButton} onPress={handleCancel}>
              <X size={24} color={colors.foreground} />
            </Pressable>
            <Text style={styles.title}>Edit Profile</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Instagram-like circular avatar with edit overlay */}
            <View style={styles.avatarSection}>
              <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar}>
                <View style={styles.avatarRing}>
                  <View style={styles.avatarInner}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.avatarImage} resizeMode="cover" />
                    ) : (
                      <UserIcon size={48} color={colors.mutedForeground} />
                    )}
                    {uploadingAvatar && (
                      <View style={styles.uploadingOverlay}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.cameraBadge}>
                  <Camera size={16} color={'#fff'} />
                </View>
              </Pressable>
              <Text style={styles.avatarHint}>Tap to change profile picture</Text>
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  placeholder="Email address"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  editable={false}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.helperText}>Email cannot be changed</Text>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  placeholder="Phone number"
                  placeholderTextColor={colors.mutedForeground}
                  value={phone}
                  editable={false}
                  keyboardType="phone-pad"
                />
                <Text style={styles.helperText}>Phone number cannot be changed</Text>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={[styles.input, styles.addressInput]}
                  placeholder="Enter your full address (used for product delivery)"
                  placeholderTextColor={colors.mutedForeground}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <Text style={styles.helperText}>This address will be used for product delivery</Text>
              </View>
            </View>
          </ScrollView>

          {/* Sticky footer buttons - always visible above the phone navigation bar */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.saveButton,
                (!name.trim() || loading) && styles.disabledButton
              ]}
              onPress={handleSave}
              disabled={!name.trim() || loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <SuccessModal
        isVisible={showSuccessModal}
        onClose={handleSuccessClose}
        title={successMessage.title}
        message={successMessage.message}
        autoClose={successMessage.title === 'Success'}
        duration={1500}
      />
    </Modal>
  );
}
