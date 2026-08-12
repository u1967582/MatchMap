import { View, StyleSheet, TouchableOpacity, Image, FlatList, Dimensions, Alert, Clipboard, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import Gradient from '~/components/ui/Gradient';
import { supabase } from '~/utils/supabase';
import { getIsGuest, showGuestLoginAlert } from '~/utils/auth';
import BottomTabBar from '~/components/ui/BottomTabBar';
import BarReviewsSection from '~/components/BarReviewsSection';
import BoostCountdown from '~/components/boost/BoostCountdown';
import BoostPaywallSheet from '~/components/boost/BoostPaywallSheet';
import { useBarBoost } from '~/hooks/useBoostBars';
import { AppText, colors, spacing, radius, BarProfileSkeleton, toast } from '~/components/ds';
import { useFavoritesStore } from '~/stores/favoritesStore';
import AdBanner from '~/components/ads/AdBanner';
// Plans removed: all bars are PRO

interface BarProfile {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  phone?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  owner_id: string | null;
  images: string[];
  category?: { id: number; name: string };
  bar_food_types?: { food_type_id: number; food_type: { name: string } }[];
  bar_selected_tv_features?: { tv_feature_id: number; tv_feature: { name: string } }[];
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

  // Store de favoritos (actualizaciones optimistas)
  const isFavorite = useFavoritesStore(state => state.isFavorite);
  const toggleFavorite = useFavoritesStore(state => state.toggleFavorite);

  const [bar, setBar] = useState<BarProfile | null>(null);
  const [posts, setPosts] = useState<BarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [canShowMenuButton, setCanShowMenuButton] = useState<boolean>(true);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [verificationNotes, setVerificationNotes] = useState<string | null>(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState<{ title: string; content: any; actionLabel?: string; onAction?: () => void }>({ title: '', content: null });
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);

  // Ref para scroll programático al FlatList
  const flatListRef = useRef<FlatList>(null);

  // Get boost status for countdown
  const { boost, isLoading: boostLoading, refresh: refreshBoost } = useBarBoost(barId);

  // Functions to show info modals
  const showManualMatchInfo = () => {
    setInfoModalContent({
      title: 'Añadir Partido Manualmente',
      content: (
        <View>
          <AppText variant="body" color={colors.text.light}>
            Esta opción te permite seleccionar y añadir partidos específicos que quieras retransmitir en tu bar.
          </AppText>
          <AppText variant="body" color={colors.text.light} style={{ marginTop: spacing.md }}>
            Ideal para cuando tienes eventos especiales o partidos concretos que sabes que tus clientes quieren ver.
          </AppText>
        </View>
      ),
    });
    setInfoModalVisible(true);
  };

  const showAutoMatchInfo = () => {
    setInfoModalContent({
      title: 'Automatizar Retransmisiones',
      content: (
        <View>
          <AppText variant="body" color={colors.text.light}>
            Configura tus equipos y competiciones favoritas para que automáticamente se añadan todos sus partidos a tu calendario de retransmisiones.
          </AppText>
          <AppText variant="body" color={colors.text.light} style={{ marginTop: spacing.md }}>
            ¡Ahorra tiempo! Una vez configurado, no tendrás que añadir partidos manualmente.
          </AppText>
        </View>
      ),
    });
    setInfoModalVisible(true);
  };

  const showBoostInfo = () => {
    setInfoModalContent({
      title: '⚡ Boost de Visibilidad',
      content: (
        <View>
          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
              <Ionicons name="arrow-up-circle" size={22} color="#4ADE80" />
            </View>
            <View style={styles.benefitContent}>
              <AppText variant="label" color={colors.text.primary}>Apareces primero</AppText>
              <AppText variant="caption" color={colors.text.secondary}>Tu bar sale antes que la competencia en el mapa y búsquedas</AppText>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: 'rgba(255,215,0,0.12)' }]}>
              <Ionicons name="star" size={22} color={colors.status.boost} />
            </View>
            <View style={styles.benefitContent}>
              <AppText variant="label" color={colors.text.primary}>Badge destacado</AppText>
              <AppText variant="caption" color={colors.text.secondary}>Etiqueta visible que llama la atención de los usuarios</AppText>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
              <Ionicons name="people" size={22} color="#60A5FA" />
            </View>
            <View style={styles.benefitContent}>
              <AppText variant="label" color={colors.text.primary}>Más clientes los días de partido</AppText>
              <AppText variant="caption" color={colors.text.secondary}>Capta aficionados que buscan bar en tiempo real</AppText>
            </View>
          </View>

          <View style={styles.boostRoiCard}>
            <Ionicons name="trending-up" size={14} color="#4ADE80" />
            <View style={styles.boostRoiText}>
              <AppText variant="caption" color={colors.text.secondary}>Cada cliente gasta ~13€ de media</AppText>
              <AppText variant="caption" color={colors.text.secondary}>Desde 19,99€</AppText>
              <AppText variant="caption" color={colors.text.secondary}>Sin suscripción</AppText>
            </View>
          </View>
        </View>
      ),
      actionLabel: 'Ver planes y precios',
      onAction: () => {
        setInfoModalVisible(false);
        setPaywallVisible(true);
      },
    });
    setInfoModalVisible(true);
  };

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

  const copyWebsite = () => {
    if (bar?.website) {
      copyToClipboard(bar.website, 'Sitio web');
    }
  };

  // Create sections for FlatList
  const sections = [
    { type: 'header', key: 'header' },
    { type: 'images', key: 'images' },
    { type: 'ad', key: 'ad-top' },
    { type: 'nav', key: 'nav' },
    { type: 'matches', key: 'matches' },
    { type: 'upcoming-matches', key: 'upcoming-matches' },
    { type: 'info', key: 'info' },
    { type: 'tags', key: 'tags' },
    { type: 'menu', key: 'menu' },
    { type: 'posts', key: 'posts' },
    { type: 'reviews', key: 'reviews' },
    { type: 'danger', key: 'danger' },
    { type: 'unclaimed-actions', key: 'unclaimed-actions' },
  ];

  const renderSection = ({ item }: { item: { type: string; key: string } }) => {
    switch (item.type) {
      case 'ad':
        return <AdBanner placement="bar-profile-top" />;
      case 'header':
        return (
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <AppText variant="h2" align="center">{bar?.name}</AppText>
              {isOwner && verificationStatus ? (
                <View
                  style={[
                    styles.verificationPill,
                    verificationStatus === 'approved'
                      ? styles.verificationPillApproved
                      : verificationStatus === 'rejected'
                        ? styles.verificationPillRejected
                        : styles.verificationPillPending,
                  ]}
                >
                  <Ionicons
                    name={
                      verificationStatus === 'approved'
                        ? 'checkmark-circle-outline'
                        : verificationStatus === 'rejected'
                          ? 'close-circle-outline'
                          : 'time-outline'
                    }
                    size={14}
                    color={
                      verificationStatus === 'approved'
                        ? colors.status.success
                        : verificationStatus === 'rejected'
                          ? colors.status.error
                          : colors.status.boost
                    }
                  />
                  <AppText
                    variant="caption"
                    color={
                      verificationStatus === 'approved'
                        ? colors.status.success
                        : verificationStatus === 'rejected'
                          ? colors.status.error
                          : colors.status.boost
                    }
                    style={styles.verificationPillTextBold}
                  >
                    {verificationStatus === 'approved'
                      ? 'Verificado'
                      : verificationStatus === 'rejected'
                        ? 'Rechazado'
                        : 'Pendiente de verificación'}
                  </AppText>
                </View>
              ) : null}

              {isOwner && verificationStatus === 'rejected' && verificationNotes ? (
                <View style={styles.verificationNotesBox}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.text.secondary} />
                  <AppText variant="caption" color={colors.text.secondary} style={styles.verificationNotesFlex}>{verificationNotes}</AppText>
                </View>
              ) : null}
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
                    style={[styles.favoritesButton, barId && isFavorite(barId) && styles.favoritesButtonActive]}
                    onPress={handleFavoriteToggle}
                  >
                    <Ionicons
                      name={barId && isFavorite(barId) ? "heart" : "heart-outline"}
                      size={20}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.defaultImageContainer}>
                <Ionicons name="storefront" size={64} color={colors.text.secondary} />
                <AppText variant="body" color={colors.text.secondary} style={styles.noImagesTextSpacing}>No hay imágenes disponibles</AppText>
              </View>
            )}

                {isOwner && (
              <TouchableOpacity style={styles.editButton} onPress={handleEditInfo}>
                <Ionicons name="create-outline" size={16} color={colors.text.primary} />
                <AppText variant="label" color={colors.text.primary}>Editar información</AppText>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'nav': {
        const navItems = [
          ...(isOwner ? [{
            key: 'matches',
            label: 'Gestión',
            icon: '⚽',
            color: colors.brand.link,
          }] : []),
          {
            key: 'upcoming-matches',
            label: 'Partidos',
            icon: '📺',
            color: colors.tags.tv,
          },
          {
            key: 'info',
            label: 'Info',
            icon: '📝',
            color: colors.tags.category,
          },
          ...(canShowMenuButton ? [{
            key: 'menu',
            label: 'Carta',
            icon: '🍽️',
            color: colors.tags.food,
          }] : []),
          {
            key: 'posts',
            label: 'Posts',
            icon: '📰',
            color: colors.tags.feature,
          },
          {
            key: 'reviews',
            label: 'Reseñas',
            icon: '⭐',
            color: '#C89B30',
          },
        ];

        return (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.navScrollContent}
            style={styles.navSection}
          >
            {navItems.map(navItem => (
              <TouchableOpacity
                key={navItem.key}
                style={[styles.navChip, { backgroundColor: navItem.color }]}
                onPress={() => {
                  const target = sections.find(s => s.key === navItem.key);
                  if (target) {
                    flatListRef.current?.scrollToItem({ item: target, animated: true });
                  }
                }}
                activeOpacity={0.75}
              >
                <AppText variant="label" color={colors.text.primary}>
                  {navItem.icon} {navItem.label}
                </AppText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );
      }

      case 'info':
        return (
          <View style={styles.infoSection}>
            <AppText variant="title" style={styles.sectionTitleSpacing}>📝 Información del Bar</AppText>

            {bar?.description && (
              <View style={styles.infoItem}>
                <Ionicons name="information-circle-outline" size={20} color={colors.text.secondary} />
                <View style={styles.infoContent}>
                  <AppText variant="label" color={colors.text.secondary}>Descripción</AppText>
                  <AppText variant="body" color={colors.text.primary}>{bar.description}</AppText>
                </View>
              </View>
            )}

            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={20} color={colors.text.secondary} />
              <View style={styles.infoContent}>
                <AppText variant="label" color={colors.text.secondary}>Dirección</AppText>
                <AppText variant="body" color={colors.text.primary}>{bar?.address}, {bar?.city}</AppText>
              </View>
              <TouchableOpacity style={styles.copyButton} onPress={copyAddress}>
                <Ionicons name="copy-outline" size={18} color={colors.brand.link} />
              </TouchableOpacity>
            </View>

            {bar?.phone && (
              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={20} color={colors.text.secondary} />
                <View style={styles.infoContent}>
                  <AppText variant="label" color={colors.text.secondary}>Teléfono</AppText>
                  <AppText variant="body" color={colors.text.primary}>{bar.phone}</AppText>
                </View>
                <TouchableOpacity style={styles.copyButton} onPress={copyPhone}>
                  <Ionicons name="copy-outline" size={18} color={colors.brand.link} />
                </TouchableOpacity>
              </View>
            )}

            {bar?.website && (
              <View style={styles.infoItem}>
                <Ionicons name="globe-outline" size={20} color={colors.text.secondary} />
                <View style={styles.infoContent}>
                  <AppText variant="label" color={colors.text.secondary}>Sitio Web</AppText>
                  <AppText variant="body" color={colors.text.primary}>{bar.website}</AppText>
                </View>
                <TouchableOpacity style={styles.copyButton} onPress={copyWebsite}>
                  <Ionicons name="copy-outline" size={18} color={colors.brand.link} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case 'tags':
        return (
          (bar?.category || (bar?.bar_food_types?.length ?? 0) > 0 || (bar?.bar_selected_tv_features?.length ?? 0) > 0 || (bar?.bar_selected_features?.length ?? 0) > 0) ? (
            <View style={styles.tagsSection}>
              <FlatList
                data={[
                  ...(bar?.category ? [{ type: 'category', data: bar.category, id: 'category' }] : []),
                  ...(bar?.bar_food_types?.map((item) => ({ type: 'food', data: item, id: `food-${item.food_type_id}` })) || []),
                  ...(bar?.bar_selected_tv_features?.map((item) => ({ type: 'tv_feature', data: item, id: `tv-${item.tv_feature_id}` })) || []),
                  ...(bar?.bar_selected_features?.map((item) => ({ type: 'feature', data: item, id: `feature-${item.feature_id}` })) || [])
                ]}
                renderItem={({ item }) => {
                  let backgroundColor = '#1976D2';
                  let icon = '📂';
                  let text = '';
                  
                  switch (item.type) {
                    case 'category':
                      backgroundColor = colors.tags.category;
                      icon = '📂';
                      text = (item.data as { name: string }).name;
                      break;
                    case 'food':
                      backgroundColor = colors.tags.food;
                      icon = '🍽️';
                      text = (item.data as { food_type: { name: string } }).food_type.name;
                      break;
                    case 'tv_feature':
                      backgroundColor = colors.tags.tv;
                      icon = '📺';
                      text = (item.data as { tv_feature: { name: string } }).tv_feature.name;
                      break;
                    case 'feature':
                      backgroundColor = colors.tags.feature;
                      icon = '✨';
                      text = (item.data as { feature: { name: string } }).feature.name;
                      break;
                  }

                  return (
                    <View style={[styles.tag, { backgroundColor }]}>
                      <AppText variant="label" color={colors.text.primary}>{icon} {text}</AppText>
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
              <AppText variant="subtitle" style={styles.menuSectionTitleSpacing}>🍽️ La Carta</AppText>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => router.push(`/bar-menu/${barId}` as any)}
              >
                <AppText variant="label" color={colors.text.primary}>Ver Carta</AppText>
              </TouchableOpacity>
            </View>
          ) : null
        );

      case 'posts':
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="title">📰 Posts</AppText>
            {isOwner && (
                <TouchableOpacity style={styles.createPostButton} onPress={handleCreatePost}>
                  <Ionicons name="add" size={16} color={colors.text.primary} />
                  <AppText variant="label" color={colors.text.primary}>Crear Post</AppText>
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
                <Ionicons name="document-text-outline" size={48} color={colors.text.secondary} />
                <AppText variant="subtitle" color={colors.text.primary} style={styles.noPostsTextSpacing}>No hay posts disponibles</AppText>
                <AppText variant="body" color={colors.text.secondary} align="center" style={styles.noPostsSubtextSpacing}>
                  {isOwner ? 'Crea tu primer post para compartir novedades' : 'Este bar aún no ha publicado nada'}
                </AppText>
              </View>
            )}

            {/* CTA para reseña se muestra únicamente dentro del bloque de Reseñas */}
          </View>
        );

      case 'reviews':
        return (
              <View style={styles.section}>
            <AppText variant="title" style={styles.sectionTitleSpacing}>⭐ Reseñas</AppText>
            {/* Siempre mostrar BarReviewsSection - maneja el caso sin reseñas internamente */}
              <BarReviewsSection key={`reviews-${reviewsRefreshKey}`} barId={barId} showHeader title="Reseñas" />
          </View>
        );

      case 'matches':
        return (
          isOwner ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="title">⚽ Gestión de Partidos</AppText>
              </View>

              <View style={styles.matchesContainer}>
                {/* Añadir partido manualmente */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.barActionButton}
                    onPress={() => router.push(`/manual-match-selection/${barId}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.barActionIcon, styles.barActionIconBlue]}>
                      <Ionicons name="calendar-outline" size={18} color={colors.brand.primary} />
                    </View>
                    <View style={styles.barActionContent}>
                      <AppText variant="body" color={colors.text.primary} style={styles.barActionTitle}>
                        Añadir partido manualmente
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={showManualMatchInfo}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="information-circle-outline" size={20} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>

                {/* Automatizar retransmisiones */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.barActionButton}
                    onPress={() => router.push(`/auto-broadcasts/${barId}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.barActionIcon, styles.barActionIconPurple]}>
                      <Ionicons name="settings-outline" size={18} color={colors.brand.link} />
                    </View>
                    <View style={styles.barActionContent}>
                      <AppText variant="body" color={colors.text.primary} style={styles.barActionTitle}>
                        Automatizar retransmisiones
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={showAutoMatchInfo}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="information-circle-outline" size={20} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>

                {/* Aumentar la visibilidad */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.barActionButton}
                    onPress={() => setPaywallVisible(true)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.barActionIcon, styles.barActionIconBoost]}>
                      <Ionicons name="flash" size={18} color={colors.status.boost} />
                    </View>
                    <View style={styles.barActionContent}>
                      <AppText variant="body" color={colors.text.primary} style={styles.barActionTitle}>
                        Aumenta la visibilidad de tu bar
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={showBoostInfo}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="information-circle-outline" size={20} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>

                {/* Boost Countdown - shown when boost is active */}
                {boost?.isActive && boost?.endAt && (
                  <BoostCountdown endAt={boost.endAt} style={{ marginTop: spacing.md }} />
                )}
              </View>
            </View>
          ) : null
        );

      case 'upcoming-matches':
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="title">📺 Próximos partidos</AppText>
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
                        <AppText variant="body" color={colors.text.primary} align="center" numberOfLines={2}>
                          {match.home_team_name}
                        </AppText>
                      </View>

                      <View style={styles.upcomingVsContainer}>
                        <AppText variant="body" color={colors.text.secondary}>VS</AppText>
                      </View>

                      <View style={styles.upcomingTeamContainer}>
                        <Image
                          source={{
                            uri: match.away_team_logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${match.away_team_id}.png`
                          }}
                          style={styles.upcomingTeamLogo}
                          defaultSource={require('~/assets/icon.png')}
                        />
                        <AppText variant="body" color={colors.text.primary} align="center" numberOfLines={2}>
                          {match.away_team_name}
                        </AppText>
                      </View>
                    </View>



                    <AppText variant="body" color={colors.brand.accent} align="center" style={styles.upcomingMatchTimeSpacing}>
                      {new Date(`${match.date} ${match.time}`).toLocaleString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </AppText>

                    <AppText variant="caption" color={colors.text.secondary} align="center">
                      {match.competition_name}
                    </AppText>
                    
                    {isOwner && (
                      <TouchableOpacity
                        style={styles.deleteMatchButton}
                        onPress={() => handleDeleteMatch(match.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.status.destructive} />
                        <AppText variant="caption" color={colors.status.destructive}>Eliminar</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyUpcomingMatches}>
                <AppText variant="body" color={colors.text.muted} align="center" style={styles.emptyUpcomingMatchesTextItalic}>
                  Este bar no tiene retransmisiones programadas actualmente
                </AppText>
              </View>
            )}
          </View>
        );

      case 'danger':
        return (
          isOwner ? (
            <View style={styles.dangerSection}>
              <TouchableOpacity style={styles.deleteBarButton} onPress={handleDeleteBar}>
                <Ionicons name="trash-outline" size={20} color={colors.status.destructive} />
                <AppText variant="body" color={colors.status.destructive} style={styles.deleteBarButtonTextMedium}>Eliminar Bar</AppText>
              </TouchableOpacity>
            </View>
          ) : null
        );

      case 'unclaimed-actions':
        return (
          !isOwner && bar?.owner_id === null ? (
            <View style={styles.unclaimedActionsRow}>
              <TouchableOpacity style={styles.reportButton} onPress={handleReportBar}>
                <Ionicons name="flag-outline" size={14} color={colors.text.secondary} />
                <AppText variant="label" color={colors.text.secondary}>Reportar información</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.claimButton} onPress={handleClaimBar}>
                <Ionicons name="storefront-outline" size={14} color={colors.brand.link} />
                <AppText variant="label" color={colors.brand.link}>¿Eres el propietario?</AppText>
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
      // Round 1: auth + bar data con joins anidados en paralelo
      const [
        { data: { user: authUser } },
        { data: barData, error: barError },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('bars')
          .select(`
            id,
            name,
            description,
            address,
            city,
            phone,
            website,
            latitude,
            longitude,
            owner_id,
            bar_images(image_url, image_order),
            bar_categories(id, name),
            bar_food_types(food_type_id, food_types(name)),
            bar_selected_tv_features(tv_feature_id, bar_tv_features(name)),
            bar_selected_features(feature_id, bar_features(name)),
            verification_status,
            verification_notes
          `)
          .eq('id', barId)
          .single(),
      ]);

      setUser(authUser);

      if (barError) {
        console.error('Error fetching bar:', barError);
        Alert.alert('Error', 'No se pudo cargar la información del bar');
        return;
      }

      if (barData) {
        setVerificationStatus((barData as any).verification_status || null);
        setVerificationNotes((barData as any).verification_notes || null);
        setCanShowMenuButton(true);

        // Procesar joins directos (patrón Map.tsx)
        const categoryRaw = Array.isArray((barData as any).bar_categories)
          ? (barData as any).bar_categories[0]
          : (barData as any).bar_categories;
        const category = categoryRaw
          ? { id: categoryRaw.id, name: categoryRaw.name }
          : undefined;

        setBar({
          id: barData.id,
          name: barData.name,
          description: barData.description,
          address: barData.address,
          city: barData.city,
          phone: barData.phone,
          website: barData.website,
          latitude: (barData as any).latitude,
          longitude: (barData as any).longitude,
          owner_id: (barData as any).owner_id ?? null,
          images: (barData as any).bar_images
            ?.sort((a: any, b: any) => (a.image_order || 0) - (b.image_order || 0))
            .map((img: any) => img.image_url) || [],
          category,
          bar_food_types: ((barData as any).bar_food_types || []).map((item: any) => ({
            food_type_id: item.food_type_id,
            food_type: { name: item.food_types?.name || 'Unknown' },
          })),
          bar_selected_tv_features: ((barData as any).bar_selected_tv_features || []).map((item: any) => ({
            tv_feature_id: item.tv_feature_id,
            tv_feature: { name: item.bar_tv_features?.name || 'Unknown' },
          })),
          bar_selected_features: ((barData as any).bar_selected_features || []).map((item: any) => ({
            feature_id: item.feature_id,
            feature: { name: item.bar_features?.name || 'Unknown' },
          })),
        });

        // Round 2: ownership primer, després posts + matches
        const ownerResult = authUser
          ? await supabase.from('users').select('bar_id, is_super_user').eq('id', authUser.id).single()
          : { data: null, error: null };

        const ownerCheck = !!(authUser && ownerResult.data && (ownerResult.data as any).bar_id === barData.id);
        setIsOwner(ownerCheck);

        await Promise.all([
          fetchBarPosts(barData.id, authUser, ownerCheck),
          fetchUpcomingMatches(barData.id),
        ]);
      }

    } catch (error) {
      console.error('Error in fetchBarProfile:', error);
      Alert.alert('Error', 'Ocurrió un error al cargar el perfil del bar');
    } finally {
      setLoading(false);
    }
  }, [barId, fetchBarPosts, fetchUpcomingMatches]);

  const fetchBarPosts = useCallback(async (barId: string, authUser: any, isOwnerCheck: boolean) => {
    try {
      let query = supabase
        .from('bar_posts')
        .select('*')
        .eq('bar_id', barId);

      // If not the owner, only show active posts within valid date range
      if (!authUser || !isOwnerCheck) {
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
  }, []);

  const fetchUpcomingMatches = useCallback(async (barId: string) => {
    try {
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
        .order('start_time', { ascending: true })
        .limit(5);

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
      } else {
        setUpcomingMatches([]);
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

  const handleReportBar = useCallback(async () => {
    const isGuest = await getIsGuest();
    if (isGuest) {
      showGuestLoginAlert(router);
      return;
    }
    router.push(`/report-bar/${barId}` as any);
  }, [barId, router]);

  const handleClaimBar = useCallback(async () => {
    const isGuest = await getIsGuest();
    if (isGuest) {
      showGuestLoginAlert(router);
      return;
    }
    router.push(`/claim-bar/${barId}` as any);
  }, [barId, router]);

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
          <Ionicons name="pin" size={12} color={colors.text.primary} />
          <AppText variant="caption" color={colors.text.primary} style={styles.pinnedTextBold}>Destacado</AppText>
        </View>
      )}

      <View style={styles.postHeader}>
        <View style={styles.postTypeContainer}>
          <Ionicons
            name={getPostTypeIcon(item.post_type) as any}
            size={16}
            color={getPostTypeColor(item.post_type)}
          />
          <AppText variant="caption" color={getPostTypeColor(item.post_type)} style={styles.postTypeTextUppercase}>
            {getPostTypeLabel(item.post_type)}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.text.secondary}>{formatDate(item.created_at)}</AppText>
      </View>

      <AppText variant="subtitle" color={colors.text.primary} style={styles.postTitleSpacing}>{item.title}</AppText>
      <AppText variant="body" color={colors.text.secondary} style={styles.postDescriptionSpacing}>{item.description}</AppText>

      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.postImage} />
      )}

      {(item.start_date || item.end_date) && (
        <View style={styles.postDates}>
          <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
          <AppText variant="caption" color={colors.text.secondary}>
            {item.start_date && item.end_date
              ? `${formatDate(item.start_date)} - ${formatDate(item.end_date)}`
              : item.start_date
              ? `Desde ${formatDate(item.start_date)}`
              : `Hasta ${formatDate(item.end_date!)}`
            }
          </AppText>
        </View>
      )}

      {isOwner && (
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.postActionButton}
            onPress={() => router.push(`/edit-post/${item.id}` as any)}
          >
            <Ionicons name="create-outline" size={16} color={colors.brand.link} />
            <AppText variant="caption" color={colors.brand.link} style={styles.postActionTextMedium}>Editar</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.postActionButton, styles.deletePostButton]}
            onPress={() => handleDeletePost(item.id)}
          >
            <Ionicons name="trash-outline" size={16} color={colors.status.destructive} />
            <AppText variant="caption" color={colors.status.destructive} style={styles.postActionTextMedium}>Eliminar</AppText>
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
                await fetchBarPosts(bar.id, user, isOwner);
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

  // Load bar profile on initial mount and when screen comes back into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchBarProfile();
    }, [fetchBarProfile])
  );

  // Tier loading removed

  const handleFavoriteToggle = async () => {
    if (!barId) return;
    const isGuest = await getIsGuest();
    if (isGuest) {
      showGuestLoginAlert(router);
      return;
    }

    const wasFavorite = isFavorite(barId);
    const success = await toggleFavorite(barId);
    if (!success) {
      toast.error('No se pudo actualizar favorito');
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
                toast.error('No se pudo eliminar el partido');
                return;
              }

              // Refresh upcoming matches
              await fetchUpcomingMatches(barId);

              toast.success('Partido eliminado');
            } catch (error) {
              console.error('Error in handleDeleteMatch:', error);
              toast.error('No se pudo eliminar el partido');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <BarProfileSkeleton />
      </SafeAreaView>
    );
  }

  if (!bar) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.loadingContainer}>
          <AppText variant="body">Bar no encontrado</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <FlatList
        ref={flatListRef}
        data={sections}
        renderItem={renderSection}
        keyExtractor={(item) => `${bar.id}-${item.key}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
        onScrollToIndexFailed={() => {}}
      />

      {/* Info Modal */}
      <Modal
        visible={infoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setInfoModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalHeader}>
                <AppText variant="title" color={colors.text.primary} style={styles.modalTitleFlex}>{infoModalContent.title}</AppText>
                <TouchableOpacity
                  onPress={() => setInfoModalVisible(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {infoModalContent.content}
              </View>

              <TouchableOpacity
                style={[styles.modalOkButton, infoModalContent.onAction && styles.modalOkButtonAccent]}
                onPress={() => {
                  setInfoModalVisible(false);
                  infoModalContent.onAction?.();
                }}
              >
                <AppText variant="body" color={colors.text.primary} style={styles.modalOkButtonTextBold}>
                  {infoModalContent.actionLabel ?? 'Entendido'}
                </AppText>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {user && barId && (
        <BoostPaywallSheet
          isVisible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          onPurchaseComplete={refreshBoost}
          barId={barId}
          userId={user.id}
        />
      )}

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
  verificationPill: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
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
  verificationNotesBox: {
    marginTop: 10,
    maxWidth: '95%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    textAlign: 'left',
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
  unclaimedActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand.link,
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
    paddingVertical: 4,
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginBottom: 8,
  },
  barActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  barActionIcon: {
    width: 32,
    height: 32,
    borderRadius: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  barActionIconBlue: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
  },
  barActionIconPurple: {
    backgroundColor: 'rgba(88, 86, 214, 0.15)',
  },
  barActionIconBoost: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
  },
  barActionContent: {
    flex: 1,
  },
  barActionTitle: {
    fontWeight: '600',
    fontSize: 13,
  },
  // Upcoming matches styles
  upcomingMatchesContainer: {
    paddingHorizontal: 20,
  },
  upcomingMatchCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  upcomingMatchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  upcomingTeamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  upcomingTeamLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginBottom: 6,
    resizeMode: 'contain',
  },
  upcomingTeamName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  upcomingVsContainer: {
    paddingHorizontal: 12,
  },
  upcomingVsText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '600',
  },

  upcomingMatchTime: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  upcomingMatchCompetition: {
    color: '#A3B3CC',
    fontSize: 11,
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
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  buttonWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonIntegrated: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonIntegratedBoost: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalScrollContent: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 24,
  },
  infoModalText: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 22,
  },
  boostMainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  benefitEmoji: {
    fontSize: 20,
  },
  benefitContent: {
    flex: 1,
    gap: 3,
    paddingTop: 2,
  },
  boostSubtitle: {
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  boostStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  boostStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xxs,
  },
  boostStatDivider: {
    width: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.sm,
  },
  boostStatValue: {
    color: colors.status.boost,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  boostStatLabel: {
    lineHeight: 14,
  },
  boostRoiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(74,222,128,0.07)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  boostRoiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  boostRoiText: {
    flex: 1,
    gap: 2,
  },
  boostTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  boostTrustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  boostTrustDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border.medium,
  },
  modalOkButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalOkButtonAccent: {
    backgroundColor: '#1976D2',
  },
  modalOkButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos auxiliares para AppText
  boostMainTextSpacing: {
    marginBottom: spacing.lg,
    fontWeight: '600',
  },
  ctaTitleSpacing: {
    marginBottom: spacing.sm,
  },
  ctaSubtitleSpacing: {
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  ctaDescriptionSpacing: {
    lineHeight: 20,
  },
  verificationPillTextBold: {
    fontWeight: '800',
  },
  verificationNotesFlex: {
    flex: 1,
    lineHeight: 16,
  },
  noImagesTextSpacing: {
    marginTop: spacing.sm,
  },
  sectionTitleSpacing: {
    marginBottom: spacing.lg,
  },
  menuSectionTitleSpacing: {
    marginBottom: spacing.md,
  },
  noPostsTextSpacing: {
    marginTop: spacing.lg,
    fontWeight: '600',
  },
  noPostsSubtextSpacing: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  upcomingMatchTimeSpacing: {
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  emptyUpcomingMatchesTextItalic: {
    fontStyle: 'italic',
  },
  deleteBarButtonTextMedium: {
    fontWeight: '500',
  },
  pinnedTextBold: {
    fontWeight: '600',
  },
  postTypeTextUppercase: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  postTitleSpacing: {
    marginBottom: spacing.sm,
  },
  postDescriptionSpacing: {
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  postActionTextMedium: {
    fontWeight: '500',
  },
  modalTitleFlex: {
    flex: 1,
    fontWeight: '700',
  },
  modalOkButtonTextBold: {
    fontWeight: '600',
  },
  // Section navigation mini-menu
  navSection: {
    paddingVertical: 4,
  },
  navScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  navChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
}); 