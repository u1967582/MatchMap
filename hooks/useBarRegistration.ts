import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '~/utils/supabase';
import { useImageUpload } from './useImageUpload';
import { validateBarRegistration } from '~/utils/validation';

export const useBarRegistration = () => {
  const [loading, setLoading] = useState(false);
  const { uploadMultipleImages } = useImageUpload();

  const registerBar = async (formData: any, barPhotos: string[], menuPhotos: string[]) => {
    setLoading(true);
    
    try {
      // Validate form data
      const validation = validateBarRegistration(formData);
      if (!validation.isValid) {
        Alert.alert('Datos incompletos', validation.errors.join('\n'));
        return { success: false };
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Debes estar autenticado para registrar un bar');
        return { success: false };
      }

      // Upload images
      const uploadedBarPhotos = await uploadMultipleImages(barPhotos, `bars/${user.id}`);
      const uploadedMenuPhotos = await uploadMultipleImages(menuPhotos, `bars/${user.id}`);

      // Create bar record in database
      const { data: barData, error: barError } = await supabase
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
        })
        .select()
        .single();

      if (barError) {
        console.error('Error creating bar:', barError);
        Alert.alert('Error', 'No se pudo registrar el bar. Inténtalo de nuevo.');
        return { success: false };
      }

      // Insert bar languages
      if (formData.languageIds.length > 0) {
        const languageInserts = formData.languageIds.map((languageId: string) => ({
          bar_id: barData.id,
          language_id: languageId,
        }));

        const { error: languageError } = await supabase
          .from('bar_languages')
          .insert(languageInserts);

        if (languageError) {
          console.error('Error inserting bar languages:', languageError);
        }
      }

      // Insert bar food types
      if (formData.foodTypeIds.length > 0) {
        const foodTypeInserts = formData.foodTypeIds.map((foodTypeId: string) => ({
          bar_id: barData.id,
          food_type_id: foodTypeId,
        }));

        const { error: foodTypeError } = await supabase
          .from('bar_food_types')
          .insert(foodTypeInserts);

        if (foodTypeError) {
          console.error('Error inserting bar food types:', foodTypeError);
        }
      }

      // Insert bar features
      if (formData.featureIds.length > 0) {
        const featureInserts = formData.featureIds.map((featureId: string) => ({
          bar_id: barData.id,
          feature_id: featureId,
        }));

        const { error: featureError } = await supabase
          .from('bar_selected_features')
          .insert(featureInserts);

        if (featureError) {
          console.error('Error inserting bar features:', featureError);
        }
      }

      console.log('Bar registered successfully:', barData);
      return { success: true, barData };
    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', 'No se pudo completar el registro. Inténtalo de nuevo.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    registerBar
  };
}; 