import { Stack, useFocusEffect } from 'expo-router';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useCallback, useEffect } from 'react';
import Map from '~/components/Map';
import BottomTabBar from '~/components/ui/BottomTabBar';

export default function MapScreen() {
  // Set status bar style when component mounts
  useEffect(() => {
    StatusBar.setBarStyle('light-content', true);
    if (Platform.OS === 'android' && StatusBar.setBackgroundColor) {
      StatusBar.setBackgroundColor('transparent', true);
    }
  }, []);

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
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
    paddingBottom: Platform.OS === 'ios' ? 80 : 60, // Space for footer
  },
}); 