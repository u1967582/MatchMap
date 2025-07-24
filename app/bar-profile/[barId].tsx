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

interface BarPost {
  id: string;
  bar_id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  image_url?: string;
  start_date?: string;
  end_date?: string;
  post_type: 'promocion' | 'evento' | 'noticia' | 'oferta';
  is_active: boolean;
  pinned: boolean;
}

const { width } = Dimensions.get('window');

export default function BarProfileScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  
  const [bar, setBar] = useState<BarProfile | null>(null);
  const [posts, setPosts] = useState<BarPost[]>([]);
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

        // Fetch posts for this bar
        await fetchBarPosts(barData.id, authUser);
      }

    } catch (error) {
      console.error('Error in fetchBarProfile:', error);
      Alert.alert('Error', 'Ocurrió un error al cargar el perfil del bar');
    } finally {
      setLoading(false);
    }
  }, [barId]);

  const fetchBarPosts = useCallback(async (barId: string, authUser: any) => {
    try {
      let query = supabase
        .from('bar_posts')
        .select('*')
        .eq('bar_id', barId);

      // If not the owner, only show active posts within valid date range
      if (!authUser || authUser.id !== user?.id) {
        const today = new Date().toISOString().split('T')[0];
        query = query
          .eq('is_active', true)
          .or(`start_date.is.null,start_date.lte.${today}`)
          .or(`end_date.is.null,end_date.gte.${today}`);
      }

      // Order by pinned first, then by creation date (newest first)
      query = query.order('pinned', { ascending: false })
                  .order('created_at', { ascending: false });

      const { data: postsData, error: postsError } = await query;

      if (postsError) {
        console.error('Error fetching posts:', postsError);
      } else {
        setPosts(postsData || []);
      }
    } catch (error) {
      console.error('Error in fetchBarPosts:', error);
    }
  }, [user]);

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
      // Navigate to create post screen
      router.push(`/create-post/${barId}` as any);
    }
  }, [isOwner, barId, router]);

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

  const getPostTypeIcon = useCallback((postType: string) => {
    switch (postType) {
      case 'promocion':
        return 'pricetag';
      case 'evento':
        return 'calendar';
      case 'noticia':
        return 'newspaper';
      case 'oferta':
        return 'gift';
      default:
        return 'document-text';
    }
  }, []);

  const getPostTypeColor = useCallback((postType: string) => {
    switch (postType) {
      case 'promocion':
        return '#10B981';
      case 'evento':
        return '#3B82F6';
      case 'noticia':
        return '#8B5CF6';
      case 'oferta':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  }, []);

  const getPostTypeLabel = useCallback((postType: string) => {
    switch (postType) {
      case 'promocion':
        return 'Promoción';
      case 'evento':
        return 'Evento';
      case 'noticia':
        return 'Noticia';
      case 'oferta':
        return 'Oferta';
      default:
        return 'Post';
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.imageItem}>
      <Image source={{ uri: item }} style={styles.galleryImage} />
    </View>
  );

  const renderPostItem = ({ item }: { item: BarPost }) => (
    <View style={styles.postCard}>
      {item.pinned && (
        <View style={styles.pinnedBadge}>
          <Ionicons name="pin" size={12} color="#FFFFFF" />
          <Text style={styles.pinnedText}>Destacado</Text>
        </View>
      )}
      
      <View style={styles.postHeader}>
        <View style={styles.postTypeContainer}>
          <Ionicons 
            name={getPostTypeIcon(item.post_type) as any} 
            size={16} 
            color={getPostTypeColor(item.post_type)} 
          />
          <Text style={[styles.postTypeText, { color: getPostTypeColor(item.post_type) }]}>
            {getPostTypeLabel(item.post_type)}
          </Text>
        </View>
        <Text style={styles.postDate}>{formatDate(item.created_at)}</Text>
      </View>

      <Text style={styles.postTitle}>{item.title}</Text>
      <Text style={styles.postDescription}>{item.description}</Text>

      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.postImage} />
      )}

      {(item.start_date || item.end_date) && (
        <View style={styles.postDates}>
          <Ionicons name="time-outline" size={16} color="#A3B3CC" />
          <Text style={styles.postDatesText}>
            {item.start_date && item.end_date
              ? `${formatDate(item.start_date)} - ${formatDate(item.end_date)}`
              : item.start_date
              ? `Desde ${formatDate(item.start_date)}`
              : `Hasta ${formatDate(item.end_date!)}`
            }
          </Text>
        </View>
      )}

      {isOwner && (
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={styles.postActionButton}
            onPress={() => router.push(`/edit-post/${item.id}` as any)}
          >
            <Ionicons name="create-outline" size={16} color="#007AFF" />
            <Text style={styles.postActionText}>Editar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.postActionButton, styles.deletePostButton]}
            onPress={() => handleDeletePost(item.id)}
          >
            <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
            <Text style={[styles.postActionText, styles.deletePostText]}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const handleDeletePost = useCallback(async (postId: string) => {
    Alert.alert(
      'Eliminar Post',
      '¿Estás seguro de que quieres eliminar este post?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bar_posts')
                .delete()
                .eq('id', postId);

              if (error) {
                console.error('Error deleting post:', error);
                Alert.alert('Error', 'No se pudo eliminar el post');
                return;
              }

              // Refresh posts
              if (bar) {
                await fetchBarPosts(bar.id, user);
              }
            } catch (error) {
              console.error('Error in handleDeletePost:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar el post');
            }
          },
        },
      ]
    );
  }, [bar, user, fetchBarPosts]);

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
          
          {posts.length > 0 ? (
            <FlatList
              data={posts}
              renderItem={renderPostItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.noPostsContainer}>
              <Ionicons name="document-text-outline" size={48} color="#A3B3CC" />
              <Text style={styles.noPostsText}>No hay posts disponibles</Text>
              <Text style={styles.noPostsSubtext}>
                {isOwner ? 'Crea tu primer post para compartir novedades' : 'Este bar aún no ha publicado nada'}
              </Text>
            </View>
          )}
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
  postCard: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
  },
  pinnedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  pinnedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postTypeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  postDate: {
    color: '#A3B3CC',
    fontSize: 12,
  },
  postTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  postDescription: {
    color: '#A3B3CC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 12,
  },
  postDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  postDatesText: {
    color: '#A3B3CC',
    fontSize: 12,
  },
  postActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A3A4A',
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  deletePostButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  postActionText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
  },
  deletePostText: {
    color: '#FF6B6B',
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