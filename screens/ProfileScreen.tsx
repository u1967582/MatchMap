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
import SubscriptionStatus from '~/components/SubscriptionStatus';
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
    router.push('/register-bar/step1' as any);
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
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <TouchableOpacity style={styles.headerPlanButton} onPress={handleViewPlans}>
            <Text style={styles.headerPlanButtonText}>Ver Planes</Text>
          </TouchableOpacity>
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

        {/* Plan Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Actual</Text>
          <View style={styles.planContainer}>
            {hasActiveSubscription && planType ? (
              <View>
                <Text style={styles.planText}>
                  Plan: {getPlanByType(planType)?.name || 'Plan Activo'}
                </Text>
                <Text style={styles.planText}>
                  Precio: {getPlanByType(planType) ? formatPrice(getPlanByType(planType)!) : 'N/A'}
                </Text>
                <Text style={styles.planText}>
                  Fotos máximas: {maxPhotosAllowed}
                </Text>
                <Text style={styles.planText}>
                  Estado: {subscription?.status === 'active' ? 'Activo' : 'En período de prueba'}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.planText}>Plan: Gratuito</Text>
                <Text style={styles.planText}>Fotos máximas: 3</Text>
                <Text style={styles.planText}>Estado: Sin suscripción activa</Text>
              </View>
            )}
          </View>
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
              <TouchableOpacity style={styles.addAnotherBarButton} onPress={handleAddBar}>
                <Ionicons name="add-circle-outline" size={20} color="#10B981" />
                <Text style={styles.addAnotherBarButtonText}>Añadir Otro Bar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBarButton} onPress={handleAddBar}>
              <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
              <Text style={styles.addBarButtonText}>Añadir Bar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Subscription Status Section */}
        {userBars.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado de Suscripción</Text>
            <SubscriptionStatus barId={userBars[0].id} />
          </View>
        )}

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
    backgroundColor: '#0e1b2c',
  },
  scrollView: {
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Space for footer
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
  planText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
}); 