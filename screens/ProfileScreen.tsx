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

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
  profile_image_url?: string;
  is_super_user?: boolean;
}

interface UserBar {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  verification_status?: 'pending' | 'approved' | 'rejected' | null;
  verification_notes?: string | null;
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
  
  // All users are PRO; no subscription gating

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
        .select('full_name, username, profile_image_url, bar_id, is_super_user')
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
        is_super_user: profileData?.is_super_user || false,
      });

      // Fetch user's bars:
      // 1) Prefer users.bar_id (legacy linkage)
      // 2) Fallback to bars.owner_id = auth.uid() (more reliable)
      let barsToShow: UserBar[] = [];

      const formatBar = (barData: any): UserBar => ({
        id: barData.id,
        name: barData.name,
        description: barData.description,
        verification_status: barData.verification_status ?? null,
        verification_notes: barData.verification_notes ?? null,
        image_url:
          barData.bar_images && barData.bar_images.length > 0
            ? barData.bar_images
                .sort((a: any, b: any) => (a.image_order || 0) - (b.image_order || 0))[0]
                ?.image_url
            : undefined,
      });

      if (profileData?.bar_id) {
        const { data: barData, error: barError } = await supabase
          .from('bars')
          .select(
            `
            id,
            name,
            description,
            verification_status,
            verification_notes,
            bar_images(image_url, image_order)
          `,
          )
          .eq('id', profileData.bar_id)
          .single();

        if (barError) {
          console.error('Error fetching user bar by users.bar_id:', barError);
        } else if (barData) {
          barsToShow = [formatBar(barData)];
        }
      }

      if (barsToShow.length === 0) {
        const { data: ownedBars, error: ownedErr } = await supabase
          .from('bars')
          .select(
            `
            id,
            name,
            description,
            verification_status,
            verification_notes,
            bar_images(image_url, image_order)
          `,
          )
          .eq('owner_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (ownedErr) {
          console.error('Error fetching user bars by owner_id:', ownedErr);
        } else if (ownedBars && ownedBars.length > 0) {
          barsToShow = ownedBars.map(formatBar);
        }
      }

      setUserBars(barsToShow);
          
      // Plan info (si hay bar)
      if (barsToShow.length > 0) {
        await getBarPlanInfo(barsToShow[0].id);
          setPlanName('Pro');
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
              router.replace('/');
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

  const handleContactSupport = useCallback(() => {
    router.push('/contact-support' as any);
  }, [router]);

  const handlePrivacy = useCallback(() => {
    router.push('/support' as any);
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

  const handleColdRegisterBar = useCallback(() => {
    router.push('/register-bar/step1?mode=auto_pre_register' as any);
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
                    <View style={styles.barHeaderRow}>
                      <Text style={styles.barName} numberOfLines={1}>
                        {bar.name}
                      </Text>

                      {/* Verification status */}
                      {bar.verification_status ? (
                        <View
                          style={[
                            styles.verificationPill,
                            bar.verification_status === 'approved'
                              ? styles.verificationPillApproved
                              : bar.verification_status === 'rejected'
                                ? styles.verificationPillRejected
                                : styles.verificationPillPending,
                          ]}
                        >
                          <Ionicons
                            name={
                              bar.verification_status === 'approved'
                                ? 'checkmark-circle-outline'
                                : bar.verification_status === 'rejected'
                                  ? 'close-circle-outline'
                                  : 'time-outline'
                            }
                            size={13}
                            color={
                              bar.verification_status === 'approved'
                                ? '#10B981'
                                : bar.verification_status === 'rejected'
                                  ? '#EF4444'
                                  : '#FFD700'
                            }
                          />
                          <Text
                            style={[
                              styles.verificationPillText,
                              bar.verification_status === 'approved'
                                ? styles.verificationPillTextApproved
                                : bar.verification_status === 'rejected'
                                  ? styles.verificationPillTextRejected
                                  : styles.verificationPillTextPending,
                            ]}
                          >
                            {bar.verification_status === 'approved'
                              ? 'Verificado'
                              : bar.verification_status === 'rejected'
                                ? 'Rechazado'
                                : 'Pendiente'}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {bar.verification_status === 'pending' ? (
                      <Text style={styles.verificationHint}>
                        Tu bar aparecerá en el mapa cuando lo aprobemos.
                      </Text>
                    ) : null}

                    {bar.verification_status === 'rejected' ? (
                      <Text style={styles.verificationHint}>
                        Revisa el motivo y actualiza la información.
                      </Text>
                    ) : null}

                    {bar.verification_status === 'rejected' && bar.verification_notes ? (
                      <View style={styles.verificationNotesBox}>
                        <Ionicons name="information-circle-outline" size={14} color="#A3B3CC" />
                        <Text style={styles.verificationNotesText}>{bar.verification_notes}</Text>
                      </View>
                    ) : null}

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

        {/* Super User - Cold Registration Section */}
        {user?.is_super_user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Super Usuario</Text>
            <TouchableOpacity 
              style={styles.coldRegisterButton} 
              onPress={handleColdRegisterBar}
              activeOpacity={0.8}
            >
              <Ionicons name="business-outline" size={24} color="#1976D2" />
              <Text style={styles.coldRegisterButtonText}>Registrar Bar en Frío</Text>
              <Text style={styles.coldRegisterSubtext}>
                Pre-registra un bar para que su propietario lo reclame después
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.coldRegisterButton, styles.verifyBarsButton]} 
              onPress={() => router.push('/bar-verification-admin' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark-outline" size={24} color="#10B981" />
              <Text style={styles.coldRegisterButtonText}>Verificar Bares</Text>
              <Text style={styles.coldRegisterSubtext}>
                Aprobar o rechazar bares pendientes de verificación
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.coldRegisterButton, styles.supportTicketsButton]} 
              onPress={() => router.push('/support-admin' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles-outline" size={24} color="#F59E0B" />
              <Text style={styles.coldRegisterButtonText}>Gestionar Tickets de Soporte</Text>
              <Text style={styles.coldRegisterSubtext}>
                Ver y responder tickets de usuarios
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan Information Section */}
        {/* Plan section removed: all users are PRO now */}



        {/* Account Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración de Cuenta</Text>
          <View style={styles.settingsContainer}>
            <SettingsRow title="Editar Perfil" onPress={handleEditProfile} />
            <SettingsRow title="Preguntas Frequentes" onPress={handlePrivacy} />
            <SettingsRow title="Soporte y Tickets" onPress={handleContactSupport} />
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
  barHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
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
  coldRegisterButton: {
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1976D2',
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  coldRegisterButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  coldRegisterSubtext: {
    color: '#E5E7EB',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  supportTicketsButton: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    marginTop: 12,
  },
  verifyBarsButton: {
    marginTop: 12,
    borderColor: '#10B981',
    shadowColor: '#10B981',
  },
  verificationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  verificationPillPending: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  verificationPillApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  verificationPillRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  verificationPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  verificationPillTextPending: {
    color: '#FFD700',
  },
  verificationPillTextApproved: {
    color: '#10B981',
  },
  verificationPillTextRejected: {
    color: '#EF4444',
  },
  verificationHint: {
    marginBottom: 8,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    lineHeight: 16,
  },
  verificationNotesBox: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  verificationNotesText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
}); 