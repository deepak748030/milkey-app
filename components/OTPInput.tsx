import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Platform, Keyboard } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@/lib/colors';

interface OTPInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function OTPInput({ length = 6, value, onChange, disabled = false }: OTPInputProps) {
    const inputRefs = useRef<(TextInput | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const hiddenInputRef = useRef<TextInput>(null);

    // Split value into individual digits
    const digits = value.split('').slice(0, length);
    while (digits.length < length) {
        digits.push('');
    }

    // Check if all digits are filled
    const isComplete = value.length === length;

    // Focus first empty input on mount
    useEffect(() => {
        if (!disabled && value.length < length) {
            const firstEmptyIndex = value.length;
            setTimeout(() => {
                inputRefs.current[firstEmptyIndex]?.focus();
            }, 100);
        }
    }, []);

    // Handle paste from clipboard
    const handleClipboardPaste = async () => {
        try {
            const clipboardContent = await Clipboard.getStringAsync();
            if (clipboardContent) {
                const numericContent = clipboardContent.replace(/[^0-9]/g, '').slice(0, length);
                if (numericContent.length > 0) {
                    onChange(numericContent);
                    if (numericContent.length === length) {
                        // All filled, blur all inputs
                        Keyboard.dismiss();
                    } else {
                        const nextIndex = numericContent.length;
                        inputRefs.current[nextIndex]?.focus();
                    }
                }
            }
        } catch (error) {
            // Clipboard access failed, ignore
        }
    };

    const handleChange = (text: string, index: number) => {
        // Handle paste - if text is longer than 1 character
        if (text.length > 1) {
            const pastedText = text.replace(/[^0-9]/g, '').slice(0, length);
            onChange(pastedText);
            if (pastedText.length === length) {
                Keyboard.dismiss();
            } else {
                const nextIndex = pastedText.length;
                inputRefs.current[nextIndex]?.focus();
            }
            return;
        }

        // Handle single digit input
        const newDigit = text.replace(/[^0-9]/g, '');

        if (newDigit) {
            // Build new value by replacing digit at current index
            const newValue = digits.slice();
            newValue[index] = newDigit;
            const finalValue = newValue.join('');
            onChange(finalValue);

            // Auto-focus next input if not the last one
            if (index < length - 1) {
                inputRefs.current[index + 1]?.focus();
            } else {
                // Last digit entered, dismiss keyboard
                Keyboard.dismiss();
            }
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace') {
            const newValue = digits.slice();

            if (digits[index]) {
                // Current box has a digit, just clear it
                newValue[index] = '';
                onChange(newValue.join(''));
            } else if (index > 0) {
                // Current box is empty, move to previous and clear it
                newValue[index - 1] = '';
                onChange(newValue.join(''));
                inputRefs.current[index - 1]?.focus();
            }
        }
    };

    const handleFocus = (index: number) => {
        setFocusedIndex(index);

        // If clicking on a filled box when all are complete, allow editing that specific box
        if (isComplete && digits[index]) {
            return;
        }

        // Otherwise, focus the first empty slot
        const firstEmptyIndex = digits.findIndex(d => !d);
        if (firstEmptyIndex !== -1 && firstEmptyIndex !== index) {
            inputRefs.current[firstEmptyIndex]?.focus();
        }
    };

    const handleBlur = () => {
        setFocusedIndex(null);
    };

    const handleBoxPress = (index: number) => {
        // If all filled, allow clicking any box to edit it
        if (isComplete) {
            inputRefs.current[index]?.focus();
            return;
        }

        // Focus the first empty slot
        const firstEmptyIndex = digits.findIndex(d => !d);
        if (firstEmptyIndex !== -1) {
            inputRefs.current[firstEmptyIndex]?.focus();
        } else {
            inputRefs.current[index]?.focus();
        }
    };

    return (
        <View style={styles.container}>
            {digits.map((digit, index) => (
                <Pressable
                    key={index}
                    onPress={() => handleBoxPress(index)}
                    onLongPress={handleClipboardPaste}
                    style={[
                        styles.inputBox,
                        focusedIndex === index && styles.inputBoxFocused,
                        digit && styles.inputBoxFilled,
                        disabled && styles.inputBoxDisabled,
                    ]}
                >
                    <TextInput
                        ref={(ref) => {
                            inputRefs.current[index] = ref;
                        }}
                        style={styles.input}
                        value={digit}
                        onChangeText={(text) => handleChange(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        onFocus={() => handleFocus(index)}
                        onBlur={handleBlur}
                        keyboardType="number-pad"
                        maxLength={2}
                        selectTextOnFocus
                        editable={!disabled}
                        caretHidden
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                    />
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    inputBox: {
        width: 46,
        height: 54,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    inputBoxFocused: {
        borderColor: colors.primary,
        borderWidth: 2,
        backgroundColor: colors.primary + '05',
    },
    inputBoxFilled: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '08',
    },
    inputBoxDisabled: {
        backgroundColor: colors.muted,
        opacity: 0.6,
    },
    input: {
        width: '100%',
        height: '100%',
        fontSize: 20,
        fontWeight: '700',
        color: colors.foreground,
        textAlign: 'center',
        padding: 0,
    },
});
