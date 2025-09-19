import * as React from 'react';
import { 
  View, 
  Text, 
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
import { getEffectiveCapabilities } from '~/lib/getEffectivePlan';
import { CAP_BY_TIER, type Tier } from '~/lib/planCapabilities';

interface Bar {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  phone?: string;
  website?: string;
  category_id?: number;
  latitude?: number;
  longitude?: number;
  postal_code?: string;
  owner_id: string;
}

interface BarImage {
  id: string;
  bar_id: string;
  image_url: string;
  image_order: number;
  image_type: 'bar' | 'menu';
}

interface BarCategory {
  id: string;
  bar_id: string;
  category_type: 'food_type' | 'language' | 'feature';
  category_id: number;
  category_name: string;
}

interface Category {
  id: number;
  name: string;
}

export default function EditBarInfoScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [bar, setBar] = React.useState<Bar | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isOwner, setIsOwner] = React.useState(false);
  
  // Form fields
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [city, setCity] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | null>(null);
  
  // Images state
  const [barImages, setBarImages] = React.useState<BarImage[]>([]);
  const [menuImages, setMenuImages] = React.useState<BarImage[]>([]);
  const [userPlan, setUserPlan] = React.useState<Tier>('free');
  const [planLoading, setPlanLoading] = React.useState(true);
  
  // Categories state
  const [foodTypes, setFoodTypes] = React.useState<BarCategory[]>([]);
  const [languages, setLanguages] = React.useState<BarCategory[]>([]);
  const [features, setFeatures] = React.useState<BarCategory[]>([]);
  
  // Available categories for selection
  const [availableFoodTypes, setAvailableFoodTypes] = React.useState<Category[]>([]);
  const [availableLanguages, setAvailableLanguages] = React.useState<Category[]>([]);
  const [availableFeatures, setAvailableFeatures] = React.useState<Category[]>([]);

  // Fetch bar data and categories
  React.useEffect(() => {
    const fetchBarData = async () => {
      if (!barId) return;

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Error', 'Debes iniciar sesión para editar información del bar');
          router.back();
          return;
        }

        // Fetch bar data
        const { data: barData, error: barError } = await supabase
          .from('bars')
          .select('*')
          .eq('id', barId)
          .single();

        if (barError || !barData) {
          console.error('Error fetching bar:', barError);
          Alert.alert('Error', 'No se pudo cargar la información del bar');
          router.back();
          return;
        }

        // Check if user is the owner
        const isBarOwner = barData.owner_id === user.id;
        setIsOwner(isBarOwner);

        if (!isBarOwner) {
          Alert.alert('Error', 'No tienes permisos para editar este bar');
          router.back();
          return;
        }

        setBar(barData);
        
        // Set form fields
        setName(barData.name);
        setDescription(barData.description || '');
        setAddress(barData.address);
        setCity(barData.city);
        setPhone(barData.phone || '');
        setWebsite(barData.website || '');
        setSelectedCategoryId(barData.category_id || null);

        // Load bar images
        const { data: barImagesData, error: barImagesError } = await supabase
          .from('bar_images')
          .select('*')
          .eq('bar_id', barId)
          .order('image_order');

        if (!barImagesError && barImagesData) {
          setBarImages(barImagesData);
          console.log('📸 Bar images loaded:', barImagesData.length);
        }

        // Load menu images
        const { data: menuImagesData, error: menuImagesError } = await supabase
          .from('bar_menus')
          .select('*')
          .eq('bar_id', barId)
          .order('image_order');

        if (!menuImagesError && menuImagesData) {
          setMenuImages(menuImagesData);
          console.log('🍽️ Menu images loaded:', menuImagesData.length);
        }

        // Load N:N relationships separately (only IDs first)
        const { data: foodTypes } = await supabase
          .from('bar_food_types')
          .select('bar_id, food_type_id')
          .eq('bar_id', barId);

        const { data: languages } = await supabase
          .from('bar_languages')
          .select('bar_id, language_id')
          .eq('bar_id', barId);

        const { data: features } = await supabase
          .from('bar_selected_features')
          .select('bar_id, feature_id')
          .eq('bar_id', barId);

        console.log('🔍 Edit bar N:N data loaded:', {
          foodTypes: foodTypes?.length || 0,
          languages: languages?.length || 0,
          features: features?.length || 0,
          foodTypeIds: foodTypes?.map(item => item.food_type_id) || [],
          languageIds: languages?.map(item => item.language_id) || [],
          featureIds: features?.map(item => item.feature_id) || []
        });

        // Load food type names
        const foodTypeIds = foodTypes?.map(item => item.food_type_id) || [];
        const { data: foodTypeNames } = await supabase
          .from('food_types')
          .select('id, name')
          .in('id', foodTypeIds);

        // Load language names
        const languageIds = languages?.map(item => item.language_id) || [];
        const { data: languageNames } = await supabase
          .from('languages')
          .select('id, name')
          .in('id', languageIds);

        // Load feature names
        const featureIds = features?.map(item => item.feature_id) || [];
        const { data: featureNames } = await supabase
          .from('bar_features')
          .select('id, name')
          .in('id', featureIds);

        // Create maps for quick lookup
        const foodTypeMap = new Map();
        foodTypeNames?.forEach(item => foodTypeMap.set(item.id, item.name));

        const languageMap = new Map();
        languageNames?.forEach(item => languageMap.set(item.id, item.name));

        const featureMap = new Map();
        featureNames?.forEach(item => featureMap.set(item.id, item.name));

        console.log('🔍 Edit bar names loaded:', {
          foodTypeNames: foodTypeNames?.length || 0,
          languageNames: languageNames?.length || 0,
          featureNames: featureNames?.length || 0,
          foodTypeMap: Object.fromEntries(foodTypeMap),
          languageMap: Object.fromEntries(languageMap),
          featureMap: Object.fromEntries(featureMap)
        });

        // Set food types
        const foodTypesData: BarCategory[] = foodTypes?.map(item => ({
          id: `${item.bar_id}-food-${item.food_type_id}`,
          bar_id: barId,
          category_type: 'food_type',
          category_id: item.food_type_id,
          category_name: foodTypeMap.get(item.food_type_id) || 'Unknown',
        })) || [];
        setFoodTypes(foodTypesData);
        console.log('🍕 Food types loaded:', foodTypesData.length);

        // Set languages
        const languagesData: BarCategory[] = languages?.map(item => ({
          id: `${item.bar_id}-language-${item.language_id}`,
          bar_id: barId,
          category_type: 'language',
          category_id: item.language_id,
          category_name: languageMap.get(item.language_id) || 'Unknown',
        })) || [];
        setLanguages(languagesData);
        console.log('🌍 Languages loaded:', languagesData.length);

        // Set features
        const featuresData: BarCategory[] = features?.map(item => ({
          id: `${item.bar_id}-feature-${item.feature_id}`,
          bar_id: barId,
          category_type: 'feature',
          category_id: item.feature_id,
          category_name: featureMap.get(item.feature_id) || 'Unknown',
        })) || [];
        setFeatures(featuresData);
        console.log('⭐ Features loaded:', featuresData.length);

        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('bar_categories')
          .select('id, name')
          .order('name');

        if (!categoriesError && categoriesData) {
          setCategories(categoriesData);
        }

        // Fetch available food types, languages, and features
        const { data: availableFoodTypesData, error: foodTypesError } = await supabase
          .from('food_types')
          .select('*')
          .order('name');

        const { data: availableLanguagesData, error: languagesError } = await supabase
          .from('languages')
          .select('*')
          .order('name');

        const { data: availableFeaturesData, error: featuresError } = await supabase
          .from('bar_features')
          .select('*')
          .order('name');

        if (!foodTypesError && availableFoodTypesData) {
          setAvailableFoodTypes(availableFoodTypesData);
        }
        if (!languagesError && availableLanguagesData) {
          setAvailableLanguages(availableLanguagesData);
        }
        if (!featuresError && availableFeaturesData) {
          setAvailableFeatures(availableFeaturesData);
        }

      } catch (error) {
        console.error('Error in fetchBarData:', error);
        Alert.alert('Error', 'Ocurrió un error al cargar la información del bar');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchBarData();
  }, [barId, router]);

  // Load user's plan to determine image limits
  React.useEffect(() => {
    const loadPlan = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUserPlan('free');
          return;
        }
        const { tier } = await getEffectiveCapabilities(user.id);
        setUserPlan((tier as Tier) ?? 'free');
      } catch (e) {
        setUserPlan('free');
      } finally {
        setPlanLoading(false);
      }
    };
    loadPlan();
  }, []);

  const barImagesLimit = React.useMemo(() => CAP_BY_TIER[userPlan].bar_images_limit, [userPlan]);
  const menuImagesLimit = React.useMemo(() => (userPlan === 'free' ? 0 : 15), [userPlan]);

  const handleAddBarImage = async () => {
    try {
      if (barImages.length >= barImagesLimit) {
        Alert.alert('Límite alcanzado', `Tu plan ${userPlan} permite hasta ${barImagesLimit} imágenes del bar.`);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadBarImage(imageUri, 'bar');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleAddMenuImage = async () => {
    try {
      if (menuImagesLimit === 0) {
        Alert.alert('Plan insuficiente', 'Tu plan actual no permite subir imágenes del menú.');
        return;
      }
      if (menuImages.length >= menuImagesLimit) {
        Alert.alert('Límite alcanzado', `Tu plan ${userPlan} permite hasta ${menuImagesLimit} imágenes del menú.`);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadBarImage(imageUri, 'menu');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadBarImage = async (imageUri: string, imageType: 'bar' | 'menu') => {
    try {
      const fileName = `bar-${barId}-${imageType}-${Date.now()}.jpg`;
      
      // Convert URI to Blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bar-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        Alert.alert('Error', 'No se pudo subir la imagen');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('bar-images')
        .getPublicUrl(fileName);

      // Get max order for this type
      const currentImages = imageType === 'bar' ? barImages : menuImages;
      const maxOrder = currentImages.length > 0 ? Math.max(...currentImages.map(img => img.image_order)) : 0;

      // Insert new image in correct table
      const tableName = imageType === 'bar' ? 'bar_images' : 'bar_menus';
      
      const { data: newImage, error: insertError } = await supabase
        .from(tableName)
        .insert({
          bar_id: barId,
          image_url: publicUrl,
          image_order: maxOrder + 1,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting image:', insertError);
        Alert.alert('Error', 'No se pudo guardar la imagen');
        return;
      }

      // Update local state
      if (imageType === 'bar') {
        setBarImages(prev => [...prev, newImage]);
        console.log('📸 Bar image added:', newImage.id);
      } else {
        setMenuImages(prev => [...prev, newImage]);
        console.log('🍽️ Menu image added:', newImage.id);
      }

      Alert.alert('Éxito', `${imageType === 'bar' ? 'Imagen del bar' : 'Imagen del menú'} añadida correctamente`);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'No se pudo procesar la imagen');
    }
  };

  const handleDeleteImage = async (imageId: string, imageType: 'bar' | 'menu') => {
    Alert.alert(
      'Eliminar Imagen',
      '¿Estás seguro de que quieres eliminar esta imagen?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const tableName = imageType === 'bar' ? 'bar_images' : 'bar_menus';
              
              const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', imageId);

              if (error) {
                console.error('Error deleting image:', error);
                Alert.alert('Error', 'No se pudo eliminar la imagen');
                return;
              }

              // Update local state
              if (imageType === 'bar') {
                setBarImages(prev => prev.filter(img => img.id !== imageId));
              } else {
                setMenuImages(prev => prev.filter(img => img.id !== imageId));
              }

              Alert.alert('Éxito', 'Imagen eliminada correctamente');
            } catch (error) {
              console.error('Error in handleDeleteImage:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar la imagen');
            }
          },
        },
      ]
    );
  };

  const handleReorderImages = async (imageType: 'bar' | 'menu', images: BarImage[]) => {
    try {
      const tableName = imageType === 'bar' ? 'bar_images' : 'bar_menus';
      
      // Update all images with new order
      const updates = images.map((image, index) => ({
        id: image.id,
        image_order: index + 1,
      }));

      const { error } = await supabase
        .from(tableName)
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error('Error reordering images:', error);
        Alert.alert('Error', 'No se pudo reordenar las imágenes');
        return;
      }

      // Update local state
      if (imageType === 'bar') {
        setBarImages(images);
      } else {
        setMenuImages(images);
      }

      Alert.alert('Éxito', 'Orden de imágenes actualizado correctamente');
    } catch (error) {
      console.error('Error in handleReorderImages:', error);
      Alert.alert('Error', 'Ocurrió un error al reordenar las imágenes');
    }
  };

  const handleAddCategory = async (categoryType: 'food_type' | 'language' | 'feature', categoryId: number, categoryName: string) => {
    try {
      let tableName: string;
      let columnName: string;

      switch (categoryType) {
        case 'food_type':
          tableName = 'bar_food_types';
          columnName = 'food_type_id';
          break;
        case 'language':
          tableName = 'bar_languages';
          columnName = 'language_id';
          break;
        case 'feature':
          tableName = 'bar_selected_features';
          columnName = 'feature_id';
          break;
        default:
          throw new Error('Invalid category type');
      }

      const { error } = await supabase
        .from(tableName)
        .insert({
          bar_id: barId,
          [columnName]: categoryId,
        });

      if (error) {
        console.error('Error adding category:', error);
        Alert.alert('Error', 'No se pudo añadir la categoría');
        return;
      }

      // Update local state
      const newBarCategory: BarCategory = {
        id: `${barId}-${categoryType === 'food_type' ? 'food' : categoryType === 'language' ? 'language' : 'feature'}-${categoryId}`,
        bar_id: barId,
        category_type: categoryType,
        category_id: categoryId,
        category_name: categoryName,
      };

      if (categoryType === 'food_type') {
        setFoodTypes(prev => [...prev, newBarCategory]);
        console.log('🍕 Food type added:', categoryName);
      } else if (categoryType === 'language') {
        setLanguages(prev => [...prev, newBarCategory]);
        console.log('🌍 Language added:', categoryName);
      } else {
        setFeatures(prev => [...prev, newBarCategory]);
        console.log('⭐ Feature added:', categoryName);
      }

      Alert.alert('Éxito', `${categoryType === 'food_type' ? 'Tipo de comida' : categoryType === 'language' ? 'Idioma' : 'Característica'} añadido correctamente`);
    } catch (error) {
      console.error('Error in handleAddCategory:', error);
      Alert.alert('Error', 'Ocurrió un error al añadir la categoría');
    }
  };

  const handleRemoveCategory = async (categoryId: string, categoryType: 'food_type' | 'language' | 'feature') => {
    Alert.alert(
      'Eliminar Categoría',
      '¿Estás seguro de que quieres eliminar esta categoría?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              let tableName: string;
              let columnName: string;

              switch (categoryType) {
                case 'food_type':
                  tableName = 'bar_food_types';
                  columnName = 'food_type_id';
                  break;
                case 'language':
                  tableName = 'bar_languages';
                  columnName = 'language_id';
                  break;
                case 'feature':
                  tableName = 'bar_selected_features';
                  columnName = 'feature_id';
                  break;
                default:
                  throw new Error('Invalid category type');
              }

              // Extract the actual ID from the generated ID
              const actualId = parseInt(categoryId.split('-').pop() || '0');

              const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('bar_id', barId)
                .eq(columnName, actualId);

              if (error) {
                console.error('Error deleting category:', error);
                Alert.alert('Error', 'No se pudo eliminar la categoría');
                return;
              }

              // Update local state
              if (categoryType === 'food_type') {
                setFoodTypes(prev => prev.filter(cat => cat.id !== categoryId));
                console.log('🍕 Food type removed');
              } else if (categoryType === 'language') {
                setLanguages(prev => prev.filter(cat => cat.id !== categoryId));
                console.log('🌍 Language removed');
              } else {
                setFeatures(prev => prev.filter(cat => cat.id !== categoryId));
                console.log('⭐ Feature removed');
              }

              Alert.alert('Éxito', `${categoryType === 'food_type' ? 'Tipo de comida' : categoryType === 'language' ? 'Idioma' : 'Característica'} eliminado correctamente`);
            } catch (error) {
              console.error('Error in handleRemoveCategory:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar la categoría');
            }
          },
        },
      ]
    );
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre del bar es obligatorio');
      return false;
    }

    // Validate phone format (optional)
    if (phone.trim() && !/^[\+]?[0-9\s\-\(\)]{9,}$/.test(phone.trim())) {
      Alert.alert('Error', 'El formato del teléfono no es válido');
      return false;
    }

    // Validate website format (optional)
    if (website.trim() && !/^https?:\/\/.+/.test(website.trim())) {
      Alert.alert('Error', 'El formato de la URL no es válido (debe empezar con http:// o https://)');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!bar) return;

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      // Update bar (only editable fields)
      const { error: updateError } = await supabase
        .from('bars')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          category_id: selectedCategoryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', barId);

      if (updateError) {
        console.error('Error updating bar:', updateError);
        Alert.alert('Error', 'No se pudo actualizar la información del bar');
        return;
      }

      Alert.alert(
        'Éxito',
        'Información del bar actualizada correctamente',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );

    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Ocurrió un error al guardar la información');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bar) {
    return (
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Bar no encontrado</Text>
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
        <Text style={styles.headerTitle}>Editar Información</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <Text style={[styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bar Info */}
        <View style={styles.barInfo}>
          <Text style={styles.barName}>{bar.name}</Text>
          <Text style={styles.barSubtitle}>Editando información del bar</Text>
        </View>

        {/* Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Nombre del Bar *</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Nombre del bar"
            placeholderTextColor="#8E8E93"
            maxLength={100}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Descripción</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe tu bar..."
            placeholderTextColor="#8E8E93"
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        {/* Food Types Section */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Tipos de Comida</Text>
          <View style={styles.categoriesContainer}>
            {foodTypes.length > 0 ? (
              foodTypes.map((foodType) => (
                <View key={foodType.id} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{foodType.category_name}</Text>
                  <TouchableOpacity
                    style={styles.removeCategoryButton}
                    onPress={() => handleRemoveCategory(foodType.id, 'food_type')}
                  >
                    <Ionicons name="close" size={16} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.noCategoriesText}>No hay tipos de comida seleccionados</Text>
            )}
            <TouchableOpacity style={styles.addCategoryButton} onPress={() => {
              const availableOptions = availableFoodTypes.filter(
                ft => !foodTypes.some(existing => existing.category_id === ft.id)
              );
              if (availableOptions.length > 0) {
                Alert.alert(
                  'Añadir Tipo de Comida',
                  'Selecciona un tipo de comida:',
                  availableOptions.map(option => ({
                    text: option.name,
                    onPress: () => handleAddCategory('food_type', option.id, option.name),
                  }))
                );
              } else {
                Alert.alert('Info', 'Ya tienes todos los tipos de comida disponibles');
              }
            }}>
              <Ionicons name="add" size={20} color="#A3B3CC" />
              <Text style={styles.addCategoryText}>Añadir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Languages Section */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Idiomas</Text>
          <View style={styles.categoriesContainer}>
            {languages.length > 0 ? (
              languages.map((language) => (
                <View key={language.id} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{language.category_name}</Text>
                  <TouchableOpacity
                    style={styles.removeCategoryButton}
                    onPress={() => handleRemoveCategory(language.id, 'language')}
                  >
                    <Ionicons name="close" size={16} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.noCategoriesText}>No hay idiomas seleccionados</Text>
            )}
            <TouchableOpacity style={styles.addCategoryButton} onPress={() => {
              const availableOptions = availableLanguages.filter(
                lang => !languages.some(existing => existing.category_id === lang.id)
              );
              if (availableOptions.length > 0) {
                Alert.alert(
                  'Añadir Idioma',
                  'Selecciona un idioma:',
                  availableOptions.map(option => ({
                    text: option.name,
                    onPress: () => handleAddCategory('language', option.id, option.name),
                  }))
                );
              } else {
                Alert.alert('Info', 'Ya tienes todos los idiomas disponibles');
              }
            }}>
              <Ionicons name="add" size={20} color="#A3B3CC" />
              <Text style={styles.addCategoryText}>Añadir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Características</Text>
          <View style={styles.categoriesContainer}>
            {features.length > 0 ? (
              features.map((feature) => (
                <View key={feature.id} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{feature.category_name}</Text>
                  <TouchableOpacity
                    style={styles.removeCategoryButton}
                    onPress={() => handleRemoveCategory(feature.id, 'feature')}
                  >
                    <Ionicons name="close" size={16} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.noCategoriesText}>No hay características seleccionadas</Text>
            )}
            <TouchableOpacity style={styles.addCategoryButton} onPress={() => {
              const availableOptions = availableFeatures.filter(
                feat => !features.some(existing => existing.category_id === feat.id)
              );
              if (availableOptions.length > 0) {
                Alert.alert(
                  'Añadir Característica',
                  'Selecciona una característica:',
                  availableOptions.map(option => ({
                    text: option.name,
                    onPress: () => handleAddCategory('feature', option.id, option.name),
                  }))
                );
              } else {
                Alert.alert('Info', 'Ya tienes todas las características disponibles');
              }
            }}>
              <Ionicons name="add" size={20} color="#A3B3CC" />
              <Text style={styles.addCategoryText}>Añadir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Phone Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Teléfono</Text>
          <TextInput
            style={styles.textInput}
            value={phone}
            onChangeText={setPhone}
            placeholder="+34 123 456 789"
            placeholderTextColor="#8E8E93"
            maxLength={20}
            keyboardType="phone-pad"
          />
        </View>

        {/* Website Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Sitio Web</Text>
          <TextInput
            style={styles.textInput}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://www.tubar.com"
            placeholderTextColor="#8E8E93"
            maxLength={200}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* Category Selection */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Categoría</Text>
          <View style={styles.categoryContainer}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategoryId === category.id && styles.categoryButtonActive
                ]}
                onPress={() => setSelectedCategoryId(
                  selectedCategoryId === category.id ? null : category.id
                )}
              >
                <Text style={[
                  styles.categoryButtonText,
                  selectedCategoryId === category.id && styles.categoryButtonTextActive
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bar Images Section */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Imágenes del Bar</Text>
          <View style={styles.imagesContainer}>
            {barImages.length > 0 ? (
              barImages.map((image, index) => (
                <View key={image.id} style={styles.imageItem}>
                  <Image source={{ uri: image.image_url }} style={styles.imageThumbnail} />
                  <TouchableOpacity
                    style={styles.deleteImageButton}
                    onPress={() => handleDeleteImage(image.id, 'bar')}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                  </TouchableOpacity>
                  <Text style={styles.imageOrderText}>{index + 1}</Text>
                  <TouchableOpacity
                    style={styles.reorderButton}
                    onPress={() => {
                      // Show reorder options
                      Alert.alert(
                        'Reordenar Imagen',
                        'Selecciona la nueva posición:',
                        barImages.map((_, idx) => ({
                          text: `Posición ${idx + 1}`,
                          onPress: () => {
                            if (idx !== index) {
                              const newImages = [...barImages];
                              const [movedImage] = newImages.splice(index, 1);
                              newImages.splice(idx, 0, movedImage);
                              handleReorderImages('bar', newImages);
                            }
                          },
                        }))
                      );
                    }}
                  >
                    <Ionicons name="swap-vertical" size={16} color="#A3B3CC" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.noImagesText}>No hay imágenes del bar</Text>
            )}
            {barImages.length < barImagesLimit && (
              <TouchableOpacity style={styles.addImageButton} onPress={handleAddBarImage}>
                <Ionicons name="add" size={24} color="#A3B3CC" />
                <Text style={styles.addImageText}>Añadir</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.noImagesText}>{barImages.length}/{barImagesLimit} fotos</Text>
        </View>

        {/* Menu Images Section (hidden if plan doesn't allow) */}
        {menuImagesLimit > 0 && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Imágenes del Menú</Text>
            <View style={styles.imagesContainer}>
              {menuImages.length > 0 ? (
                menuImages.map((image, index) => (
                  <View key={image.id} style={styles.imageItem}>
                    <Image source={{ uri: image.image_url }} style={styles.imageThumbnail} />
                    <TouchableOpacity
                      style={styles.deleteImageButton}
                      onPress={() => handleDeleteImage(image.id, 'menu')}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                    </TouchableOpacity>
                    <Text style={styles.imageOrderText}>{index + 1}</Text>
                    <TouchableOpacity
                      style={styles.reorderButton}
                      onPress={() => {
                        // Show reorder options
                        Alert.alert(
                          'Reordenar Imagen',
                          'Selecciona la nueva posición:',
                          menuImages.map((_, idx) => ({
                            text: `Posición ${idx + 1}`,
                            onPress: () => {
                              if (idx !== index) {
                                const newImages = [...menuImages];
                                const [movedImage] = newImages.splice(index, 1);
                                newImages.splice(idx, 0, movedImage);
                                handleReorderImages('menu', newImages);
                              }
                            },
                          }))
                        );
                      }}
                    >
                      <Ionicons name="swap-vertical" size={16} color="#A3B3CC" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.noImagesText}>No hay imágenes del menú</Text>
              )}
              {menuImages.length < menuImagesLimit && (
                <TouchableOpacity style={styles.addImageButton} onPress={handleAddMenuImage}>
                  <Ionicons name="add" size={24} color="#A3B3CC" />
                  <Text style={styles.addImageText}>Añadir</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.noImagesText}>{menuImages.length}/{menuImagesLimit} fotos</Text>
          </View>
        )}

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
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#374151',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  categoryButtonActive: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  categoryButtonText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
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
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageItem: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deleteImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOrderText: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#A3B3CC',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  addImageText: {
    color: '#A3B3CC',
    fontSize: 12,
    marginTop: 4,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryChipText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 6,
  },
  removeCategoryButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A3B3CC',
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  addCategoryText: {
    color: '#A3B3CC',
    fontSize: 14,
    marginLeft: 4,
  },
  noCategoriesText: {
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  reorderButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImagesText: {
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
}); 