import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBarRegisterStore } from '~/stores/barRegisterStore';
import PrimaryButton from '~/components/ui/PrimaryButton';
import { supabase } from '~/utils/supabase';
import { useState } from 'react';

const Step4Photos: React.FC = () => {
  const router = useRouter();
  const { getFormData, resetForm } = useBarRegisterStore();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const formData = getFormData();
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Debes estar autenticado para registrar un bar');
        return;
      }

      // Simple bar registration without images for now
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
        Alert.alert('Error', 'No se pudo registrar el bar: ' + barError.message);
        return;
      }

      // Insert relationships with detailed logging
      console.log('📊 Form data for relationships:', {
        languageIds: formData.languageIds,
        foodTypeIds: formData.foodTypeIds,
        featureIds: formData.featureIds,
        barId: barData.id
      });

      if (formData.languageIds && formData.languageIds.length > 0) {
        console.log('🗣️ Inserting languages:', formData.languageIds);
        const languageInserts = formData.languageIds.map((languageId: string) => ({
          bar_id: barData.id,
          language_id: parseInt(languageId),
        }));
        console.log('🗣️ Language inserts:', languageInserts);

        const { error: languageError } = await supabase.from('bar_languages').insert(languageInserts);
        if (languageError) {
          console.error('❌ Error inserting languages:', languageError);
        } else {
          console.log('✅ Languages inserted successfully');
        }
      } else {
        console.log('⚠️ No languages to insert');
      }

      if (formData.foodTypeIds && formData.foodTypeIds.length > 0) {
        console.log('🍕 Inserting food types:', formData.foodTypeIds);
        const foodTypeInserts = formData.foodTypeIds.map((foodTypeId: string) => ({
          bar_id: barData.id,
          food_type_id: parseInt(foodTypeId),
        }));
        console.log('🍕 Food type inserts:', foodTypeInserts);

        const { error: foodTypeError } = await supabase.from('bar_food_types').insert(foodTypeInserts);
        if (foodTypeError) {
          console.error('❌ Error inserting food types:', foodTypeError);
        } else {
          console.log('✅ Food types inserted successfully');
        }
      } else {
        console.log('⚠️ No food types to insert');
      }

      if (formData.featureIds && formData.featureIds.length > 0) {
        console.log('⭐ Inserting features:', formData.featureIds);
        const featureInserts = formData.featureIds.map((featureId: string) => ({
          bar_id: barData.id,
          feature_id: parseInt(featureId),
        }));
        console.log('⭐ Feature inserts:', featureInserts);

        const { error: featureError } = await supabase.from('bar_selected_features').insert(featureInserts);
        if (featureError) {
          console.error('❌ Error inserting features:', featureError);
        } else {
          console.log('✅ Features inserted successfully');
        }
      } else {
        console.log('⚠️ No features to insert');
      }

      Alert.alert(
        '¡Éxito!',
        'Tu bar ha sido registrado correctamente. Será revisado por nuestro equipo antes de ser publicado.',
        [
          {
            text: 'Continuar',
            onPress: () => {
              resetForm();
              router.replace('/(protected)/profile' as any);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', 'No se pudo completar el registro. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fotos</Text>
          <View style={styles.headerSpacer} />
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
            <Text style={styles.title}>Finalizar Registro</Text>
            <Text style={styles.subtitle}>
              Tu bar está listo para ser registrado. Las fotos se podrán agregar más tarde.
            </Text>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#007AFF" />
              <Text style={styles.infoText}>
                Tu bar será revisado por nuestro equipo antes de ser publicado. Podrás agregar fotos después de la aprobación.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Completar Registro"
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </SafeAreaView>
    </>
  );
};

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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E3A8A',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    color: '#93C5FD',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});

export default Step4Photos; 