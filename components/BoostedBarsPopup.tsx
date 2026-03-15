import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { AppText, colors, spacing, radius } from '~/components/ds';
import { supabase } from '~/utils/supabase';

const C = {
  bg: '#0e1219',
  boost: '#FFD700',
  starColor: '#fbbf24',
  textWhite: '#ffffff',
  textMuted: '#888888',
  buttonSecBg: 'rgba(255,255,255,0.04)',
  buttonSecBorder: 'rgba(255,255,255,0.07)',
  closeBtnBg: 'rgba(255,255,255,0.05)',
  closeBtnBorder: 'rgba(255,255,255,0.07)',
  separator: 'rgba(255,255,255,0.12)',
  dotInactive: 'rgba(255,255,255,0.08)',
  dotActive: '#2563eb',
};

interface BoostedBar {
  id: string;
  name: string;
  image_url?: string;
  rating?: number;
  review_count?: number;
}

interface BoostedBarsPopupProps {
  visible: boolean;
  onClose: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.85;

export default function BoostedBarsPopup({ visible, onClose }: BoostedBarsPopupProps) {
  const [bars, setBars] = useState<BoostedBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    async function fetchBoostedBars() {
      try {
        setLoading(true);
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('bar_boosts')
          .select(`
            end_at,
            bars (
              id,
              name,
              rating,
              review_count,
              bar_images (image_url, image_order)
            )
          `)
          .eq('status', 'active')
          .gt('end_at', now)
          .order('end_at', { ascending: false })
          .limit(3);

        if (error) throw error;
        if (!isMounted) return;

        const boostedBars: BoostedBar[] = (data || [])
          .filter((item) => item.bars && !Array.isArray(item.bars))
          .map((item) => {
            const bar = item.bars as unknown as {
              id: string;
              name: string;
              rating?: number;
              review_count?: number;
              bar_images?: { image_url: string; image_order: number }[];
            };
            const images = bar.bar_images || [];
            const mainImage =
              images.find((img) => img.image_order === 1)?.image_url ||
              images[0]?.image_url ||
              null;
            return {
              id: bar.id,
              name: bar.name,
              rating: bar.rating,
              review_count: bar.review_count,
              image_url: mainImage ?? undefined,
            };
          });

        setBars(boostedBars);
      } catch (err) {
        console.error('❌ BoostedBarsPopup: Error fetching bars:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchBoostedBars();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (visible && (bars.length > 0 || loading)) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, bars.length, loading]);

  if (!visible) return null;
  if (!loading && bars.length === 0) return null;

  const handleViewProfile = (barId: string) => {
    onClose();
    router.push(`/bar-profile/${barId}` as any);
  };

  const renderStars = (rating?: number) => {
    const score = typeof rating === 'number' ? rating : 0;
    return Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < Math.round(score) ? 'star' : 'star-outline'}
        size={12}
        color={C.starColor}
      />
    ));
  };

  const renderCard = ({ item }: { item: BoostedBar }) => (
    <View style={styles.slide}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.badge}>
          <Ionicons name="star" size={10} color={C.boost} />
          <Text style={styles.badgeText}>NUESTRAS RECOMENDACIONES</Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      {/* Image — mismo patrón que search.tsx */}
      <View style={styles.imageContainer}>
        {item.image_url ? (
          <>
            <Image source={{ uri: item.image_url }} style={styles.barImage} />
            <LinearGradient
              colors={['rgba(29,78,216,0.18)', 'rgba(29,78,216,0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="image-outline" size={32} color={colors.text.muted} />
            <AppText variant="caption" color={colors.text.muted}>Sin imagen</AppText>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <Text style={styles.barName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.infoRow}>
          <View style={styles.starsRow}>{renderStars(item.rating)}</View>
          <Text style={styles.scoreText}>
            {typeof item.rating === 'number' ? item.rating.toFixed(1) : '—'}
          </Text>
          <View style={styles.infoSeparator} />
          <Text style={styles.reviewsText}>{item.review_count || 0} reseñas</Text>
        </View>

        <View style={styles.buttonsRow}>
          {/* Botón "Ver en el Mapa" — mismo estilo que search.tsx/favorites.tsx */}
          <TouchableOpacity style={styles.viewOnMapButton} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="map-outline" size={16} color={colors.brand.link} />
            <AppText variant="label" color={colors.brand.link}>Ver en el Mapa</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleViewProfile(item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Ver perfil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
        pointerEvents="auto"
      >
        {/* Gradient de fondo del card — siempre visible */}
        <LinearGradient
          colors={['rgba(29,78,216,0.12)', C.bg, C.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Línea dorada lateral (color boost/marker) */}
        <View style={styles.accentLine} />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.brand.primary} />
          </View>
        ) : (
          <>
            <FlatList
              data={bars}
              renderItem={renderCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH}
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
                setActiveIndex(index);
              }}
            />

            {bars.length > 1 && (
              <View style={styles.dotsContainer}>
                {bars.map((_, index) => (
                  <View key={index} style={[styles.dot, index === activeIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
  },
  container: {
    width: CARD_WIDTH,
    backgroundColor: C.bg,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.65,
    shadowRadius: 30,
    elevation: 20,
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: C.boost,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    zIndex: 10,
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    width: CARD_WIDTH,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingRight: 14,
    paddingLeft: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: C.boost,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.closeBtnBg,
    borderWidth: 1,
    borderColor: C.closeBtnBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Imagen — igual que search.tsx
  imageContainer: {
    position: 'relative',
    marginTop: 12,
    marginLeft: 18,
    marginRight: 14,
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  barImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardBody: {
    paddingTop: 14,
    paddingLeft: 18,
    paddingRight: 14,
    paddingBottom: 16,
  },
  barName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.textWhite,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textWhite,
  },
  infoSeparator: {
    width: 1,
    height: 12,
    backgroundColor: C.separator,
  },
  reviewsText: {
    fontSize: 12,
    color: C.textMuted,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  // Botón "Ver en el Mapa" — idéntico a search.tsx y favorites.tsx
  viewOnMapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    backgroundColor: colors.alpha.brandLight,
    paddingVertical: spacing.lg - 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.alpha.brandBorder,
  },
  secondaryButton: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: C.buttonSecBg,
    borderWidth: 1,
    borderColor: C.buttonSecBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 13,
    paddingBottom: 14,
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 50,
    backgroundColor: C.dotInactive,
  },
  dotActive: {
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.dotActive,
  },
});
