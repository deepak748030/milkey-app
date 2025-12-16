import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Camera } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface AvatarUploadProps {
  imageUri: string | null;
  onPickImage: () => void;
  label?: string;
}

export function AvatarUpload({ imageUri, onPickImage, label = 'Add Profile Photo' }: AvatarUploadProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: imageUri || 'https://api.dicebear.com/7.x/avataaars/png?seed=user' }}
          style={styles.avatar}
        />
        <Pressable style={styles.cameraButton} onPress={onPickImage}>
          <Camera size={16} color={colors.primaryForeground} />
        </Pressable>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.border,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    backgroundColor: colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
  },
  label: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
});
