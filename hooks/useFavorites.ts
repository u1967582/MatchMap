import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/utils/supabase';

export const useFavorites = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
      setLoading(false);
    };
    getUser();
  }, []);

  // Check if a bar is in favorites
  const isFavorite = useCallback(async (barId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('bar_id', barId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error checking favorite:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('❌ Error in isFavorite:', error);
      return false;
    }
  }, [user]);

  // Add bar to favorites
  const addToFavorites = useCallback(async (barId: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ No user found');
      return false;
    }

    try {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, bar_id: barId });

      if (error) {
        console.error('❌ Error adding favorite:', error);
        return false;
      }

      console.log('✅ Bar added to favorites');
      return true;
    } catch (error) {
      console.error('❌ Error in addToFavorites:', error);
      return false;
    }
  }, [user]);

  // Remove bar from favorites
  const removeFromFavorites = useCallback(async (barId: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ No user found');
      return false;
    }

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('bar_id', barId);

      if (error) {
        console.error('❌ Error removing favorite:', error);
        return false;
      }

      console.log('🗑️ Bar removed from favorites');
      return true;
    } catch (error) {
      console.error('❌ Error in removeFromFavorites:', error);
      return false;
    }
  }, [user]);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (barId: string): Promise<boolean> => {
    const isFav = await isFavorite(barId);
    
    if (isFav) {
      return await removeFromFavorites(barId);
    } else {
      return await addToFavorites(barId);
    }
  }, [isFavorite, addToFavorites, removeFromFavorites]);

  // Get user's favorite bars
  const getFavoriteBars = useCallback(async () => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          bar_id,
          bars (
            id,
            name,
            description,
            address,
            city,
            bar_images(image_url, image_order)
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Error fetching favorites:', error);
        return [];
      }

      return data?.map(item => ({
        ...item.bars,
        image_url: (item.bars as any).bar_images
          ?.find((img: any) => img.image_order === 1)?.image_url || 
          (item.bars as any).bar_images?.[0]?.image_url || null,
      })) || [];
    } catch (error) {
      console.error('❌ Error in getFavoriteBars:', error);
      return [];
    }
  }, [user]);

  return {
    user,
    loading,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    getFavoriteBars,
  };
}; 