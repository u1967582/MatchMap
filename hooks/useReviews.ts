import { useState, useCallback } from 'react';
import { supabase } from '~/utils/supabase';

interface Review {
  id: string;
  bar_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
  user?: {
    email?: string;
    full_name?: string;
  };
}

interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    [key: number]: number;
  };
}

export const useReviews = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get reviews for a specific bar
  const getBarReviews = useCallback(async (barId: string): Promise<Review[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('bar_id', barId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching reviews:', error);
        setError('Failed to load reviews');
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('❌ Error fetching reviews:', err);
      setError('Failed to load reviews');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get review statistics for a bar
  const getBarReviewStats = useCallback(async (barId: string): Promise<ReviewStats | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('bar_id', barId);

      if (error) {
        console.error('❌ Error fetching review stats:', error);
        setError('Failed to load review statistics');
        return null;
      }

      if (!data || data.length === 0) {
        return {
          average_rating: 0,
          total_reviews: 0,
          rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
      }

      const totalReviews = data.length;
      const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / totalReviews;

      // Calculate rating distribution
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      data.forEach(review => {
        distribution[review.rating as keyof typeof distribution]++;
      });

      return {
        average_rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        total_reviews: totalReviews,
        rating_distribution: distribution
      };
    } catch (err) {
      console.error('❌ Error fetching review stats:', err);
      setError('Failed to load review statistics');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user has already reviewed a bar
  const getUserReview = useCallback(async (barId: string, userId: string): Promise<Review | null> => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('bar_id', barId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching user review:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('❌ Error fetching user review:', err);
      return null;
    }
  }, []);

  // Create a new review
  const createReview = useCallback(async (
    barId: string, 
    userId: string, 
    rating: number, 
    comment?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          bar_id: barId,
          user_id: userId,
          rating,
          comment: comment?.trim() || null
        });

      if (error) {
        console.error('❌ Error creating review:', error);
        setError('Failed to create review');
        return false;
      }

      return true;
    } catch (err) {
      console.error('❌ Error creating review:', err);
      setError('Failed to create review');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update an existing review
  const updateReview = useCallback(async (
    reviewId: string,
    rating: number,
    comment?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          rating,
          comment: comment?.trim() || null
        })
        .eq('id', reviewId);

      if (error) {
        console.error('❌ Error updating review:', error);
        setError('Failed to update review');
        return false;
      }

      return true;
    } catch (err) {
      console.error('❌ Error updating review:', err);
      setError('Failed to update review');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete a review
  const deleteReview = useCallback(async (reviewId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        console.error('❌ Error deleting review:', error);
        setError('Failed to delete review');
        return false;
      }

      return true;
    } catch (err) {
      console.error('❌ Error deleting review:', err);
      setError('Failed to delete review');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getBarReviews,
    getBarReviewStats,
    getUserReview,
    createReview,
    updateReview,
    deleteReview
  };
}; 