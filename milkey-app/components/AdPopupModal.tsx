import React, { useEffect, useState, useCallback } from 'react';
import { Modal, View, Image, Text, Dimensions, ActivityIndicator, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X } from 'lucide-react-native';
import { API_BASE_URL } from '@/lib/apiConfig';
import { useAuth } from '@/hooks/useAuth';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface AdPopupData {
  _id: string;
  title?: string;
  subtitle?: string;
  image: string;
  linkType?: string;
  linkValue?: string;
}

async function fetchActiveAd(): Promise<AdPopupData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/ads/active`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (json?.success && json?.response) return json.response as AdPopupData;
    return null;
  } catch {
    return null;
  }
}

export function AdPopupModal() {
  const { isAuthenticated } = useAuth();
  const [ad, setAd] = useState<AdPopupData | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null); // w/h

  const dismiss = useCallback(async () => {
    setVisible(false);
    if (ad?._id) {
      // Remember dismissed for this ad for session + 12h to avoid spamming same ad repeatedly,
      // but new ad id will show again. Uses timestamp.
      try {
        await AsyncStorage.setItem(`adPopup:dismissed:${ad._id}`, String(Date.now()));
      } catch {}
    }
  }, [ad]);

  const handleImagePress = useCallback(() => {
    if (!ad) return;
    if (ad.linkType === 'url' && ad.linkValue) {
      Linking.openURL(ad.linkValue).catch(() => {});
    } else if (ad.linkType === 'product' || ad.linkType === 'category') {
      // For now open as url if linkValue looks like url, else just dismiss
      if (ad.linkValue?.startsWith('http')) Linking.openURL(ad.linkValue).catch(() => {});
    }
  }, [ad]);

  // Load image aspect for proper full-width cover
  useEffect(() => {
    if (!ad?.image) return;
    Image.getSize(
      ad.image,
      (w, h) => {
        if (w && h) setAspect(w / h);
      },
      () => setAspect(null)
    );
  }, [ad?.image]);

  // Fetch after login — show once per app open / per ad id
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const fetched = await fetchActiveAd();
      if (cancelled) return;
      if (!fetched?.image) {
        setLoading(false);
        return;
      }
      // If this exact ad was dismissed in last 12h, don't show again
      try {
        const dismissedAt = await AsyncStorage.getItem(`adPopup:dismissed:${fetched._id}`);
        if (dismissedAt) {
          const age = Date.now() - parseInt(dismissedAt, 10);
          if (age < 12 * 60 * 60 * 1000) {
            setLoading(false);
            return;
          }
        }
      } catch {}
      setAd(fetched);
      // Small delay so splash/navigation settles, then show
      setTimeout(() => {
        if (!cancelled) {
          setVisible(true);
          setLoading(false);
        }
      }, 600);
      if (cancelled) setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!ad || !visible) return null;

  const containerWidth = Math.min(SCREEN_W * 0.94, 420);
  const maxContainerHeight = SCREEN_H * 0.88;

  // Image style: full width, height derived from aspect, cover/contain
  // - If tall image (aspect <1), height will be large, but container is capped + scrollable
  const imageStyle: any = {
    width: '100%' as const,
    backgroundColor: '#000',
  };
  if (aspect) {
    imageStyle.aspectRatio = aspect;
  } else {
    // fallback: let image be at least 60% of width height
    imageStyle.height = containerWidth * 1.15;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.backdrop}>
        {/* Tap backdrop to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        <View style={[styles.card, { width: containerWidth, maxHeight: maxContainerHeight }]}>
          {/* Close button — floating top-right over image */}
          <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={12}>
            <X size={18} color="#fff" strokeWidth={2.5} />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ flexGrow: 0 }}
            style={{ maxHeight: maxContainerHeight }}
          >
            <Pressable onPress={handleImagePress} disabled={!ad.linkValue || ad.linkType === 'none'}>
              <Image
                source={{ uri: ad.image }}
                style={imageStyle}
                resizeMode="cover"
              />
            </Pressable>
            {/* Optional subtle footer if link exists — hint to tap */}
            {ad.linkType !== 'none' && ad.linkValue ? (
              <View style={styles.footerHint}>
                <Text style={styles.footerHintText}>Tap image to open</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

        {/* Optional: loading indicator hidden behind */}
        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    // border for light mode definition
    borderWidth: Platform.OS === 'ios' ? 0 : 0,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  footerHint: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  footerHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
  },
});

export default AdPopupModal;
