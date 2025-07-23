import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '~/utils/supabase';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';
import ScreenTitle from '~/components/ui/ScreenTitle';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
  profile_image_url?: string;
}

interface FormData {
  full_name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormValidation {
  isValid: boolean;
  errors: string[];
}

export default function EditProfileScreen() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const router = useRouter();

  // Form validation
  const formValidation = useMemo((): FormValidation => {
    const errors: string[] = [];
    
    // Only validate if fields have been modified (not empty)
    if (formData.full_name.trim() && formData.full_name.length < 2) {
      errors.push('El nombre debe tener al menos 2 caracteres');
    }
    
    if (formData.username.trim() && formData.username.length < 3) {
      errors.push('El nombre de usuario debe tener al menos 3 caracteres');
    }

    // Password validation (only if password field is shown and has content)
    if (showPasswordFields && formData.password) {
      if (formData.password.length < 6) {
        errors.push('La contraseña debe tener al menos 6 caracteres');
      }
      if (formData.password !== formData.confirmPassword) {
        errors.push('Las contraseñas no coinciden');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [formData, showPasswordFields]);

  // Load current user profile
  const fetchUserProfile = useCallback(async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.error('Error getting user:', authError);
        router.replace('/login');
        return;
      }

      // Get profile data from users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('full_name, username, email, profile_image_url')
        .eq('id', authUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        Alert.alert('Error', 'No se pudo cargar el perfil');
        return;
      }

      const userProfile: UserProfile = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: profile?.full_name,
        username: profile?.username,
        profile_image_url: profile?.profile_image_url,
      };

      setUser(userProfile);
      // Initialize form with empty values - we'll use user data as placeholders
      setFormData({
        full_name: '',
        username: '',
        email: authUser.email || '',
        password: '',
        confirmPassword: '',
      });
      setProfileImage(profile?.profile_image_url || null);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      Alert.alert('Error', 'Error inesperado al cargar el perfil');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Handle form field changes
  const handleFullNameChange = useCallback((full_name: string) => {
    setFormData(prev => ({ ...prev, full_name }));
  }, []);

  const handleUsernameChange = useCallback((username: string) => {
    setFormData(prev => ({ ...prev, username }));
  }, []);

  const handlePasswordChange = useCallback((password: string) => {
    setFormData(prev => ({ ...prev, password }));
  }, []);

  const handleConfirmPasswordChange = useCallback((confirmPassword: string) => {
    setFormData(prev => ({ ...prev, confirmPassword }));
  }, []);

  const togglePasswordFields = useCallback(() => {
    setShowPasswordFields(prev => {
      if (!prev) {
        // Clear password fields when showing
        setFormData(prevForm => ({
          ...prevForm,
          password: '',
          confirmPassword: '',
        }));
      }
      return !prev;
    });
  }, []);

  // Request permissions for image picker
  const requestPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permisos requeridos',
        'Necesitamos acceso a tu galería para seleccionar una imagen de perfil.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  }, []);

  // Handle profile image selection
  const handleSelectImage = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    Alert.alert(
      'Seleccionar imagen',
      'Elige una opción',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Galería', onPress: () => pickImageFromGallery() },
        { text: 'Cámara', onPress: () => pickImageFromCamera() },
      ]
    );
  }, [requestPermissions]);

  const pickImageFromGallery = useCallback(async () => {
    try {
      console.log('📱 Iniciando selección desde galería...');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false, // No necesitamos base64 aquí
      });

      console.log('📱 Resultado del picker:', {
        canceled: result.canceled,
        assetsLength: result.assets?.length,
      });

      if (result.canceled || !result.assets?.length) {
        console.log('Usuario canceló la selección de imagen');
        return;
      }

      const file = result.assets[0];
      console.log('📱 Archivo seleccionado:', {
        uri: file.uri,
        type: file.type,
        width: file.width,
        height: file.height,
        fileSize: file.fileSize,
      });
      
      if (!file.uri) {
        Alert.alert('Error', 'No se pudo obtener la imagen seleccionada');
        return;
      }

      // Verificar que el archivo es válido antes de continuar
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      console.log('📋 Verificación del archivo:', fileInfo);

      if (!fileInfo.exists) {
        Alert.alert('Error', 'El archivo seleccionado no existe');
        return;
      }

      if (fileInfo.size === 0) {
        Alert.alert('Error', 'El archivo seleccionado está vacío');
        return;
      }

      console.log('✅ Imagen válida seleccionada desde galería');
      setProfileImage(file.uri);
      
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen de la galería');
    }
  }, []);

  const pickImageFromCamera = useCallback(async () => {
    try {
      console.log('📷 Iniciando toma de foto con cámara...');
      
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado', 
          'Se necesita acceso a la cámara para tomar una foto.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('📷 Resultado de la cámara:', {
        canceled: result.canceled,
        assetsLength: result.assets?.length,
      });

      if (result.canceled || !result.assets?.length) {
        console.log('Usuario canceló la toma de foto');
        return;
      }

      const file = result.assets[0];
      console.log('📷 Foto tomada:', {
        uri: file.uri,
        type: file.type,
        width: file.width,
        height: file.height,
        fileSize: file.fileSize,
      });
      
      if (!file.uri) {
        Alert.alert('Error', 'No se pudo obtener la foto tomada');
        return;
      }

      // Verificar que el archivo es válido
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      console.log('📋 Verificación de la foto:', fileInfo);

      if (!fileInfo.exists) {
        Alert.alert('Error', 'La foto tomada no existe');
        return;
      }

      if (fileInfo.size === 0) {
        Alert.alert('Error', 'La foto tomada está vacía');
        return;
      }

      console.log('✅ Foto válida tomada con cámara');
      setProfileImage(file.uri);
      
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto con la cámara');
    }
  }, []);

    const uploadProfileImage = useCallback(async (uri: string): Promise<string | null> => {
    if (!user) return null;

    try {
      setUploadingImage(true);
      console.log('📸 Iniciando subida de imagen para usuario:', user.id);
      console.log('📁 URI recibida:', uri);

      // Verificar que el archivo existe y obtener información
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('📋 Información del archivo:', fileInfo);

      if (!fileInfo.exists) {
        throw new Error('El archivo no existe en la URI proporcionada');
      }

      if (fileInfo.size === 0) {
        throw new Error('El archivo está vacío');
      }

      const filePath = `${user.id}/avatar_${Date.now()}.jpg`;
      
      // Método 1: Usando base64 (más confiable en simuladores iOS)
      try {
        console.log('🔄 Intentando método base64...');
        
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log('📦 Base64 length:', base64.length);
        console.log('📦 Base64 preview:', base64.substring(0, 50) + '...');

        if (!base64 || base64.length === 0) {
          throw new Error('Base64 string está vacío');
        }

        // Convertir base64 a ArrayBuffer
        const binaryString = atob(base64);
        const arrayBuffer = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          arrayBuffer[i] = binaryString.charCodeAt(i);
        }

        console.log('📦 ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (error) {
          console.error('❌ Error subiendo con base64:', error);
          throw error;
        }

        console.log('✅ Imagen subida exitosamente con base64:', data);

      } catch (base64Error) {
        console.warn('⚠️ Método base64 falló, intentando con fetch:', base64Error);
        
        // Método 2: Usando fetch como fallback
        const response = await fetch(uri);
        console.log('🌐 Fetch response status:', response.status);
        console.log('🌐 Fetch response headers:', response.headers);

        if (!response.ok) {
          throw new Error(`Fetch failed with status: ${response.status}`);
        }

        const blob = await response.blob();
        console.log('📦 Blob size:', blob.size, 'bytes');
        console.log('📦 Blob type:', blob.type);

        if (blob.size === 0) {
          throw new Error('El blob está vacío');
        }

        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: true,
          });

        if (error) {
          console.error('❌ Error subiendo con fetch:', error);
          throw error;
        }

        console.log('✅ Imagen subida exitosamente con fetch:', data);
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData?.publicUrl;

      if (!avatarUrl) {
        throw new Error('No se pudo obtener la URL pública');
      }

      console.log('🔗 Public URL:', avatarUrl);

      // Actualizar perfil en la base de datos
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          profile_image_url: avatarUrl, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ Error actualizando perfil:', updateError);
        throw updateError;
      }

      console.log('✅ Perfil actualizado correctamente con nueva imagen');
      return avatarUrl;

    } catch (error) {
      console.error('❌ Error completo en uploadProfileImage:', error);
      
      // Proporcionar más contexto del error
      if (error instanceof Error) {
        throw new Error(`Error subiendo imagen: ${error.message}`);
      } else {
        throw new Error('Error desconocido subiendo imagen');
      }
    } finally {
      setUploadingImage(false);
    }
  }, [user]);
  

  // Check if any changes were made
  const hasChanges = useMemo(() => {
    if (!user) return false;
    
    const imageChanged = profileImage !== user.profile_image_url;
    const nameChanged = formData.full_name.trim() !== '' && formData.full_name.trim() !== user.full_name;
    const usernameChanged = formData.username.trim() !== '' && formData.username.trim() !== user.username;
    const passwordChanged = showPasswordFields && formData.password.trim() !== '';
    
    return imageChanged || nameChanged || usernameChanged || passwordChanged;
  }, [user, profileImage, formData, showPasswordFields]);

  // Save profile changes
  const handleSaveProfile = useCallback(async () => {
    if (!formValidation.isValid) {
      Alert.alert('Error', formValidation.errors[0]);
      return;
    }

    if (!user) return;

    if (!hasChanges) {
      Alert.alert('Sin cambios', 'No se han detectado cambios para guardar.');
      return;
    }

    setSaving(true);

    try {
      let imageUrl: string | undefined = user.profile_image_url || undefined;

              // Upload new image if selected (this also updates the database)
        if (profileImage && profileImage !== user.profile_image_url) {
          try {
            const uploadedUrl = await uploadProfileImage(profileImage);
            imageUrl = uploadedUrl || undefined;
            
            // Refresh user data to show the new image immediately
            await fetchUserProfile();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            Alert.alert(
              'Error subiendo imagen', 
              `${errorMessage}\n\n¿Deseas continuar sin cambiar la imagen?`, 
              [
                { text: 'Cancelar', style: 'cancel', onPress: () => setSaving(false) },
                { text: 'Continuar', onPress: () => saveProfileData(user.profile_image_url || undefined) },
              ]
            );
            return;
          }
        }

      await saveProfileData(imageUrl);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  }, [formValidation, user, profileImage, uploadProfileImage, hasChanges]);

  const saveProfileData = useCallback(async (imageUrl?: string) => {
    if (!user) return;

    try {
      // Prepare update data with only changed fields
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only update fields that have been modified
      if (formData.full_name.trim() !== '' && formData.full_name.trim() !== user.full_name) {
        updateData.full_name = formData.full_name.trim();
      }

      if (formData.username.trim() !== '' && formData.username.trim() !== user.username) {
        updateData.username = formData.username.trim();
      }

      if (imageUrl !== user.profile_image_url) {
        updateData.profile_image_url = imageUrl;
      }

      // Update users table if there are changes
      if (Object.keys(updateData).length > 1) { // More than just updated_at
        const { error: profileError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          throw new Error(profileError.message);
        }
      }

      // Update password in auth if changed
      if (showPasswordFields && formData.password.trim() !== '') {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.password.trim(),
        });

        if (passwordError) {
          console.error('Password update error:', passwordError);
          Alert.alert(
            'Perfil actualizado parcialmente',
            'Los datos del perfil se actualizaron correctamente, pero hubo un problema al cambiar la contraseña.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }
      }

      Alert.alert('Éxito', 'Perfil actualizado correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      throw error;
    }
  }, [user, formData, showPasswordFields, router]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
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
  }, [router, hasChanges]);

  const getProfileImageUrl = useCallback(() => {
    if (profileImage) return profileImage;
    if (user?.profile_image_url) return user.profile_image_url;
    
    const displayName = user?.full_name || user?.username || 'Usuario';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2A3A4A&color=A3B3CC&size=240`;
  }, [profileImage, user?.profile_image_url, user?.full_name, user?.username]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBack}
            disabled={saving}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <ScreenTitle 
            title="Editar Perfil" 
            color="#FFFFFF" 
            shadow={false}
            marginBottom={0}
            fontSize={20}
          />
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.contentContainer}>
            {/* Profile Image Section */}
            <View style={styles.imageSection}>
              <TouchableOpacity 
                style={styles.imageContainer}
                onPress={handleSelectImage}
                disabled={saving || uploadingImage}
              >
                <Image 
                  source={{ uri: getProfileImageUrl() }} 
                  style={styles.profileImage}
                />
                <View style={styles.imageOverlay}>
                  {uploadingImage ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
              <Text style={styles.imageHint}>Toca para cambiar foto</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Nombre completo</Text>
                <InputField
                  placeholder={user?.full_name || 'Ingresa tu nombre completo'}
                  value={formData.full_name}
                  onChangeText={handleFullNameChange}
                  autoCapitalize="words"
                  autoCorrect={false}
                  theme="dark"
                  editable={!saving}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Nombre de usuario</Text>
                <InputField
                  placeholder={user?.username || 'Ingresa tu nombre de usuario'}
                  value={formData.username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  theme="dark"
                  editable={!saving}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Email</Text>
                <InputField
                  placeholder={user?.email || 'Correo electrónico'}
                  value={formData.email}
                  onChangeText={() => {}} // No-op since it's disabled
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  theme="dark"
                  editable={false}
                />
                <Text style={styles.fieldHint}>
                  Para cambiar tu email, contacta con soporte
                </Text>
              </View>

              {/* Password Section */}
              <View style={styles.passwordSection}>
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={togglePasswordFields}
                  disabled={saving}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPasswordFields ? 'Cancelar cambio de contraseña' : 'Cambiar contraseña'}
                  </Text>
                  <Ionicons 
                    name={showPasswordFields ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#007AFF" 
                  />
                </TouchableOpacity>

                {showPasswordFields && (
                  <>
                    <View style={styles.fieldContainer}>
                      <Text style={styles.fieldLabel}>Nueva contraseña</Text>
                      <InputField
                        placeholder="Ingresa tu nueva contraseña"
                        value={formData.password}
                        onChangeText={handlePasswordChange}
                        secureTextEntry
                        autoCapitalize="none"
                        theme="dark"
                        editable={!saving}
                      />
                    </View>

                    <View style={styles.fieldContainer}>
                      <Text style={styles.fieldLabel}>Confirmar contraseña</Text>
                      <InputField
                        placeholder="Confirma tu nueva contraseña"
                        value={formData.confirmPassword}
                        onChangeText={handleConfirmPasswordChange}
                        secureTextEntry
                        autoCapitalize="none"
                        theme="dark"
                        editable={!saving}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Save Button */}
            <View style={styles.buttonContainer}>
              <CustomButton
                text="Guardar cambios"
                onPress={handleSaveProfile}
                variant="primary"
                loading={saving}
                disabled={!formValidation.isValid || saving || !hasChanges}
              />
              
              {!hasChanges && !loading && (
                <Text style={styles.noChangesText}>
                  Modifica algún campo para guardar cambios
                </Text>
              )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3A4A5C',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1C2A3A',
  },
  imageHint: {
    color: '#8E8E93',
    fontSize: 14,
  },
  formContainer: {
    marginBottom: 32,
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
  fieldHint: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  passwordSection: {
    marginTop: 24,
  },
  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    marginBottom: 16,
  },
  passwordToggleText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 12,
    alignItems: 'center',
  },
  noChangesText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 