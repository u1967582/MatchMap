import { create } from 'zustand';
import { supabase } from '~/utils/supabase';

interface LikesState {
  // State
  likes: Set<string>; // reviewIds that the user has liked
  userId: string | null;
  initialized: boolean;

  // Actions
  setUserId: (userId: string | null) => void;
  initializeLikes: () => Promise<void>;
  isLiked: (reviewId: string) => boolean;
  addLike: (reviewId: string) => Promise<boolean>;
  removeLike: (reviewId: string) => Promise<boolean>;
  toggleLike: (reviewId: string) => Promise<boolean>;
}

export const useLikesStore = create<LikesState>((set, get) => ({
  likes: new Set(),
  userId: null,
  initialized: false,

  setUserId: (userId: string | null) => {
    set({ userId, initialized: false });
    if (userId) {
      get().initializeLikes();
    } else {
      set({ likes: new Set(), initialized: true });
    }
  },

  initializeLikes: async () => {
    const { userId } = get();
    if (!userId) {
      set({ likes: new Set(), initialized: true });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error loading likes:', error);
        set({ initialized: true });
        return;
      }

      const likedReviewIds = new Set(data?.map(l => l.review_id) || []);
      set({ likes: likedReviewIds, initialized: true });
      console.log('✅ Likes initialized:', likedReviewIds.size);
    } catch (error) {
      console.error('❌ Error in initializeLikes:', error);
      set({ initialized: true });
    }
  },

  isLiked: (reviewId: string) => {
    return get().likes.has(reviewId);
  },

  addLike: async (reviewId: string) => {
    const { userId, likes } = get();
    if (!userId) {
      console.error('❌ No user found');
      return false;
    }

    // Optimistic update
    const newLikes = new Set(likes);
    newLikes.add(reviewId);
    set({ likes: newLikes });
    console.log('⚡ Optimistic add like:', reviewId);

    // Server sync
    try {
      const { error } = await supabase
        .from('review_likes')
        .insert({ user_id: userId, review_id: reviewId });

      if (error) {
        console.error('❌ Error adding like:', error);
        // Rollback optimistic update
        const rolledBackLikes = new Set(likes);
        rolledBackLikes.delete(reviewId);
        set({ likes: rolledBackLikes });
        console.log('↩️ Rolled back like add:', reviewId);
        return false;
      }

      console.log('✅ Like added to server:', reviewId);
      return true;
    } catch (error) {
      console.error('❌ Error in addLike:', error);
      // Rollback optimistic update
      const rolledBackLikes = new Set(likes);
      rolledBackLikes.delete(reviewId);
      set({ likes: rolledBackLikes });
      console.log('↩️ Rolled back like add:', reviewId);
      return false;
    }
  },

  removeLike: async (reviewId: string) => {
    const { userId, likes } = get();
    if (!userId) {
      console.error('❌ No user found');
      return false;
    }

    // Optimistic update
    const newLikes = new Set(likes);
    newLikes.delete(reviewId);
    set({ likes: newLikes });
    console.log('⚡ Optimistic remove like:', reviewId);

    // Server sync
    try {
      const { error } = await supabase
        .from('review_likes')
        .delete()
        .eq('user_id', userId)
        .eq('review_id', reviewId);

      if (error) {
        console.error('❌ Error removing like:', error);
        // Rollback optimistic update
        const rolledBackLikes = new Set(likes);
        rolledBackLikes.add(reviewId);
        set({ likes: rolledBackLikes });
        console.log('↩️ Rolled back like remove:', reviewId);
        return false;
      }

      console.log('✅ Like removed from server:', reviewId);
      return true;
    } catch (error) {
      console.error('❌ Error in removeLike:', error);
      // Rollback optimistic update
      const rolledBackLikes = new Set(likes);
      rolledBackLikes.add(reviewId);
      set({ likes: rolledBackLikes });
      console.log('↩️ Rolled back like remove:', reviewId);
      return false;
    }
  },

  toggleLike: async (reviewId: string) => {
    const isLikedNow = get().isLiked(reviewId);

    if (isLikedNow) {
      return await get().removeLike(reviewId);
    } else {
      return await get().addLike(reviewId);
    }
  },
}));
