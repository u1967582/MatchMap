import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Image, Alert, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
} from '~/components/ds';

interface Bar {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: { name: string } | null;
}

// Rating Star Component
interface RatingStarProps {
  value: number;
  selected: boolean;
  onPress: () => void;
}

function RatingStar({ value, selected, onPress }: RatingStarProps) {
  return (
    <TouchableOpacity
      style={[styles.ratingButton, selected && styles.ratingButtonSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={selected ? 'star' : 'star-outline'}
        size={32}
        color={selected ? colors.status.boost : colors.text.secondary}
      />
      <AppText
        variant="caption"
        color={selected ? colors.status.boost : colors.text.secondary}
        style={styles.ratingValueText}
      >
        {value}
      </AppText>
    </TouchableOpacity>
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
        {/* Bar Information */}
        {bar && (
          <AppCard style={styles.barSection}>
            <Image
              source={{
                uri: bar.image_url || 'https://via.placeholder.com/120x120/2A3A4A/A3B3CC?text=Bar'
              }}
              style={styles.barImage}
              resizeMode="cover"
            />
            <View style={styles.barInfo}>
              <AppText variant="h2" numberOfLines={2}>{bar.name}</AppText>
              <AppText variant="caption" color={colors.text.secondary} style={styles.barTypeSpacing}>
                {bar.category?.name || 'Bar'}
              </AppText>
            </View>
          </AppCard>
        )}

        {/* Rating Section */}
        <AppCard style={styles.ratingSection}>
          <AppText variant="subtitle" style={styles.ratingSectionTitle}>
            Valora tu experiencia
          </AppText>
          <View style={styles.ratingRow}>
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
            <AppText variant="caption" color={colors.text.secondary} align="center" style={styles.ratingHint}>
              {rating === 5 ? '¡Excelente!' : rating === 4 ? 'Muy bueno' : rating === 3 ? 'Bueno' : rating === 2 ? 'Regular' : 'Mejorable'}
            </AppText>
          )}
        </AppCard>

        {/* Review Input */}
        <AppCard style={styles.inputSection}>
          <AppText variant="subtitle" style={styles.inputLabel}>
            Escribe tu Valoración
          </AppText>
          <TextInput
            placeholder="Cuéntanos tu experiencia en este bar..."
            value={comment}
            onChangeText={setComment}
            multiline
            style={styles.textInput}
            placeholderTextColor={colors.text.muted}
            textAlignVertical="top"
            editable={!loading}
          />
          <AppText variant="caption" color={colors.text.muted} style={styles.charCount}>
            {comment.length} caracteres
          </AppText>
        </AppCard>

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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  barSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  barImage: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    marginRight: spacing.lg,
  },
  barInfo: {
    flex: 1,
  },
  barTypeSpacing: {
    marginTop: spacing.xs,
  },
  ratingSection: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  ratingSectionTitle: {
    marginBottom: spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.elevated,
    borderWidth: 2,
    borderColor: colors.border.subtle,
  },
  ratingButtonSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: colors.status.boost,
  },
  ratingValueText: {
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  ratingHint: {
    marginTop: spacing.lg,
  },
  inputSection: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    marginBottom: spacing.md,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.xl,
    minHeight: 150,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: 16,
    backgroundColor: colors.bg.input,
    lineHeight: 24,
  },
  charCount: {
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  buttonContainer: {
    marginBottom: spacing.xl,
  },
}); 