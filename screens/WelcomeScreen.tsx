import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
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
      <SafeAreaView style={styles.container}>
        <View style={styles.contentContainer}>
          <ScreenTitle title="Find the best bars to watch the game" />
          
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
    </BackgroundImage>
  );
};

const styles = StyleSheet.create({
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
  buttonsContainer: {
    width: '100%',
    gap: 20,
  },
});

export default WelcomeScreen; 