import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import ExamplePlayer from '~/components/ExamplePlayer';

export default function ExamplePlayerScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          title: 'Example Player'
        }} 
      />
      <ExamplePlayer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 