import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBarRegisterStore } from '~/stores/barRegisterStore';
import TextInputField from '~/components/Form/TextInputField';
import PrimaryButton from '~/components/ui/PrimaryButton';
import { useState } from 'react';
import * as Location from 'expo-location';

const Step3Location: React.FC = () => {
  const router = useRouter();
  const { address, city, postalCode, latitude, longitude, setField } = useBarRegisterStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!address.trim()) {
      newErrors.address = 'La dirección es requerida';
    }

    if (!city.trim()) {
      newErrors.city = 'La ciudad es requerida';
    }

    if (!postalCode.trim()) {
      newErrors.postalCode = 'El código postal es requerido';
    } else if (!/^\d{5}$/.test(postalCode.trim())) {
      newErrors.postalCode = 'El código postal debe tener 5 dígitos';
    }

    // Validate coordinates if provided
    if (latitude !== 0 && (latitude < -90 || latitude > 90)) {
      newErrors.latitude = 'La latitud debe estar entre -90 y 90';
    }

    if (longitude !== 0 && (longitude < -180 || longitude > 180)) {
      newErrors.longitude = 'La longitud debe estar entre -180 y 180';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Necesitamos acceso a tu ubicación para obtener las coordenadas automáticamente.',
          [{ text: 'Entendido' }]
        );
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Update coordinates in store
      setField('latitude', location.coords.latitude);
      setField('longitude', location.coords.longitude);

      Alert.alert(
        'Ubicación obtenida',
        `Coordenadas actualizadas:\nLatitud: ${location.coords.latitude.toFixed(6)}\nLongitud: ${location.coords.longitude.toFixed(6)}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación actual. Verifica que tengas GPS activado.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (validateForm()) {
      router.push('/register-bar/step4' as any);
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
          <Text style={styles.headerTitle}>Ubicación</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={[styles.progressStep, styles.progressStepActive]} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Paso 3 de 4</Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.title}>¿Dónde está tu bar?</Text>
            <Text style={styles.subtitle}>
              Información de ubicación para que los usuarios puedan encontrarte fácilmente.
            </Text>

            <TextInputField
              label="Dirección"
              value={address}
              onChangeText={(text) => setField('address', text)}
              placeholder="Calle, número, piso..."
              required
              error={errors.address}
            />

            <TextInputField
              label="Ciudad"
              value={city}
              onChangeText={(text) => setField('city', text)}
              placeholder="Barcelona, Madrid, Valencia..."
              required
              error={errors.city}
            />

            <TextInputField
              label="Código Postal"
              value={postalCode}
              onChangeText={(text) => {
                // Limit to 5 digits
                if (text.length <= 5) {
                  setField('postalCode', text);
                }
              }}
              placeholder="08001"
              keyboardType="numeric"
              required
              error={errors.postalCode}
            />

            <View style={styles.coordinatesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Coordenadas (Opcional)</Text>
                {(latitude !== 0 || longitude !== 0) && (
                  <View style={styles.coordinatesStatus}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.statusText}>Establecidas</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sectionSubtitle}>
                Ayuda a los usuarios a encontrarte con mayor precisión
              </Text>
              
              <View style={styles.coordinatesRow}>
                <View style={styles.coordinateInput}>
                  <TextInputField
                    label="Latitud"
                    value={latitude === 0 ? '' : latitude.toString()}
                    onChangeText={(text) => setField('latitude', parseFloat(text) || 0)}
                    placeholder="41.3851"
                    keyboardType="numeric"
                    error={errors.latitude}
                  />
                </View>
                <View style={styles.coordinateInput}>
                  <TextInputField
                    label="Longitud"
                    value={longitude === 0 ? '' : longitude.toString()}
                    onChangeText={(text) => setField('longitude', parseFloat(text) || 0)}
                    placeholder="2.1734"
                    keyboardType="numeric"
                    error={errors.longitude}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={styles.locationButton} 
                onPress={handleGetCurrentLocation}
                disabled={loading}
              >
                <Ionicons name="location" size={20} color="#007AFF" />
                <Text style={styles.locationButtonText}>
                  {loading ? 'Obteniendo ubicación...' : 'Usar ubicación actual'}
                </Text>
              </TouchableOpacity>
            </View>
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
  coordinatesSection: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 16,
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  coordinateInput: {
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  locationButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  coordinatesStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Step3Location; 