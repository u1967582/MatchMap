import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import Map from '~/components/Map';

export default function Home() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: false,
      }} />
      <Map />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 0,
    padding: 0,
  },
});
