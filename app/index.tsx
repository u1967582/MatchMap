import { Stack } from 'expo-router';
import WelcomeScreen from '~/screens/WelcomeScreen';

export default function Home() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <WelcomeScreen />
    </>
  );
}


