import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBarRegisterStore } from '~/stores/barRegisterStore';
import PrimaryButton from '~/components/ui/PrimaryButton';
import { supabase } from '~/utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Stripe helpers no longer used
import { useFocusEffect } from '@react-navigation/native';
// Plan capabilities removed; use fixed limits
import { createAutoPreRegisterBar } from '~/services/bars';

interface ImageItem {
  id: string;
  uri: string;
  uploading: boolean;
  order: number;
}

const { width } = Dimensions.get('window');
const IMAGE_WIDTH = (width - 60) / 2; // 2 columns with padding

// Fixed global limits
const MAX_BAR_PHOTOS = 10;
const MAX_MENU_PHOTOS = 15;

// Get color for plan badge
const getPlanColor = () => '#10B981';

const Step4Photos: React.FC = () => {
  const router = useRouter();
  const { getFormData, resetForm } = useBarRegisterStore();
  
  const [loading, setLoading] = useState(false);
  const [barImages, setBarImages] = useState<ImageItem[]>([]);
  const [menuImages, setMenuImages] = useState<ImageItem[]>([]);
  const [barCreated, setBarCreated] = useState(false);
  const [planLoading] = useState(false);

  // Generate unique ID for images
  const generateId = () => Math.random().toString(36).substring(7);

  // No plan fetching needed

  // Upload single image to Supabase Storage
  const uploadSingleImage = useCallback(async (uri: string, barId: string, type: 'bar' | 'menu', order: number): Promise<string> => {
    try {
      console.log(`📸 Subiendo imagen ${type} para bar:`, barId, 'orden:', order);
      console.log('📁 URI:', uri);

      // Verificar que el archivo existe
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('📋 Info del archivo:', fileInfo);

      if (!fileInfo.exists) {
        throw new Error('El archivo no existe');
      }

      if (fileInfo.size === 0) {
        throw new Error('El archivo está vacío');
      }

      // Crear path del archivo
      const timestamp = Date.now();
      const fileName = `${barId}/${type}/${type}_${order}_${timestamp}.jpg`;

      // Método 1: Usando base64 (más confiable en simuladores iOS)
      let uploadData, uploadError;
      
      try {
        console.log('🔄 Intentando método base64...');
        
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log('📦 Base64 length:', base64.length);

        if (!base64 || base64.length === 0) {
          throw new Error('Base64 string vacío');
        }

        // Convertir base64 a ArrayBuffer
        const binaryString = atob(base64);
        const arrayBuffer = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          arrayBuffer[i] = binaryString.charCodeAt(i);
        }

        console.log('📦 ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

        const result = await supabase.storage
          .from('bar-images')
          .upload(fileName, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        uploadData = result.data;
        uploadError = result.error;

        if (!uploadError) {
          console.log('✅ Subida exitosa con base64');
        }

      } catch (base64Error) {
        console.warn('⚠️ Método base64 falló, intentando con fetch:', base64Error);
        
        // Método 2: Usando fetch como fallback
        const response = await fetch(uri);
        console.log('🌐 Fetch response status:', response.status);

        if (!response.ok) {
          throw new Error(`Fetch failed with status: ${response.status}`);
        }

        const blob = await response.blob();
        console.log('📦 Blob size:', blob.size, 'bytes');

        if (blob.size === 0) {
          throw new Error('El blob está vacío');
        }

        const result = await supabase.storage
          .from('bar-images')
          .upload(fileName, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: true,
          });

        uploadData = result.data;
        uploadError = result.error;

        if (!uploadError) {
          console.log('✅ Subida exitosa con fetch');
        }
      }

      if (uploadError) {
        console.error('❌ Error subiendo imagen:', uploadError);
        throw uploadError;
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('bar-images')
        .getPublicUrl(fileName);

      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) {
        throw new Error('No se pudo obtener la URL pública');
      }

      console.log('🔗 Public URL:', publicUrl);
      return publicUrl;

    } catch (error) {
      console.error('❌ Error en uploadSingleImage:', error);
      throw error;
    }
  }, []);

  // Upload single image for auto_pre_register_bars (cold registration)
  const uploadAutoPreRegisterImage = useCallback(async (
    uri: string,
    autoPreBarId: string,
    type: 'bar' | 'menu',
    order: number
  ): Promise<{ filePath: string; publicUrl: string }> => {
    try {
      console.log(`\n=== SUBIENDO IMAGEN PRE-REGISTRO ===`);
      console.log(`❄️ Tipo: ${type.toUpperCase()}`);
      console.log(`❄️ Auto Pre Bar ID: ${autoPreBarId}`);
      console.log(`❄️ Orden: ${order}`);

      // Verificar que el archivo existe
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('El archivo no existe o está vacío');
      }

      // Create file path: <autoPreBarId>/<type>/file.jpg (bar or menu folder)
      const timestamp = Date.now();
      const fileName = `image_${type}_${order}.png`;
      const filePath = `${autoPreBarId}/${type}/${fileName}`;

      console.log(`📁 Estructura completa del path:`);
      console.log(`   - autoPreBarId: ${autoPreBarId}`);
      console.log(`   - type (carpeta): ${type}`);
      console.log(`   - fileName: ${fileName}`);
      console.log(`   - filePath FINAL: ${filePath}`);

      // Read and upload file (same method as uploadSingleImage)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64 || base64.length === 0) {
        throw new Error('Base64 string vacío');
      }

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64);
      const arrayBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        arrayBuffer[i] = binaryString.charCodeAt(i);
      }

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bar-images')
        .upload(filePath, arrayBuffer.buffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('bar-images')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      console.log(`✅ Imagen de ${type.toUpperCase()} subida exitosamente`);
      console.log(`   - Storage path: ${filePath}`);
      console.log(`   - Public URL: ${publicUrl}`);
      console.log(`=== FIN SUBIDA ===\n`);
      
      return { filePath, publicUrl };

    } catch (error) {
      console.error('❌ Error en uploadAutoPreRegisterImage:', error);
      throw error;
    }
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permisos requeridos',
        'Necesitamos acceso a tu galería para seleccionar imágenes.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  }, []);

  // Pick images from gallery
  const pickImages = useCallback(async (type: 'bar' | 'menu') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      console.log(`📱 Seleccionando imágenes para ${type}...`);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: type === 'bar' ? [16, 9] : [3, 4],
        allowsEditing: false,
      });

      console.log(`📱 Resultado del picker:`, {
        canceled: result.canceled,
        assetsLength: result.assets?.length,
      });

      if (!result.canceled && result.assets) {
        const currentImages = type === 'bar' ? barImages : menuImages;
        const maxImages = type === 'bar' ? MAX_BAR_PHOTOS : MAX_MENU_PHOTOS;
        
        // Check if we can add more images based on user's plan
        const remainingSlots = maxImages - currentImages.length;
        if (remainingSlots <= 0) {
          Alert.alert('Límite alcanzado', `Permite hasta ${maxImages} imágenes para ${type === 'bar' ? 'fotos del bar' : 'fotos del menú'}.`);
          return;
        }

        // Take only the images that fit
        const imagesToAdd = result.assets.slice(0, remainingSlots);
        
        // Verificar cada imagen antes de agregar
        const validImages = [];
        for (const asset of imagesToAdd) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            console.log(`📋 Verificando ${asset.uri}:`, fileInfo);
            
            if (fileInfo.exists && fileInfo.size > 0) {
              validImages.push(asset);
            } else {
              console.warn(`⚠️ Imagen inválida: ${asset.uri}`);
            }
          } catch (error) {
            console.warn(`⚠️ Error verificando imagen ${asset.uri}:`, error);
          }
        }
        
        const newImages = validImages.map((asset, index) => ({
          id: generateId(),
          uri: asset.uri,
          uploading: false,
          order: currentImages.length + index + 1,
        }));

        console.log(`✅ Agregando ${newImages.length} imágenes válidas para ${type}`);

        if (type === 'bar') {
          setBarImages(prev => [...prev, ...newImages]);
        } else {
          setMenuImages(prev => [...prev, ...newImages]);
        }
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  }, [barImages, menuImages, requestPermissions]);

  // Remove image
  const removeImage = useCallback((id: string, type: 'bar' | 'menu') => {
    if (type === 'bar') {
      setBarImages(prev => {
        const filtered = prev.filter(img => img.id !== id);
        // Reorder remaining images
        return filtered.map((img, index) => ({ ...img, order: index + 1 }));
      });
    } else {
      setMenuImages(prev => {
        const filtered = prev.filter(img => img.id !== id);
        // Reorder remaining images
        return filtered.map((img, index) => ({ ...img, order: index + 1 }));
      });
    }
  }, []);

  // Handle drag end for reordering
  const handleDragEnd = useCallback((data: ImageItem[], type: 'bar' | 'menu') => {
    // Update order based on new positions
    const reorderedImages = data.map((img, index) => ({
      ...img,
      order: index + 1,
    }));

    if (type === 'bar') {
      setBarImages(reorderedImages);
    } else {
      setMenuImages(reorderedImages);
    }
  }, []);

  // Render draggable image item
  const renderImageItem = useCallback(({ item, drag, isActive }: RenderItemParams<ImageItem>, type: 'bar' | 'menu') => {
    const imageStyle = type === 'bar' 
      ? { width: IMAGE_WIDTH, height: IMAGE_WIDTH * 9 / 16 } // 16:9 ratio
      : { width: IMAGE_WIDTH, height: IMAGE_WIDTH * 4 / 3 }; // 3:4 ratio

    return (
      <TouchableOpacity
        style={[styles.imageContainer, isActive && styles.activeImageContainer]}
        onLongPress={drag}
        disabled={isActive}
      >
        <Image source={{ uri: item.uri }} style={[styles.image, imageStyle]} />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeImage(item.id, type)}
        >
          <Ionicons name="close-circle" size={24} color="#FF6B6B" />
        </TouchableOpacity>
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{item.order}</Text>
        </View>
        <View style={styles.dragHandle}>
          <Ionicons name="reorder-three" size={20} color="#666" />
        </View>
        {item.uploading && (
          <View style={styles.uploadingOverlay}>
            <Text style={styles.uploadingText}>Subiendo...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [removeImage]);

  // Insert relationships helper
  const insertRelationships = useCallback(async (barId: string, formData: any) => {
    const relationships = [
      {
        table: 'bar_languages',
        data: formData.languageIds?.map((id: string) => ({
          bar_id: barId,
          language_id: parseInt(id)
        })) || [],
      },
      {
        table: 'bar_food_types',
        data: formData.foodTypeIds?.map((id: string) => ({
          bar_id: barId,
          food_type_id: parseInt(id)
        })) || [],
      },
      {
        table: 'bar_selected_features',
        data: formData.featureIds?.map((id: string) => ({
          bar_id: barId,
          feature_id: parseInt(id)
        })) || [],
      },
    ];

    for (const { table, data } of relationships) {
      if (data.length > 0) {
        const { error } = await supabase.from(table).insert(data);
        if (error) {
          console.error(`Error inserting ${table}:`, error);
        }
      }
    }
  }, []);

  // Upload images and save to database with order
  const uploadImages = useCallback(async (barId: string, images: ImageItem[], type: 'bar' | 'menu') => {
    const table = type === 'bar' ? 'bar_images' : 'bar_menus';
    
    try {
      console.log(`📤 Subiendo ${images.length} imágenes de ${type}...`);

      // Marcar imágenes como subiendo
      if (type === 'bar') {
        setBarImages(prev => prev.map(img => ({ ...img, uploading: true })));
      } else {
        setMenuImages(prev => prev.map(img => ({ ...img, uploading: true })));
      }

      const uploadPromises = images.map(async (image) => {
        try {
          // Subir imagen
          const imageUrl = await uploadSingleImage(image.uri, barId, type, image.order);
          
          // Guardar en base de datos
          const insertData = {
            bar_id: barId,
            image_url: imageUrl,
            image_order: image.order,
          };

          const { error } = await supabase.from(table).insert(insertData);

          if (error) {
            console.error(`Error saving ${type} image to database:`, error);
            throw error;
          }

          console.log(`✅ ${type} image saved with order ${image.order}`);
          return { success: true, order: image.order };
          
        } catch (error) {
          console.error(`❌ Error uploading ${type} image order ${image.order}:`, error);
          return { success: false, order: image.order, error };
        }
      });

      const results = await Promise.all(uploadPromises);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(`📊 ${type} upload results: ${successful} exitosas, ${failed} fallidas`);

      if (failed > 0) {
        throw new Error(`${failed} de ${images.length} imágenes de ${type} no se pudieron subir`);
      }

    } catch (error) {
      console.error(`Error uploading ${type} images:`, error);
      throw error;
    } finally {
      // Quitar estado de subiendo
      if (type === 'bar') {
        setBarImages(prev => prev.map(img => ({ ...img, uploading: false })));
      } else {
        setMenuImages(prev => prev.map(img => ({ ...img, uploading: false })));
      }
    }
  }, [uploadSingleImage]);

  // Main submit handler
  const handleSubmit = useCallback(async () => {
    setLoading(true);
    
    try {
      const formData = getFormData();
      const isAutoPreRegister = formData.isAutoPreRegister || false;
      
      // Get current user for plan validation
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert('Error', 'Debes estar autenticado para registrar un bar');
        return;
      }

      // Validate fixed image limits
      const maxBarImages = MAX_BAR_PHOTOS;
      const maxMenuImages = MAX_MENU_PHOTOS;

      if (barImages.length > maxBarImages) {
        Alert.alert(
          'Límite de imágenes excedido',
          `Se permiten hasta ${maxBarImages} imágenes del bar. Tienes ${barImages.length} seleccionadas.`
        );
        setLoading(false);
        return;
      }

      if (menuImages.length > maxMenuImages) {
        Alert.alert(
          'Límite de imágenes excedido',
          `Se permiten hasta ${maxMenuImages} imágenes del menú. Tienes ${menuImages.length} seleccionadas.`
        );
        setLoading(false);
        return;
      }
      
      // Validate precise coordinates
      if (formData.latitude === 0 || formData.longitude === 0) {
        Alert.alert('Error', 'Debes seleccionar una ubicación precisa para el bar');
        return;
      }

      // Log the data being saved
      console.log('🏗️ Datos del bar a guardar:', {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
        doorNumber: formData.doorNumber,
        latitude: formData.latitude,
        longitude: formData.longitude,
        isPreciseLocation: formData.doorNumber ? 'Sí (con número de puerta)' : 'No (ubicación aproximada)'
      });
      
      // User already validated above

      console.log('🏗️ Creando bar...');

      let barData: any;

      // Check if this is auto pre-register mode (super user cold registration)
      if (isAutoPreRegister) {
        console.log('🔥 Modo registro en frío - guardando en auto_pre_register_bars');
        
        // For auto pre-register, save to auto_pre_register_bars table
        barData = await createAutoPreRegisterBar({
          name: formData.name,
          description: formData.description || null,
          email: formData.email,
          phone: formData.phone,
          website: formData.website || null,
          address: formData.address || null,
          city: formData.city || null,
          postal_code: formData.postalCode || null,
          door_number: formData.doorNumber || null,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          category_id: formData.categoryId ? parseInt(formData.categoryId) : null,
          notes: formData.notes || null,
        });

        console.log('✅ Bar pre-registrado:', barData.id);
        
        // Upload images for auto pre-register
        let uploadSuccess = true;
        let imageCount = 0;

        if (barImages.length > 0 || menuImages.length > 0) {
          console.log(`📷 Subiendo ${barImages.length + menuImages.length} imágenes para pre-registro...`);

          try {
            // Upload bar images
            console.log(`📸 Subiendo ${barImages.length} imágenes del BAR para auto-registro`);
            for (const image of barImages) {
              try {
                console.log(`📸 [BAR IMAGE] Procesando imagen ${image.order} de ${barImages.length}`);
                const { filePath, publicUrl } = await uploadAutoPreRegisterImage(
                  image.uri,
                  barData.id,
                  'bar',
                  image.order
                );

                console.log(`📁 [BAR IMAGE] Path generado: ${filePath}`);

                // Insert into auto_pre_register_bar_images
                const insertPayload = {
                  auto_pre_bar_id: barData.id,
                  file_path: filePath,
                  image_order: image.order,
                  description: 'bar',
                };
                console.log(`💾 [BAR IMAGE] Insertando en auto_pre_register_bar_images:`, insertPayload);

                const { error: insertError } = await supabase
                  .from('auto_pre_register_bar_images')
                  .insert(insertPayload);

                if (insertError) {
                  console.error('❌ Error inserting auto_pre_register_bar_images:', insertError);
                } else {
                  imageCount++;
                  console.log(`✅ [BAR IMAGE] Imagen ${image.order} guardada en auto_pre_register_bar_images`);
                }
              } catch (imageError) {
                console.error('❌ Error uploading pre-register BAR image:', imageError);
                uploadSuccess = false;
              }
            }

            // Upload menu images to auto_pre_register_bar_menus
            console.log(`🍽️ Subiendo ${menuImages.length} imágenes del MENÚ para auto-registro`);
            for (const image of menuImages) {
              try {
                console.log(`🍽️ [MENU IMAGE] Procesando imagen ${image.order} de ${menuImages.length}`);
                const { filePath, publicUrl } = await uploadAutoPreRegisterImage(
                  image.uri,
                  barData.id,
                  'menu',
                  image.order
                );

                console.log(`📁 [MENU IMAGE] Path generado: ${filePath}`);

                // Insert into auto_pre_register_bar_menus (separate table for menu images)
                const insertPayload = {
                  auto_pre_bar_id: barData.id,
                  file_path: filePath,
                  image_order: image.order,
                };
                console.log(`💾 [MENU IMAGE] Insertando en auto_pre_register_bar_menus:`, insertPayload);

                const { error: insertError } = await supabase
                  .from('auto_pre_register_bar_menus')
                  .insert(insertPayload);

                if (insertError) {
                  console.error('❌ [MENU IMAGE] Error inserting auto_pre_register_bar_menus:', insertError);
                } else {
                  imageCount++;
                  console.log(`✅ [MENU IMAGE] Imagen ${image.order} guardada en auto_pre_register_bar_menus`);
                }
              } catch (imageError) {
                console.error('❌ Error uploading pre-register MENU image:', imageError);
                uploadSuccess = false;
              }
            }

            console.log(`✅ Total de ${imageCount} imágenes subidas para pre-registro`);
          } catch (error) {
            console.error('❌ Error general subiendo imágenes pre-registro:', error);
            uploadSuccess = false;
          }
        }
        
        // Show success message and redirect
        Alert.alert(
          'Bar Registrado en Frío',
          `El bar ha sido pre-registrado exitosamente${imageCount > 0 ? ` con ${imageCount} imágenes` : ''}. Cuando el propietario se registre con el email proporcionado, podrá reclamar el perfil.`,
          [
            {
              text: 'OK',
              onPress: () => {
                resetForm();
                router.replace('/(protected)/profile' as any);
              }
            }
          ]
        );
        
        return; // Exit early for auto pre-register
        
      } else {
        // Normal registration flow
        const { data: insertedBarData, error: barError } = await supabase
        .from('bars')
        .insert({
          name: formData.name,
          description: formData.description,
          phone: formData.phone,
          website: formData.website || null,
          category_id: formData.categoryId,
          address: formData.address,
          city: formData.city,
          postal_code: formData.postalCode,
          latitude: formData.latitude || 0,
          longitude: formData.longitude || 0,
          doorNumber: formData.doorNumber,
        })
        .select()
        .single();

      if (barError) {
        throw new Error(barError.message);
      }

        barData = insertedBarData;
      console.log('✅ Bar creado:', barData.id);

      // Insert relationships
      await insertRelationships(barData.id, formData);
      }

      // Upload images with order (only for normal registration)
      let uploadSuccess = true;
      let uploadErrors: string[] = [];

      if (barImages.length > 0) {
        try {
          await uploadImages(barData.id, barImages, 'bar');
          console.log(`✅ Uploaded ${barImages.length} bar images`);
        } catch (error) {
          uploadSuccess = false;
          uploadErrors.push('fotos del bar');
          console.error('Error uploading bar images:', error);
        }
      }
      
      if (menuImages.length > 0) {
        try {
          await uploadImages(barData.id, menuImages, 'menu');
          console.log(`✅ Uploaded ${menuImages.length} menu images`);
        } catch (error) {
          uploadSuccess = false;
          uploadErrors.push('fotos del menú');
          console.error('Error uploading menu images:', error);
        }
      }

      // 5) Finalizar wizard: bar queda en verificación (pending) y aún no aparece públicamente
      console.log('✅ Bar creado. Estado: pendiente de verificación');
      
      // Mostrar pantalla de "enviado para verificación" (mejor UX que un alert)
      router.replace(`/register-bar/submitted?barId=${barData.id}` as any);

    } catch (error: any) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', error.message || 'No se pudo completar el registro. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [getFormData, insertRelationships, uploadImages, uploadAutoPreRegisterImage, barImages, menuImages, resetForm, router]);

  const handleBack = useCallback(() => {
    // Si el bar ya fue creado, mostrar alerta en lugar de navegar hacia atrás
    if (barCreated) {
      Alert.alert(
        'Navegación bloqueada',
        'No puedes volver atrás después de crear tu bar. Usa el botón "Ver mi Bar" para continuar.',
        [{ text: 'OK' }]
      );
    } else {
      router.back();
    }
  }, [router, barCreated]);

  // Bloquear navegación hacia atrás después de crear el bar
  useFocusEffect(
    React.useCallback(() => {
      // En Expo Router, no podemos usar addListener directamente
      // En su lugar, manejamos la navegación en el handleBack
    }, [barCreated])
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <Stack.Screen options={{ title: 'Fotos del Bar', headerShown: false }} />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fotos del Bar</Text>
          <View style={styles.headerSpacer} />
          {/* Plan badge removed */}
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
          </View>
          <Text style={styles.progressText}>Paso 4 de 4</Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Bar Images Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Fotos del Bar</Text>
                <Text style={styles.sectionSubtitle}>Máximo {MAX_BAR_PHOTOS} imágenes (16:9) - Mantén presionado para reordenar</Text>
              </View>
              
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => pickImages('bar')}
                disabled={loading || barImages.length >= MAX_BAR_PHOTOS}
              >
                <Ionicons name="camera" size={24} color="#007AFF" />
                <Text style={styles.addButtonText}>
                  {barImages.length >= MAX_BAR_PHOTOS ? 'Máximo alcanzado' : 'Agregar fotos del bar'}
                </Text>
              </TouchableOpacity>

              {barImages.length > 0 && (
                <View style={styles.imageGrid}>
                  <DraggableFlatList
                    data={barImages}
                    renderItem={(params: any) => renderImageItem(params, 'bar')}
                    keyExtractor={(item: ImageItem) => item.id}
                    onDragEnd={({ data }: any) => handleDragEnd(data, 'bar')}
                    numColumns={2}
                    scrollEnabled={false}
                  />
                </View>
              )}
              
              <Text style={styles.counter}>{barImages.length}/{MAX_BAR_PHOTOS} fotos</Text>
            </View>

            {/* Menu Images Section (hidden for free plan) */}
            {MAX_MENU_PHOTOS > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Fotos del Menú</Text>
                  <Text style={styles.sectionSubtitle}>Máximo {MAX_MENU_PHOTOS} imágenes (3:4) - Mantén presionado para reordenar</Text>
                </View>
                
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => pickImages('menu')}
                  disabled={loading || menuImages.length >= MAX_MENU_PHOTOS}
                >
                  <Ionicons name="restaurant" size={24} color="#007AFF" />
                  <Text style={styles.addButtonText}>
                    {menuImages.length >= MAX_MENU_PHOTOS ? 'Máximo alcanzado' : 'Agregar fotos del menú'}
                  </Text>
                </TouchableOpacity>
  
                {menuImages.length > 0 && (
                  <View style={styles.imageGrid}>
                    <DraggableFlatList
                      data={menuImages}
                      renderItem={(params: any) => renderImageItem(params, 'menu')}
                      keyExtractor={(item: ImageItem) => item.id}
                      onDragEnd={({ data }: any) => handleDragEnd(data, 'menu')}
                      numColumns={2}
                      scrollEnabled={false}
                    />
                  </View>
                )}
                
                <Text style={styles.counter}>{menuImages.length}/{MAX_MENU_PHOTOS} fotos</Text>
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#007AFF" />
              <Text style={styles.infoText}>
                Las imágenes son opcionales. El orden de las fotos importa - la primera será la imagen principal.
                Mantén presionado para reordenar.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="Finalizar Registro"
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2A38',
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
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#007AFF',
  },
  progressText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  imageGrid: {
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeImageContainer: {
    opacity: 0.8,
    transform: [{ scale: 1.05 }],
  },
  image: {
    borderRadius: 12,
    backgroundColor: '#374151',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(30, 42, 56, 0.9)',
    borderRadius: 12,
  },
  orderBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dragHandle: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(30, 42, 56, 0.9)',
    borderRadius: 8,
    padding: 4,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  counter: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'right',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
});

export default Step4Photos; 