import { Stack } from 'expo-router';

export default function RegisterBarLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, // Deshabilitar gestos de navegación
        animation: 'slide_from_right',
      }}
    >
      {/* Inicio directo en step1 (planes/pagos eliminados) */}
      <Stack.Screen 
        name="step1" 
        options={{ 
          title: 'Paso 1 - Información General',
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="step2" 
        options={{ 
          title: 'Paso 2 - Información Adicional',
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="step3" 
        options={{ 
          title: 'Paso 3 - Ubicación',
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="step4" 
        options={{ 
          title: 'Paso 4 - Fotos',
          gestureEnabled: false,
        }} 
      />
    </Stack>
  );
} 