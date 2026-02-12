import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { supabase } from '~/utils/supabase';
import { useReviews } from '~/hooks/useReviews';
import {
  AppText,
  AppButton,
  AppCard,
  toast,
  colors,
  spacing,
  radius,
  shadows,
} from '~/components/ds';

interface Bar {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: { name: string } | null;
}

// Rating Star Component with Animation
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
    scale.value = withSequence(
      withSpring(1.3, { damping: 10 }),
      withSpring(1, { damping: 8 })
    );
    onPress();
  };

  return (
    <Animated.View style={[styles.starContainer, animatedStyle]}>
      <TouchableOpacity
        style={styles.starButton}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Ionicons
          name={selected ? 'star' : 'star-outline'}
          size={48}
          color={selected ? colors.status.boost : colors.text.muted}
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
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
          title: 'Write a Review'
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title">
          {existingReview ? 'Editar Reseña' : 'Escribir Reseña'}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bar Information Card - Premium Design */}
        {bar && (
          <View style={styles.barCard}>
            <View style={styles.barImageContainer}>
              <Image
                source={{
                  uri: bar.image_url || 'https://via.placeholder.com/120x120/2A3A4A/A3B3CC?text=Bar'
                }}
                style={styles.barImage}
                resizeMode="cover"
              />
              <View style={styles.barImageOverlay} />
            </View>
            <View style={styles.barInfoContainer}>
              <AppText variant="h2" style={styles.barName}>{bar.name}</AppText>
              <View style={styles.barCategoryRow}>
                <Ionicons name="location" size={14} color={colors.status.boost} />
                <AppText variant="caption" color={colors.text.secondary} style={styles.barCategory}>
                  {bar.category?.name || 'Bar'}
                </AppText>
              </View>
            </View>
          </View>
        )}

        {/* Rating Section - Redesigned */}
        <View style={styles.ratingSection}>
          <View style={styles.ratingHeader}>
            <Ionicons name="star" size={20} color={colors.status.boost} />
            <AppText variant="subtitle" style={styles.ratingTitle}>
              ¿Qué te pareció?
            </AppText>
          </View>

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
            <View style={styles.ratingFeedback}>
              <View style={[
                styles.ratingBadge,
                {
                  backgroundColor: rating >= 4
                    ? 'rgba(16, 185, 129, 0.15)'
                    : rating === 3
                      ? 'rgba(255, 215, 0, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)'
                }
              ]}>
                <AppText
                  variant="body"
                  color={
                    rating >= 4
                      ? colors.status.success
                      : rating === 3
                        ? colors.status.boost
                        : colors.status.error
                  }
                  style={styles.ratingFeedbackText}
                >
                  {rating === 5 ? '¡Excelente!' : rating === 4 ? 'Muy bueno' : rating === 3 ? 'Bueno' : rating === 2 ? 'Regular' : 'Mejorable'}
                </AppText>
              </View>
            </View>
          )}
        </View>

        {/* Review Input - Premium Design */}
        <View style={styles.commentSection}>
          <View style={styles.commentHeader}>
            <Ionicons name="create-outline" size={20} color={colors.brand.primary} />
            <AppText variant="subtitle" style={styles.commentTitle}>
              Comparte tu experiencia
            </AppText>
          </View>

          <View style={styles.textInputContainer}>
            <TextInput
              placeholder="Cuéntanos qué te gustó, qué mejorarías, ambiente, atención..."
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

          <View style={styles.commentFooter}>
            <View style={styles.charCountContainer}>
              <Ionicons
                name="document-text-outline"
                size={14}
                color={comment.length > 450 ? colors.status.warning : colors.text.muted}
              />
              <AppText
                variant="caption"
                color={comment.length > 450 ? colors.status.warning : colors.text.muted}
                style={styles.charCountText}
              >
                {comment.length}/500
              </AppText>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
          <AppButton
            text={loading ? 'Publicando...' : existingReview ? 'Actualizar Reseña' : 'Publicar Reseña'}
            onPress={handleSubmit}
            variant="primary"
            loading={loading}
            disabled={!rating || !comment.trim() || loading}
          />
        </View>
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxxl,
  },

  // Bar Card - Premium Design
  barCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xxxl,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    ...shadows.md,
  },
  barImageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  barImage: {
    width: '100%',
    height: '100%',
  },
  barImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  barInfoContainer: {
    padding: spacing.xl,
  },
  barName: {
    marginBottom: spacing.sm,
  },
  barCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  barCategory: {
    fontSize: 14,
  },

  // Rating Section - Redesigned
  ratingSection: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xxxl,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    ...shadows.sm,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  ratingTitle: {
    fontWeight: '700',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  starContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButton: {
    padding: spacing.xs,
  },
  ratingFeedback: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ratingBadge: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  ratingFeedbackText: {
    fontWeight: '700',
    fontSize: 16,
  },

  // Comment Section - Premium Design
  commentSection: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    ...shadows.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  commentTitle: {
    fontWeight: '700',
  },
  textInputContainer: {
    borderWidth: 2,
    borderColor: colors.border.subtle,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.input,
    overflow: 'hidden',
  },
  textInput: {
    minHeight: 160,
    maxHeight: 240,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  commentFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  charCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  charCountText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Submit Button
  buttonContainer: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
}); 