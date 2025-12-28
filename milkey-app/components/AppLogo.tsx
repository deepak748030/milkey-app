import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Crown, Sparkles } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

interface AppLogoProps {
    size?: number;
}

export const AppLogo = ({ size = 120 }: AppLogoProps) => {
    const scale = size / 120;

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} viewBox="0 0 120 120">
                <Defs>
                    <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#FFD700" />
                        <Stop offset="50%" stopColor="#DAA520" />
                        <Stop offset="100%" stopColor="#B8860B" />
                    </LinearGradient>
                    <LinearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#8B0000" />
                        <Stop offset="100%" stopColor="#4A0000" />
                    </LinearGradient>
                </Defs>

                {/* Background Circle */}
                <Circle cx="60" cy="60" r="58" fill="url(#bgGradient)" stroke="#DAA520" strokeWidth="2" />

                {/* Decorative Border */}
                <Circle cx="60" cy="60" r="52" fill="none" stroke="#DAA520" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />

                {/* Crown at top */}
                <G transform="translate(42, 15)">
                    <Path
                        d="M18 0L22 12H14L18 0ZM8 4L14 12H2L8 4ZM28 4L22 12H34L28 4Z"
                        fill="url(#goldGradient)"
                    />
                    <Path d="M2 12H34V16H2V12Z" fill="url(#goldGradient)" />
                </G>

                {/* Letter P */}
                <G transform="translate(35, 32)">
                    {/* Main stem of P */}
                    <Path
                        d="M10 0V55H18V35H28C38 35 45 28 45 17.5C45 7 38 0 28 0H10Z"
                        fill="url(#goldGradient)"
                    />
                    {/* Inner P cutout */}
                    <Path
                        d="M18 8H26C32 8 36 12 36 17.5C36 23 32 27 26 27H18V8Z"
                        fill="#8B0000"
                    />
                </G>

                {/* Left decorative flourish */}
                <G transform="translate(8, 45)">
                    <Path
                        d="M0 15C5 10 10 8 15 10C10 5 8 0 12 0C16 0 20 5 18 12C22 8 28 8 25 15C22 22 15 25 10 22C5 19 0 20 0 15Z"
                        fill="url(#goldGradient)"
                        opacity="0.8"
                    />
                </G>

                {/* Right decorative flourish */}
                <G transform="translate(92, 45)">
                    <Path
                        d="M20 15C15 10 10 8 5 10C10 5 12 0 8 0C4 0 0 5 2 12C-2 8 -8 8 -5 15C-2 22 5 25 10 22C15 19 20 20 20 15Z"
                        fill="url(#goldGradient)"
                        opacity="0.8"
                    />
                </G>

                {/* Bottom decorative elements */}
                <G transform="translate(30, 92)">
                    {/* Left dot */}
                    <Circle cx="10" cy="5" r="3" fill="url(#goldGradient)" />
                    {/* Center diamond */}
                    <Path d="M30 0L35 5L30 10L25 5Z" fill="url(#goldGradient)" />
                    {/* Right dot */}
                    <Circle cx="50" cy="5" r="3" fill="url(#goldGradient)" />
                </G>

                {/* Small sparkle decorations */}
                <Circle cx="25" cy="30" r="2" fill="#FFD700" opacity="0.6" />
                <Circle cx="95" cy="30" r="2" fill="#FFD700" opacity="0.6" />
                <Circle cx="20" cy="75" r="1.5" fill="#FFD700" opacity="0.5" />
                <Circle cx="100" cy="75" r="1.5" fill="#FFD700" opacity="0.5" />
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});



