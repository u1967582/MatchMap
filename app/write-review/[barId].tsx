import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { supabase } from '~/utils/supabase';
import { useReviews } from '~/hooks/useReviews';
import {
  AppText,
  AppButton,
  toast,
  colors,
  spacing,
  radius,
} from '~/components/ds';

interface Bar {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: { name: string } | null;
}

// Rating Star Component with Enhanced Animation
interface RatingStarProps {
  value: number;
  selected: boolean;
  onPress: () => void;
}

function RatingStar({ value, selected, onPress }: RatingStarProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    scale.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 150 })
    );

    onPress();
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={selected ? 'star' : 'star-outline'}
          size={32}
          color={selected ? '#FFD700' : colors.text.muted}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function WriteReviewScreen() {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [bar, setBar] = useState<Bar | null>(null);
  const [user, setUser] = useState<any>(null);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const { createReview, updateReview, getUserReview } = useReviews();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
    };
    getUser();
  }, []);

  // Fetch bar information and check for existing review
  useEffect(() => {
    const fetchBarAndReview = async () => {
      if (!barId || !user?.id) return;
      
      try {
        // Fetch bar data
        const { data: barData, error } = await supabase
          .from('bars')
          .select(`
            id,
            name,
            description,
            bar_categories(name),
            bar_images(image_url, image_order)
          `)
          .eq('id', barId)
          .single();

        if (error) {
          console.error('❌ Error fetching bar:', error);
          return;
        }

        // Transform the data to match our interface
        const transformedBar = {
          id: barData.id,
          name: barData.name,
          description: barData.description,
          // Get the image with image_order = 1, or the first image if none found
          image_url: barData.bar_images?.find((img: any) => img.image_order === 1)?.image_url || 
                    barData.bar_images?.[0]?.image_url || undefined,
          category: barData.bar_categories?.[0] || null,
        };

        setBar(transformedBar);

        // Check if user has already reviewed this bar
        const userReview = await getUserReview(barId, user.id);
        if (userReview) {
          setExistingReview(userReview);
          setRating(userReview.rating);
          setComment(userReview.comment || '');
        }
      } catch (error) {
        console.error('❌ Error fetching bar:', error);
      }
    };

    fetchBarAndReview();
  }, [barId, user?.id, getUserReview]);

  const handleSubmit = async () => {
    if (!rating || !user?.id || !barId) {
      toast.warning('Selecciona una valoración');
      return;
    }

    if (!comment.trim()) {
      toast.warning('Escribe un comentario sobre tu experiencia');
      return;
    }

    setLoading(true);

    try {
      let success = false;

      if (existingReview) {
        // Update existing review
        success = await updateReview(existingReview.id, rating, comment.trim());
      } else {
        // Create new review
        success = await createReview(barId, user.id, rating, comment.trim());
      }

      if (success) {
        toast.success(existingReview ? 'Reseña actualizada' : 'Reseña publicada');
        router.back();
      } else {
        toast.error('No se pudo publicar la reseña');
      }
    } catch (error) {
      console.error('❌ Error posting review:', error);
      toast.error('No se pudo publicar la reseña', 'Inténtalo de nuevo');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
          title: 'Write a Review'
        }}
      />

      {/* Minimal Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="h2">
          {existingReview ? 'Editar reseña' : 'Nueva reseña'}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bar Info - Minimal Design */}
        {bar && (
          <View style={styles.barInfo}>
            <View style={styles.barImageWrapper}>
              <Image
                source={{
                  uri: bar.image_url || 'https://via.placeholder.com/56x56/2A3A4A/A3B3CC?text=Bar'
                }}
                style={styles.barAvatar}
                resizeMode="cover"
              />
            </View>
            <View style={styles.barDetails}>
              <AppText variant="h2" numberOfLines={1}>{bar.name}</AppText>
              <View style={styles.categoryRow}>
                <Ionicons name="location-sharp" size={14} color={colors.text.secondary} />
                <AppText variant="caption" color={colors.text.secondary}>
                  {bar.category?.name || 'Bar'}
                </AppText>
              </View>
            </View>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Rating Section - Clean Design */}
        <View style={styles.ratingSection}>
          <AppText variant="subtitle" style={styles.sectionTitle}>
            ¿Cómo estuvo tu experiencia?
          </AppText>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <RatingStar
                key={value}
                value={value}
                selected={rating !== null && value <= rating}
                onPress={() => setRating(value)}
              />
            ))}
          </View>

          {rating !== null && (
            <AppText
              variant="body"
              color={
                rating >= 4
                  ? colors.status.success
                  : rating === 3
                    ? colors.status.boost
                    : colors.status.error
              }
              style={styles.ratingLabel}
            >
              {rating === 5 ? '¡Excelente!' : rating === 4 ? 'Muy bueno' : rating === 3 ? 'Bueno' : rating === 2 ? 'Regular' : 'Mejorable'}
            </AppText>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Comment Section - Minimal Design */}
        <View style={styles.commentSection}>
          <AppText variant="subtitle" style={styles.sectionTitle}>
            Cuéntanos más
          </AppText>

          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              // Focus the input when tapping the container
            }}
          >
            <View style={styles.textInputWrapper}>
              <TextInput
                placeholder="Comparte detalles sobre tu visita: ambiente, atención, bebidas, música..."
                value={comment}
                onChangeText={setComment}
                multiline
                style={styles.textInput}
                placeholderTextColor={colors.text.muted}
                textAlignVertical="top"
                editable={!loading}
                maxLength={500}
              />
            </View>
          </TouchableOpacity>

          <View style={styles.charCountRow}>
            <AppText
              variant="caption"
              color={comment.length > 450 ? colors.status.warning : colors.text.muted}
            >
              {comment.length}/500 caracteres
            </AppText>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomBar}>
        <AppButton
          text={loading ? 'Publicando...' : existingReview ? 'Actualizar' : 'Publicar'}
          onPress={handleSubmit}
          variant="primary"
          loading={loading}
          disabled={!rating || !comment.trim() || loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerSpacer: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for fixed button
  },

  // Bar Info - Minimal Design
  barInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  barImageWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  barAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.elevated,
  },
  barDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: spacing.xl,
    marginVertical: spacing.md,
  },

  // Rating Section - Clean Design
  ratingSection: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ratingLabel: {
    marginTop: spacing.md,
    fontWeight: '600',
    fontSize: 15,
  },

  // Comment Section - Minimal Design
  commentSection: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  textInputWrapper: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    marginTop: spacing.md,
  },
  textInput: {
    minHeight: 140,
    maxHeight: 240,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  charCountRow: {
    marginTop: spacing.md,
    alignItems: 'flex-end',
  },

  // Fixed Bottom Button
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
}); 