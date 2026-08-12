import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { AppText } from '~/components/ds';
import { useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { toast } from '~/components/ds';
import { useLikesStore } from '~/stores/likesStore';
import { getIsGuest, showGuestLoginAlert } from '~/utils/auth';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user: {
    username: string;
    profile_image_url: string;
  };
  likes?: number;
}

interface BarReviewsSectionProps {
  barId: string;
  showHeader?: boolean;
  title?: string;
}

const BarReviewsSection: React.FC<BarReviewsSectionProps> = ({ barId, showHeader = true, title = 'Reseñas' }) => {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [distribution, setDistribution] = useState<number[]>([0, 0, 0, 0, 0]);
  const [average, setAverage] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});

  // Store de likes (actualizaciones optimistas)
  const isLiked = useLikesStore(state => state.isLiked);
  const toggleLikeStore = useLikesStore(state => state.toggleLike);

  useEffect(() => {
    const fetchReviewsAndBarData = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id || null;
        setUserId(uid);

        // Fetch reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(`id, rating, comment, created_at, likes, user:users(username, profile_image_url)`)
          .eq('bar_id', barId)
          .order('created_at', { ascending: false });

        if (reviewsError) {
          console.error('❌ Error loading reviews:', reviewsError);
          return;
        }

        // Fetch bar data for real rating and review count
        const { data: barData, error: barError } = await supabase
          .from('bars')
          .select('rating, review_count')
          .eq('id', barId)
          .single();

        if (barError) {
          console.error('❌ Error loading bar data:', barError);
          return;
        }

        if (reviewsData) {
          // Transform the data to match our interface
          const transformedData: Review[] = reviewsData.map((item: any) => ({
            id: item.id,
            rating: item.rating,
            comment: item.comment,
            created_at: item.created_at,
            likes: item.likes ?? 0,
            user: {
              username: item.user?.username || 'Anonymous',
              profile_image_url: item.user?.profile_image_url || '',
            },
          }));

          setReviews(transformedData);

          // Calculate distribution from reviews
          const ratings = [0, 0, 0, 0, 0];
          transformedData.forEach((r) => {
            if (r.rating >= 1 && r.rating <= 5) ratings[r.rating - 1]++;
          });
          setDistribution(ratings);

          // Compute totals from fetched reviews (fallback to bars data if needed)
          const total = transformedData.length;
          setTotalReviews(total);

          const computedAvg = total > 0
            ? transformedData.reduce((sum, r) => sum + (r.rating || 0), 0) / total
            : 0;
          setAverage(typeof barData?.rating === 'number' && barData.rating > 0 ? barData.rating : computedAvg);
        }
      } catch (error) {
        console.error('❌ Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviewsAndBarData();
  }, [barId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const renderStars = (value: number, size = 14) => {
    const full = Math.floor(value);
    const hasHalf = value - full >= 0.5;
    const stars = [] as React.ReactNode[];
    for (let i = 1; i <= 5; i++) {
      let icon: any = 'star-outline';
      if (i <= full) icon = 'star';
      else if (i === full + 1 && hasHalf) icon = 'star-half';
      stars.push(
        <Ionicons key={`star-${i}`} name={icon} size={size} color="#1976D2" />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const toggleLike = useCallback(async (review: Review) => {
    const isGuest = await getIsGuest();
    if (isGuest) {
      showGuestLoginAlert(router);
      return;
    }
    if (!userId || busyById[review.id]) return;
    setBusyById(prev => ({ ...prev, [review.id]: true }));

    try {
      const wasLiked = isLiked(review.id);

      // Actualización optimista del contador de likes local
      if (wasLiked) {
        setReviews(prev => prev.map(r =>
          r.id === review.id ? { ...r, likes: Math.max(0, (r.likes ?? 1) - 1) } : r
        ));
      } else {
        setReviews(prev => prev.map(r =>
          r.id === review.id ? { ...r, likes: (r.likes ?? 0) + 1 } : r
        ));
      }

      // Toggle en el store (optimista)
      const success = await toggleLikeStore(review.id);

      if (success) {
        if (!wasLiked) {
          toast.success('Te ha gustado esta reseña');
        }
        // No mostrar toast al quitar like (sería molesto)
      } else {
        // Rollback del contador si falló
        if (wasLiked) {
          setReviews(prev => prev.map(r =>
            r.id === review.id ? { ...r, likes: (r.likes ?? 0) + 1 } : r
          ));
        } else {
          setReviews(prev => prev.map(r =>
            r.id === review.id ? { ...r, likes: Math.max(0, (r.likes ?? 1) - 1) } : r
          ));
        }
        toast.error(wasLiked ? 'No se pudo quitar el like' : 'No se pudo registrar el like');
      }
    } catch (error) {
      toast.error('Error al actualizar el like', 'Inténtalo de nuevo');
    } finally {
      setBusyById(prev => ({ ...prev, [review.id]: false }));
    }
  }, [userId, busyById, isLiked, toggleLikeStore, router]);

  // Build header consistently on every render to keep hook order stable
  const header = useMemo(() => (
    <View style={styles.headerBlock}>
      {/* título interno eliminado */}
      <View style={styles.headerRow}>
        <View style={styles.avgColumn}>
          <AppText style={styles.avgRating}>{average.toFixed(1)}</AppText>
          {renderStars(average, 16)}
          <AppText style={styles.totalReviews}>{totalReviews} reseñas</AppText>
        </View>
        <View style={styles.distribution}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star - 1];
            const percent = totalReviews ? (count / totalReviews) * 100 : 0;
            return (
              <View key={`dist-${star}`} style={styles.distRow}>
                <AppText maxScale={1.0} style={styles.distLabel}>{star}</AppText>
                <View style={styles.distBarBackground}>
                  <View style={[styles.distBarFill, { width: `${percent}%` }]} />
                </View>
                <AppText maxScale={1.0} style={styles.distPercent}>{percent.toFixed(0)}%</AppText>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  ), [average, totalReviews, distribution, title]);

  const renderReview = ({ item }: { item: Review }) => {
    const liked = isLiked(item.id);
    return (
      <View style={styles.reviewRow}>
        <Image
          source={{
            uri: item.user.profile_image_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(item.user.username || 'U') + '&background=2A3A4A&color=94A3B8&size=64'
          }}
          style={styles.avatar}
        />

        <View style={styles.reviewContent}>
          <Text maxFontSizeMultiplier={1.5} style={styles.commentLine}>
            <Text style={styles.username}>{item.user.username || 'Anonymous'}</Text>
            {'  '}
            <Text style={styles.commentText}>{item.comment}</Text>
          </Text>

          <View style={styles.metaRow}>
            <AppText maxScale={1.0} style={styles.metaText}>{formatDate(item.created_at)}</AppText>
            <View style={styles.metaDot} />
            {renderStars(item.rating, 11)}
          </View>
        </View>

        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => toggleLike(item)}
          disabled={!userId || busyById[item.id]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#EF4444' : '#94A3B8'} />
          <AppText maxScale={1.0} style={[styles.likeCount, liked && styles.likeCountActive]}>{item.likes ?? 0}</AppText>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <AppText style={styles.loadingText}>Cargando reseñas...</AppText>
        </View>
      </View>
    );
  }

  const hasReviews = totalReviews > 0;

  return (
    <View style={styles.container}>
      {/* Siempre mostrar el header, incluso cuando no hay reseñas (mostrará 0.0) */}
      {showHeader && header}
      
      {/* Mensaje cuando no hay reseñas */}
      {!hasReviews && (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={48} color="#94A3B8" />
          <AppText style={styles.emptyTitle}>Aún no hay reseñas</AppText>
          <AppText style={styles.emptySubtitle}>¡Sé el primero en compartir tu experiencia!</AppText>
        </View>
      )}

      {/* Botón para escribir reseña - SIEMPRE visible */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={async () => {
          const isGuest = await getIsGuest();
          if (isGuest) {
            showGuestLoginAlert(router);
            return;
          }
          router.push(`/write-review/${barId}` as any);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="star-outline" size={18} color="#FFFFFF" />
        <AppText maxScale={1.0} style={styles.ctaText}>Escribir una reseña</AppText>
      </TouchableOpacity>

      {/* Lista de reseñas - solo cuando hay reseñas */}
      {hasReviews && (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={renderReview}
          style={styles.reviewList}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    paddingHorizontal: 20,
    backgroundColor: '#1C2A3A',
  },
  headerBlock: { marginBottom: 8, paddingHorizontal: 0 },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  headerRow: { 
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 0,
    marginBottom: 16,
  },
  avgColumn: { 
    marginRight: 24,
    alignItems: 'flex-start',
    minWidth: 120,
  },
  avgRating: {
    fontSize: 36,
    lineHeight: 46,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  starsRow: { 
    flexDirection: 'row', 
    marginTop: 6,
    gap: 2,
  },
  totalReviews: { 
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
  },
  distribution: { 
    flex: 1, 
    justifyContent: 'center' 
  },
  distRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8,
  },
  distLabel: { 
    color: '#FFFFFF', 
    width: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  distBarBackground: {
    flex: 1,
    height: 10,
    backgroundColor: '#2A3A4A',
    borderRadius: 4,
    marginHorizontal: 8,
  },
  distBarFill: {
    height: 10,
    backgroundColor: '#1976D2',
    borderRadius: 4,
  },
  distPercent: { 
    color: '#94A3B8', 
    width: 44,
    textAlign: 'right',
    fontSize: 14,
  },
  reviewList: { 
    marginTop: 8 
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  reviewContent: {
    flex: 1,
    paddingRight: 8,
  },
  commentLine: {
    fontSize: 14,
    lineHeight: 19,
  },
  username: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  commentText: {
    color: '#E5E7EB',
    fontWeight: '400',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7A8F',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#6B7A8F',
  },
  likeButton: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
  },
  likeCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  likeCountActive: {
    color: '#EF4444',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default BarReviewsSection; 