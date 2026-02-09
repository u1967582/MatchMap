import { create } from 'zustand';
import { supabase } from '~/utils/supabase';

interface FavoriteBar {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  review_count?: number;
}

interface FavoritesState {
  // State
  favorites: Set<string>; // barIds
  userId: string | null;
  initialized: boolean;

  // Actions
  setUserId: (userId: string | null) => void;
  initializeFavorites: () => Promise<void>;
  isFavorite: (barId: string) => boolean;
  addFavorite: (barId: string) => Promise<boolean>;
  removeFavorite: (barId: string) => Promise<boolean>;
  toggleFavorite: (barId: string) => Promise<boolean>;
  getFavoriteBars: () => Promise<FavoriteBar[]>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Set(),
  userId: null,
  initialized: false,

  setUserId: (userId: string | null) => {
    set({ userId, initialized: false });
    if (userId) {
      get().initializeFavorites();
    } else {
      set({ favorites: new Set(), initialized: true });
    }
  },

  initializeFavorites: async () => {
    const { userId } = get();
    if (!userId) {
      set({ favorites: new Set(), initialized: true });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('bar_id')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error loading favorites:', error);
        set({ initialized: true });
        return;
      }

      const favoriteBarIds = new Set(data?.map(f => f.bar_id) || []);
      set({ favorites: favoriteBarIds, initialized: true });
      console.log('✅ Favorites initialized:', favoriteBarIds.size);
    } catch (error) {
      console.error('❌ Error in initializeFavorites:', error);
      set({ initialized: true });
    }
  },

  isFavorite: (barId: string) => {
    return get().favorites.has(barId);
  },

  addFavorite: async (barId: string) => {
    const { userId, favorites } = get();
    if (!userId) {
      console.error('❌ No user found');
      return false;
    }

    // Optimistic update
    const newFavorites = new Set(favorites);
    newFavorites.add(barId);
    set({ favorites: newFavorites });
    console.log('⚡ Optimistic add to favorites:', barId);

    // Server sync
    try {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, bar_id: barId });

      if (error) {
        console.error('❌ Error adding favorite:', error);
        // Rollback optimistic update
        const rolledBackFavorites = new Set(favorites);
        rolledBackFavorites.delete(barId);
        set({ favorites: rolledBackFavorites });
        console.log('↩️ Rolled back favorite add:', barId);
        return false;
      }

      console.log('✅ Favorite added to server:', barId);
      return true;
    } catch (error) {
      console.error('❌ Error in addFavorite:', error);
      // Rollback optimistic update
      const rolledBackFavorites = new Set(favorites);
      rolledBackFavorites.delete(barId);
      set({ favorites: rolledBackFavorites });
      console.log('↩️ Rolled back favorite add:', barId);
      return false;
    }
  },

  removeFavorite: async (barId: string) => {
    const { userId, favorites } = get();
    if (!userId) {
      console.error('❌ No user found');
      return false;
    }

    // Optimistic update
    const newFavorites = new Set(favorites);
    newFavorites.delete(barId);
    set({ favorites: newFavorites });
    console.log('⚡ Optimistic remove from favorites:', barId);

    // Server sync
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('bar_id', barId);

      if (error) {
        console.error('❌ Error removing favorite:', error);
        // Rollback optimistic update
        const rolledBackFavorites = new Set(favorites);
        rolledBackFavorites.add(barId);
        set({ favorites: rolledBackFavorites });
        console.log('↩️ Rolled back favorite remove:', barId);
        return false;
      }

      console.log('✅ Favorite removed from server:', barId);
      return true;
    } catch (error) {
      console.error('❌ Error in removeFavorite:', error);
      // Rollback optimistic update
      const rolledBackFavorites = new Set(favorites);
      rolledBackFavorites.add(barId);
      set({ favorites: rolledBackFavorites });
      console.log('↩️ Rolled back favorite remove:', barId);
      return false;
    }
  },

  toggleFavorite: async (barId: string) => {
    const isFav = get().isFavorite(barId);

    if (isFav) {
      return await get().removeFavorite(barId);
    } else {
      return await get().addFavorite(barId);
    }
  },

  getFavoriteBars: async () => {
    const { userId } = get();
    if (!userId) return [];

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
            rating,
            review_count,
            latitude,
            longitude,
            bar_images(image_url, image_order)
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error fetching favorite bars:', error);
        return [];
      }

      return data?.map((item: any) => ({
        ...item.bars,
        image_url: item.bars.bar_images
          ?.find((img: any) => img.image_order === 1)?.image_url ||
          item.bars.bar_images?.[0]?.image_url || null,
      })) || [];
    } catch (error) {
      console.error('❌ Error in getFavoriteBars:', error);
      return [];
    }
  },
}));
