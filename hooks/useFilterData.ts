import { useState, useEffect } from 'react';
import { supabase } from '~/utils/supabase';

// Helper functions to assign emojis based on names
const getCategoryEmoji = (name: string): string => {
  const categoryMap: { [key: string]: string } = {
    'Bar deportivo': '⚽️',
    'Cervecería': '🍺',
    'Lounge': '🍸',
    'Pub': '🍻',
    'Restaurante': '🍽️',
  };
  return categoryMap[name] || '🏪';
};

const getFoodEmoji = (name: string): string => {
  const foodMap: { [key: string]: string } = {
    'Americana': '🍔',
    'Asador / Parrilla': '🍖',
    'Italiana': '🍕',
    'Japonesa': '🍱',
    'Kebab': '🌮',
    'Mediterránea': '🐠',
    'Mexicana': '🌵',
    'Tapas / Raciones': '🍷',
    'Vegana': '🌱',
    'Vegetariana': '🥦',
  };
  return foodMap[name] || '🍽️';
};

const getFeatureEmoji = (name: string): string => {
  const featureMap: { [key: string]: string } = {
    'Acceso para personas con movilidad reducida': '♿',
    'Admite mascotas': '🐶',
    'Aire acondicionado': '❄️',
    'Parking': '🅿️',
    'Terraza': '🌞',
    'Zona infantil': '👶',
    'Zona para fumadores': '🚬',
  };
  return featureMap[name] || '✨';
};

const getTVFeatureEmoji = (name: string): string => {
  const tvFeatureMap: { [key: string]: string } = {
    'Pantallas Gigantes': '📺',
    'Múltiples Pantallas': '🖥️',
    'Buena Calidad de Imagen': '✨',
    'Sonido Envolvente': '🔊',
    'Audio Alto': '🔉',
    'TV 4K': '4️⃣',
    'Proyector de Gran Formato': '📽️',
    'Transmisión en Vivo Garantizada': '📡',
  };
  return tvFeatureMap[name] || '📺';
};

interface FilterItem {
  id: number;
  name: string;
  emoji: string;
}

interface FilterData {
  barCategories: FilterItem[];
  foodTypes: FilterItem[];
  barFeatures: FilterItem[];
  tvFeatures: FilterItem[];
  loading: boolean;
  error: string | null;
}

// Fallback data
const FALLBACK_CATEGORIES = [
  { id: 1, name: 'Pub', emoji: '🍻' },
  { id: 2, name: 'Sports Bar', emoji: '⚽️' },
  { id: 3, name: 'Karaoke', emoji: '🎤' },
  { id: 4, name: 'Wine Bar', emoji: '🍷' },
  { id: 5, name: 'Cervecería', emoji: '🍺' },
  { id: 6, name: 'Lounge', emoji: '🍸' },
];

const FALLBACK_FOOD_TYPES = [
  { id: 1, name: 'Americana', emoji: '🍔' },
  { id: 2, name: 'Asador / Parrilla', emoji: '🍖' },
  { id: 3, name: 'Italiana', emoji: '🍕' },
  { id: 4, name: 'Japonesa', emoji: '🍱' },
  { id: 5, name: 'Kebab', emoji: '🌮' },
  { id: 6, name: 'Mediterránea', emoji: '🐠' },
  { id: 7, name: 'Mexicana', emoji: '🌵' },
  { id: 8, name: 'Tapas / Raciones', emoji: '🍷' },
  { id: 9, name: 'Vegana', emoji: '🌱' },
  { id: 10, name: 'Vegetariana', emoji: '🥦' },
];

const FALLBACK_FEATURES = [
  { id: 1, name: 'TV Grande', emoji: '📺' },
  { id: 2, name: 'Pet Friendly', emoji: '🐶' },
  { id: 3, name: 'Parking', emoji: '🅿️' },
  { id: 4, name: 'Terraza', emoji: '🌞' },
  { id: 5, name: 'Aire acondicionado', emoji: '❄️' },
  { id: 6, name: 'Acceso para personas con movilidad reducida', emoji: '♿' },
];

const FALLBACK_TV_FEATURES = [
  { id: 1, name: 'Pantallas Gigantes', emoji: '📺' },
  { id: 2, name: 'Múltiples Pantallas', emoji: '🖥️' },
  { id: 3, name: 'Buena Calidad de Imagen', emoji: '✨' },
  { id: 4, name: 'Sonido Envolvente', emoji: '🔊' },
  { id: 5, name: 'Audio Alto', emoji: '🔉' },
  { id: 6, name: 'TV 4K', emoji: '4️⃣' },
  { id: 7, name: 'Proyector de Gran Formato', emoji: '📽️' },
  { id: 8, name: 'Transmisión en Vivo Garantizada', emoji: '📡' },
];

export function useFilterData(): FilterData {
  const [barCategories, setBarCategories] = useState<FilterItem[]>(FALLBACK_CATEGORIES);
  const [foodTypes, setFoodTypes] = useState<FilterItem[]>(FALLBACK_FOOD_TYPES);
  const [barFeatures, setBarFeatures] = useState<FilterItem[]>(FALLBACK_FEATURES);
  const [tvFeatures, setTvFeatures] = useState<FilterItem[]>(FALLBACK_TV_FEATURES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFilterData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔄 Loading filter data from Supabase...');

        // Load bar categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('bar_categories')
          .select('id, name')
          .order('name');

        console.log('📊 Categories data:', categoriesData);
        console.log('❌ Categories error:', categoriesError);

        // Load food types
        const { data: foodData, error: foodError } = await supabase
          .from('food_types')
          .select('id, name')
          .order('name');

        console.log('🍕 Food types data:', foodData);
        console.log('❌ Food types error:', foodError);

        // Load bar features
        const { data: featuresData, error: featuresError } = await supabase
          .from('bar_features')
          .select('id, name')
          .order('name');

        console.log('✨ Features data:', featuresData);
        console.log('❌ Features error:', featuresError);

        // Load TV features
        const { data: tvFeaturesData, error: tvFeaturesError } = await supabase
          .from('bar_tv_features')
          .select('id, name')
          .order('name');

        console.log('📺 TV Features data:', tvFeaturesData);
        console.log('❌ TV Features error:', tvFeaturesError);

        // Use fallback data if any table doesn't exist or has errors
        const useFallback = categoriesError || foodError || featuresError || tvFeaturesError ||
                           !categoriesData || !foodData || !featuresData || !tvFeaturesData ||
                           categoriesData.length === 0 || foodData.length === 0 || 
                           featuresData.length === 0 || tvFeaturesData.length === 0;

        if (useFallback) {
          console.log('⚠️ Using fallback data due to errors or empty tables');
          setBarCategories(FALLBACK_CATEGORIES);
          setFoodTypes(FALLBACK_FOOD_TYPES);
          setBarFeatures(FALLBACK_FEATURES);
          setTvFeatures(FALLBACK_TV_FEATURES);
        } else {
          console.log('✅ Using data from Supabase');
          // Add emojis to categories
          const categoriesWithEmojis = categoriesData.map(category => ({
            ...category,
            emoji: getCategoryEmoji(category.name)
          }));

          // Add emojis to food types
          const foodTypesWithEmojis = foodData.map(food => ({
            ...food,
            emoji: getFoodEmoji(food.name)
          }));

          // Add emojis to features
          const featuresWithEmojis = featuresData.map(feature => ({
            ...feature,
            emoji: getFeatureEmoji(feature.name)
          }));

          // Add emojis to TV features
          const tvFeaturesWithEmojis = tvFeaturesData.map(tvFeature => ({
            ...tvFeature,
            emoji: getTVFeatureEmoji(tvFeature.name)
          }));

          setBarCategories(categoriesWithEmojis);
          setFoodTypes(foodTypesWithEmojis);
          setBarFeatures(featuresWithEmojis);
          setTvFeatures(tvFeaturesWithEmojis);
        }

      } catch (err) {
        console.error('💥 Error loading filter data:', err);
        setError('Error al cargar los filtros');
        
        console.log('🔄 Setting fallback data due to error');
        setBarCategories(FALLBACK_CATEGORIES);
        setFoodTypes(FALLBACK_FOOD_TYPES);
        setBarFeatures(FALLBACK_FEATURES);
        setTvFeatures(FALLBACK_TV_FEATURES);
      } finally {
        setLoading(false);
        console.log('✅ Filter data loading completed');
      }
    };

    loadFilterData();
  }, []);

  return {
    barCategories,
    foodTypes,
    barFeatures,
    tvFeatures,
    loading,
    error,
  };
} 