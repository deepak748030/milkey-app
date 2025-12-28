import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { getImageUrl } from '@/lib/api';

const { width: screenWidth } = Dimensions.get('window');

interface ImageCarouselProps {
    images: string[];
    badge?: string | null;
    showBackButton?: boolean;
    showFavoriteButton?: boolean;
    isFavorite?: boolean;
    onBackPress?: () => void;
    onFavoritePress?: () => void;
    height?: number;
}

export function ImageCarousel({
    images,
    badge,
    showBackButton = true,
    showFavoriteButton = false,
    isFavorite = false,
    onBackPress,
    onFavoritePress,
    height = 200,
}: ImageCarouselProps) {
    const scrollViewRef = useRef<ScrollView>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const handleImageScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / screenWidth);
        setCurrentImageIndex(index);
    };

    return (
        <View style={[styles.container, { height }]}>
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
            >
                {images.map((image, index) => (
                    <Image key={index} source={{ uri: getImageUrl(image) }} style={[styles.image, { height }]} />
                ))}
            </ScrollView>

            {/* Back Button - Top Left */}
            {showBackButton && onBackPress && (
                <Pressable style={styles.backButton} onPress={onBackPress}>
                    <ArrowLeft size={20} color={colors.primary} />
                </Pressable>
            )}

            {/* Badge - Bottom Left */}
            {badge && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                </View>
            )}

            {/* Favorite Button - Top Right */}
            {showFavoriteButton && onFavoritePress && (
                <Pressable style={styles.favoriteButton} onPress={onFavoritePress}>
                    <Heart
                        size={20}
                        color={colors.primary}
                        fill={isFavorite ? colors.primary : 'transparent'}
                    />
                </Pressable>
            )}

            {/* Image Dots - Bottom Center */}
            <View style={styles.dotsContainer}>
                {images.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            { opacity: currentImageIndex === index ? 1 : 0.6 }
                        ]}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    image: {
        width: screenWidth,
        resizeMode: 'cover',
    },
    backButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 8,
        borderRadius: 20,
        zIndex: 10,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    badge: {
        position: 'absolute',
        bottom: 32,
        left: 16,
        backgroundColor: colors.warning,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        zIndex: 10,
    },
    badgeText: {
        color: colors.foreground,
        fontSize: 12,
        fontWeight: 'bold',
    },
    favoriteButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 8,
        borderRadius: 20,
        zIndex: 10,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    dotsContainer: {
        position: 'absolute',
        bottom: 10,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.white,
    },
});