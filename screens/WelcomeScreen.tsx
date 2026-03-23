import { View, StyleSheet, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { AppText } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BackgroundImage from '~/components/ui/BackgroundImage';
import CustomButton from '~/components/ui/CustomButton';
import { useState } from 'react';

interface WelcomeScreenProps {
  onLoginPress: () => void;
  onRegisterPress: () => void;
  onGooglePress: () => void;
  loadingGoogle: boolean;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onLoginPress,
  onRegisterPress,
  onGooglePress,
  loadingGoogle,
}) => {
  const { width } = Dimensions.get('window');
  const [currentIndex, setCurrentIndex] = useState(0);

  const slides = [
    {
      key: 'nearby',
      icon: 'map',
      title: 'Encuentra bares cerca de ti',
      description: 'Explora tu zona y descubre los mejores lugares para ver el partido.'
    },
    {
      key: 'events',
      icon: 'calendar',
      title: 'Descubre eventos y partidos',
      description: 'Consulta la agenda de retransmisiones y no te pierdas nada.'
    },
    {
      key: 'favorites',
      icon: 'heart',
      title: 'Guarda tus bares favoritos',
      description: 'Accede rápido a los sitios que más te gustan.'
    }
  ] as const;

  const renderSlide = ({ item }: { item: typeof slides[number] }) => (
    <View style={[styles.slide, { width }]}>      
      <View style={styles.illustration}>
        <Ionicons name={item.icon as any} size={120} color="#7FB3FF" />
      </View>
      <AppText maxScale={1.2} style={styles.title}>{item.title}</AppText>
      <AppText maxScale={1.3} style={styles.description}>{item.description}</AppText>
    </View>
  );

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (index !== currentIndex) setCurrentIndex(index);
  };

  return (
    <BackgroundImage source={require('~/assets/stadium.jpg')}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* Onboarding hero (horizontal) */}
          <View style={styles.heroContainer}>
            <FlatList
              data={slides}
              renderItem={renderSlide}
              keyExtractor={(s) => s.key}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
            {/* Pagination dots */}
            <View style={styles.dotsContainer}>
              {slides.map((_, i) => (
                <View key={`dot-${i}`} style={[styles.dot, i === currentIndex && styles.dotActive]} />
              ))}
            </View>
          </View>

          {/* Sticky bottom buttons */}
          <View style={styles.footer}>
            <CustomButton 
              text="Iniciar sesión" 
              onPress={onLoginPress} 
              variant="primary"
              disabled={loadingGoogle}
            />
            <CustomButton 
              text="Registrarse" 
              onPress={onRegisterPress} 
              variant="secondary"
              disabled={loadingGoogle}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <AppText maxScale={1.0} style={styles.dividerText}>o</AppText>
              <View style={styles.dividerLine} />
            </View>

            <CustomButton
              text="Continuar con Google"
              onPress={onGooglePress}
              variant="social"
              loading={loadingGoogle}
              disabled={loadingGoogle}
            />
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
  heroContainer: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  illustration: {
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  description: {
    color: '#C7D2FE',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  footer: {
    padding: 16,
    gap: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#3A4A5A',
  },
  dividerText: {
    color: '#8E8E93',
    paddingHorizontal: 16,
    fontSize: 14,
  },
});

export default WelcomeScreen; 