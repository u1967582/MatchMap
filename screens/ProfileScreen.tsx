import { useState, useEffect, useCallback } from 'react';
import {
  View,
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
import { AppText, colors, spacing, ProfileSkeleton } from '~/components/ds';

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
    <AppText variant="body" color={colors.text.primary}>{title}</AppText>
    <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
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
        <ProfileSkeleton />
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
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText variant="title">Perfil</AppText>
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
          <AppText variant="h2">{displayName}</AppText>
          <AppText variant="body" color={colors.text.secondary} style={styles.userHandleSpacing}>{displayHandle}</AppText>
        </View>

        {/* Bar Management Section */}
        <View style={styles.section}>
          <AppText variant="title" style={styles.sectionTitleSpacing}>Gestiona tu Bar</AppText>
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
                        <Ionicons name="storefront" size={32} color={colors.text.secondary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.barInfo}>
                    <View style={styles.barHeaderRow}>
                      <AppText variant="subtitle" numberOfLines={1} style={styles.barNameFlex}>
                        {bar.name}
                      </AppText>

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
                                ? colors.status.success
                                : bar.verification_status === 'rejected'
                                  ? colors.status.error
                                  : colors.status.boost
                            }
                          />
                          <AppText
                            variant="caption"
                            color={
                              bar.verification_status === 'approved'
                                ? colors.status.success
                                : bar.verification_status === 'rejected'
                                  ? colors.status.error
                                  : colors.status.boost
                            }
                            style={styles.verificationPillTextBold}
                          >
                            {bar.verification_status === 'approved'
                              ? 'Verificado'
                              : bar.verification_status === 'rejected'
                                ? 'Rechazado'
                                : 'Pendiente'}
                          </AppText>
                        </View>
                      ) : null}
                    </View>

                    {bar.verification_status === 'pending' ? (
                      <AppText variant="caption" color={colors.text.muted} style={styles.verificationHintSpacing}>
                        Tu bar aparecerá en el mapa cuando lo aprobemos.
                      </AppText>
                    ) : null}

                    {bar.verification_status === 'rejected' ? (
                      <AppText variant="caption" color={colors.text.muted} style={styles.verificationHintSpacing}>
                        Revisa el motivo y actualiza la información.
                      </AppText>
                    ) : null}

                    {bar.verification_status === 'rejected' && bar.verification_notes ? (
                      <View style={styles.verificationNotesBox}>
                        <Ionicons name="information-circle-outline" size={14} color={colors.text.secondary} />
                        <AppText variant="caption" color={colors.text.secondary} style={styles.verificationNotesFlex}>{bar.verification_notes}</AppText>
                      </View>
                    ) : null}

                    <View style={styles.viewProfileButton}>
                      <AppText variant="label" color={colors.brand.primary}>Ver Perfil del Bar</AppText>
                      <Ionicons name="chevron-forward" size={16} color={colors.brand.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={styles.addBarButton} onPress={handleAddBar}>
              <Ionicons name="add-circle-outline" size={24} color={colors.text.primary} />
              <AppText variant="body" color={colors.text.primary} style={styles.addBarButtonTextBold}>Añadir Bar</AppText>
            </TouchableOpacity>
          )}
        </View>

        {/* Super User - Admin Dashboard */}
        {user?.is_super_user && (
          <View style={styles.section}>
            <AppText variant="title" style={styles.sectionTitleSpacing}>Super Usuario</AppText>

            {/* Gestión de Bares */}
            <View style={styles.adminCategory}>
              <AppText variant="subtitle" color={colors.text.secondary} style={styles.adminCategoryTitle}>
                Gestión de Bares
              </AppText>

              <TouchableOpacity
                style={styles.adminButton}
                onPress={handleColdRegisterBar}
                activeOpacity={0.8}
              >
                <View style={[styles.adminButtonIcon, styles.adminButtonIconBlue]}>
                  <Ionicons name="business-outline" size={24} color={colors.brand.primary} />
                </View>
                <View style={styles.adminButtonContent}>
                  <AppText variant="body" color={colors.text.primary} style={styles.adminButtonTitle}>
                    Registrar Bar en Frío
                  </AppText>
                  <AppText variant="caption" color={colors.text.secondary} style={styles.adminButtonSubtitle}>
                    Pre-registra un bar para que su propietario lo reclame después
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => router.push('/bar-verification-admin' as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.adminButtonIcon, styles.adminButtonIconGreen]}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={colors.status.success} />
                </View>
                <View style={styles.adminButtonContent}>
                  <AppText variant="body" color={colors.text.primary} style={styles.adminButtonTitle}>
                    Verificar Bares
                  </AppText>
                  <AppText variant="caption" color={colors.text.secondary} style={styles.adminButtonSubtitle}>
                    Aprobar o rechazar bares pendientes de verificación
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            {/* Soporte */}
            <View style={styles.adminCategory}>
              <AppText variant="subtitle" color={colors.text.secondary} style={styles.adminCategoryTitle}>
                Soporte
              </AppText>

              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => router.push('/support-admin' as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.adminButtonIcon, styles.adminButtonIconOrange]}>
                  <Ionicons name="chatbubbles-outline" size={24} color={colors.status.warning} />
                </View>
                <View style={styles.adminButtonContent}>
                  <AppText variant="body" color={colors.text.primary} style={styles.adminButtonTitle}>
                    Gestionar Tickets
                  </AppText>
                  <AppText variant="caption" color={colors.text.secondary} style={styles.adminButtonSubtitle}>
                    Ver y responder tickets de usuarios
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            {/* Automatización */}
            <View style={styles.adminCategory}>
              <AppText variant="subtitle" color={colors.text.secondary} style={styles.adminCategoryTitle}>
                Automatización
              </AppText>

              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => router.push('/admin-select-bar-auto-broadcasts' as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.adminButtonIcon, styles.adminButtonIconPurple]}>
                  <Ionicons name="settings-outline" size={24} color={colors.brand.link} />
                </View>
                <View style={styles.adminButtonContent}>
                  <AppText variant="body" color={colors.text.primary} style={styles.adminButtonTitle}>
                    Automatizar Partidos
                  </AppText>
                  <AppText variant="caption" color={colors.text.secondary} style={styles.adminButtonSubtitle}>
                    Configurar automatización de partidos para cualquier bar
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => router.push('/admin-gift-boost' as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.adminButtonIcon, styles.adminButtonIconBoost]}>
                  <Ionicons name="flash-outline" size={24} color={colors.status.boost} />
                </View>
                <View style={styles.adminButtonContent}>
                  <AppText variant="body" color={colors.text.primary} style={styles.adminButtonTitle}>
                    Regalar Boost
                  </AppText>
                  <AppText variant="caption" color={colors.text.secondary} style={styles.adminButtonSubtitle}>
                    Activar boost de visibilidad en el mapa para cualquier bar
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Plan Information Section */}
        {/* Plan section removed: all users are PRO now */}


        {/* Account Settings Section */}
        <View style={styles.section}>
          <AppText variant="title" style={styles.sectionTitleSpacing}>Configuración de Cuenta</AppText>
          <View style={styles.settingsContainer}>
            <SettingsRow title="Editar Perfil" onPress={handleEditProfile} />
            <SettingsRow title="Preguntas Frequentes" onPress={handlePrivacy} />
            {userBars.length > 0 && (
              <SettingsRow title="Soporte y Tickets" onPress={handleContactSupport} />
            )}
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
    backgroundColor: colors.bg.primary,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerSpacer: {
    flex: 1,
  },
  headerPlanButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
  },
  headerPlanButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  avatarContainer: {
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  userHandleSpacing: {
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  sectionTitleSpacing: {
    marginBottom: spacing.lg,
  },
  planButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    borderRadius: spacing.xxl,
    alignItems: 'center',
    alignSelf: 'center',
  },
  planButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  addBarButton: {
    backgroundColor: colors.status.success,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addBarButtonTextBold: {
    fontWeight: '600',
  },
  settingsContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: spacing.md,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.elevated,
  },
  settingsRowLast: {
    borderBottomWidth: 0,
  },
  barCard: {
    backgroundColor: colors.bg.card,
    borderRadius: spacing.md,
    padding: spacing.lg,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  barImageContainer: {
    marginRight: spacing.lg,
  },
  barImage: {
    width: 60,
    height: 60,
    borderRadius: spacing.sm,
  },
  defaultBarImage: {
    width: 60,
    height: 60,
    borderRadius: spacing.sm,
    backgroundColor: colors.bg.elevated,
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
  barNameFlex: {
    flex: 1,
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addAnotherBarButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.status.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addAnotherBarButtonText: {
    color: colors.status.success,
    fontSize: 14,
    fontWeight: '500',
  },
  planContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  planIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  planPrice: {
    color: colors.status.success,
    fontSize: 16,
    fontWeight: '600',
  },
  planStatus: {
    marginLeft: 'auto',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.lg,
  },
  statusText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  planFeatures: {
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featureText: {
    color: colors.text.light,
    fontSize: 14,
    marginLeft: spacing.md,
    flex: 1,
  },
  planActions: {
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: colors.status.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: spacing.sm,
    gap: spacing.sm,
  },
  upgradeButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionDetails: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.sm,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
    minWidth: 80,
  },
  detailValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  usageWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: colors.status.warning,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningText: {
    color: '#92400E',
    fontSize: 13,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  planText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  coldRegisterButton: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.md,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  coldRegisterButtonTextBold: {
    fontWeight: '700',
    marginTop: 4,
  },
  coldRegisterSubtextSpacing: {
    marginTop: 4,
    lineHeight: 18,
  },
  supportTicketsButton: {
    borderColor: colors.status.warning,
    shadowColor: colors.status.warning,
    marginTop: spacing.md,
  },
  verifyBarsButton: {
    marginTop: spacing.md,
    borderColor: colors.status.success,
    shadowColor: colors.status.success,
  },
  autoMatchesButton: {
    marginTop: spacing.md,
    borderColor: colors.brand.link,
    shadowColor: colors.brand.link,
  },
  adminCategory: {
    marginTop: spacing.lg,
  },
  adminCategoryTitle: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  adminButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  adminButtonIconBlue: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
  },
  adminButtonIconGreen: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  adminButtonIconOrange: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
  },
  adminButtonIconPurple: {
    backgroundColor: 'rgba(88, 86, 214, 0.15)',
  },
  adminButtonIconBoost: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  adminButtonContent: {
    flex: 1,
  },
  adminButtonTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  adminButtonSubtitle: {
    lineHeight: 16,
  },
  verificationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  verificationPillTextBold: {
    fontWeight: '800',
  },
  verificationHintSpacing: {
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  verificationNotesBox: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  verificationNotesFlex: {
    flex: 1,
    lineHeight: 16,
  },
}); 