import { useState, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ScrollView } from 'react-native';
import { AppText } from '~/components/ds';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import ScreenTitle from '~/components/ui/ScreenTitle';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';
import { memo } from 'react';

interface BarFormData {
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  openingHours: string;
  category: string;
}

interface FormValidation {
  isValid: boolean;
  errors: string[];
}

const AddBarScreen: React.FC = () => {
  const [formData, setFormData] = useState<BarFormData>({
    name: '',
    description: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    openingHours: '',
    category: '',
  });

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Memoized form validation
  const formValidation = useMemo((): FormValidation => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) errors.push('El nombre del bar es requerido');
    if (!formData.description.trim()) errors.push('La descripción es requerida');
    if (!formData.address.trim()) errors.push('La dirección es requerida');
    if (!formData.city.trim()) errors.push('La ciudad es requerida');
    if (!formData.phone.trim()) errors.push('El teléfono es requerido');
    if (!formData.email.trim()) errors.push('El email es requerido');
    if (formData.email.trim() && !formData.email.includes('@')) errors.push('Ingresa un email válido');
    if (!formData.category.trim()) errors.push('La categoría es requerida');

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [formData]);

  // Optimized form update handlers
  const handleNameChange = useCallback((name: string) => {
    setFormData(prev => ({ ...prev, name }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormData(prev => ({ ...prev, description }));
  }, []);

  const handleAddressChange = useCallback((address: string) => {
    setFormData(prev => ({ ...prev, address }));
  }, []);

  const handleCityChange = useCallback((city: string) => {
    setFormData(prev => ({ ...prev, city }));
  }, []);

  const handlePhoneChange = useCallback((phone: string) => {
    setFormData(prev => ({ ...prev, phone }));
  }, []);

  const handleEmailChange = useCallback((email: string) => {
    setFormData(prev => ({ ...prev, email }));
  }, []);

  const handleWebsiteChange = useCallback((website: string) => {
    setFormData(prev => ({ ...prev, website }));
  }, []);

  const handleOpeningHoursChange = useCallback((openingHours: string) => {
    setFormData(prev => ({ ...prev, openingHours }));
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setFormData(prev => ({ ...prev, category }));
  }, []);

  // Form validation helper
  const validateAndShowErrors = useCallback(() => {
    if (!formValidation.isValid) {
      Alert.alert('Error', formValidation.errors[0]);
      return false;
    }
    return true;
  }, [formValidation]);

  // Main bar registration handler
  const handleAddBar = useCallback(async () => {
    if (!validateAndShowErrors()) return;

    setLoading(true);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Debes estar autenticado para añadir un bar');
        return;
      }

      // Insert bar into database
      const { data: barData, error: barError } = await supabase
        .from('bars')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          phone: formData.phone.trim(),
          website: formData.website.trim() || null,
          latitude: 0,
          longitude: 0,
        })
        .select()
        .single();

      if (barError) {
        console.error('Bar creation error:', barError);
        Alert.alert('Error', 'No se pudo crear el bar. Inténtalo de nuevo.');
        return;
      }

      if (barData) {
        Alert.alert('Éxito', 'Bar añadido correctamente', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      console.error('Add bar error:', error);
      Alert.alert('Error', 'Error inesperado al añadir el bar');
    } finally {
      setLoading(false);
    }
  }, [formData, validateAndShowErrors, router]);

  // Back navigation handler
  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <ScreenTitle 
            title="Añadir Bar" 
            color="#FFFFFF" 
            shadow={false}
            marginBottom={0}
            fontSize={20}
          />
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.contentContainer}>
            <View style={styles.formContainer}>
              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Nombre del Bar</AppText>
                <InputField
                  placeholder="Ingresa el nombre del bar"
                  value={formData.name}
                  onChangeText={handleNameChange}
                  autoCapitalize="words"
                  autoCorrect={false}
                  theme="dark"
                  editable={!loading}
                />
              </View>

              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Descripción</AppText>
                <InputField
                  placeholder="Describe tu bar"
                  value={formData.description}
                  onChangeText={handleDescriptionChange}
                  autoCapitalize="sentences"
                  autoCorrect={true}
                  theme="dark"
                  editable={!loading}
                  multiline={true}
                  numberOfLines={3}
                />
              </View>

              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Dirección</AppText>
                <InputField
                  placeholder="Dirección completa"
                  value={formData.address}
                  onChangeText={handleAddressChange}
                  autoCapitalize="words"
                  autoCorrect={false}
                  theme="dark"
                  editable={!loading}
                />
              </View>

              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Ciudad</AppText>
                <InputField
                  placeholder="Ciudad"
                  value={formData.city}
                  onChangeText={handleCityChange}
                  autoCapitalize="words"
                  autoCorrect={false}
                  theme="dark"
                  editable={!loading}
                />
              </View>

              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Teléfono</AppText>
                <InputField
                  placeholder="Número de teléfono"
                  value={formData.phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  theme="dark"
                  editable={!loading}
                />
              </View>

              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Email</AppText>
                <InputField
                  placeholder="Email del bar"
                  value={formData.email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  theme="dark"
                  editable={!loading}
                />
              </View>

              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Sitio Web (Opcional)</AppText>
                <InputField
                  placeholder="www.ejemplo.com"
                  value={formData.website}
                  onChangeText={handleWebsiteChange}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  theme="dark"
                  editable={!loading}
                />
              </View>

              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Horario (Opcional)</AppText>
                <InputField
                  placeholder="Ej: Lun-Dom 18:00-02:00"
                  value={formData.openingHours}
                  onChangeText={handleOpeningHoursChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  theme="dark"
                  editable={!loading}
                />
              </View>

              <View style={styles.fieldContainer}>
                <AppText maxScale={1.1} style={styles.fieldLabel}>Categoría</AppText>
                <InputField
                  placeholder="Ej: Cocktail Bar, Pub, Lounge"
                  value={formData.category}
                  onChangeText={handleCategoryChange}
                  autoCapitalize="words"
                  autoCorrect={false}
                  theme="dark"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <CustomButton
                text="Añadir Bar"
                onPress={handleAddBar}
                variant="primary"
                loading={loading}
                disabled={!formValidation.isValid || loading}
              />
            </View>
          </View>
        </ScrollView>
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
    paddingTop: 10,
    paddingBottom: 30,
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
  formContainer: {
    marginBottom: 40,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  buttonContainer: {
    gap: 12,
  },
});

export default memo(AddBarScreen); 