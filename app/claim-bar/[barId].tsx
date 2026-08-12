import React, { useEffect, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '~/utils/supabase';
import {
  AppText,
  AppButton,
  AppInput,
  toast,
  colors,
  spacing,
  radius,
} from '~/components/ds';

interface BarSummary {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  owner_id: string | null;
}

export default function ClaimBarScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();

  const [bar, setBar] = useState<BarSummary | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [message, setMessage] = useState('');
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingBar, setLoadingBar] = useState(true);

  useEffect(() => {
    if (!barId) return;
    (async () => {
      const { data } = await supabase
        .from('bars')
        .select('id, name, address, city, phone, owner_id')
        .eq('id', barId)
        .single();
      if (data) setBar(data as BarSummary);
      setLoadingBar(false);
    })();
  }, [barId]);

  const handlePickDocument = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.warning('Necesitamos acceso a la galería para subir el documento');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (result.canceled || !result.assets[0]) return;

      const imageUri = result.assets[0].uri;
      setDocumentUri(imageUri);
      await uploadDocument(imageUri);
    } catch (error) {
      console.error('❌ Error picking document:', error);
      toast.error('No se pudo seleccionar la imagen', 'Inténtalo de nuevo');
    }
  };

  const uploadDocument = async (imageUri: string) => {
    if (!barId) return;

    setUploadingDocument(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Debes iniciar sesión');
        return;
      }

      const fileName = `${user.id}/${barId}-${Date.now()}.jpg`;
      const fileUri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: 'image/jpeg',
        name: fileName,
      } as any);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bar-claim-documents')
        .upload(fileName, formData as any, {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.error('❌ Error uploading document:', uploadError);
        toast.error('No se pudo subir el documento', uploadError.message);
        setDocumentUri(null);
        return;
      }

      setDocumentPath(uploadData.path);
    } catch (error) {
      console.error('❌ Error uploading document:', error);
      toast.error('No se pudo subir el documento', 'Inténtalo de nuevo');
      setDocumentUri(null);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleRemoveDocument = () => {
    setDocumentUri(null);
    setDocumentPath(null);
  };

  const handleSubmit = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.warning('Completa tu nombre y teléfono');
      return;
    }
    if (!documentPath) {
      toast.warning('Sube una foto de un documento que demuestre que eres el propietario');
      return;
    }
    if (!barId) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Debes iniciar sesión');
        return;
      }

      const { error } = await supabase.from('bar_claims').insert({
        bar_id: barId,
        claimant_id: user.id,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        message: message.trim() || null,
        document_path: documentPath,
      });

      if (error) {
        if (error.code === '23505') {
          toast.warning('Ya has enviado una solicitud para este bar');
        } else {
          toast.supabaseError(error, 'Este bar ya tiene una solicitud o propietario');
        }
        return;
      }

      toast.success('Solicitud enviada', 'La revisaremos pronto');
      router.back();
    } catch (error) {
      console.error('❌ Error claiming bar:', error);
      toast.error('No se pudo enviar la solicitud', 'Inténtalo de nuevo');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && !uploadingDocument && !!contactName.trim() && !!contactPhone.trim() && !!documentPath;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="h2">Reclamar bar</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {bar && (
          <View style={styles.barCard}>
            <Ionicons name="storefront-outline" size={22} color={colors.brand.link} />
            <View style={styles.barCardText}>
              <AppText variant="title" numberOfLines={1}>{bar.name}</AppText>
              <AppText variant="caption" color={colors.text.secondary} numberOfLines={1}>
                {(bar.address || 'Sin dirección') + (bar.city ? `, ${bar.city}` : '')}
              </AppText>
              {bar.phone ? (
                <AppText variant="caption" color={colors.text.secondary}>Tel. guardado: {bar.phone}</AppText>
              ) : null}
            </View>
          </View>
        )}

        {!loadingBar && bar?.owner_id ? (
          <View style={styles.warningBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.status.warning} />
            <AppText variant="caption" color={colors.text.secondary} style={styles.warningText}>
              Este bar ya tiene un propietario asignado. Si crees que es un error, contacta con soporte.
            </AppText>
          </View>
        ) : (
          <View style={styles.section}>
            <AppText variant="body" color={colors.text.secondary} style={styles.intro}>
              Cuéntanos quién eres para poder verificar que este bar es tuyo. Revisaremos tu solicitud manualmente.
            </AppText>

            <AppInput
              label="Tu nombre"
              placeholder="Nombre y apellidos"
              value={contactName}
              onChangeText={setContactName}
              autoCapitalize="words"
            />

            <AppInput
              label="Teléfono de contacto"
              placeholder="Ej. 600 000 000"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />

            <AppText variant="label" style={styles.messageLabel}>Documento de verificación</AppText>
            <AppText variant="caption" color={colors.text.secondary} style={styles.documentHint}>
              Sube una foto de un documento que demuestre que este bar es tuyo (licencia de actividad, factura o recibo a nombre del bar).
            </AppText>

            {documentUri ? (
              <View style={styles.documentPreviewWrapper}>
                <Image source={{ uri: documentUri }} style={styles.documentPreview} />
                {uploadingDocument ? (
                  <View style={styles.documentUploadingOverlay}>
                    <AppText variant="caption" color="#FFFFFF">Subiendo...</AppText>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.documentRemoveButton} onPress={handleRemoveDocument}>
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity style={styles.documentPickButton} onPress={handlePickDocument}>
                <Ionicons name="camera-outline" size={20} color={colors.brand.link} />
                <AppText variant="label" color={colors.brand.link}>Subir foto del documento</AppText>
              </TouchableOpacity>
            )}

            <AppText variant="label" style={styles.messageLabel}>Contexto adicional (opcional)</AppText>
            <View style={styles.textInputWrapper}>
              <TextInput
                placeholder="Añade cualquier detalle que nos ayude a verificar tu solicitud..."
                placeholderTextColor={colors.text.muted}
                value={message}
                onChangeText={setMessage}
                multiline
                style={styles.textInput}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {!loadingBar && !bar?.owner_id && (
        <View style={styles.bottomBar}>
          <AppButton
            text={loading ? 'Enviando...' : 'Enviar solicitud'}
            onPress={handleSubmit}
            variant="primary"
            loading={loading}
            disabled={!canSubmit}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerSpacer: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  barCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  barCardText: {
    flex: 1,
    gap: spacing.xxs,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
  },
  warningText: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  intro: {
    marginBottom: spacing.lg,
  },
  messageLabel: {
    marginBottom: spacing.sm,
  },
  documentHint: {
    marginBottom: spacing.md,
  },
  documentPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    backgroundColor: colors.alpha.brandLight,
    paddingVertical: spacing.lg - 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.alpha.brandBorder,
    marginBottom: spacing.xl,
  },
  documentPreviewWrapper: {
    marginBottom: spacing.xl,
    alignSelf: 'flex-start',
  },
  documentPreview: {
    width: 140,
    height: 140,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  documentUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: radius.round,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInputWrapper: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  textInput: {
    minHeight: 100,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});
