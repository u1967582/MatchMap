import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Dimensions, Alert, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/utils/supabase';
import BottomTabBar from '~/components/ui/BottomTabBar';
import { useFavorites } from '~/hooks/useFavorites';
import BarReviewsSection from '~/components/BarReviewsSection';

interface BarProfile {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  phone?: string;
  website?: string;
  images: string[];
  category?: { id: number; name: string };
  bar_food_types?: { food_type_id: number; food_type: { name: string } }[];
  bar_languages?: { language_id: number; language: { name: string } }[];
  bar_selected_features?: { feature_id: number; feature: { name: string } }[];
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

interface UpcomingMatch {
  id: string;
  start_time: string;
  date: string;
  time: string;
  home_team_id: string;
  away_team_id: string;
  competition_id: number;
  home_team_name: string;
  away_team_name: string;
  competition_name: string;
  home_team_logo_url?: string;
  away_team_logo_url?: string;
}

const { width } = Dimensions.get('window');

export default function BarProfileScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const { isFavorite, toggleFavorite } = useFavorites();
  
  const [bar, setBar] = useState<BarProfile | null>(null);
  const [posts, setPosts] = useState<BarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [canShowMenuButton, setCanShowMenuButton] = useState<boolean>(false);

  // Functions to copy to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setString(text);
      Alert.alert('Copiado', `${label} copiado al portapapeles`);
    } catch (error) {
      Alert.alert('Error', 'No se pudo copiar al portapapeles');
    }
  };

  const copyAddress = () => {
    if (bar?.address && bar?.city) {
      copyToClipboard(`${bar.address}, ${bar.city}`, 'Dirección');
    }
  };

  const copyPhone = () => {
    if (bar?.phone) {
      copyToClipboard(bar.phone, 'Teléfono');
    }
  };

  // Create sections for FlatList
  const sections = [
    { type: 'header', key: 'header' },
    { type: 'images', key: 'images' },
    { type: 'matches', key: 'matches' },
    { type: 'upcoming-matches', key: 'upcoming-matches' },
    { type: 'info', key: 'info' },
    { type: 'tags', key: 'tags' },
    { type: 'menu', key: 'menu' },
    { type: 'posts', key: 'posts' },
    { type: 'reviews', key: 'reviews' },
    { type: 'danger', key: 'danger' },
  ];

  const renderSection = ({ item }: { item: { type: string; key: string } }) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.barName}>{bar?.name}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        );

      case 'images':
        return (
          <View style={styles.imagesSection}>
            {bar?.images.length ? (
              <View style={styles.imageContainer}>
                <FlatList
                  data={bar.images}
                  renderItem={renderImageItem}
                  keyExtractor={(item, index) => `image-${index}-${item}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={width - 40}
                  decelerationRate="fast"
                  contentContainerStyle={styles.imagesList}
                  scrollEnabled={bar.images.length > 1}
                  pagingEnabled={bar.images.length > 1}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / (width - 40));
                    setCurrentImageIndex(index);
                  }}
                />
                
                {/* Page indicators */}
                {bar.images.length > 1 && (
                  <View style={styles.pageIndicators}>
                    {bar.images.map((imgUrl, index) => (
                      <View
                        key={`indicator-${bar.id}-${index}-${imgUrl}`}
                        style={[
                          styles.pageIndicator,
                          index === currentImageIndex && styles.pageIndicatorActive
                        ]}
                      />
                    ))}
                  </View>
                )}
                
                {!isOwner && (
                  <TouchableOpacity 
                    style={[styles.favoritesButton, isFav && styles.favoritesButtonActive]}
                    onPress={handleFavoriteToggle}
                  >
                    <Ionicons 
                      name={isFav ? "heart" : "heart-outline"} 
                      size={20} 
                      color="#FFFFFF" 
                    />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.defaultImageContainer}>
                <Ionicons name="storefront" size={64} color="#A3B3CC" />
                <Text style={styles.noImagesText}>No hay imágenes disponibles</Text>
              </View>
            )}
            
            {isOwner && (
              <TouchableOpacity style={styles.editButton} onPress={handleEditInfo}>
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text style={styles.editButtonText}>Editar información</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'info':
        return (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>📝 Información del Bar</Text>
            
            {bar?.description && (
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
                <Text style={styles.infoText}>{bar?.address}, {bar?.city}</Text>
              </View>
              <TouchableOpacity style={styles.copyButton} onPress={copyAddress}>
                <Ionicons name="copy-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {bar?.phone && (
              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={20} color="#A3B3CC" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Teléfono</Text>
                  <Text style={styles.infoText}>{bar.phone}</Text>
                </View>
                <TouchableOpacity style={styles.copyButton} onPress={copyPhone}>
                  <Ionicons name="copy-outline" size={18} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}

            {bar?.website && (
              <View style={styles.infoItem}>
                <Ionicons name="globe-outline" size={20} color="#A3B3CC" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Sitio Web</Text>
                  <Text style={styles.infoText}>{bar.website}</Text>
                </View>
              </View>
            )}
          </View>
        );

      case 'tags':
        return (
          (bar?.category || (bar?.bar_food_types?.length ?? 0) > 0 || (bar?.bar_languages?.length ?? 0) > 0 || (bar?.bar_selected_features?.length ?? 0) > 0) ? (
            <View style={styles.tagsSection}>
              <FlatList
                data={[
                  ...(bar?.category ? [{ type: 'category', data: bar.category, id: 'category' }] : []),
                  ...(bar?.bar_food_types?.map((item) => ({ type: 'food', data: item, id: `food-${item.food_type_id}` })) || []),
                  ...(bar?.bar_languages?.map((item) => ({ type: 'language', data: item, id: `language-${item.language_id}` })) || []),
                  ...(bar?.bar_selected_features?.map((item) => ({ type: 'feature', data: item, id: `feature-${item.feature_id}` })) || [])
                ]}
                renderItem={({ item }) => {
                  let backgroundColor = '#1976D2';
                  let icon = '📂';
                  let text = '';
                  
                  switch (item.type) {
                    case 'category':
                      backgroundColor = '#1976D2';
                      icon = '📂';
                      text = (item.data as { name: string }).name;
                      break;
                    case 'food':
                      backgroundColor = '#FF6B35';
                      icon = '🍽️';
                      text = (item.data as { food_type: { name: string } }).food_type.name;
                      break;
                    case 'language':
                      backgroundColor = '#4CAF50';
                      icon = '🗣️';
                      text = (item.data as { language: { name: string } }).language.name;
                      break;
                    case 'feature':
                      backgroundColor = '#9C27B0';
                      icon = '✨';
                      text = (item.data as { feature: { name: string } }).feature.name;
                      break;
                  }
                  
                  return (
                    <View style={[styles.tag, { backgroundColor }]}>
                      <Text style={styles.tagText}>{icon} {text}</Text>
                    </View>
                  );
                }}
                keyExtractor={(item) => (item as any).id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagsScrollContainer}
              />
            </View>
          ) : null
        );

      case 'menu':
        return (
          canShowMenuButton ? (
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>🍽️ La Carta</Text>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => router.push(`/bar-menu/${barId}` as any)}
              >
                <Text style={styles.menuButtonText}>Ver Carta</Text>
              </TouchableOpacity>
            </View>
          ) : null
        );

      case 'posts':
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📰 Posts</Text>
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
                renderItem={({ item }) => renderPostItem({ item })}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ListEmptyComponent={null}
                contentContainerStyle={{ gap: 0 }}
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
            
            {/* Write Review Button */}
            {!isOwner && (
              <TouchableOpacity
                style={styles.reviewButton}
                onPress={() => router.push(`/write-review/${barId}` as any)}
              >
                <Ionicons name="star-outline" size={20} color="#FFFFFF" />
                <Text style={styles.reviewButtonText}>Write a Review</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'reviews':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⭐ Reseñas</Text>
            <BarReviewsSection barId={barId} />
          </View>
        );

      case 'matches':
        return (
          isOwner ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>⚽ Gestión de Partidos</Text>
              </View>
              
              <View style={styles.matchesContainer}>
                <TouchableOpacity
                  style={styles.matchButton}
                  onPress={() => router.push(`/manual-match-selection/${barId}` as any)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.matchButtonText}>Añadir partido manualmente</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.matchButton, styles.matchButtonDisabled]}
                  disabled={true}
                >
                  <Ionicons name="settings-outline" size={20} color="#8E8E93" />
                  <Text style={styles.matchButtonTextDisabled}>Automatizar retransmisiones (próximamente)</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        );

      case 'upcoming-matches':
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📺 Próximos partidos</Text>
            </View>
            
            {upcomingMatches.length > 0 ? (
              <View style={styles.upcomingMatchesContainer}>
                {upcomingMatches.map((match) => (
                  <View key={match.id} style={styles.upcomingMatchCard}>
                    <View style={styles.upcomingMatchTeams}>
                      <View style={styles.upcomingTeamContainer}>
                        <Image
                          source={{
                            uri: match.home_team_logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${match.home_team_id}.png`
                          }}
                          style={styles.upcomingTeamLogo}
                          defaultSource={require('~/assets/icon.png')}
                        />
                        <Text style={styles.upcomingTeamName} numberOfLines={2}>
                          {match.home_team_name}
                        </Text>
                      </View>
                      
                      <View style={styles.upcomingVsContainer}>
                        <Text style={styles.upcomingVsText}>VS</Text>
                      </View>
                      
                      <View style={styles.upcomingTeamContainer}>
                        <Image
                          source={{
                            uri: match.away_team_logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${match.away_team_id}.png`
                          }}
                          style={styles.upcomingTeamLogo}
                          defaultSource={require('~/assets/icon.png')}
                        />
                        <Text style={styles.upcomingTeamName} numberOfLines={2}>
                          {match.away_team_name}
                        </Text>
                      </View>
                    </View>
                    

                    
                    <Text style={styles.upcomingMatchTime}>
                      {new Date(`${match.date} ${match.time}`).toLocaleString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    
                    <Text style={styles.upcomingMatchCompetition}>
                      {match.competition_name}
                    </Text>
                    
                    {isOwner && (
                      <TouchableOpacity
                        style={styles.deleteMatchButton}
                        onPress={() => handleDeleteMatch(match.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                        <Text style={styles.deleteMatchButtonText}>Eliminar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyUpcomingMatches}>
                <Text style={styles.emptyUpcomingMatchesText}>
                  Este bar no tiene retransmisiones programadas actualmente
                </Text>
              </View>
            )}
          </View>
        );

      case 'danger':
        return (
          isOwner ? (
            <View style={styles.dangerSection}>
              <TouchableOpacity style={styles.deleteBarButton} onPress={handleDeleteBar}>
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                <Text style={styles.deleteBarButtonText}>Eliminar Bar</Text>
              </TouchableOpacity>
            </View>
          ) : null
        );

      default:
        return null;
    }
  };

  const fetchBarProfile = useCallback(async () => {
    if (!barId) return;

    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser); // This line was removed as per the new_code, as user state is no longer managed here.

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
          bar_images(image_url, image_order),
          category_id
        `)
        .eq('id', barId)
        .single();

      if (barError) {
        console.error('Error fetching bar:', barError);
        Alert.alert('Error', 'No se pudo cargar la información del bar');
        return;
      }

      if (barData) {
        // Check if bar has at least one active subscription (supports multiple rows)
        const { count, error: subsError } = await supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('bar_id', barData.id)
          .eq('status', 'active');
        if (subsError) {
          console.warn('Error checking bar subscriptions:', subsError);
          setCanShowMenuButton(false);
        } else {
          setCanShowMenuButton(!!count && count > 0);
        }

        // Load N:N relationships separately (only IDs first)
        const { data: foodTypes } = await supabase
          .from('bar_food_types')
          .select('food_type_id')
          .eq('bar_id', barId);

        const { data: languages } = await supabase
          .from('bar_languages')
          .select('language_id')
          .eq('bar_id', barId);

        const { data: features } = await supabase
          .from('bar_selected_features')
          .select('feature_id')
          .eq('bar_id', barId);

        console.log('🔍 Bar profile N:N data loaded:', {
          foodTypes: foodTypes?.length || 0,
          languages: languages?.length || 0,
          features: features?.length || 0,
          foodTypeIds: foodTypes?.map(item => item.food_type_id) || [],
          languageIds: languages?.map(item => item.language_id) || [],
          featureIds: features?.map(item => item.feature_id) || []
        });

        // Load category name
        let categoryName = '';
        if (barData.category_id) {
          const { data: categoryData } = await supabase
            .from('bar_categories')
            .select('name')
            .eq('id', barData.category_id)
            .single();
          categoryName = categoryData?.name || '';
        }

        // Load food type names
        const foodTypeIds = foodTypes?.map(item => item.food_type_id) || [];
        const { data: foodTypeNames } = await supabase
          .from('food_types')
          .select('id, name')
          .in('id', foodTypeIds);

        // Load language names
        const languageIds = languages?.map(item => item.language_id) || [];
        const { data: languageNames } = await supabase
          .from('languages')
          .select('id, name')
          .in('id', languageIds);

        // Load feature names
        const featureIds = features?.map(item => item.feature_id) || [];
        const { data: featureNames } = await supabase
          .from('bar_features')
          .select('id, name')
          .in('id', featureIds);

        // Create maps for quick lookup
        const foodTypeMap = new Map();
        foodTypeNames?.forEach(item => foodTypeMap.set(item.id, item.name));

        const languageMap = new Map();
        languageNames?.forEach(item => languageMap.set(item.id, item.name));

        const featureMap = new Map();
        featureNames?.forEach(item => featureMap.set(item.id, item.name));

        console.log('🔍 Bar profile names loaded:', {
          foodTypeNames: foodTypeNames?.length || 0,
          languageNames: languageNames?.length || 0,
          featureNames: featureNames?.length || 0,
          foodTypeMap: Object.fromEntries(foodTypeMap),
          languageMap: Object.fromEntries(languageMap),
          featureMap: Object.fromEntries(featureMap)
        });

        setBar({
          id: barData.id,
          name: barData.name,
          description: barData.description,
          address: barData.address,
          city: barData.city,
          phone: barData.phone,
          website: barData.website,
          images: barData.bar_images
            ?.sort((a: any, b: any) => (a.image_order || 0) - (b.image_order || 0))
            .map((img: any) => img.image_url) || [],
          category: barData.category_id ? { id: barData.category_id, name: categoryName } : undefined,
          bar_food_types: foodTypes?.map(item => ({
            food_type_id: item.food_type_id,
            food_type: { name: foodTypeMap.get(item.food_type_id) || 'Unknown' }
          })) || [],
          bar_languages: languages?.map(item => ({
            language_id: item.language_id,
            language: { name: languageMap.get(item.language_id) || 'Unknown' }
          })) || [],
          bar_selected_features: features?.map(item => ({
            feature_id: item.feature_id,
            feature: { name: featureMap.get(item.feature_id) || 'Unknown' }
          })) || [],
        });

        console.log('✅ Bar profile set:', {
          name: barData.name,
          category: barData.category_id ? { id: barData.category_id, name: categoryName } : undefined,
          foodTypes: foodTypes?.map(item => ({
            food_type_id: item.food_type_id,
            food_type: { name: foodTypeMap.get(item.food_type_id) || 'Unknown' }
          })) || [],
          languages: languages?.map(item => ({
            language_id: item.language_id,
            language: { name: languageMap.get(item.language_id) || 'Unknown' }
          })) || [],
          features: features?.map(item => ({
            feature_id: item.feature_id,
            feature: { name: featureMap.get(item.feature_id) || 'Unknown' }
          })) || []
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
        
        // Fetch upcoming matches for this bar
        await fetchUpcomingMatches(barData.id);
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

  const fetchUpcomingMatches = useCallback(async (barId: string) => {
    try {
      console.log('📺 Fetching upcoming matches for bar:', barId);
      
      const { data: matchesData, error: matchesError } = await supabase
        .from('events')
        .select(`
          start_time,
          matches!inner(
            id,
            date,
            time,
            home_team_id,
            away_team_id,
            competition_id,
            home_team:teams!matches_home_team_id_fkey(id, name, logo_url),
            away_team:teams!matches_away_team_id_fkey(id, name, logo_url),
            competition:competitions!inner(id, name)
          )
        `)
        .eq('bar_id', barId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (matchesError) {
        console.error('Error fetching upcoming matches:', matchesError);
        return;
      }

      if (matchesData && matchesData.length > 0) {
        const upcomingMatches: UpcomingMatch[] = matchesData.map((event: any) => ({
          id: event.matches.id,
          start_time: event.start_time,
          date: event.matches.date,
          time: event.matches.time,
          home_team_id: event.matches.home_team_id,
          away_team_id: event.matches.away_team_id,
          competition_id: event.matches.competition_id,
          home_team_name: event.matches.home_team.name,
          away_team_name: event.matches.away_team.name,
          competition_name: event.matches.competition.name,
          home_team_logo_url: event.matches.home_team.logo_url,
          away_team_logo_url: event.matches.away_team.logo_url,
        }));

        setUpcomingMatches(upcomingMatches);
        console.log('📺 Upcoming matches loaded:', upcomingMatches.length);
      } else {
        setUpcomingMatches([]);
        console.log('📺 No upcoming matches found for bar:', barId);
      }
    } catch (error) {
      console.error('Error in fetchUpcomingMatches:', error);
    }
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleEditInfo = useCallback(() => {
    if (isOwner) {
      router.push(`/edit-bar-info/${barId}` as any);
    }
  }, [isOwner, barId, router]);

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

  // Check if bar is in favorites when bar loads
  useEffect(() => {
    if (barId) {
      const checkFavorite = async () => {
        const favorite = await isFavorite(barId);
        setIsFav(favorite);
      };
      checkFavorite();
    }
  }, [barId, isFavorite]);

  const handleFavoriteToggle = async () => {
    if (!barId) return;
    
    const success = await toggleFavorite(barId);
    if (success) {
      setIsFav(!isFav);
      console.log(isFav ? '🗑️ Removed from favorites:' : '❤️ Added to favorites:', bar?.name);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    Alert.alert(
      'Eliminar Partido',
      '¿Estás seguro de que quieres eliminar este partido de la programación?',
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
              const { error } = await supabase
                .from('events')
                .delete()
                .eq('bar_id', barId)
                .eq('match_id', matchId);

              if (error) {
                console.error('Error deleting match:', error);
                Alert.alert('Error', 'No se pudo eliminar el partido');
                return;
              }

              // Refresh upcoming matches
              await fetchUpcomingMatches(barId);
              
              Alert.alert('Éxito', 'Partido eliminado correctamente');
            } catch (error) {
              console.error('Error in handleDeleteMatch:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar el partido');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bar) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Bar no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <FlatList
        data={sections}
        renderItem={renderSection}
        keyExtractor={(item) => `${bar.id}-${item.key}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      />

      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  scrollViewContent: {
    paddingBottom: 80, // Add padding for the bottom tab bar
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
    backgroundColor: '#1C2A3A',
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
  imageContainer: {
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
  favoritesButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 15,
    zIndex: 1,
  },
  favoritesButtonActive: {
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
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
  tagsSection: {
    padding: 20,
    backgroundColor: 'transparent', // Changed to transparent
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tagsScrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  pageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  pageIndicatorActive: {
    backgroundColor: '#FFFFFF',
  },
  tag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  matchesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1A2332',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  matchButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  matchButtonDisabled: {
    backgroundColor: '#2A3A4A',
    borderWidth: 1,
    borderColor: '#8E8E93',
    shadowOpacity: 0.1,
  },
  matchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  matchButtonTextDisabled: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '600',
  },
  // Upcoming matches styles
  upcomingMatchesContainer: {
    paddingHorizontal: 20,
  },
  upcomingMatchCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  upcomingMatchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  upcomingTeamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  upcomingTeamLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  upcomingTeamName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  upcomingVsContainer: {
    paddingHorizontal: 16,
  },
  upcomingVsText: {
    color: '#A3B3CC',
    fontSize: 16,
    fontWeight: '600',
  },

  upcomingMatchTime: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  upcomingMatchCompetition: {
    color: '#A3B3CC',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyUpcomingMatches: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyUpcomingMatchesText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  deleteMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'center',
    gap: 4,
  },
  deleteMatchButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '500',
  },
  menuSection: {
    padding: 20,
    backgroundColor: '#1A2332',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  menuSectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 10,
    backgroundColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  copyButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
}); 