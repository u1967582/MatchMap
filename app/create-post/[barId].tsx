import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';
import CustomButton from '~/components/ui/CustomButton';
import ScreenTitle from '~/components/ui/ScreenTitle';
import { getBarTierAndCapabilities } from '~/lib/getBarPlanInfo';
import { CAP_BY_TIER, type Capabilities, type Tier } from '~/lib/planCapabilities';

interface PostFormData {
  title: string;
  description: string;
  post_type: 'promocion' | 'evento' | 'noticia' | 'oferta';
  start_date: string;
  end_date: string;
  image_url?: string;
  is_active: boolean;
  pinned: boolean;
}

const POST_TYPES = [
  { value: 'promocion', label: 'Promoción', icon: 'pricetag', color: '#10B981' },
  { value: 'evento', label: 'Evento', icon: 'calendar', color: '#3B82F6' },
  { value: 'noticia', label: 'Noticia', icon: 'newspaper', color: '#8B5CF6' },
  { value: 'oferta', label: 'Oferta', icon: 'gift', color: '#F59E0B' },
];

export default function CreatePostScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  
  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    description: '',
    post_type: 'noticia',
    start_date: '',
    end_date: '',
    is_active: true,
    pinned: false,
  });
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [planTier, setPlanTier] = useState<Tier>('free');
  const [capabilities, setCapabilities] = useState<Capabilities>(CAP_BY_TIER.free);

  const handleBack = useCallback(() => {
    if (formData.title || formData.description || selectedImage) {
      Alert.alert(
        'Descartar cambios',
        '¿Estás seguro de que quieres salir? Se perderán los cambios no guardados.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }, [router, formData, selectedImage]);

  const handleSelectImage = useCallback(async () => {
    const hasPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (hasPermission.status !== 'granted') {
      Alert.alert(
        'Permisos requeridos',
        'Necesitamos acceso a tu galería para seleccionar una imagen.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Seleccionar imagen',
      'Elige una opción',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Galería', onPress: () => pickImageFromGallery() },
        { text: 'Cámara', onPress: () => pickImageFromCamera() },
      ]
    );
  }, []);

  const pickImageFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length) {
        const file = result.assets[0];
        if (file.uri) {
          const fileInfo = await FileSystem.getInfoAsync(file.uri);
          if (fileInfo.exists && fileInfo.size > 0) {
            setSelectedImage(file.uri);
          }
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      toast.error('No se pudo seleccionar la imagen');
    }
  }, []);

  const pickImageFromCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara para tomar una foto.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length) {
        const file = result.assets[0];
        if (file.uri) {
          const fileInfo = await FileSystem.getInfoAsync(file.uri);
          if (fileInfo.exists && fileInfo.size > 0) {
            setSelectedImage(file.uri);
          }
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  }, []);

  const uploadPostImage = useCallback(async (uri: string, postId: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      console.log('📸 Uploading post image for:', postId);

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Invalid file');
      }

      const timestamp = Date.now();
      const fileName = `${barId}/posts/post_${postId}_${timestamp}.jpg`;

      // Use the same robust upload method as profile images
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (!base64) throw new Error('Base64 conversion failed');

        const binaryString = atob(base64);
        const arrayBuffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          arrayBuffer[i] = binaryString.charCodeAt(i);
        }

        const { data, error } = await supabase.storage
          .from('bar-images')
          .upload(fileName, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('bar-images')
          .getPublicUrl(fileName);

        return urlData?.publicUrl || null;
      } catch (base64Error) {
        // Fallback to fetch method
        const response = await fetch(uri);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const blob = await response.blob();
        if (blob.size === 0) throw new Error('Empty blob');

        const { data, error } = await supabase.storage
          .from('bar-images')
          .upload(fileName, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: true,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('bar-images')
          .getPublicUrl(fileName);

        return urlData?.publicUrl || null;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }, [barId]);

  // Load bar capabilities
  useEffect(() => {
    const load = async () => {
      if (!barId) return;
      try {
        const { tier, capabilities } = await getBarTierAndCapabilities(String(barId));
        setPlanTier(tier);
        setCapabilities(capabilities);
      } catch (e) {
        setPlanTier('free');
        setCapabilities(CAP_BY_TIER.free);
      }
    };
    load();
  }, [barId]);

  const handleCreatePost = useCallback(async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.warning('El título y la descripción son obligatorios');
      return;
    }

    if (!barId) {
      toast.error('ID del bar no válido');
      return;
    }

    setLoading(true);

    try {
      // Enforce posts_limit per bar plan
      const maxPosts = capabilities.posts_limit === 'unlimited' ? Infinity : capabilities.posts_limit;
      if (maxPosts !== Infinity) {
        const { count } = await supabase
          .from('bar_posts')
          .select('id', { count: 'exact', head: true })
          .eq('bar_id', barId);
        if (typeof count === 'number' && count >= maxPosts) {
          Alert.alert('Límite de publicaciones', `Tu plan ${planTier} permite máximo ${maxPosts} publicaciones.`);
          setLoading(false);
          return;
        }
      }

      // First create the post without image
      const postData = {
        bar_id: barId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        post_type: formData.post_type,
        start_date: formData.start_date ? convertToISODate(formData.start_date) : null,
        end_date: formData.end_date ? convertToISODate(formData.end_date) : null,
        is_active: formData.is_active,
        pinned: formData.pinned,
      };

      const { data: newPost, error: postError } = await supabase
        .from('bar_posts')
        .insert(postData)
        .select()
        .single();

      if (postError) {
        console.error('Error creating post:', postError);
        toast.error('No se pudo crear el post');
        return;
      }

      // Upload image if selected
      let imageUrl = null;
      if (selectedImage && newPost) {
        try {
          imageUrl = await uploadPostImage(selectedImage, newPost.id);
          
          if (imageUrl) {
            // Update post with image URL
            const { error: updateError } = await supabase
              .from('bar_posts')
              .update({ image_url: imageUrl })
              .eq('id', newPost.id);

            if (updateError) {
              console.error('Error updating post with image:', updateError);
            }
          }
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
          toast.warning('Post creado, pero no se pudo subir la imagen');
          router.back();
          return;
        }
      }

      toast.success('Post creado correctamente');
      router.back();

    } catch (error) {
      console.error('Error in handleCreatePost:', error);
      toast.error('Error al crear el post', 'Inténtalo de nuevo');
    } finally{
      setLoading(false);
    }
  }, [formData, barId, selectedImage, uploadPostImage, router]);

  // Convert DD/MM/YYYY to YYYY-MM-DD for database
  const convertToISODate = useCallback((dateString: string): string => {
    if (!dateString) return '';
    // If already in ISO format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateString;
  }, []);

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  const formatDateForDisplay = useCallback((isoDate: string): string => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return isoDate;
  }, []);

  const handleDateChange = useCallback((field: 'start_date' | 'end_date', value: string) => {
    // Store the display format in state, will convert to ISO when saving
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBack}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <ScreenTitle 
            title="Crear Post" 
            color="#FFFFFF" 
            shadow={false}
            marginBottom={0}
            fontSize={20}
          />
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.contentContainer}>
            
            {/* Post Type Selection */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Tipo de Post</Text>
              <View style={styles.postTypeGrid}>
                {POST_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.postTypeButton,
                      formData.post_type === type.value && [
                        styles.postTypeButtonActive,
                        { borderColor: type.color }
                      ]
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, post_type: type.value as any }))}
                    disabled={loading}
                  >
                    <Ionicons 
                      name={type.icon as any} 
                      size={20} 
                      color={formData.post_type === type.value ? type.color : '#A3B3CC'} 
                    />
                    <Text style={[
                      styles.postTypeButtonText,
                      formData.post_type === type.value && { color: type.color }
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Title */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Título *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ingresa el título del post"
                placeholderTextColor="#8E8E93"
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                editable={!loading}
                maxLength={100}
              />
            </View>

            {/* Description */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Descripción *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe tu post..."
                placeholderTextColor="#8E8E93"
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading}
                maxLength={500}
              />
            </View>

            {/* Image Selection */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Imagen (Opcional)</Text>
              <TouchableOpacity
                style={styles.imageSelector}
                onPress={handleSelectImage}
                disabled={loading || uploadingImage}
              >
                {selectedImage ? (
                  <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera" size={32} color="#A3B3CC" />
                    <Text style={styles.imagePlaceholderText}>Toca para agregar imagen</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Date Range */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Fechas</Text>
              <View style={styles.dateContainer}>
                <View style={styles.dateField}>
                  <Text style={styles.dateFieldLabel}>Fecha inicio</Text>
                  <View style={styles.dateInputContainer}>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#8E8E93"
                      value={formData.start_date}
                      onChangeText={(text) => handleDateChange('start_date', text)}
                      editable={!loading}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.todayButton}
                      onPress={() => {
                        const today = new Date();
                        const day = String(today.getDate()).padStart(2, '0');
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const year = today.getFullYear();
                        handleDateChange('start_date', `${day}/${month}/${year}`);
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.todayButtonText}>Hoy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.dateFieldLabel}>Fecha fin</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor="#8E8E93"
                    value={formData.end_date}
                    onChangeText={(text) => handleDateChange('end_date', text)}
                    editable={!loading}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* Options */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Opciones</Text>
              
              <TouchableOpacity 
                style={styles.optionRow}
                onPress={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                disabled={loading}
              >
                <View style={styles.optionLeft}>
                  <Ionicons name="eye" size={20} color="#A3B3CC" />
                  <Text style={styles.optionText}>Post activo</Text>
                </View>
                <View style={[styles.toggle, formData.is_active && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, formData.is_active && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionRow}
                onPress={() => setFormData(prev => ({ ...prev, pinned: !prev.pinned }))}
                disabled={loading}
              >
                <View style={styles.optionLeft}>
                  <Ionicons name="pin" size={20} color="#A3B3CC" />
                  <Text style={styles.optionText}>Post destacado</Text>
                </View>
                <View style={[styles.toggle, formData.pinned && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, formData.pinned && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Create Button */}
            <View style={styles.buttonContainer}>
              <CustomButton
                text="Crear Post"
                onPress={handleCreatePost}
                variant="primary"
                loading={loading}
                disabled={loading || !formData.title.trim() || !formData.description.trim()}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  postTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  postTypeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#2A3A4A',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  postTypeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
  },
  postTypeButtonText: {
    color: '#A3B3CC',
    fontSize: 12,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  imageSelector: {
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    color: '#A3B3CC',
    fontSize: 14,
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  dateFieldLabel: {
    color: '#A3B3CC',
    fontSize: 14,
    marginBottom: 8,
  },
  dateInput: {
    backgroundColor: '#2A3A4A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  todayButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  toggle: {
    width: 50,
    height: 28,
    backgroundColor: '#4A5568',
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  buttonContainer: {
    marginTop: 20,
  },
}); 