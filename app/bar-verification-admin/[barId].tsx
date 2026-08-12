import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { AppText, colors, spacing, radius, shadows, Divider, toast } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '~/utils/supabase';
import ImageViewing from 'react-native-image-viewing';
import { DraggableImageGrid, type DraggableImage } from '~/components/images';

// ─── Types ───────────────────────────────────────────────────────────────────

type Source = 'owner' | 'scraped';
type VerificationStatus = 'pending' | 'approved' | 'rejected';

type BarDetail = {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  verification_status: VerificationStatus;
  verification_notes?: string | null;
  flag_bar_photos?: boolean;
  flag_menu_photos?: boolean;
  // Solo presentes cuando source === 'scraped'
  email?: string | null;
  postal_code?: string | null;
  place_id?: string | null;
  confidence?: string | null;
};

type ImgRow = { id: string; image_url: string; image_order?: number | null };
type CatalogItem = { id: number; name: string };
type GoogleReview = {
  id: string;
  author_name: string | null;
  rating: number | null;
  review_text: string | null;
  review_date: string | null;
  owner_answer: string | null;
};

// Los catálogos de características cambian poco: se cachean entre visitas a esta pantalla.
let catalogCache: { foodTypes: CatalogItem[]; tvFeatures: CatalogItem[]; features: CatalogItem[] } | null = null;

const QUICK_REJECT_PRESETS = [
  'El bar no existe en esta dirección.',
  'La información del bar es insuficiente o incorrecta.',
  'Faltan fotos del bar o no son claras.',
  'Faltan fotos de la carta/menú.',
  'Las fotos no corresponden al bar.',
];

const STATUS_COLOR: Record<VerificationStatus, string> = {
  pending: colors.status.warning,
  approved: colors.status.success,
  rejected: colors.status.error,
};

const STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function BarVerificationDetailScreen() {
  const router = useRouter();
  const { barId, source: sourceParam } = useLocalSearchParams<{ barId: string; source?: string }>();
  const source: Source = sourceParam === 'scraped' ? 'scraped' : 'owner';
  const isScraped = source === 'scraped';

  // ── Loading ──
  const [loading, setLoading] = useState(true);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [actionLoading, setActionLoading] = useState<null | 'approve' | 'reject' | 'delete'>(null);

  // ── Reseñas de Google ──
  const [googleReviews, setGoogleReviews] = useState<GoogleReview[]>([]);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  // ── Data ──
  const [bar, setBar] = useState<BarDetail | null>(null);
  const [barImages, setBarImages] = useState<ImgRow[]>([]);
  const [menuImages, setMenuImages] = useState<ImgRow[]>([]);

  // ── Edit fields ──
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');

  // ── Características (solo source === 'owner') ──
  const [selectedFoodTypeIds, setSelectedFoodTypeIds] = useState<number[]>([]);
  const [selectedTvFeatureIds, setSelectedTvFeatureIds] = useState<number[]>([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>([]);
  const [origFoodTypeIds, setOrigFoodTypeIds] = useState<number[]>([]);
  const [origTvFeatureIds, setOrigTvFeatureIds] = useState<number[]>([]);
  const [origFeatureIds, setOrigFeatureIds] = useState<number[]>([]);

  const [allFoodTypes, setAllFoodTypes] = useState<CatalogItem[]>([]);
  const [allTvFeatures, setAllTvFeatures] = useState<CatalogItem[]>([]);
  const [allFeatures, setAllFeatures] = useState<CatalogItem[]>([]);

  // ── Flags de fotos (solo source === 'owner') ──
  const [flagBarPhotos, setFlagBarPhotos] = useState(false);
  const [flagMenuPhotos, setFlagMenuPhotos] = useState(false);

  // ── UI ──
  const [rejectSheetVisible, setRejectSheetVisible] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<Array<{ uri: string }>>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerType, setViewerType] = useState<'bar' | 'menu'>('bar');
  const currentViewerIdxRef = useRef(0);

  // ── Selección múltiple ──
  const [selectModeBar, setSelectModeBar] = useState(false);
  const [selectedBarIds, setSelectedBarIds] = useState<Set<string>>(new Set());
  const [selectModeMenu, setSelectModeMenu] = useState(false);
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());

  // ─── Load ─────────────────────────────────────────────────────────────────

  const loadGoogleReviews = useCallback(async (placeId: string) => {
    const { data, error } = await supabase
      .from('bar_reviews')
      .select('id, author_name, rating, review_text, review_date, owner_answer')
      .eq('place_id', placeId)
      .order('review_date', { ascending: false });
    if (error) {
      console.error('❌ Error loading google reviews:', error);
      return;
    }
    setGoogleReviews(((data as any) || []) as GoogleReview[]);
  }, []);

  const loadCatalogs = useCallback(async () => {
    if (!catalogCache) {
      const [ft, tv, feat] = await Promise.all([
        supabase.from('food_types').select('id, name').order('name'),
        supabase.from('bar_tv_features').select('id, name').order('name'),
        supabase.from('bar_features').select('id, name').order('name'),
      ]);
      catalogCache = {
        foodTypes: ((ft.data as any) || []) as CatalogItem[],
        tvFeatures: ((tv.data as any) || []) as CatalogItem[],
        features: ((feat.data as any) || []) as CatalogItem[],
      };
    }
    setAllFoodTypes(catalogCache.foodTypes);
    setAllTvFeatures(catalogCache.tvFeatures);
    setAllFeatures(catalogCache.features);
  }, []);

  // Fase 1 (bloqueante): fila principal + fotos. Es lo mínimo para pintar la pantalla.
  const loadOwnerCore = useCallback(async () => {
    const [{ data: barData, error: barErr }, { data: imgs }, { data: menus }] = await Promise.all([
      supabase
        .from('bars')
        .select('id, name, description, address, city, phone, website, latitude, longitude, created_at, verification_status, verification_notes, flag_bar_photos, flag_menu_photos, place_id')
        .eq('id', barId)
        .single(),
      supabase.from('bar_images').select('id, image_url, image_order').eq('bar_id', barId).order('image_order', { ascending: true }),
      supabase.from('bar_menus').select('id, image_url, image_order').eq('bar_id', barId).order('image_order', { ascending: true }),
    ]);

    if (barErr) throw barErr;
    const b = barData as BarDetail;
    setBar(b);
    setEditName(b.name || '');
    setEditDescription(b.description || '');
    setEditPhone(b.phone || '');
    setEditWebsite(b.website || '');
    setFlagBarPhotos(b.flag_bar_photos ?? false);
    setFlagMenuPhotos(b.flag_menu_photos ?? false);

    setBarImages(((imgs as any) || []) as ImgRow[]);
    setMenuImages(((menus as any) || []) as ImgRow[]);
    return b;
  }, [barId]);

  // Fase 2 (en segundo plano): catálogos, selección actual y reseñas de Google.
  const loadOwnerExtras = useCallback(async (placeId: string | null) => {
    const [{ data: ftData }, { data: tvData }, { data: featData }] = await Promise.all([
      supabase.from('bar_food_types').select('food_type_id').eq('bar_id', barId),
      supabase.from('bar_selected_tv_features').select('tv_feature_id').eq('bar_id', barId),
      supabase.from('bar_selected_features').select('feature_id').eq('bar_id', barId),
    ]);

    const ftIds = (ftData || []).map((r: any) => r.food_type_id as number);
    const tvIds = (tvData || []).map((r: any) => r.tv_feature_id as number);
    const fIds = (featData || []).map((r: any) => r.feature_id as number);

    setSelectedFoodTypeIds(ftIds);
    setSelectedTvFeatureIds(tvIds);
    setSelectedFeatureIds(fIds);
    setOrigFoodTypeIds(ftIds);
    setOrigTvFeatureIds(tvIds);
    setOrigFeatureIds(fIds);

    await loadCatalogs();
    if (placeId) await loadGoogleReviews(placeId);
  }, [barId, loadCatalogs, loadGoogleReviews]);

  const loadScrapedCore = useCallback(async () => {
    const { data, error } = await supabase
      .from('bars_scraped')
      .select('id, name, description, address, city, postal_code, phone, email, website, latitude, longitude, place_id, confidence, created_at, status, verification_notes, image_urls, carta_urls, selected_feature_ids, selected_tv_feature_ids, selected_food_type_ids')
      .eq('id', barId)
      .single();
    if (error) throw error;

    const b: BarDetail = {
      id: data.id,
      name: data.name || '',
      description: data.description,
      address: data.address,
      city: data.city,
      postal_code: data.postal_code,
      phone: data.phone,
      email: data.email,
      website: data.website,
      latitude: data.latitude,
      longitude: data.longitude,
      created_at: data.created_at,
      verification_status: (data.status === 'rejected' ? 'rejected' : data.status === 'converted' ? 'approved' : 'pending') as VerificationStatus,
      verification_notes: data.verification_notes,
      place_id: data.place_id,
      confidence: data.confidence,
    };
    setBar(b);
    setEditName(b.name || '');
    setEditDescription(b.description || '');
    setEditPhone(b.phone || '');
    setEditWebsite(b.website || '');

    const imgs: ImgRow[] = ((data.image_urls as string[]) || []).map((url, i) => ({ id: `img-${i}`, image_url: url, image_order: i }));
    const menus: ImgRow[] = ((data.carta_urls as string[]) || []).map((url, i) => ({ id: `menu-${i}`, image_url: url, image_order: i }));
    setBarImages(imgs);
    setMenuImages(menus);

    const ftIds = (data.selected_food_type_ids as number[] | null) || [];
    const tvIds = (data.selected_tv_feature_ids as number[] | null) || [];
    const fIds = (data.selected_feature_ids as number[] | null) || [];
    setSelectedFoodTypeIds(ftIds);
    setSelectedTvFeatureIds(tvIds);
    setSelectedFeatureIds(fIds);
    setOrigFoodTypeIds(ftIds);
    setOrigTvFeatureIds(tvIds);
    setOrigFeatureIds(fIds);

    return b;
  }, [barId]);

  const loadScrapedExtras = useCallback(async (placeId: string | null) => {
    await loadCatalogs();
    if (placeId) await loadGoogleReviews(placeId);
  }, [loadCatalogs, loadGoogleReviews]);

  const load = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    setLoadingExtras(true);
    setGoogleReviews([]);
    try {
      const b = isScraped ? await loadScrapedCore() : await loadOwnerCore();
      setLoading(false);
      try {
        if (isScraped) await loadScrapedExtras(b.place_id ?? null);
        else await loadOwnerExtras(b.place_id ?? null);
      } finally {
        setLoadingExtras(false);
      }
      return;
    } catch (e: any) {
      toast.error('Error al cargar el bar', e?.message);
    } finally {
      setLoading(false);
      setLoadingExtras(false);
    }
  }, [barId, isScraped, loadOwnerCore, loadScrapedCore, loadOwnerExtras, loadScrapedExtras]);

  useEffect(() => { load(); }, [load]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const infoDirty = useMemo(() => {
    if (!bar) return false;
    return (
      editName.trim() !== (bar.name || '') ||
      editDescription.trim() !== (bar.description || '') ||
      editPhone.trim() !== (bar.phone || '') ||
      editWebsite.trim() !== (bar.website || '')
    );
  }, [bar, editName, editDescription, editPhone, editWebsite]);

  const featuresDirty = useMemo(() => {
    const same = (a: number[], b: number[]) =>
      a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
    return !same(selectedFoodTypeIds, origFoodTypeIds) ||
      !same(selectedTvFeatureIds, origTvFeatureIds) ||
      !same(selectedFeatureIds, origFeatureIds);
  }, [selectedFoodTypeIds, selectedTvFeatureIds, selectedFeatureIds, origFoodTypeIds, origTvFeatureIds, origFeatureIds]);

  const showStickyBar = infoDirty || featuresDirty;

  const mainImageUrl = useMemo(
    () => barImages.find((i) => i.image_order === 1 || i.image_order === 0)?.image_url || barImages[0]?.image_url || null,
    [barImages],
  );

  // ─── Actions: save info ───────────────────────────────────────────────────

  const saveAll = useCallback(async () => {
    if (!bar) return;
    const name = editName.trim();
    if (!name) { toast.warning('El nombre no puede estar vacío'); return; }

    const prevBar = bar;
    const optimisticBar = { ...bar, name, description: editDescription.trim() || null, phone: editPhone.trim() || null, website: editWebsite.trim() || null };
    const prevOrig = { ft: origFoodTypeIds, tv: origTvFeatureIds, feat: origFeatureIds };

    if (infoDirty) setBar(optimisticBar);
    if (featuresDirty) {
      setOrigFoodTypeIds(selectedFoodTypeIds);
      setOrigTvFeatureIds(selectedTvFeatureIds);
      setOrigFeatureIds(selectedFeatureIds);
    }

    setSavingInfo(true);
    try {
      const ops: Promise<any>[] = [];

      if (infoDirty) {
        const table = isScraped ? 'bars_scraped' : 'bars';
        ops.push(
          supabase.from(table).update({
            name,
            description: editDescription.trim() || null,
            phone: editPhone.trim() || null,
            website: editWebsite.trim() || null,
          }).eq('id', bar.id) as unknown as Promise<any>,
        );
      }

      if (featuresDirty && isScraped) {
        ops.push(
          supabase.from('bars_scraped').update({
            selected_feature_ids: selectedFeatureIds,
            selected_tv_feature_ids: selectedTvFeatureIds,
            selected_food_type_ids: selectedFoodTypeIds,
          }).eq('id', bar.id) as unknown as Promise<any>,
        );
      } else if (featuresDirty) {
        ops.push(
          (async () => {
            await Promise.all([
              supabase.from('bar_food_types').delete().eq('bar_id', bar.id),
              supabase.from('bar_selected_tv_features').delete().eq('bar_id', bar.id),
              supabase.from('bar_selected_features').delete().eq('bar_id', bar.id),
            ]);
            await Promise.all([
              selectedFoodTypeIds.length > 0
                ? supabase.from('bar_food_types').insert(selectedFoodTypeIds.map((id) => ({ bar_id: bar.id, food_type_id: id })))
                : Promise.resolve(),
              selectedTvFeatureIds.length > 0
                ? supabase.from('bar_selected_tv_features').insert(selectedTvFeatureIds.map((id) => ({ bar_id: bar.id, tv_feature_id: id })))
                : Promise.resolve(),
              selectedFeatureIds.length > 0
                ? supabase.from('bar_selected_features').insert(selectedFeatureIds.map((id) => ({ bar_id: bar.id, feature_id: id })))
                : Promise.resolve(),
            ]);
          })(),
        );
      }

      const results = await Promise.all(ops);
      const firstError = results.find((r) => r?.error)?.error;
      if (firstError) throw firstError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Cambios guardados');
    } catch (e: any) {
      setBar(prevBar);
      setOrigFoodTypeIds(prevOrig.ft);
      setOrigTvFeatureIds(prevOrig.tv);
      setOrigFeatureIds(prevOrig.feat);
      toast.supabaseError(e, 'No se pudieron guardar los cambios');
    } finally {
      setSavingInfo(false);
    }
  }, [bar, isScraped, editName, editDescription, editPhone, editWebsite, infoDirty, featuresDirty, selectedFoodTypeIds, selectedTvFeatureIds, selectedFeatureIds, origFoodTypeIds, origTvFeatureIds, origFeatureIds]);

  // ─── Reorder ──────────────────────────────────────────────────────────────

  const persistScrapedImages = useCallback(async (column: 'image_urls' | 'carta_urls', urls: string[]) => {
    if (!bar) return;
    const { error } = await supabase.from('bars_scraped').update({ [column]: urls }).eq('id', bar.id);
    if (error) throw error;
  }, [bar]);

  const reorderBarPhotos = useCallback(async (reordered: DraggableImage[]) => {
    const prev = barImages;
    setBarImages(reordered as ImgRow[]);
    try {
      if (isScraped) {
        await persistScrapedImages('image_urls', reordered.map((img) => img.image_url));
      } else {
        await Promise.all(
          reordered.map((img) =>
            supabase.from('bar_images').update({ image_order: img.image_order }).eq('id', img.id)
          )
        );
      }
    } catch (e: any) {
      setBarImages(prev);
      toast.supabaseError(e, 'No se pudo actualizar el orden');
    }
  }, [barImages, isScraped, persistScrapedImages]);

  const reorderMenuPhotos = useCallback(async (reordered: DraggableImage[]) => {
    const prev = menuImages;
    setMenuImages(reordered as ImgRow[]);
    try {
      if (isScraped) {
        await persistScrapedImages('carta_urls', reordered.map((img) => img.image_url));
      } else {
        await Promise.all(
          reordered.map((img) =>
            supabase.from('bar_menus').update({ image_order: img.image_order }).eq('id', img.id)
          )
        );
      }
    } catch (e: any) {
      setMenuImages(prev);
      toast.supabaseError(e, 'No se pudo actualizar el orden');
    }
  }, [menuImages, isScraped, persistScrapedImages]);

  // ─── Toggle selección ─────────────────────────────────────────────────────

  const toggleBarSelect = useCallback((id: string) => {
    setSelectedBarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleMenuSelect = useCallback((id: string) => {
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const cancelSelectBar = useCallback(() => {
    setSelectModeBar(false);
    setSelectedBarIds(new Set());
  }, []);

  const cancelSelectMenu = useCallback(() => {
    setSelectModeMenu(false);
    setSelectedMenuIds(new Set());
  }, []);

  // ─── Eliminación en lote ──────────────────────────────────────────────────

  const deleteSelectedBarPhotos = useCallback(() => {
    const ids = [...selectedBarIds];
    if (ids.length === 0) return;
    Alert.alert(
      `Eliminar ${ids.length} foto${ids.length > 1 ? 's' : ''}`,
      '¿Eliminar las fotos seleccionadas? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const prev = barImages;
            const next = prev.filter((i) => !selectedBarIds.has(i.id));
            setBarImages(next);
            setSelectedBarIds(new Set());
            setSelectModeBar(false);
            try {
              if (isScraped) {
                await persistScrapedImages('image_urls', next.map((i) => i.image_url));
              } else {
                await Promise.all(ids.map((id) => supabase.from('bar_images').delete().eq('id', id)));
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              toast.success(`${ids.length} foto${ids.length > 1 ? 's eliminadas' : ' eliminada'}`);
            } catch (e: any) {
              setBarImages(prev);
              toast.supabaseError(e, 'No se pudieron eliminar las fotos');
            }
          },
        },
      ]
    );
  }, [barImages, selectedBarIds, isScraped, persistScrapedImages]);

  const deleteSelectedMenuPhotos = useCallback(() => {
    const ids = [...selectedMenuIds];
    if (ids.length === 0) return;
    Alert.alert(
      `Eliminar ${ids.length} imagen${ids.length > 1 ? 'es' : ''}`,
      '¿Eliminar las imágenes seleccionadas? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const prev = menuImages;
            const next = prev.filter((i) => !selectedMenuIds.has(i.id));
            setMenuImages(next);
            setSelectedMenuIds(new Set());
            setSelectModeMenu(false);
            try {
              if (isScraped) {
                await persistScrapedImages('carta_urls', next.map((i) => i.image_url));
              } else {
                await Promise.all(ids.map((id) => supabase.from('bar_menus').delete().eq('id', id)));
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              toast.success(`${ids.length} imagen${ids.length > 1 ? 'es eliminadas' : ' eliminada'}`);
            } catch (e: any) {
              setMenuImages(prev);
              toast.supabaseError(e, 'No se pudieron eliminar las imágenes');
            }
          },
        },
      ]
    );
  }, [menuImages, selectedMenuIds, isScraped, persistScrapedImages]);

  const deleteBarPhoto = useCallback((imgId: string) => {
    Alert.alert('Eliminar foto', '¿Eliminar esta foto del bar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const prev = barImages;
          const next = prev.filter((i) => i.id !== imgId);
          setBarImages(next);
          try {
            if (isScraped) {
              await persistScrapedImages('image_urls', next.map((i) => i.image_url));
            } else {
              const { error } = await supabase.from('bar_images').delete().eq('id', imgId);
              if (error) throw error;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toast.success('Foto eliminada');
          } catch (e: any) {
            setBarImages(prev);
            toast.supabaseError(e, 'No se pudo eliminar la foto');
          }
        },
      },
    ]);
  }, [barImages, isScraped, persistScrapedImages]);

  const deleteMenuPhoto = useCallback((imgId: string) => {
    Alert.alert('Eliminar imagen', '¿Eliminar esta imagen de la carta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const prev = menuImages;
          const next = prev.filter((i) => i.id !== imgId);
          setMenuImages(next);
          try {
            if (isScraped) {
              await persistScrapedImages('carta_urls', next.map((i) => i.image_url));
            } else {
              const { error } = await supabase.from('bar_menus').delete().eq('id', imgId);
              if (error) throw error;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toast.success('Imagen eliminada');
          } catch (e: any) {
            setMenuImages(prev);
            toast.supabaseError(e, 'No se pudo eliminar la imagen');
          }
        },
      },
    ]);
  }, [menuImages, isScraped, persistScrapedImages]);

  // ─── Reseñas de Google ────────────────────────────────────────────────────

  const deleteGoogleReview = useCallback((reviewId: string) => {
    Alert.alert('Eliminar reseña', '¿Eliminar esta reseña de Google? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const prev = googleReviews;
          setDeletingReviewId(reviewId);
          setGoogleReviews((cur) => cur.filter((r) => r.id !== reviewId));
          try {
            const { error } = await supabase.rpc('admin_delete_bar_review', { p_review_id: reviewId });
            if (error) throw error;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toast.success('Reseña eliminada');
          } catch (e: any) {
            setGoogleReviews(prev);
            toast.supabaseError(e, 'No se pudo eliminar la reseña');
          } finally {
            setDeletingReviewId(null);
          }
        },
      },
    ]);
  }, [googleReviews]);

  // ─── Actions: approve / reject / delete ───────────────────────────────────

  const approve = useCallback(async () => {
    if (!bar) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoading('approve');
    try {
      if (isScraped) {
        const { error } = await supabase.rpc('convert_scraped_bar', {
          p_scraped_id: bar.id,
          p_name: editName.trim(),
          p_description: editDescription.trim() || null,
          p_phone: editPhone.trim() || null,
          p_email: bar.email || null,
          p_website: editWebsite.trim() || null,
          p_address: bar.address || null,
          p_city: bar.city || null,
          p_postal_code: bar.postal_code || null,
          p_latitude: bar.latitude ?? null,
          p_longitude: bar.longitude ?? null,
          p_place_id: bar.place_id || null,
          p_image_urls: barImages.map((i) => i.image_url),
          p_menu_urls: menuImages.map((i) => i.image_url),
          p_feature_ids: selectedFeatureIds,
          p_tv_feature_ids: selectedTvFeatureIds,
          p_food_type_ids: selectedFoodTypeIds,
        });
        if (error) throw error;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.success('Bar aprobado', 'Ya es visible para los usuarios');
        router.back();
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) throw new Error('No auth user');
      const { error } = await supabase
        .from('bars')
        .update({ verification_status: 'approved', verified_at: new Date().toISOString(), verified_by: user.id, verification_notes: null })
        .eq('id', bar.id);
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Bar aprobado', 'Ya es visible para los usuarios');
      router.back();
    } catch (e: any) {
      toast.supabaseError(e, 'No se pudo aprobar el bar');
      setActionLoading(null);
    }
  }, [bar, isScraped, editName, editDescription, editPhone, editWebsite, barImages, menuImages, selectedFeatureIds, selectedTvFeatureIds, selectedFoodTypeIds, router]);

  const reject = useCallback(async () => {
    if (!bar) return;
    const notes = rejectNotes.trim();
    if (!notes) { toast.warning('Escribe un motivo para rechazar'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoading('reject');
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) throw new Error('No auth user');

      if (isScraped) {
        const { error } = await supabase
          .from('bars_scraped')
          .update({ status: 'rejected', verification_notes: notes, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
          .eq('id', bar.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bars')
          .update({ verification_status: 'rejected', verified_at: new Date().toISOString(), verified_by: user.id, verification_notes: notes })
          .eq('id', bar.id);
        if (error) throw error;
      }
      setRejectSheetVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      toast.info('Bar rechazado', isScraped ? 'Se descarta de la cola de revisión' : 'El propietario verá el motivo');
      router.back();
    } catch (e: any) {
      toast.supabaseError(e, 'No se pudo rechazar el bar');
      setActionLoading(null);
    }
  }, [bar, isScraped, rejectNotes, router]);

  const deleteBar = useCallback(() => {
    if (!bar) return;
    const title = isScraped ? 'Descartar candidato' : 'Eliminar bar';
    const message = isScraped
      ? `¿Eliminar definitivamente "${bar.name}" de los datos scrapeados? No se puede deshacer.`
      : `¿Eliminar "${bar.name}" permanentemente? No se puede deshacer.`;
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: () => Alert.alert('Confirmar', isScraped ? 'Se borrará el registro scrapeado.' : 'Se borrarán el bar, fotos y características.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Eliminar definitivamente', style: 'destructive',
              onPress: async () => {
                setActionLoading('delete');
                try {
                  const table = isScraped ? 'bars_scraped' : 'bars';
                  const { error } = await supabase.from(table).delete().eq('id', bar.id);
                  if (error) throw error;
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  toast.success(isScraped ? 'Candidato eliminado' : 'Bar eliminado');
                  router.back();
                } catch (e: any) {
                  toast.supabaseError(e, 'No se pudo eliminar');
                  setActionLoading(null);
                }
              },
            },
          ]),
        },
      ],
    );
  }, [bar, isScraped, router]);

  // ─── Viewer ───────────────────────────────────────────────────────────────

  const openViewer = useCallback((urls: string[], startIndex: number, type: 'bar' | 'menu') => {
    const safe = urls.filter(Boolean);
    if (safe.length === 0) return;
    const idx = Math.min(Math.max(startIndex, 0), safe.length - 1);
    setViewerImages(safe.map((u) => ({ uri: u })));
    setViewerIndex(idx);
    currentViewerIdxRef.current = idx;
    setViewerType(type);
    setViewerVisible(true);
  }, []);

  const deleteViewerPhoto = useCallback(() => {
    const idx = currentViewerIdxRef.current;
    const currentUrl = viewerImages[idx]?.uri;
    if (!currentUrl) return;

    const isBar = viewerType === 'bar';
    const targetImg = isBar
      ? barImages.find((i) => i.image_url === currentUrl)
      : menuImages.find((i) => i.image_url === currentUrl);

    if (!targetImg) return;

    Alert.alert(
      'Eliminar foto',
      `¿Eliminar esta foto ${isBar ? 'del bar' : 'de la carta'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const newViewerImages = viewerImages.filter((_, i) => i !== idx);

            const applyViewerUpdate = () => {
              setViewerImages(newViewerImages);
              if (newViewerImages.length === 0) {
                setViewerVisible(false);
              } else if (idx >= newViewerImages.length) {
                const newI = newViewerImages.length - 1;
                setViewerIndex(newI);
                currentViewerIdxRef.current = newI;
              }
            };

            if (isBar) {
              const prev = barImages;
              const next = prev.filter((i) => i.id !== targetImg.id);
              setBarImages(next);
              applyViewerUpdate();
              try {
                if (isScraped) {
                  await persistScrapedImages('image_urls', next.map((i) => i.image_url));
                } else {
                  const { error } = await supabase.from('bar_images').delete().eq('id', targetImg.id);
                  if (error) throw error;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                toast.success('Foto eliminada');
              } catch (e: any) {
                setBarImages(prev);
                setViewerImages(viewerImages);
                toast.supabaseError(e, 'No se pudo eliminar la foto');
              }
            } else {
              const prev = menuImages;
              const next = prev.filter((i) => i.id !== targetImg.id);
              setMenuImages(next);
              applyViewerUpdate();
              try {
                if (isScraped) {
                  await persistScrapedImages('carta_urls', next.map((i) => i.image_url));
                } else {
                  const { error } = await supabase.from('bar_menus').delete().eq('id', targetImg.id);
                  if (error) throw error;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                toast.success('Imagen eliminada');
              } catch (e: any) {
                setMenuImages(prev);
                setViewerImages(viewerImages);
                toast.supabaseError(e, 'No se pudo eliminar la imagen');
              }
            }
          },
        },
      ],
    );
  }, [viewerImages, viewerType, barImages, menuImages, isScraped, persistScrapedImages]);

  // ─── Flag toggle (solo source === 'owner') ───────────────────────────────

  const toggleFlag = useCallback(async (field: 'flag_bar_photos' | 'flag_menu_photos', current: boolean) => {
    if (!bar) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVal = !current;
    if (field === 'flag_bar_photos') setFlagBarPhotos(newVal);
    else setFlagMenuPhotos(newVal);
    try {
      const { error } = await supabase.from('bars').update({ [field]: newVal }).eq('id', bar.id);
      if (error) throw error;
      toast.success(newVal ? 'Marcado para revisión' : 'Flag eliminado');
    } catch (e: any) {
      if (field === 'flag_bar_photos') setFlagBarPhotos(current);
      else setFlagMenuPhotos(current);
      toast.supabaseError(e, 'No se pudo actualizar');
    }
  }, [bar]);

  // ─── Chip toggle ──────────────────────────────────────────────────────────

  const toggleId = useCallback((id: number, setter: React.Dispatch<React.SetStateAction<number[]>>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setter((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.status.boost} />
          <AppText variant="caption" color={colors.text.secondary}>Cargando…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!bar) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Verificación" onBack={() => router.back()} />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.text.secondary} />
          <AppText variant="subtitle" color={colors.text.primary}>No encontrado</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const barUrls = barImages.map((i) => i.image_url);
  const menuUrls = menuImages.map((i) => i.image_url);
  const busy = actionLoading !== null;
  const { width: screenWidth } = Dimensions.get('window');
  const gridColumns = 3;
  const gridGap = 8;
  const gridItemSize = Math.floor((screenWidth - 2 * spacing.xl - (gridColumns - 1) * gridGap) / gridColumns);
  const hasBarSelection = selectedBarIds.size > 0;
  const hasMenuSelection = selectedMenuIds.size > 0;
  const statusColor = STATUS_COLOR[bar.verification_status];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title={bar.name}
        onBack={() => router.back()}
        onRefresh={load}
        refreshDisabled={busy}
        statusLabel={STATUS_LABEL[bar.verification_status]}
        statusColor={statusColor}
        sourceLabel={isScraped ? 'Scraper' : 'Propietario'}
        confidence={bar.confidence}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, showStickyBar && { paddingBottom: 80 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero ── */}
          {mainImageUrl ? (
            <TouchableOpacity activeOpacity={0.92} onPress={() => openViewer(barUrls, 0, 'bar')} style={styles.heroWrap}>
              <Image source={{ uri: mainImageUrl }} style={styles.heroImage} />
              <View style={styles.heroOverlay}>
                <AppText variant="subtitle" color={colors.text.primary} numberOfLines={1} maxScale={1.0}>
                  {bar.name}
                </AppText>
                <View style={[styles.heroStatusBadge, { backgroundColor: `${statusColor}33` }]}>
                  <View style={[styles.heroDot, { backgroundColor: statusColor }]} />
                  <AppText variant="caption" style={{ color: statusColor, fontWeight: '800' }} maxScale={1.0}>
                    {STATUS_LABEL[bar.verification_status]}
                  </AppText>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.heroFallback}>
              <Ionicons name="image-outline" size={32} color={colors.text.muted} />
              <AppText variant="caption" color={colors.text.muted}>Sin foto de portada</AppText>
            </View>
          )}

          {/* ── Fotos del bar ── */}
          <SectionTitle
            title="Fotos del bar"
            count={barImages.length}
            flagActive={isScraped ? undefined : flagBarPhotos}
            onFlagToggle={isScraped ? undefined : () => toggleFlag('flag_bar_photos', flagBarPhotos)}
            selectActive={selectModeBar}
            onSelect={barImages.length > 0 ? () => { cancelSelectBar(); setSelectModeBar((v) => !v); } : undefined}
          />
          {barImages.length > 0 ? (
            <View style={styles.gridWrap}>
              <DraggableImageGrid
                images={barImages.map((i) => ({ id: i.id, image_url: i.image_url, image_order: i.image_order ?? 0 }))}
                onReorder={reorderBarPhotos}
                onDelete={deleteBarPhoto}
                columns={gridColumns}
                itemSize={gridItemSize}
                gap={gridGap}
                isSelectMode={selectModeBar}
                selectedIds={selectedBarIds}
                onToggleSelect={toggleBarSelect}
              />
            </View>
          ) : (
            <AppText variant="caption" color={colors.text.muted} style={styles.emptyText}>Sin fotos del bar</AppText>
          )}

          {/* ── Fotos de la carta ── */}
          <SectionTitle
            title="Fotos de la carta"
            count={menuImages.length}
            flagActive={isScraped ? undefined : flagMenuPhotos}
            onFlagToggle={isScraped ? undefined : () => toggleFlag('flag_menu_photos', flagMenuPhotos)}
            selectActive={selectModeMenu}
            onSelect={menuImages.length > 0 ? () => { cancelSelectMenu(); setSelectModeMenu((v) => !v); } : undefined}
          />
          {menuImages.length > 0 ? (
            <View style={styles.gridWrap}>
              <DraggableImageGrid
                images={menuImages.map((i) => ({ id: i.id, image_url: i.image_url, image_order: i.image_order ?? 0 }))}
                onReorder={reorderMenuPhotos}
                onDelete={deleteMenuPhoto}
                columns={gridColumns}
                itemSize={gridItemSize}
                gap={gridGap}
                isSelectMode={selectModeMenu}
                selectedIds={selectedMenuIds}
                onToggleSelect={toggleMenuSelect}
              />
            </View>
          ) : (
            <AppText variant="caption" color={colors.text.muted} style={styles.emptyText}>Sin fotos de la carta</AppText>
          )}

          {/* ── Información básica ── */}
          <SectionTitle title="Información básica" />
          <View style={styles.card}>
            <FieldInput label="Nombre" value={editName} onChangeText={setEditName} placeholder="Nombre del bar" />
            <Divider />
            <FieldInput label="Descripción" value={editDescription} onChangeText={setEditDescription} placeholder="Sin descripción" multiline />
            <Divider />
            <FieldInput label="Teléfono" value={editPhone} onChangeText={setEditPhone} placeholder="Sin teléfono" keyboardType="phone-pad" />
            <Divider />
            <FieldInput label="Web" value={editWebsite} onChangeText={setEditWebsite} placeholder="Sin web" keyboardType="url" autoCapitalize="none" />
            <Divider />
            <InfoReadOnly
              label="Dirección"
              value={(bar.address || '—') + (bar.city ? `, ${bar.city}` : '')}
            />
            <Divider />
            <InfoReadOnly
              label="Coordenadas"
              value={bar.latitude && bar.longitude ? `${bar.latitude.toFixed(5)}, ${bar.longitude.toFixed(5)}` : '—'}
            />
          </View>

          {/* ── Características ── */}
          <SectionTitle title="Características del local" />
          <View style={[styles.chipGroup, { marginBottom: spacing.lg }]}>
            {allFeatures.map((item) => {
              const active = selectedFeatureIds.includes(item.id);
              return (
                <Chip key={item.id} label={item.name} active={active} activeColor={colors.tags.feature} onPress={() => toggleId(item.id, setSelectedFeatureIds)} />
              );
            })}
            {allFeatures.length === 0 && (
              <AppText variant="caption" color={colors.text.muted}>{loadingExtras ? 'Cargando…' : 'Sin características'}</AppText>
            )}
          </View>

          <SectionTitle title="Características de TV" />
          <View style={[styles.chipGroup, { marginBottom: spacing.lg }]}>
            {allTvFeatures.map((item) => {
              const active = selectedTvFeatureIds.includes(item.id);
              return (
                <Chip key={item.id} label={item.name} active={active} activeColor={colors.tags.tv} onPress={() => toggleId(item.id, setSelectedTvFeatureIds)} />
              );
            })}
            {allTvFeatures.length === 0 && (
              <AppText variant="caption" color={colors.text.muted}>{loadingExtras ? 'Cargando…' : 'Sin características'}</AppText>
            )}
          </View>

          <SectionTitle title="Tipos de comida" />
          <View style={[styles.chipGroup, { marginBottom: spacing.xl }]}>
            {allFoodTypes.map((item) => {
              const active = selectedFoodTypeIds.includes(item.id);
              return (
                <Chip key={item.id} label={item.name} active={active} activeColor={colors.tags.food} onPress={() => toggleId(item.id, setSelectedFoodTypeIds)} />
              );
            })}
            {allFoodTypes.length === 0 && (
              <AppText variant="caption" color={colors.text.muted}>{loadingExtras ? 'Cargando…' : 'Sin tipos'}</AppText>
            )}
          </View>

          {/* ── Reseñas de Google ── */}
          {bar.place_id && googleReviews.length > 0 && (
            <>
              <SectionTitle title="Reseñas de Google" count={googleReviews.length} />
              <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm }}>
                {googleReviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="label" color={colors.text.primary} maxScale={1.0}>
                          {review.author_name || 'Anónimo'}
                        </AppText>
                        <View style={styles.reviewMetaRow}>
                          {review.rating != null && (
                            <View style={styles.reviewStars}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Ionicons
                                  key={i}
                                  name={i < (review.rating || 0) ? 'star' : 'star-outline'}
                                  size={12}
                                  color={colors.status.warning}
                                />
                              ))}
                            </View>
                          )}
                          {review.review_date && (
                            <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                              {new Date(review.review_date).toLocaleDateString('es-ES')}
                            </AppText>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        disabled={deletingReviewId === review.id}
                        onPress={() => deleteGoogleReview(review.id)}
                      >
                        {deletingReviewId === review.id ? (
                          <ActivityIndicator size="small" color={colors.status.error} />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color={colors.status.error} />
                        )}
                      </TouchableOpacity>
                    </View>
                    {review.review_text && (
                      <AppText variant="body" color={colors.text.secondary} style={{ marginTop: spacing.xs }} maxScale={1.0}>
                        {review.review_text}
                      </AppText>
                    )}
                    {review.owner_answer && (
                      <View style={styles.reviewOwnerAnswer}>
                        <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                          Respuesta del propietario: {review.owner_answer}
                        </AppText>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Botones de verificación ── */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.approveBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={approve}
            >
              {actionLoading === 'approve' ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <AppText variant="button" color="#FFFFFF" maxScale={1.0}>Aprobar</AppText>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.rejectBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRejectSheetVisible(true); }}
            >
              <Ionicons name="close-circle" size={18} color="#FFFFFF" />
              <AppText variant="button" color="#FFFFFF" maxScale={1.0}>Rechazar</AppText>
            </TouchableOpacity>
          </View>

          {/* ── Eliminar ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.deleteBarBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={deleteBar}
          >
            {actionLoading === 'delete' ? <ActivityIndicator color={colors.status.error} /> : (
              <>
                <Ionicons name="trash-outline" size={15} color={colors.status.error} />
                <AppText variant="label" style={{ color: colors.status.error }} maxScale={1.0}>
                  {isScraped ? 'Descartar candidato definitivamente' : 'Eliminar bar definitivamente'}
                </AppText>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>

        {/* ── Barra de selección ── */}
        {(selectModeBar || selectModeMenu) && (
          <View style={styles.selectionBar}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.selectionCancelBtn}
              onPress={selectModeBar ? cancelSelectBar : cancelSelectMenu}
            >
              <Ionicons name="close" size={16} color={colors.text.secondary} />
              <AppText variant="label" color={colors.text.secondary} maxScale={1.0}>Cancelar</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.selectionDeleteBtn,
                !(hasBarSelection || hasMenuSelection) && styles.btnDisabled,
              ]}
              disabled={!(hasBarSelection || hasMenuSelection)}
              onPress={selectModeBar ? deleteSelectedBarPhotos : deleteSelectedMenuPhotos}
            >
              <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
              <AppText variant="label" color="#FFFFFF" maxScale={1.0}>
                {selectModeBar
                  ? hasBarSelection ? `Eliminar ${selectedBarIds.size}` : 'Selecciona fotos'
                  : hasMenuSelection ? `Eliminar ${selectedMenuIds.size}` : 'Selecciona imágenes'
                }
              </AppText>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Sticky save bar ── */}
        {showStickyBar && (
          <View style={styles.stickyBar}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.stickyBtn, savingInfo && styles.btnDisabled]}
              onPress={saveAll}
              disabled={savingInfo}
            >
              {savingInfo ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <AppText variant="button" color="#FFFFFF" maxScale={1.0}>Guardar cambios</AppText>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Bottom sheet: rechazar ── */}
      <Modal
        visible={rejectSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectSheetVisible(false)}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setRejectSheetVisible(false)} />
        <View style={styles.sheetContent}>
          <View style={styles.sheetHandle} />
          <AppText variant="title" color={colors.text.primary} style={{ marginBottom: spacing.lg }} maxScale={1.0}>
            Motivo de rechazo
          </AppText>
          <View style={styles.presetRow}>
            {QUICK_REJECT_PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                activeOpacity={0.8}
                style={[styles.presetChip, rejectNotes === p && styles.presetChipActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRejectNotes(p); }}
              >
                <AppText variant="caption" style={[styles.presetText, rejectNotes === p && styles.presetTextActive]} maxScale={1.0}>
                  {p}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            placeholder="O escribe un motivo personalizado…"
            placeholderTextColor={colors.text.muted}
            value={rejectNotes}
            onChangeText={setRejectNotes}
            style={styles.rejectInput}
            multiline
          />
          <View style={styles.sheetButtons}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.cancelBtn}
              onPress={() => setRejectSheetVisible(false)}
            >
              <AppText variant="button" color={colors.text.secondary} maxScale={1.0}>Cancelar</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.rejectConfirmBtn, (busy) && styles.btnDisabled]}
              disabled={busy}
              onPress={reject}
            >
              {actionLoading === 'reject' ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <AppText variant="button" color="#FFFFFF" maxScale={1.0}>Rechazar</AppText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ImageViewing
        images={viewerImages}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        onImageIndexChange={(i) => { currentViewerIdxRef.current = i; }}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        FooterComponent={({ imageIndex }) => (
          <View style={styles.viewerFooter}>
            <AppText variant="caption" color="rgba(255,255,255,0.6)" maxScale={1.0}>
              {imageIndex + 1} / {viewerImages.length}
            </AppText>
            <TouchableOpacity
              style={styles.viewerDeleteBtn}
              onPress={deleteViewerPhoto}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              <AppText variant="caption" color="#FFFFFF" maxScale={1.0}>Eliminar</AppText>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScreenHeader({
  title, onBack, onRefresh, refreshDisabled, statusLabel, statusColor, sourceLabel, confidence,
}: {
  title: string;
  onBack: () => void;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  statusLabel?: string;
  statusColor?: string;
  sourceLabel?: string;
  confidence?: string | null;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <AppText variant="subtitle" color={colors.text.primary} numberOfLines={1} style={{ flexShrink: 1 }} maxScale={1.0}>
          {title}
        </AppText>
        {statusLabel && statusColor && (
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}44` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <AppText variant="caption" style={{ color: statusColor, fontWeight: '800' }} maxScale={1.0}>{statusLabel}</AppText>
          </View>
        )}
        {sourceLabel && (
          <View style={[styles.sourcePill, sourceLabel === 'Scraper' ? styles.sourcePillScraped : styles.sourcePillOwner]}>
            <AppText variant="caption" style={{ color: sourceLabel === 'Scraper' ? colors.tags.tv : colors.brand.primary, fontWeight: '800' }} maxScale={1.0}>
              {sourceLabel}
            </AppText>
          </View>
        )}
        {confidence && (
          <View style={styles.sourcePill}>
            <AppText variant="caption" color={colors.text.secondary} style={{ fontWeight: '700' }} maxScale={1.0}>{confidence}</AppText>
          </View>
        )}
      </View>
      {onRefresh ? (
        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn} disabled={refreshDisabled}>
          <Ionicons name="refresh" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      ) : <View style={{ width: 32 }} />}
    </View>
  );
}

function SectionTitle({ title, count, flagActive, onFlagToggle, selectActive, onSelect }: {
  title: string;
  count?: number;
  flagActive?: boolean;
  onFlagToggle?: () => void;
  selectActive?: boolean;
  onSelect?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <AppText variant="label" color={colors.text.primary} maxScale={1.0}>{title}</AppText>
      {count !== undefined && (
        <View style={styles.sectionBadge}>
          <AppText variant="caption" color={colors.text.secondary} maxScale={1.0}>{count}</AppText>
        </View>
      )}
      {onFlagToggle && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.flagChip, flagActive && styles.flagChipActive]}
          onPress={onFlagToggle}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={flagActive ? 'warning' : 'warning-outline'}
            size={12}
            color={flagActive ? colors.status.warning : colors.text.muted}
          />
          <AppText
            variant="caption"
            style={{ color: flagActive ? colors.status.warning : colors.text.muted, fontWeight: '700' }}
            maxScale={1.0}
          >
            {flagActive ? 'Mejorar' : 'OK'}
          </AppText>
        </TouchableOpacity>
      )}
      {onSelect && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.selectChip, selectActive && styles.selectChipActive]}
          onPress={onSelect}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={selectActive ? 'close-circle-outline' : 'checkmark-circle-outline'}
            size={12}
            color={selectActive ? colors.brand.primary : colors.text.muted}
          />
          <AppText
            variant="caption"
            style={{ color: selectActive ? colors.brand.primary : colors.text.muted, fontWeight: '700' }}
            maxScale={1.0}
          >
            {selectActive ? 'Cancelar' : 'Seleccionar'}
          </AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FieldInput({
  label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <AppText variant="caption" color={colors.text.secondary} style={{ fontWeight: '800' }} maxScale={1.0}>{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function InfoReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldWrap}>
      <AppText variant="caption" color={colors.text.secondary} style={{ fontWeight: '800' }} maxScale={1.0}>{label}</AppText>
      <AppText variant="body" color={colors.text.muted} maxScale={1.0}>{value}</AppText>
    </View>
  );
}

function Chip({ label, active, activeColor, onPress }: { label: string; active: boolean; activeColor: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.chip, active && { borderColor: activeColor, backgroundColor: `${activeColor}22` }]}
      onPress={onPress}
    >
      {active && <View style={[styles.chipDot, { backgroundColor: activeColor }]} />}
      <AppText variant="caption" style={[styles.chipText, active && { color: activeColor, fontWeight: '800' }]} maxScale={1.0}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },

  // Header
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  iconBtn: { padding: spacing.xs + 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.round },
  sourcePill: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated,
  },
  sourcePillOwner: { borderColor: `${colors.brand.primary}44`, backgroundColor: `${colors.brand.primary}18` },
  sourcePillScraped: { borderColor: `${colors.tags.tv}44`, backgroundColor: `${colors.tags.tv}18` },

  // Content
  content: { paddingBottom: spacing.xxxl },

  // Hero
  heroWrap: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    ...shadows.md,
  },
  heroImage: { width: '100%', height: 240, backgroundColor: colors.bg.elevated },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.52)',
    gap: spacing.sm,
  },
  heroStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.pill,
  },
  heroDot: { width: 6, height: 6, borderRadius: radius.round },
  heroFallback: {
    marginHorizontal: spacing.xl, marginBottom: spacing.xl,
    height: 140, borderRadius: radius.xxl,
    backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },

  // Section title
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.sm, paddingHorizontal: spacing.xl,
  },
  sectionBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.pill, backgroundColor: colors.bg.elevated,
  },
  flagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 3, paddingHorizontal: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated,
    marginLeft: 'auto' as any,
  },
  flagChipActive: {
    borderColor: `${colors.status.warning}60`,
    backgroundColor: `${colors.status.warning}18`,
  },

  // Gallery
  emptyText: { paddingHorizontal: spacing.xl, marginBottom: spacing.xl },
  gridWrap: { paddingHorizontal: spacing.xl, marginBottom: spacing.xl },

  // Select chip in SectionTitle
  selectChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 3, paddingHorizontal: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated,
  },
  selectChipActive: {
    borderColor: `${colors.brand.primary}60`,
    backgroundColor: `${colors.brand.primary}18`,
  },

  // Selection action bar
  selectionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  selectionCancelBtn: {
    flex: 1, height: 48, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
  },
  selectionDeleteBtn: {
    flex: 1, height: 48, borderRadius: radius.xl,
    backgroundColor: colors.status.error,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    ...shadows.sm,
  },

  // Info card
  card: {
    marginHorizontal: spacing.xl, marginBottom: spacing.xl,
    backgroundColor: colors.bg.card, borderRadius: radius.xxl,
    borderWidth: 1, borderColor: colors.border.subtle,
    paddingVertical: spacing.xs,
    ...shadows.sm,
  },
  fieldWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs },
  fieldInput: {
    color: colors.text.primary, fontSize: 14,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.bg.input,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.subtle,
    minHeight: 40,
  },
  fieldInputMulti: { minHeight: 72, textAlignVertical: 'top' },

  // Chips
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border.subtle, backgroundColor: colors.bg.card,
  },
  chipDot: { width: 5, height: 5, borderRadius: radius.round },
  chipText: { color: colors.text.muted, fontWeight: '600' },

  // Reseñas de Google
  reviewCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.subtle,
    padding: spacing.md,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reviewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewOwnerAnswer: {
    marginTop: spacing.xs, paddingTop: spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },

  // Sticky save bar
  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  stickyBtn: {
    height: 52, borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    ...shadows.md,
  },

  // Action buttons
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.sm },
  approveBtn: {
    flex: 1, height: 50, borderRadius: radius.xl,
    backgroundColor: colors.status.success,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    ...shadows.sm,
  },
  rejectBtn: {
    flex: 1, height: 50, borderRadius: radius.xl,
    backgroundColor: colors.status.error,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    ...shadows.sm,
  },
  deleteBarBtn: {
    height: 46, marginHorizontal: spacing.xl, marginTop: spacing.sm,
    borderRadius: radius.xl, borderWidth: 1,
    borderColor: `${colors.status.error}40`, backgroundColor: `${colors.status.error}0A`,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  btnDisabled: { opacity: 0.55 },

  // Viewer footer
  viewerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, paddingTop: spacing.lg,
  },
  viewerDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderRadius: radius.pill, backgroundColor: `${colors.status.error}CC`,
  },

  // Bottom sheet (rechazar)
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetContent: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl, paddingBottom: 40, paddingTop: spacing.lg,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: radius.pill,
    backgroundColor: colors.bg.elevated, alignSelf: 'center', marginBottom: spacing.xl,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  presetChip: {
    paddingVertical: spacing.xs + 1, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated,
  },
  presetChipActive: { borderColor: colors.status.error, backgroundColor: `${colors.status.error}18` },
  presetText: { color: colors.text.secondary, fontWeight: '700' },
  presetTextActive: { color: colors.status.error },
  rejectInput: {
    minHeight: 80, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    color: colors.text.primary, fontSize: 14, lineHeight: 20, textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  sheetButtons: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectConfirmBtn: {
    flex: 1, height: 48, borderRadius: radius.xl,
    backgroundColor: colors.status.error,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },
});
