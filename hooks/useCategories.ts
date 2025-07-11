import { useState, useEffect, useCallback } from 'react';

import { supabase } from '~/utils/supabase';
import { BarCategory } from '~/stores/barRegisterStore';

const FALLBACK_CATEGORIES: BarCategory[] = [
  { id: 'cocktail', name: 'Cocktail Bar' },
  { id: 'pub', name: 'Pub' },
  { id: 'lounge', name: 'Lounge' },
  { id: 'sports', name: 'Sports Bar' },
  { id: 'wine', name: 'Wine Bar' },
  { id: 'brewery', name: 'Brewery' },
  { id: 'nightclub', name: 'Nightclub' },
  { id: 'restaurant', name: 'Restaurant Bar' },
];

export const useCategories = () => {
  const [categories, setCategories] = useState<BarCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setUsingFallback(false);
      
      // Fetch categories directly
      const { data, error } = await supabase
        .from('bar_categories')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching categories:', error);
        throw new Error(`Failed to fetch categories: ${error.message}`);
      }

      if (data && data.length > 0) {
        console.log('✅ Categories loaded from database:', data.length, 'items');
        setCategories(data);
        setUsingFallback(false);
      } else {
        console.log('⚠️ No categories found, using fallback');
        setCategories(FALLBACK_CATEGORIES);
        setUsingFallback(true);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setCategories(FALLBACK_CATEGORIES);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    usingFallback,
    refetch: fetchCategories,
  };
}; 