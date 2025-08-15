import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBarRegisterStore } from '~/stores/barRegisterStore';
import TextInputField from '~/components/Form/TextInputField';
import RadioGroup from '~/components/Form/RadioGroup';
import PrimaryButton from '~/components/ui/PrimaryButton';
import { useCategories } from '~/hooks/useCategories';

const Step1GeneralInfo: React.FC = () => {
  const router = useRouter();
  const { name, description, phone, website, categoryId, setField } = useBarRegisterStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Use custom hook for categories
  const { categories, loading, error, usingFallback, refetch } = useCategories();

  // Show alert only if using fallback categories due to error
  useEffect(() => {
    if (usingFallback && error) {
      Alert.alert('Aviso', 'No se pudieron cargar las categorías de la base de datos. Se muestran categorías por defecto.');
    }
  }, [usingFallback, error]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre del bar es requerido';
    }

    if (!description.trim()) {
      newErrors.description = 'La descripción es requerida';
    }

    if (!phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    }

    if (!categoryId) {
      newErrors.categoryId = 'Selecciona una categoría';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      router.push('/register-bar/step2' as any);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Convert categories to RadioGroup options format
  const categoryOptions = categories.map(category => ({
    id: category.id,
    label: category.name,
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Información General</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Paso 1 de 4</Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.title}>Cuéntanos sobre tu bar</Text>
            <Text style={styles.subtitle}>
              Información básica que ayudará a los usuarios a encontrar y conocer tu establecimiento.
            </Text>

            <TextInputField
              label="Nombre del Bar"
              value={name}
              onChangeText={(text) => setField('name', text)}
              placeholder="Ej: El Rincón del Jazz"
              required
              error={errors.name}
            />

            <TextInputField
              label="Descripción"
              value={description}
              onChangeText={(text) => setField('description', text)}
              placeholder="Describe el ambiente, especialidades, música..."
              multiline
              numberOfLines={4}
              required
              error={errors.description}
            />

            <TextInputField
              label="Teléfono"
              value={phone}
              onChangeText={(text) => setField('phone', text)}
              placeholder="+34 123 456 789"
              keyboardType="phone-pad"
              required
              error={errors.phone}
            />

            <TextInputField
              label="Sitio Web"
              value={website}
              onChangeText={(text) => setField('website', text)}
              placeholder="https://www.ejemplo.com"
              keyboardType="url"
            />

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Cargando categorías...</Text>
              </View>
            ) : (
              <View>
                <RadioGroup
                  label="Categoría"
                  options={categoryOptions}
                  selectedId={categoryId}
                  onSelectionChange={(id) => setField('categoryId', id)}
                  required
                  error={errors.categoryId}
                />
                {usingFallback ? (
                  <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackText}>
                      ⚠️ Usando categorías por defecto
                    </Text>
                    <TouchableOpacity onPress={refetch} style={styles.retryButton}>
                      <Text style={styles.retryButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            )}
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
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  fallbackContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fallbackText: {
    color: '#FCD34D',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#065F46',
    borderRadius: 8,
    alignItems: 'center',
  },
  successText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Step1GeneralInfo; 