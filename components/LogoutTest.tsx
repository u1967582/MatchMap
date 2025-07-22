import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';
import { useSession } from '~/hooks/useSession';

export const LogoutTest: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, session } = useSession();

  const handleLogout = () => {
    Alert.alert(
      '¿Seguro que quieres salir?',
      'Tu sesión se cerrará y volverás al login.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('Error al cerrar sesión:', error);
                Alert.alert('Error', 'No se pudo cerrar la sesión');
                return;
              }
              
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Error inesperado al cerrar sesión:', error);
              Alert.alert('Error', 'Error inesperado al cerrar sesión. Inténtalo de nuevo.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>
        Estado: {isAuthenticated ? 'Autenticado' : 'No autenticado'}
      </Text>
      <Text style={styles.emailText}>
        Email: {session?.user?.email || 'No disponible'}
      </Text>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  statusText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emailText: {
    fontSize: 14,
    color: '#A3B3CC',
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 