// components/CustomTextInput.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors } from '@/lib/colors';

interface CustomTextInputProps extends TextInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
}

export function CustomTextInput({ label, value, onChangeText, ...rest }: CustomTextInputProps) {
    return (
        <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{label}</Text>
            <TextInput
                style={styles.textInput}
                placeholderTextColor={colors.mutedForeground}
                value={value}
                onChangeText={onChangeText}
                {...rest}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    textInput: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 15,
        backgroundColor: colors.card,
        color: colors.foreground,
        height: 48,
    },
});

