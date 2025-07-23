import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '~/utils/supabase';
import BottomTabBar from '~/components/ui/BottomTabBar';

interface BarProfile {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  phone?: string;
  website?: string;
  images: string[];
}



const { width } = Dimensions.get('window');

export default function BarProfileScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  
  const [bar, setBar] = useState<BarProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [user, setUser] = useState<any>(null);

  const fetchBarProfile = useCallback(async () => {
    if (!barId) return;

    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      // Fetch bar data
      const { data: barData, error: barError } = await supabase
        .from('bars')
        .select(`
          id,
          name,
          description,
          address,
          city,
          phone,
          website,
          bar_images(image_url, image_order)
        `)
        .eq('id', barId)
        .single();

      if (barError) {
        console.error('Error fetching bar:', barError);
        Alert.alert('Error', 'No se pudo cargar la información del bar');
        return;
      }

      if (barData) {
        setBar({
          id: barData.id,
          name: barData.name,
          description: barData.description,
          address: barData.address,
          city: barData.city,
          phone: barData.phone,
          website: barData.website,
          images: barData.bar_images
            ?.sort((a, b) => (a.image_order || 0) - (b.image_order || 0))
            .map(img => img.image_url) || [],
        });

        // Check if current user is the owner by checking if their bar_id matches this bar's id
        if (authUser) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('bar_id')
            .eq('id', authUser.id)
            .single();

          if (!userError && userData) {
            setIsOwner(userData.bar_id === barData.id);
          }
        }
      }

      // Comments and events will be loaded from database in the future

    } catch (error) {
      console.error('Error in fetchBarProfile:', error);
      Alert.alert('Error', 'Ocurrió un error al cargar el perfil del bar');
    } finally {
      setLoading(false);
    }
  }, [barId]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleEditInfo = useCallback(() => {
    if (isOwner) {
      Alert.alert('Editar Información', 'Función de edición próximamente disponible');
    }
  }, [isOwner]);

  const handleCreatePost = useCallback(() => {
    if (isOwner) {
      Alert.alert('Crear Post', 'Función de creación de posts próximamente disponible');
    }
  }, [isOwner]);

  const handleDeleteBar = useCallback(() => {
    if (!isOwner || !user) return;

    Alert.alert(
      'Eliminar Bar',
      '¿Estás seguro de que quieres eliminar este bar? Esta acción no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove bar_id from user profile
              const { error: userError } = await supabase
                .from('users')
                .update({ bar_id: null })
                .eq('id', user.id);

              if (userError) {
                console.error('Error removing bar from user:', userError);
                Alert.alert('Error', 'No se pudo eliminar el bar del perfil');
                return;
              }

              // Note: In a real implementation, you might want to soft delete the bar
              // or handle related data (images, posts, etc.) before deletion
              const { error: barError } = await supabase
                .from('bars')
                .delete()
                .eq('id', barId);

              if (barError) {
                console.error('Error deleting bar:', barError);
                Alert.alert('Error', 'No se pudo eliminar el bar');
                return;
              }

              Alert.alert(
                'Bar Eliminado',
                'El bar ha sido eliminado correctamente.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(protected)/profile' as any),
                  },
                ]
              );
            } catch (error) {
              console.error('Error in handleDeleteBar:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar el bar');
            }
          },
        },
      ]
    );
  }, [isOwner, user, barId, router]);



  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.imageItem}>
      <Image source={{ uri: item }} style={styles.galleryImage} />
    </View>
  );

  useEffect(() => {
    fetchBarProfile();
  }, [fetchBarProfile]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bar) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Bar no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header with Bar Name */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.barName}>{bar.name}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Images Gallery */}
        <View style={styles.imagesSection}>
          {bar.images.length > 0 ? (
            <FlatList
              data={bar.images}
              renderItem={renderImageItem}
              keyExtractor={(item, index) => `image-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={width - 40}
              decelerationRate="fast"
              contentContainerStyle={styles.imagesList}
            />
          ) : (
            <View style={styles.defaultImageContainer}>
              <Ionicons name="storefront" size={64} color="#A3B3CC" />
              <Text style={styles.noImagesText}>No hay imágenes disponibles</Text>
            </View>
          )}
          
          {/* Edit Button */}
          {isOwner && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditInfo}>
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Editar información</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bar Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Información del Bar</Text>
          
          {bar.description && (
            <View style={styles.infoItem}>
              <Ionicons name="information-circle-outline" size={20} color="#A3B3CC" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Descripción</Text>
                <Text style={styles.infoText}>{bar.description}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={20} color="#A3B3CC" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Dirección</Text>
              <Text style={styles.infoText}>{bar.address}, {bar.city}</Text>
            </View>
          </View>

          {bar.phone && (
            <View style={styles.infoItem}>
              <Ionicons name="call-outline" size={20} color="#A3B3CC" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoText}>{bar.phone}</Text>
              </View>
            </View>
          )}

          {bar.website && (
            <View style={styles.infoItem}>
              <Ionicons name="globe-outline" size={20} color="#A3B3CC" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Sitio Web</Text>
                <Text style={styles.infoText}>{bar.website}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Posts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Posts</Text>
            {isOwner && (
              <TouchableOpacity style={styles.createPostButton} onPress={handleCreatePost}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.createPostButtonText}>Crear Post</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.noPostsContainer}>
            <Ionicons name="document-text-outline" size={48} color="#A3B3CC" />
            <Text style={styles.noPostsText}>No hay posts disponibles</Text>
            <Text style={styles.noPostsSubtext}>
              {isOwner ? 'Crea tu primer post para compartir novedades' : 'Este bar aún no ha publicado nada'}
            </Text>
          </View>
        </View>

        {/* Delete Bar Section - Only for owners */}
        {isOwner && (
          <View style={styles.dangerSection}>
            <TouchableOpacity style={styles.deleteBarButton} onPress={handleDeleteBar}>
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
              <Text style={styles.deleteBarButtonText}>Eliminar Bar</Text>
            </TouchableOpacity>
          </View>
        )}




      </ScrollView>

      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1b2c',
  },
  scrollView: {
    flex: 1,
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
  headerContainer: {
    backgroundColor: '#0e1b2c',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 32, // Same width as back button to center the title
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  imagesSection: {
    position: 'relative',
  },
  imagesList: {
    paddingHorizontal: 20,
  },
  imageItem: {
    marginRight: 12,
  },
  galleryImage: {
    width: width - 80,
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  defaultImageContainer: {
    height: 200,
    backgroundColor: '#2A3A4A',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 12,
  },
  noImagesText: {
    color: '#A3B3CC',
    fontSize: 14,
    marginTop: 8,
  },
  editButton: {
    position: 'absolute',
    bottom: 16,
    right: 20,
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  infoSection: {
    padding: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
  },
  createPostButton: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  createPostButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  noPostsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noPostsText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noPostsSubtext: {
    color: '#A3B3CC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  dangerSection: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 60,
  },
  deleteBarButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteBarButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '500',
  },

}); 