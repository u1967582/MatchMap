import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import ImageViewing from 'react-native-image-viewing';

interface MenuImage {
  id: string;
  image_url: string;
  image_order: number;
  url: string;
}

const BarMenuScreen: React.FC = () => {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const [menuImages, setMenuImages] = useState<MenuImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [barName, setBarName] = useState('');

  useEffect(() => {
    fetchMenuImages();
    fetchBarName();
  }, [barId]);

  const fetchBarName = async () => {
    try {
      const { data, error } = await supabase
        .from('bars')
        .select('name')
        .eq('id', barId)
        .single();

      if (error) {
        console.error('Error fetching bar name:', error);
        return;
      }

      setBarName(data?.name || '');
    } catch (error) {
      console.error('Error fetching bar name:', error);
    }
  };

  const fetchMenuImages = async () => {
    try {
      setLoading(true);
      console.log('🍽️ Fetching menu images for bar:', barId);

      const { data, error } = await supabase
        .from('bar_menus')
        .select('*')
        .eq('bar_id', barId)
        .order('image_order');

      if (error) {
        console.error('❌ Error fetching menu images:', error);
        return;
      }

      if (data) {
        // Construir URLs públicas para las imágenes
        const imagesWithUrls = data.map((item: any) => ({
          ...item,
          url: item.image_url // La URL ya viene completa desde Supabase
        }));

        console.log('✅ Menu images loaded:', imagesWithUrls.length);
        setMenuImages(imagesWithUrls);
      }
    } catch (error) {
      console.error('❌ Error in fetchMenuImages:', error);
    } finally {
      setLoading(false);
    }
  };

  const openImageViewer = (index: number) => {
    setCurrentIndex(index);
    setViewerVisible(true);
  };

  const renderMenuImage = ({ item, index }: { item: MenuImage; index: number }) => (
    <TouchableOpacity
      style={styles.menuThumbnailContainer}
      onPress={() => openImageViewer(index)}
    >
      <Image
        source={{ uri: item.url }}
        style={styles.menuThumbnail}
        resizeMode="cover"
      />
      <View style={styles.imageOverlay}>
        <Ionicons name="expand" size={20} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <Stack.Screen options={{ title: 'Carta del Bar', headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando carta del bar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (menuImages.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <Stack.Screen options={{ title: 'Carta del Bar', headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carta del Bar</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#8E8E93" />
          <Text style={styles.emptyTitle}>No hay carta disponible</Text>
          <Text style={styles.emptySubtitle}>
            Este bar aún no ha subido imágenes de su carta
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Stack.Screen options={{ title: 'Carta del Bar', headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carta del Bar</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.barName}>{barName}</Text>
        <Text style={styles.subtitle}>
          Toca una imagen para verla a pantalla completa
        </Text>

        <FlatList
          data={menuImages}
          renderItem={renderMenuImage}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryContainer}
          snapToAlignment="start"
          decelerationRate="fast"
        />
      </View>

      <ImageViewing
        images={menuImages.map(img => ({ uri: img.url }))}
        imageIndex={currentIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2A38',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 16,
    marginBottom: 24,
  },
  galleryContainer: {
    paddingHorizontal: 10,
  },
  menuThumbnailContainer: {
    marginHorizontal: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuThumbnail: {
    width: 120,
    height: 160,
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default BarMenuScreen; 