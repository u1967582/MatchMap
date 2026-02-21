import * as React from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  Image,
  Platform,
  
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '~/utils/supabase';
import { toast, AppText } from '~/components/ds';
import { getBarTierAndCapabilities } from '~/lib/getBarPlanInfo';
import { CAP_BY_TIER, type Capabilities, type Tier } from '~/lib/planCapabilities';

interface Post {
  id: string;
  bar_id: string;
  title: string;
  description: string;
  image_url?: string;
  post_type: 'promocion' | 'evento' | 'noticia' | 'oferta';
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface Bar {
  id: string;
  name: string;
}

export default function EditPostScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [post, setPost] = React.useState<Post | null>(null);
  const [bar, setBar] = React.useState<Bar | null>(null);
  const [isOwner, setIsOwner] = React.useState(false);
  
  // Form fields
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState<string | undefined>(undefined);
  const [postType, setPostType] = React.useState<'promocion' | 'evento' | 'noticia' | 'oferta'>('noticia');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [pinned, setPinned] = React.useState(false);
  const [planTier, setPlanTier] = React.useState<Tier>('free');
  const [capabilities, setCapabilities] = React.useState<Capabilities>(CAP_BY_TIER.free);

  // Fetch post data
  React.useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Error', 'Debes iniciar sesión para editar posts');
          router.back();
          return;
        }

        // Fetch post with bar info
        const { data: postData, error: postError } = await supabase
          .from('bar_posts')
          .select(`
            *,
            bars!inner(
              id,
              name,
              owner_id
            )
          `)
          .eq('id', postId)
          .single();

        if (postError || !postData) {
          console.error('Error fetching post:', postError);
          toast.error('No se pudo cargar el post');
          router.back();
          return;
        }

        // Check if user is the owner
        const isBarOwner = postData.bars.owner_id === user.id;
        setIsOwner(isBarOwner);

        if (!isBarOwner) {
          Alert.alert('Error', 'No tienes permisos para editar este post');
          router.back();
          return;
        }

        setPost(postData);
        setBar(postData.bars);
        
        // Set form fields
        setTitle(postData.title);
        setDescription(postData.description);
        setImageUrl(postData.image_url);
        setPostType(postData.post_type);
        setStartDate(postData.start_date ? formatDateForDisplay(postData.start_date) : '');
        setEndDate(postData.end_date ? formatDateForDisplay(postData.end_date) : '');
        setIsActive(postData.is_active);
        setPinned(postData.pinned);

      } catch (error) {
        console.error('Error in fetchPost:', error);
        Alert.alert('Error', 'Ocurrió un error al cargar el post');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId, router]);

  // Load bar capabilities when bar is available
  React.useEffect(() => {
    const loadCapabilities = async () => {
      if (!bar?.id) return;
      try {
        const { tier, capabilities } = await getBarTierAndCapabilities(String(bar.id));
        setPlanTier(tier);
        setCapabilities(capabilities);
      } catch (e) {
        setPlanTier('free');
        setCapabilities(CAP_BY_TIER.free);
      }
    };
    loadCapabilities();
  }, [bar?.id]);

  // Convert DD/MM/YYYY to YYYY-MM-DD for database
  const convertToISODate = (dateString: string): string => {
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
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return isoDate;
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setImageUrl(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleSave = async () => {
    if (!post || !bar) return;

    // Validation
    if (!title.trim()) {
      toast.warning('El título es obligatorio');
      return;
    }

    if (!description.trim()) {
      toast.warning('La descripción es obligatoria');
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = imageUrl;

      // Upload new image if changed
      if (imageUrl && imageUrl !== post.image_url && !imageUrl.startsWith('http')) {
        try {
          const fileName = `post-${post.id}-${Date.now()}.jpg`;
          
          // Convert URI to Blob
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('post-images')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
            });

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            toast.error('No se pudo subir la imagen');
            return;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('post-images')
            .getPublicUrl(fileName);

          finalImageUrl = publicUrl;
        } catch (error) {
          console.error('Error processing image:', error);
          toast.error('No se pudo procesar la imagen');
          return;
        }
      }

      // Update post
      const { error: updateError } = await supabase
        .from('bar_posts')
        .update({
          title: title.trim(),
          description: description.trim(),
          image_url: finalImageUrl,
          post_type: postType,
          start_date: startDate ? convertToISODate(startDate) : null,
          end_date: endDate ? convertToISODate(endDate) : null,
          is_active: isActive,
          pinned: pinned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId);

      if (updateError) {
        console.error('Error updating post:', updateError);
        toast.error('No se pudo actualizar el post');
        return;
      }

      toast.success('Post actualizado');
      router.back();

    } catch (error) {
      console.error('Error in handleSave:', error);
      toast.error('Error al guardar el post', 'Inténtalo de nuevo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
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

              Alert.alert('Éxito', 'Post eliminado correctamente', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Error in handleDelete:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar el post');
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
          <AppText style={styles.loadingText}>Cargando...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!post || !bar) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.loadingContainer}>
          <AppText style={styles.loadingText}>Post no encontrado</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Editar Post</AppText>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <AppText style={[styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
            {saving ? 'Guardando...' : 'Guardar'}
          </AppText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bar Info */}
        <View style={styles.barInfo}>
          <AppText style={styles.barName}>{bar.name}</AppText>
          <AppText style={styles.barSubtitle}>Editando post</AppText>
        </View>

        {/* Title Input */}
        <View style={styles.inputContainer}>
          <AppText style={styles.inputLabel}>Título *</AppText>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Título del post"
            placeholderTextColor="#8E8E93"
            maxLength={100}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputContainer}>
          <AppText style={styles.inputLabel}>Descripción *</AppText>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe tu post..."
            placeholderTextColor="#8E8E93"
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        {/* Post Type */}
        <View style={styles.inputContainer}>
          <AppText style={styles.inputLabel}>Tipo de Post</AppText>
          <View style={styles.typeContainer}>
            {(['noticia', 'evento', 'promocion', 'oferta'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, postType === type && styles.typeButtonActive]}
                onPress={() => setPostType(type)}
              >
                <AppText style={[styles.typeButtonText, postType === type && styles.typeButtonTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Image Section */}
        <View style={styles.inputContainer}>
          <AppText style={styles.inputLabel}>Imagen (opcional)</AppText>
          <TouchableOpacity style={styles.imageContainer} onPress={handleImagePick}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.selectedImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={32} color="#A3B3CC" />
                <AppText style={styles.imagePlaceholderText}>Seleccionar imagen</AppText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Date Range */}
        <View style={styles.inputContainer}>
          <AppText style={styles.inputLabel}>Fechas (opcional)</AppText>
          <View style={styles.dateContainer}>
            <View style={styles.dateInput}>
              <AppText style={styles.dateLabel}>Fecha inicio</AppText>
              <TextInput
                style={styles.textInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.dateInput}>
              <AppText style={styles.dateLabel}>Fecha fin</AppText>
              <TextInput
                style={styles.textInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Options */}
        <View style={styles.inputContainer}>
          <AppText style={styles.inputLabel}>Opciones</AppText>
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setIsActive(!isActive)}
            >
              <Ionicons 
                name={isActive ? "checkmark-circle" : "ellipse-outline"} 
                size={20} 
                color={isActive ? "#10B981" : "#A3B3CC"} 
              />
              <AppText style={styles.optionText}>Post activo</AppText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setPinned(!pinned)}
            >
              <Ionicons 
                name={pinned ? "checkmark-circle" : "ellipse-outline"} 
                size={20} 
                color={pinned ? "#10B981" : "#A3B3CC"} 
              />
              <AppText style={styles.optionText}>Destacar post</AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
          <AppText style={styles.deleteButtonText}>Eliminar Post</AppText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
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
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  barInfo: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
    marginBottom: 20,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  barSubtitle: {
    color: '#A3B3CC',
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2A3A4A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#374151',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  typeButtonActive: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  typeButtonText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2A3A4A',
    borderWidth: 1,
    borderColor: '#374151',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#A3B3CC',
    fontSize: 16,
    marginTop: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    color: '#A3B3CC',
    fontSize: 14,
    marginBottom: 4,
  },
  optionsContainer: {
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 40,
    gap: 8,
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
}); 