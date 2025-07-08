import { Stack, useFocusEffect } from 'expo-router';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useCallback } from 'react';
import Map from '~/components/Map';

export default function MapScreen() {
  // Set status bar style when screen is focused
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content', true);
      if (Platform.OS === 'android' && StatusBar.setBackgroundColor) {
        StatusBar.setBackgroundColor('transparent', true);
      }
    }, [])
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'none',
        }} 
      />
      <Map />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}); 