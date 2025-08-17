import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';
import BottomTabBar from '~/components/ui/BottomTabBar';
import { getBarPlanInfo } from '~/lib/getBarPlanInfo';
import { useUserSubscription } from '~/hooks/useUserSubscription';
import { getPlanByType, formatPrice } from '~/utils/subscription';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
  profile_image_url?: string;
}

interface UserBar {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
}

interface SettingsRowProps {
  title: string;
  onPress: () => void;
  isLast?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ title, onPress, isLast = false }) => (
  <TouchableOpacity
    style={[styles.settingsRow, isLast && styles.settingsRowLast]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={styles.settingsText}>{title}</Text>
    <Ionicons name="chevron-forward" size={20} color="#A3B3CC" />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userBars, setUserBars] = useState<UserBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState<string>('Cargando...');
  const router = useRouter();
  
  // Hook para obtener la suscripción del usuario
  const { hasActiveSubscription, planType, maxPhotosAllowed, subscription } = useUserSubscription(user?.id);

  const fetchUserProfile = useCallback(async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.error('Error getting user:', authError);
        router.replace('/login');
        return;
      }

      // Try to get additional profile data from users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('full_name, username, profile_image_url, bar_id')
        .eq('id', authUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        full_name: profileData?.full_name,
        username: profileData?.username,
        profile_image_url: profileData?.profile_image_url,
      });

      // Fetch user's bars using the bar_id from users table
      if (profileData?.bar_id) {
        const { data: barData, error: barError } = await supabase
          .from('bars')
          .select(`
            id,
            name,
            description,
            bar_images(image_url, image_order)
          `)
          .eq('id', profileData.bar_id)
          .single();

        if (barError) {
          console.error('Error fetching user bar:', barError);
        } else if (barData) {
          const formattedBar = {
            id: barData.id,
            name: barData.name,
            description: barData.description,
            image_url: barData.bar_images && barData.bar_images.length > 0 
              ? barData.bar_images.sort((a, b) => (a.image_order || 0) - (b.image_order || 0))[0]?.image_url
              : undefined,
          };
          setUserBars([formattedBar]);
          
          // Fetch plan information for the bar
          const plan = await getBarPlanInfo(profileData.bar_id);
          setPlanName(plan.name);
        }
      } else {
        setPlanName('No asignado');
      }

    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'No se pudo cerrar sesión. Inténtalo de nuevo.');
            }
          },
        },
      ]
    );
  }, [router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleEditProfile = useCallback(() => {
    router.push('/edit-profile' as any);
  }, [router]);

  const handleNotifications = useCallback(() => {
    router.push('/notifications' as any);
  }, [router]);

  const handlePrivacy = useCallback(() => {
    router.push('/privacy' as any);
  }, [router]);

  const handleViewPlans = useCallback(() => {
    // Si el usuario tiene bar, pasar barId para suscripción enlazada
    if (userBars.length > 0) {
      router.push({ 
        pathname: '/subscription-plans', 
        params: { barId: userBars[0].id } 
      });
    } else {
      // Si no tiene bar, ir a la pantalla de planes sin barId
      router.push('/subscription-plans');
    }
  }, [router, userBars]);

  const handleAddBar = useCallback(() => {
    router.push('/register-bar/step0' as any);
  }, [router]);

  const handleViewBarProfile = useCallback((barId: string) => {
    router.push(`/bar-profile/${barId}` as any);
  }, [router]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user?.full_name || user?.username || 'Usuario';
  const displayHandle = user?.username ? `@${user.username}` : user?.email || '';
  
  // Default profile image URL when user doesn't have one
  const getProfileImageUrl = () => {
    if (user?.profile_image_url) {
      return user.profile_image_url;
    }
    // Default avatar URL - you can replace this with your preferred default image
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName) + '&background=2A3A4A&color=A3B3CC&size=240';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="always"
        keyboardShouldPersistTaps="handled"
        scrollIndicatorInsets={{ bottom: 100 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Perfil</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: getProfileImageUrl() }} 
              style={styles.avatar}
              defaultSource={require('~/assets/icon.png')}
            />
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userHandle}>{displayHandle}</Text>
        </View>

        {/* Bar Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestiona tu Bar</Text>
          {userBars.length > 0 ? (
            <View>
              {userBars.map((bar) => (
                <TouchableOpacity 
                  key={bar.id}
                  style={styles.barCard} 
                  onPress={() => handleViewBarProfile(bar.id)}
                >
                  <View style={styles.barImageContainer}>
                    {bar.image_url ? (
                      <Image source={{ uri: bar.image_url }} style={styles.barImage} />
                    ) : (
                      <View style={styles.defaultBarImage}>
                        <Ionicons name="storefront" size={32} color="#A3B3CC" />
                      </View>
                    )}
                  </View>
                  <View style={styles.barInfo}>
                    <Text style={styles.barName}>{bar.name}</Text>
                    <View style={styles.viewProfileButton}>
                      <Text style={styles.viewProfileButtonText}>Ver Perfil del Bar</Text>
                      <Ionicons name="chevron-forward" size={16} color="#1976D2" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={styles.addBarButton} onPress={handleAddBar}>
              <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
              <Text style={styles.addBarButtonText}>Añadir Bar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Plan Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Actual</Text>
          <View style={styles.planContainer}>
            {hasActiveSubscription && planType ? (
              <View>
                {/* Plan Header */}
                <View style={styles.planHeader}>
                  <View style={styles.planIconContainer}>
                    <Ionicons 
                      name={planType?.includes('elite') ? "diamond" : "star"} 
                      size={24} 
                      color={planType?.includes('elite') ? "#8B5CF6" : "#10B981"} 
                    />
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>
                      {getPlanByType(planType)?.name || 'Plan Activo'}
                    </Text>
                    <Text style={styles.planPrice}>
                      {getPlanByType(planType) ? formatPrice(getPlanByType(planType)!) : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.planStatus}>
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: subscription?.status === 'active' ? '#10B981' : '#F59E0B' }
                    ]}>
                      <Text style={styles.statusText}>
                        {subscription?.status === 'active' ? 'ACTIVO' : 'PRUEBA'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Plan Features */}
                <View style={styles.planFeatures}>
                  <View style={styles.featureRow}>
                    <Ionicons name="search" size={20} color="#10B981" />
                    <Text style={styles.featureText}>
                      Prioridad en búsquedas: {getPlanByType(planType)?.features.search_priority === 'top' ? 'Máxima' : 
                        getPlanByType(planType)?.features.search_priority === 'highlighted' ? 'Destacada' : 'Normal'}
                    </Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons name="calendar" size={20} color="#10B981" />
                    <Text style={styles.featureText}>
                      Eventos: {getPlanByType(planType)?.features.events_limit === 'unlimited' ? 'Ilimitados' : 
                        `${getPlanByType(planType)?.features.events_limit} máximo`}
                    </Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons name="document-text" size={20} color="#10B981" />
                    <Text style={styles.featureText}>
                      Posts: {getPlanByType(planType)?.features.posts_limit === 'unlimited' ? 'Ilimitados' : 
                        `${getPlanByType(planType)?.features.posts_limit} máximo`}
                    </Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons 
                      name={getPlanByType(planType)?.features.images_allowed ? "images" : "lock-closed"} 
                      size={20} 
                      color={getPlanByType(planType)?.features.images_allowed ? "#10B981" : "#EF4444"} 
                    />
                    <Text style={styles.featureText}>
                      {getPlanByType(planType)?.features.images_allowed ? 
                        `Imágenes: ${getPlanByType(planType)?.features.bar_images_limit} máximo` : 
                        'Sin imágenes'}
                    </Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons 
                      name={getPlanByType(planType)?.features.analytics ? "analytics" : "close-circle"} 
                      size={20} 
                      color={getPlanByType(planType)?.features.analytics ? "#10B981" : "#A3B3CC"} 
                    />
                    <Text style={styles.featureText}>
                      Analytics: {getPlanByType(planType)?.features.analytics === 'advanced' ? 'Avanzados' : 
                        getPlanByType(planType)?.features.analytics === 'basic' ? 'Básicos' : 'No disponibles'}
                    </Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons 
                      name={getPlanByType(planType)?.features.home_promotion ? "star" : "close-circle"} 
                      size={20} 
                      color={getPlanByType(planType)?.features.home_promotion ? "#10B981" : "#A3B3CC"} 
                    />
                    <Text style={styles.featureText}>
                      Promoción en home: {getPlanByType(planType)?.features.home_promotion ? 'Sí' : 'No'}
                    </Text>
                  </View>
                </View>

                {/* Subscription Details */}
                {subscription && (
                  <View style={styles.subscriptionDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar" size={16} color="#A3B3CC" />
                      <Text style={styles.detailLabel}>Inicio:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(subscription.start_date).toLocaleDateString('es-ES')}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="refresh" size={16} color="#A3B3CC" />
                      <Text style={styles.detailLabel}>Renovación:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(subscription.end_date).toLocaleDateString('es-ES')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Usage Warning */}
                {userBars.length > 0 && planType && (
                  <View style={styles.usageWarning}>
                    <Ionicons name="information-circle" size={20} color="#F59E0B" />
                    <Text style={styles.warningText}>
                      {!getPlanByType(planType)?.features.images_allowed ? 
                        'Tu plan no permite imágenes. Actualiza para añadir fotos a tu bar.' :
                        getPlanByType(planType)?.features.events_limit === 1 || getPlanByType(planType)?.features.posts_limit === 1 ?
                        'Tu plan tiene límites bajos. Considera actualizar para más flexibilidad.' :
                        `Tu plan permite hasta ${getPlanByType(planType)?.features.bar_images_limit} imágenes. ¡Aprovecha al máximo!`
                      }
                    </Text>
                  </View>
                )}

                {/* Plan Actions */}
                <View style={styles.planActions}>
                  <TouchableOpacity 
                    style={styles.upgradeButton} 
                    onPress={handleViewPlans}
                  >
                    <Ionicons name="arrow-up-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.upgradeButtonText}>Cambiar Plan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                {/* Free Plan Display */}
                <View style={styles.planHeader}>
                  <View style={styles.planIconContainer}>
                    <Ionicons name="gift" size={24} color="#A3B3CC" />
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>Plan Gratuito</Text>
                    <Text style={styles.planPrice}>0€/mes</Text>
                  </View>
                  <View style={styles.planStatus}>
                    <View style={[styles.statusBadge, { backgroundColor: '#6B7280' }]}>
                      <Text style={styles.statusText}>GRATUITO</Text>
                    </View>
                  </View>
                </View>

                {/* Free Plan Features */}
                <View style={styles.planFeatures}>
                  <View style={styles.featureRow}>
                    <Ionicons name="search" size={20} color="#A3B3CC" />
                    <Text style={styles.featureText}>Prioridad en búsquedas: Normal</Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons name="calendar" size={20} color="#A3B3CC" />
                    <Text style={styles.featureText}>Eventos: 1 máximo</Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons name="document-text" size={20} color="#A3B3CC" />
                    <Text style={styles.featureText}>Posts: 1 máximo</Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons name="images" size={20} color="#A3B3CC" />
                    <Text style={styles.featureText}>Imágenes: 2 máximo</Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons name="close-circle" size={20} color="#A3B3CC" />
                    <Text style={styles.featureText}>Analytics: No disponibles</Text>
                  </View>
                  
                  <View style={styles.featureRow}>
                    <Ionicons name="close-circle" size={20} color="#A3B3CC" />
                    <Text style={styles.featureText}>Promoción en home: No</Text>
                  </View>
                </View>

                {/* Upgrade CTA */}
                <View style={styles.planActions}>
                  <TouchableOpacity 
                    style={styles.upgradeButton} 
                    onPress={handleViewPlans}
                  >
                    <Ionicons name="rocket" size={20} color="#FFFFFF" />
                    <Text style={styles.upgradeButtonText}>Mejorar Plan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>



        {/* Account Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración de Cuenta</Text>
          <View style={styles.settingsContainer}>
            <SettingsRow title="Editar Perfil" onPress={handleEditProfile} />
            <SettingsRow title="Notificaciones" onPress={handleNotifications} />
            <SettingsRow title="Privacidad" onPress={handlePrivacy} />
            <SettingsRow title="Cerrar Sesión" onPress={handleLogout} isLast />
          </View>
        </View>
      </ScrollView>
      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 140 : 110, // Extra space for BottomTabBar overlap
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
    fontSize: 20,
    fontWeight: '600',
  },
  headerSpacer: {
    flex: 1,
  },
  headerPlanButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  headerPlanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  defaultAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2A3A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  userHandle: {
    color: '#A3B3CC',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  planButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    alignSelf: 'center',
  },
  planButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addBarButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsContainer: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
  },
  settingsRowLast: {
    borderBottomWidth: 0,
  },
  settingsText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  barCard: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
  },
  barImageContainer: {
    marginRight: 16,
  },
  barImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  defaultBarImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#2A3A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewProfileButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '500',
  },
  addAnotherBarButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  addAnotherBarButtonText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  planContainer: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  planIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A3A4A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planPrice: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
  planStatus: {
    marginLeft: 'auto',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    color: '#E5E7EB',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  planActions: {
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionDetails: {
    backgroundColor: '#2A3A4A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 80,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  usageWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningText: {
    color: '#92400E',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  planText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
}); 