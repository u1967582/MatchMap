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
import { supabase } from '~/utils/supabase';
import { ensureAvatarsBucket } from '~/utils/avatarStorage';
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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  }, []);

  const pickImageFromCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se necesitan permisos de cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  }, []);

  // Upload image to Supabase Storage
  const uploadProfileImage = useCallback(async (imageUri: string): Promise<string | null> => {
    if (!user) return null;

    try {
      setUploadingImage(true);

      // Create file path
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}.${fileExt}`;
      const filePath = fileName;

      // Convert image to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: true,
        });

      if (error) {
        console.error('Error uploading image:', error);
        throw new Error(error.message);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw error;
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

      // Upload new image if selected
      if (profileImage && profileImage !== user.profile_image_url) {
        try {
          const uploadedUrl = await uploadProfileImage(profileImage);
          imageUrl = uploadedUrl || undefined;
        } catch (error) {
          Alert.alert('Error', 'No se pudo subir la imagen. ¿Deseas continuar sin cambiarla?', [
            { text: 'Cancelar', style: 'cancel', onPress: () => setSaving(false) },
            { text: 'Continuar', onPress: () => saveProfileData(user.profile_image_url || undefined) },
          ]);
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
    ensureAvatarsBucket(); // Initialize bucket on component mount
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