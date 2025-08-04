import { View, StyleSheet, SafeAreaView, Text, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BackgroundImage from '~/components/ui/BackgroundImage';
import ScreenTitle from '~/components/ui/ScreenTitle';
import CustomButton from '~/components/ui/CustomButton';

const WelcomeScreen: React.FC = () => {
  const router = useRouter();

  const handleLoginPress = () => {
    router.push('/(auth)/login');
  };

  const handleSignUpPress = () => {
    router.push('/(auth)/register');
  };

  return (
    <BackgroundImage source={require('~/assets/stadium.jpg')}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.contentContainer}>
            {/* App Icon */}
            <View style={styles.iconContainer}>
              <Image 
                source={require('~/assets/icon.png')} 
                style={styles.appIcon}
                resizeMode="contain"
              />
            </View>
            
            {/* Main Title */}
            <ScreenTitle title="Encuentra los mejores bares para ver el partido" />
            
            {/* Subtitle */}
            <Text style={styles.subtitle}>
              Descubre bares deportivos cerca de ti y disfruta del fútbol con la mejor compañía
            </Text>
            
            {/* Features */}
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <Ionicons name="location" size={20} color="#007AFF" />
                <Text style={styles.featureText}>Bares cercanos</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="star" size={20} color="#007AFF" />
                <Text style={styles.featureText}>Reseñas verificadas</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="calendar" size={20} color="#007AFF" />
                <Text style={styles.featureText}>Partidos en vivo</Text>
              </View>
            </View>
            
            <View style={styles.buttonsContainer}>
              <CustomButton
                text="Iniciar sesión"
                onPress={handleLoginPress}
                variant="primary"
              />
              
              <CustomButton
                text="Registrarse"
                onPress={handleSignUpPress}
                variant="secondary"
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </BackgroundImage>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },
  iconContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 120,
    height: 120,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
    marginBottom: 40,
    opacity: 1,
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  buttonsContainer: {
    width: '100%',
    gap: 20,
  },
});

export default WelcomeScreen; 