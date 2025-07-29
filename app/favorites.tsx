import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  Dimensions,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import BottomTabBar from '~/components/ui/BottomTabBar';
import { useFavorites } from '~/hooks/useFavorites';

interface FavoriteBar {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  image_url?: string;
}

const { width } = Dimensions.get('window');

export default function FavoritesScreen() {
  const router = useRouter();
  const { getFavoriteBars, removeFromFavorites } = useFavorites();
  
  const [favoriteBars, setFavoriteBars] = useState<FavoriteBar[]>([]);
  const [filteredBars, setFilteredBars] = useState<FavoriteBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Load favorite bars
  const loadFavoriteBars = useCallback(async () => {
    setLoading(true);
    try {
      const bars = await getFavoriteBars();
      setFavoriteBars(bars as unknown as FavoriteBar[]);
      setFilteredBars(bars as unknown as FavoriteBar[]);
    } catch (error) {
      console.error('❌ Error loading favorite bars:', error);
    } finally {
      setLoading(false);
    }
  }, [getFavoriteBars]);

  // Filter bars based on search text
  const filterBars = useCallback((text: string) => {
    if (!text.trim()) {
      setFilteredBars(favoriteBars);
      return;
    }
    
    const filtered = favoriteBars.filter(bar => 
      bar.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredBars(filtered);
  }, [favoriteBars]);

  // Handle search text change
  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text);
    filterBars(text);
  }, [filterBars]);

  // Toggle search visibility
  const toggleSearch = useCallback(() => {
    setSearchVisible(!searchVisible);
    if (searchVisible) {
      setSearchText('');
      setFilteredBars(favoriteBars);
    }
  }, [searchVisible, favoriteBars]);

  // Load favorites on mount
  useEffect(() => {
    loadFavoriteBars();
  }, [loadFavoriteBars]);

  // Handle bar press
  const handleBarPress = useCallback((barId: string) => {
    router.push(`/bar-profile/${barId}` as any);
  }, [router]);

  // Handle remove from favorites
  const handleRemoveFromFavorites = useCallback(async (barId: string, barName: string) => {
    Alert.alert(
      'Eliminar de favoritos',
      `¿Estás seguro de que quieres eliminar "${barName}" de tus favoritos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const success = await removeFromFavorites(barId);
            if (success) {
              // Remove from local state
              setFavoriteBars(prev => prev.filter(bar => bar.id !== barId));
              setFilteredBars(prev => prev.filter(bar => bar.id !== barId));
              console.log('🗑️ Removed from favorites:', barName);
            } else {
              Alert.alert('Error', 'No se pudo eliminar de favoritos');
            }
          },
        },
      ]
    );
  }, [removeFromFavorites]);

  // Render favorite bar card
  const renderFavoriteBar = useCallback(({ item }: { item: FavoriteBar }) => (
    <View style={styles.barCard}>
      <TouchableOpacity 
        style={styles.imageContainer}
        onPress={() => handleBarPress(item.id)}
      >
        <Image
          source={{
            uri: item.image_url || 'https://via.placeholder.com/300x200/2A3A4A/A3B3CC?text=Bar'
          }}
          style={styles.barImage}
        />
      </TouchableOpacity>

      <View style={styles.barInfo}>
        <View style={styles.barHeader}>
          <View style={styles.barTextContainer}>
            <Text style={styles.barName}>{item.name}</Text>
            {item.description && (
              <Text style={styles.barDescription}>{item.description}</Text>
            )}
            <Text style={styles.barAddress}>{item.address}, {item.city}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => handleRemoveFromFavorites(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [handleBarPress, handleRemoveFromFavorites]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando favoritos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
  
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favoritos</Text>
        <TouchableOpacity style={styles.searchButton} onPress={toggleSearch}>
          <Ionicons name="search" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#A3B3CC" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar bares..."
              placeholderTextColor="#A3B3CC"
              value={searchText}
              onChangeText={handleSearchTextChange}
              autoFocus={true}
            />
            {searchText.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => handleSearchTextChange('')}
              >
                <Ionicons name="close-circle" size={20} color="#A3B3CC" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.sortButton, styles.sortButtonActive]}>
            <Text style={styles.sortButtonText}>Recomendados</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortButton}>
            <Text style={styles.sortButtonText}>Cercanos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortButton}>
            <Text style={styles.sortButtonText}>Mejor valorado</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Favorite Bars List */}
      <View style={styles.content}>
        {filteredBars.length > 0 ? (
          <FlatList
            data={filteredBars}
            renderItem={renderFavoriteBar}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.barsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            {searchText.length > 0 ? (
              <>
                <Ionicons name="search-outline" size={64} color="#A3B3CC" />
                <Text style={styles.emptyTitle}>No se encontraron resultados</Text>
                <Text style={styles.emptySubtitle}>
                  No hay bares favoritos que coincidan con "{searchText}"
                </Text>
                <TouchableOpacity 
                  style={styles.exploreButton}
                  onPress={() => handleSearchTextChange('')}
                >
                  <Text style={styles.exploreButtonText}>Limpiar búsqueda</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="heart-outline" size={64} color="#A3B3CC" />
                <Text style={styles.emptyTitle}>No tienes favoritos</Text>
                <Text style={styles.emptySubtitle}>
                  Explora bares y añádelos a tus favoritos para verlos aquí
                </Text>
                <TouchableOpacity 
                  style={styles.exploreButton}
                  onPress={() => router.push('/search' as any)}
                >
                  <Text style={styles.exploreButtonText}>Explorar Bares</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1b2c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2332',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  sortContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sortButton: {
    backgroundColor: '#2A3A4A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  sortButtonActive: {
    backgroundColor: '#1976D2',
  },
  sortButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#A3B3CC',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  barsList: {
    paddingBottom: 20,
  },
  barCard: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
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
  barInfo: {
    padding: 16,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  barTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  barDescription: {
    color: '#A3B3CC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  barAddress: {
    color: '#A3B3CC',
    fontSize: 14,
  },
  removeButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
  },
}); 