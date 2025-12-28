import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image, Modal, Alert } from 'react-native';
import { Camera, X } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { authApi, getStoredUser } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';

interface EditProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function EditProfileModal({ isVisible, onClose, onSave }: EditProfileModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadUserData();
    }
  }, [isVisible]);

  const loadUserData = async () => {
    try {
      // First try API
      const result = await authApi.getMe();
      if (result.success && result.response) {
        setName(result.response.name);
        setEmail(result.response.email);
        setPhone(result.response.phone);
        setAddress(result.response.address || '');
        setSelectedImage(result.response.avatar);
      } else {
        // Fallback to stored user
        const user = await getStoredUser();
        if (user) {
          setName(user.name);
          setEmail(user.email);
          setPhone(user.phone);
          setAddress((user as any).address || '');
          setSelectedImage(user.avatar);
        }
      }
    } catch (error) {
      // Fallback to stored user
      const user = await getStoredUser();
      if (user) {
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone);
        setAddress((user as any).address || '');
        setSelectedImage(user.avatar);
      }
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [(ImagePicker as any).MediaType?.Image ?? 'images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Validation Error', 'Name and email are required.');
      return;
    }

    setLoading(true);

    try {
      const updateData: { name?: string; email?: string; avatar?: string; address?: string } = {};

      if (name.trim()) updateData.name = name.trim();
      if (email.trim()) updateData.email = email.trim();
      if (selectedImage) updateData.avatar = selectedImage;
      updateData.address = address.trim();

      const result = await authApi.updateProfile(updateData);

      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully!');
        onSave();
        onClose();
      } else {
        Alert.alert('Update Failed', result.message || 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error saving user data:', error);
      Alert.alert('Error', 'An error occurred while updating your profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    loadUserData();
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
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
          <View style={styles.content}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{ uri: selectedImage || 'https://api.dicebear.com/7.x/avataaars/png?seed=user' }}
                  style={styles.avatar}
                />
                <Pressable style={styles.cameraButton} onPress={pickImage}>
                  <Camera size={16} color={colors.primaryForeground} />
                </Pressable>
              </View>
              <Text style={styles.avatarCaption}>Tap camera icon to change picture</Text>
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  placeholder="Phone number"
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
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <Text style={styles.helperText}>This address will be used for product delivery</Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <Pressable style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.saveButton,
                  (!name.trim() || !email.trim() || loading) && styles.disabledButton
                ]}
                onPress={handleSave}
                disabled={!name.trim() || !email.trim() || loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 32,
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
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  placeholder: {
    width: 32,
  },
  content: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCaption: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  fieldContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
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
  disabledInput: {
    backgroundColor: colors.muted,
    color: colors.mutedForeground,
  },
  addressInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  helperText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: colors.muted,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});