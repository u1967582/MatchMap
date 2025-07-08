import { useState } from 'react';
import { View, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';
import ScreenTitle from '~/components/ui/ScreenTitle';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        Alert.alert('Error de inicio de sesión', error.message);
        return;
      }

      router.push('/');
    } catch (error) {
      Alert.alert('Error', 'Error inesperado durante el inicio de sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <ScreenTitle 
          title="Iniciar Sesión" 
          color="#333" 
          shadow={false}
          marginBottom={40}
        />
        
        <InputField
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <InputField
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        
        <CustomButton
          text="Iniciar Sesión"
          onPress={handleLogin}
          variant="primary"
          loading={loading}
        />
        
        <View style={styles.linkContainer}>
          <Link href="/(auth)/register" style={styles.link}>
            ¿No tienes cuenta? Regístrate
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  linkContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  link: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default LoginScreen; 