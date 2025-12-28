import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { authApi, getStoredUser } from '@/lib/api';
import { SuccessModal } from './SuccessModal';

interface EditProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function EditProfileModal({ isVisible, onClose, onSave }: EditProfileModalProps) {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
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
      } else {
        const user = await getStoredUser();
        if (user) {
          setName(user.name);
          setEmail(user.email);
          setPhone(user.phone);
          setAddress((user as any).address || '');
        }
      }
    } catch (error) {
      const user = await getStoredUser();
      if (user) {
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone);
        setAddress((user as any).address || '');
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Validation Error', 'Name and email are required.');
      return;
    }

    setLoading(true);

    try {
      const updateData: { name?: string; email?: string; address?: string } = {};

      if (name.trim()) updateData.name = name.trim();
      if (email.trim()) updateData.email = email.trim();
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
      padding: 20,
    },
    modal: {
      backgroundColor: colors.card,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
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
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.mutedForeground}
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
          </ScrollView>
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