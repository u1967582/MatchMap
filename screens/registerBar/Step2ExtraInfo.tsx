import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBarRegisterStore } from '~/stores/barRegisterStore';
import CheckboxGroup from '~/components/Form/CheckboxGroup';
import PrimaryButton from '~/components/ui/PrimaryButton';
import { supabase } from '~/utils/supabase';

interface SelectOption {
  id: string;
  label: string;
}

const Step2ExtraInfo: React.FC = () => {
  const router = useRouter();
  const { languageIds, foodTypeIds, featureIds, setField } = useBarRegisterStore();
  const [loading, setLoading] = useState(false);
  const [languages, setLanguages] = useState<SelectOption[]>([]);
  const [foodTypes, setFoodTypes] = useState<SelectOption[]>([]);
  const [features, setFeatures] = useState<SelectOption[]>([]);

  // Fetch languages from database
  const fetchLanguages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('languages')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching languages:', error);
        return;
      }

      setLanguages(data?.map(lang => ({ id: lang.id.toString(), label: lang.name })) || []);
    } catch (error) {
      console.error('Error fetching languages:', error);
    }
  }, []);

  // Fetch food types from database
  const fetchFoodTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('food_types')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching food types:', error);
        return;
      }

      setFoodTypes(data?.map(food => ({ id: food.id.toString(), label: food.name })) || []);
    } catch (error) {
      console.error('Error fetching food types:', error);
    }
  }, []);

  // Fetch features from database
  const fetchFeatures = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bar_features')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching features:', error);
        return;
      }

      setFeatures(data?.map(feature => ({ id: feature.id.toString(), label: feature.name })) || []);
    } catch (error) {
      console.error('Error fetching features:', error);
    }
  }, []);

  // Load all data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchLanguages(),
        fetchFoodTypes(),
        fetchFeatures(),
      ]);
      setLoading(false);
    };

    loadData();
  }, [fetchLanguages, fetchFoodTypes, fetchFeatures]);

  const handleNext = () => {
    const query = useBarRegisterStore.getState().isAutoPreRegister ? '?mode=auto_pre_register' : '';
    router.push(`/register-bar/step3${query}` as any);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Información Extra</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Paso 2 de 4</Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.title}>Detalles adicionales</Text>
            <Text style={styles.subtitle}>
              Información que ayudará a los usuarios a encontrar exactamente lo que buscan.
            </Text>

            <CheckboxGroup
              label="Idiomas que se hablan"
              options={languages}
              selectedIds={languageIds}
              onSelectionChange={(ids) => setField('languageIds', ids)}
            />

            <CheckboxGroup
              label="Tipos de comida disponibles"
              options={foodTypes}
              selectedIds={foodTypeIds}
              onSelectionChange={(ids) => setField('foodTypeIds', ids)}
            />

            <CheckboxGroup
              label="Características del bar"
              options={features}
              selectedIds={featureIds}
              onSelectionChange={(ids) => setField('featureIds', ids)}
            />
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Siguiente"
            onPress={handleNext}
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
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});

export default Step2ExtraInfo; 