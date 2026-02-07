import * as React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';

interface Bar {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  rating?: number | null;
  review_count?: number | null;
  image_url?: string;
  category_id?: number;
  distance_km?: number;
  category?: { id: number; name: string };
  bar_food_types?: { food_type_id: number; food_type: { name: string } }[];
  bar_selected_tv_features?: { tv_feature_id: number; tv_feature: { name: string } }[];
  bar_selected_features?: { feature_id: number; feature: { name: string } }[];
  next_match?: {
    date: string;
    time: string;
  };
}

interface BarInfoCardProps {
  bar: Bar | null;
  visible: boolean;
  onClose: () => void;
  onNavigate?: (barId: string) => void;
  onStartNavigation?: (destination: { latitude: number; longitude: number; name: string }) => void;
}

const BarInfoCard: React.FC<BarInfoCardProps> = ({ 
  bar, 
  visible, 
  onClose,
  onNavigate,
  onStartNavigation 
}) => {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [nextMatch, setNextMatch] = React.useState<{ date: string; time: string } | null>(null);
  
  console.log('📍 BarInfoCard render - visible:', visible, 'bar name:', bar?.name || 'undefined');
  
  // Check if bar is favorite
  React.useEffect(() => {
    if (!bar) return;
    
    const checkFavorite = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('bar_id', bar.id)
          .single();

        setIsFavorite(!!data);
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavorite();
  }, [bar?.id]);

  // Fetch next match
  React.useEffect(() => {
    if (!bar) return;
    
    const fetchNextMatch = async () => {
      try {
        const { data } = await supabase
          .from('posts')
          .select('start_date, start_time')
          .eq('bar_id', bar.id)
          .gte('start_date', new Date().toISOString().split('T')[0])
          .order('start_date', { ascending: true })
          .limit(1)
          .single();

        if (data) {
          setNextMatch({
            date: data.start_date,
            time: data.start_time || '18:00'
          });
        }
      } catch (error) {
        console.error('Error fetching next match:', error);
      }
    };

    fetchNextMatch();
  }, [bar?.id]);
  
  if (!visible || !bar) {
    console.log('📍 BarInfoCard returning null - visible:', visible, 'bar exists:', !!bar);
    return null;
  }

  const handleCardPress = () => {
    console.log('📍 Opening bar profile for:', bar.name);
    onClose(); // Close the card first
    router.push(`/bar-profile/${bar.id}` as any);
  };

  const handleFavoriteToggle = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Debes iniciar sesión para agregar favoritos');
        return;
      }

      if (isFavorite) {
        // Remove from favorites
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('bar_id', bar.id);
        setIsFavorite(false);
      } else {
        // Add to favorites
        await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            bar_id: bar.id
          });
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'No se pudo actualizar favoritos');
    }
  };

  const handleStartNavigation = () => {
    if (!bar.latitude || !bar.longitude) {
      Alert.alert('Error', 'No hay coordenadas disponibles para este bar');
      return;
    }
    
    if (onStartNavigation) {
      onStartNavigation({
        latitude: bar.latitude,
        longitude: bar.longitude,
        name: bar.name
      });
      onClose(); // Close the card when starting navigation
    }
  };



  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.overlay} 
        onPress={onClose}
        activeOpacity={1}
      />
      <TouchableOpacity 
        style={styles.card} 
        onPress={handleCardPress}
        activeOpacity={0.8}
      >
        {/* Image Container with Favorite Button */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: bar.image_url || 'https://via.placeholder.com/300x200/2A3A4A/A3B3CC?text=Bar'
            }}
            style={styles.barImage}
            resizeMode="cover"
          />
          
          {/* Favorites Button */}
          <TouchableOpacity 
            style={[styles.favoritesButton, isFavorite && styles.favoritesButtonActive]}
            onPress={(e) => {
              e.stopPropagation();
              handleFavoriteToggle();
            }}
          >
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={20} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>

          {/* Close Button */}
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              console.log('📍 Closing bar card for:', bar.name);
              onClose();
            }} 
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bar Info */}
        <View style={styles.barInfo}>
          <Text style={styles.barName}>{typeof bar.name === 'string' ? bar.name : 'Bar sin nombre'}</Text>

          <View style={styles.barMeta}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {(typeof bar.rating === 'number' ? bar.rating.toFixed(1) : 'N/A')} ({bar.review_count || 0} reseñas)
              </Text>
            </View>

            {typeof bar.distance_km === 'number' && !isNaN(bar.distance_km) && (
              <Text style={styles.distanceText}>
                {bar.distance_km.toFixed(1)} km
              </Text>
            )}
          </View>

          {/* Next Match */}
          {nextMatch && (
            <View style={styles.nextMatchContainer}>
              <Ionicons name="calendar" size={14} color="#10B981" />
              <Text style={styles.nextMatchText}>
                Próximo partido: {new Date(nextMatch.date).toLocaleDateString('es-ES')} {nextMatch.time}
              </Text>
            </View>
          )}

          {/* Address */}
          {bar.address && bar.city && (
            <View>
              <Text style={styles.barAddress}>{bar.address}, {bar.city}</Text>
              
              {/* Navigate Button */}
              {onStartNavigation && (
                <TouchableOpacity 
                  style={styles.navigateButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleStartNavigation();
                  }}
                >
                  <Ionicons name="navigate" size={18} color="#FFFFFF" />
                  <Text style={styles.navigateButtonText}>Cómo llegar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100, // Position well above BottomTabBar with safe spacing
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 350, // Increased height for more content
    ...(Platform.OS === 'android' && {
      minHeight: 320,
      flexShrink: 0,
    }),
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  barImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favoritesButton: {
    position: 'absolute',
    top: 10,
    right: 50, // Position to the left of close button
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  favoritesButtonActive: {
    backgroundColor: '#EF4444',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  barInfo: {
    padding: 16,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  barMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#A3B3CC',
    fontSize: 14,
  },
  distanceText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  nextMatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  nextMatchText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  barAddress: {
    color: '#A3B3CC',
    fontSize: 14,
    marginBottom: 8,
  },
  categoryContainer: {
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default BarInfoCard; 