import { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View, StatusBar, Platform } from 'react-native';

interface BackgroundImageProps {
  children: ReactNode;
  source: any;
  overlay?: boolean;
  overlayColor?: string;
}

const BackgroundImage: React.FC<BackgroundImageProps> = ({
  children,
  source,
  overlay = true,
  overlayColor = 'rgba(0, 0, 0, 0.4)',
}) => {
  return (
    <ImageBackground source={source} style={styles.backgroundImage} resizeMode="cover">
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={Platform.OS === 'android' ? '#1C2A3A' : 'transparent'} 
        translucent={false}
      />
      
      {overlay && <View style={[styles.overlay, { backgroundColor: overlayColor }]} />}
      
      <View style={styles.content}>
        {children}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});

export default BackgroundImage; 