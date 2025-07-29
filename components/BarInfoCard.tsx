import * as React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Bar {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  rating?: number | null;
  review_count?: number | null;
  image_url?: string;
  category_id?: number;
  distance_km?: number;
  category?: { id: number; name: string };
  bar_food_types?: { food_type_id: number; food_type: { name: string } }[];
  bar_languages?: { language_id: number; language: { name: string } }[];
  bar_selected_features?: { feature_id: number; feature: { name: string } }[];
}

interface BarInfoCardProps {
  bar: Bar | null;
  visible: boolean;
  onClose: () => void;
  onNavigate?: (barId: string) => void;
}

const BarInfoCard: React.FC<BarInfoCardProps> = ({ 
  bar, 
  visible, 
  onClose,
  onNavigate 
}) => {
  const router = useRouter();
  
  console.log('📍 BarInfoCard render - visible:', visible, 'bar name:', bar?.name || 'undefined');
  
  if (!visible || !bar) {
    console.log('📍 BarInfoCard returning null - visible:', visible, 'bar exists:', !!bar);
    return null;
  }

  const handleCardPress = () => {
    console.log('📍 Opening bar profile for:', bar.name);
    onClose(); // Close the card first
    router.push(`/bar-profile/${bar.id}` as any);
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
        {/* Header with close button */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{typeof bar.name === 'string' ? bar.name : 'Bar sin nombre'}</Text>
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation(); // Prevent card press when clicking close button
              console.log('📍 Closing bar card for:', bar.name);
              onClose();
            }} 
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#A3B3CC" />
          </TouchableOpacity>
        </View>

        {/* Bar image and info row */}
        <View style={styles.contentRow}>
          <Image
            source={{
              uri: bar.image_url || 'https://via.placeholder.com/300x200/2A3A4A/A3B3CC?text=Bar'
            }}
            style={styles.barImage}
            resizeMode="cover"
          />
          
          <View style={styles.infoContainer}>
            {/* Address */}
            <View style={styles.locationContainer}>
              <Ionicons name="location-outline" size={14} color="#A3B3CC" />
              <Text style={styles.address} numberOfLines={2}>
                {typeof bar.address === 'string' ? bar.address : 'Dirección no disponible'}, {typeof bar.city === 'string' ? bar.city : 'Ciudad no disponible'}
              </Text>
            </View>

            {/* Rating */}
            {typeof bar.rating === 'number' && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.rating}>{bar.rating.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>
                  {typeof bar.review_count === 'number' ? ` (${bar.review_count} reseñas)` : ' (0 reseñas)'}
                </Text>
              </View>
            )}

            {/* Distance */}
            {typeof bar.distance_km === 'number' && (
              <View style={styles.distanceContainer}>
                <Ionicons name="navigate-outline" size={14} color="#4CAF50" />
                <Text style={styles.distance}>{bar.distance_km.toFixed(1)} km</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80, // Position above BottomTabBar (estimated height)
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingBottom: 20,
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
    maxHeight: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
  contentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },

  infoContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  address: {
    fontSize: 12,
    color: '#A3B3CC',
    marginLeft: 4,
    flex: 1,
  },
  barImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 10,
    color: '#A3B3CC',
    marginLeft: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distance: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },

});

export default BarInfoCard; 