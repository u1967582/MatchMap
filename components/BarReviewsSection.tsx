import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { supabase } from '~/utils/supabase';
import { Ionicons } from '@expo/vector-icons';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user: {
    username: string;
    profile_image_url: string;
  };
}

const BarReviewsSection: React.FC<{ barId: string }> = ({ barId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [distribution, setDistribution] = useState<number[]>([0, 0, 0, 0, 0]);
  const [average, setAverage] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviewsAndBarData = async () => {
      setLoading(true);
      try {
        // Fetch reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(`id, rating, comment, created_at, user:users(username, profile_image_url)`)
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
          const transformedData = reviewsData.map((item: any) => ({
            id: item.id,
            rating: item.rating,
            comment: item.comment,
            created_at: item.created_at,
            user: {
              username: item.user?.username || 'Anonymous',
              profile_image_url: item.user?.profile_image_url || '',
            },
          }));
          
          setReviews(transformedData);
          
          // Calculate distribution from reviews
          const ratings = [0, 0, 0, 0, 0];
          transformedData.forEach((r) => {
            ratings[r.rating - 1]++;
          });
          setDistribution(ratings);
          
          // Use real data from bars table
          setAverage(barData?.rating || 0);
          setTotalReviews(barData?.review_count || 0);
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

  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.userRow}>
        <Image 
          source={{ 
            uri: item.user.profile_image_url || 'https://via.placeholder.com/32x32/2A3A4A/94A3B8?text=U'
          }} 
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.user.username || 'Anonymous'}</Text>
          <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
        </View>
      </View>

      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Ionicons
            key={s}
            name={s <= item.rating ? 'star' : 'star-outline'}
            color="#1976D2"
            size={14}
          />
        ))}
      </View>

      <Text style={styles.comment}>{item.comment}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="thumbs-up-outline" size={16} color="#94A3B8" />
          <Text style={styles.actionText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={16} color="#94A3B8" />
          <Text style={styles.actionText}>0</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading reviews...</Text>
        </View>
      </View>
    );
  }

  if (totalReviews === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to share your experience!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <View style={styles.headerRow}>
        <View style={styles.avgColumn}>
          <Text style={styles.avgRating}>{average.toFixed(1)}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= Math.round(average) ? 'star' : 'star-outline'}
                color="#1976D2"
                size={16}
              />
            ))}
          </View>
          <Text style={styles.totalReviews}>{totalReviews} reviews</Text>
        </View>

        <View style={styles.distribution}>
          {[5, 4, 3, 2, 1].map((star, index) => {
            const count = distribution[star - 1];
            const percent = totalReviews ? (count / totalReviews) * 100 : 0;
            return (
              <View key={star} style={styles.distRow}>
                <Text style={styles.distLabel}>{star}</Text>
                <View style={styles.distBarBackground}>
                  <View style={[styles.distBarFill, { width: `${percent}%` }]} />
                </View>
                <Text style={styles.distPercent}>{percent.toFixed(0)}%</Text>
              </View>
            );
          })}
        </View>
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={renderReview}
        style={styles.reviewList}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    marginTop: 24, 
    paddingHorizontal: 20,
    backgroundColor: '#1C2A3A',
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    marginBottom: 16 
  },
  headerRow: { 
    flexDirection: 'row',
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A3A4A',
  },
  avgColumn: { 
    marginRight: 24, 
    alignItems: 'center',
    minWidth: 80,
  },
  avgRating: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  starsRow: { 
    flexDirection: 'row', 
    marginVertical: 4,
    gap: 2,
  },
  totalReviews: { 
    fontSize: 12, 
    color: '#94A3B8' 
  },
  distribution: { 
    flex: 1, 
    justifyContent: 'center' 
  },
  distRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  distLabel: { 
    color: '#FFFFFF', 
    width: 14,
    fontSize: 12,
    fontWeight: '600',
  },
  distBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#2A3A4A',
    borderRadius: 4,
    marginHorizontal: 8,
  },
  distBarFill: {
    height: 8,
    backgroundColor: '#1976D2',
    borderRadius: 4,
  },
  distPercent: { 
    color: '#94A3B8', 
    width: 40, 
    textAlign: 'right', 
    fontSize: 12 
  },
  reviewList: { 
    marginTop: 8 
  },
  reviewCard: { 
    backgroundColor: '#1A2332', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3A4A',
  },
  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  avatar: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    marginRight: 12 
  },
  userInfo: {
    flex: 1,
  },
  username: { 
    color: '#FFFFFF', 
    fontWeight: 'bold',
    fontSize: 14,
  },
  timestamp: { 
    fontSize: 12, 
    color: '#94A3B8' 
  },
  comment: { 
    color: '#FFFFFF', 
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: { 
    flexDirection: 'row', 
    marginTop: 12,
    gap: 16,
  },
  actionButton: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 4,
  },
  actionText: { 
    fontSize: 12, 
    color: '#94A3B8' 
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
    backgroundColor: '#1A2332',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3A4A',
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
});

export default BarReviewsSection; 