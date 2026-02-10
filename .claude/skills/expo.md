# Expo Skill para MatchMap

## Configuración de Proyecto

### 1. app.json / app.config.js
```json
{
  "expo": {
    "name": "MatchMap",
    "slug": "matchmap",
    "version": "1.0.6",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0A0E27"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.matchmap.app",
      "buildNumber": "9",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "MatchMap necesita tu ubicación para mostrarte bares cercanos",
        "NSPhotoLibraryUsageDescription": "MatchMap necesita acceso a tus fotos para subir imágenes de bares"
      },
      "config": {
        "googleMapsApiKey": "GOOGLE_MAPS_API_KEY_IOS"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A0E27"
      },
      "package": "com.matchmap.app",
      "versionCode": 9,
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ],
      "config": {
        "googleMaps": {
          "apiKey": "GOOGLE_MAPS_API_KEY_ANDROID"
        }
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "MatchMap necesita tu ubicación para mostrarte bares cercanos"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "MatchMap necesita acceso a tus fotos para subir imágenes de bares"
        }
      ]
    ],
    "extra": {
      "router": {
        "origin": false
      },
      "eas": {
        "projectId": "tu-project-id-aqui"
      }
    }
  }
}
```

---

## EAS Build

### 1. eas.json - Configuración de Builds
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": {
        "simulator": false,
        "buildNumber": "auto-increment"
      },
      "android": {
        "buildType": "apk",
        "versionCode": "auto-increment"
      }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true,
      "ios": {
        "buildNumber": "auto-increment"
      },
      "android": {
        "versionCode": "auto-increment"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "tu-apple-id@email.com",
        "ascAppId": "tu-asc-app-id",
        "appleTeamId": "tu-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### 2. Comandos de Build
```bash
# ✅ CORRECTO: Build de desarrollo
eas build --profile development --platform ios

# ✅ CORRECTO: Build de preview (internal testing)
eas build --profile preview --platform all

# ✅ CORRECTO: Build de producción
eas build --profile production --platform all

# ✅ CORRECTO: Build local (para debugging)
eas build --profile development --platform ios --local

# ❌ INCORRECTO: Sin especificar profile
eas build --platform ios
```

### 3. Variables de Entorno en EAS
```bash
# Configurar secrets en EAS
eas secret:create --scope project --name SUPABASE_URL --value "https://..."
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "eyJ..."
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_IOS --value "AIza..."
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_ANDROID --value "AIza..."
eas secret:create --scope project --name REVENUECAT_API_KEY_IOS --value "appl_..."
eas secret:create --scope project --name REVENUECAT_API_KEY_ANDROID --value "goog_..."

# Listar secrets
eas secret:list

# Eliminar secret
eas secret:delete --name NOMBRE_SECRET
```

### 4. app.config.js con Variables de Entorno
```javascript
export default {
  expo: {
    name: 'MatchMap',
    slug: 'matchmap',
    // ... resto de configuración
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      googleMapsApiKeyIos: process.env.GOOGLE_MAPS_API_KEY_IOS,
      googleMapsApiKeyAndroid: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      revenuecatApiKeyIos: process.env.REVENUECAT_API_KEY_IOS,
      revenuecatApiKeyAndroid: process.env.REVENUECAT_API_KEY_ANDROID,
      eas: {
        projectId: 'tu-project-id-aqui',
      },
    },
  },
};
```

### 5. Acceder a Variables de Entorno
```typescript
// ✅ CORRECTO: Usar expo-constants
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ❌ INCORRECTO: Hardcodear credenciales
const supabase = createClient('https://...', 'eyJ...');
```

---

## EAS Update (OTA Updates)

### 1. Configuración de Updates
```json
// eas.json
{
  "build": {
    "production": {
      "channel": "production"
    },
    "preview": {
      "channel": "preview"
    }
  }
}
```

### 2. Publicar Updates
```bash
# ✅ CORRECTO: Update a canal de producción
eas update --branch production --message "Fix: Corregir bug en favoritos"

# ✅ CORRECTO: Update a canal de preview
eas update --branch preview --message "Feat: Nuevo diseño de perfil"

# ✅ CORRECTO: Ver historial de updates
eas update:list

# ✅ CORRECTO: Rollback a versión anterior
eas update:republish --group <group-id>

# ❌ INCORRECTO: Update sin mensaje descriptivo
eas update --branch production
```

### 3. Configurar Updates en App
```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import * as Updates from 'expo-updates';

export default function RootLayout() {
  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) return; // No check en desarrollo

      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();

          // Mostrar modal al usuario
          Alert.alert(
            'Actualización disponible',
            'Hay una nueva versión. ¿Reiniciar ahora?',
            [
              { text: 'Más tarde', style: 'cancel' },
              {
                text: 'Reiniciar',
                onPress: async () => {
                  await Updates.reloadAsync();
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }

    checkForUpdates();
  }, []);

  return <Stack />;
}
```

---

## Expo Router

### 1. Estructura de Rutas
```
app/
├── _layout.tsx                 # Layout raíz
├── (tabs)/                     # Tab navigation
│   ├── _layout.tsx
│   ├── index.tsx               # Home (mapa)
│   ├── search.tsx              # Búsqueda
│   ├── favorites.tsx           # Favoritos
│   └── profile.tsx             # Perfil
├── (auth)/                     # Auth modals
│   ├── login.tsx
│   └── register.tsx
├── bar-profile/
│   └── [barId].tsx             # Dynamic route
├── write-review/
│   └── [barId].tsx
└── +not-found.tsx              # 404
```

### 2. Navegación Programática
```typescript
// ✅ CORRECTO: Usar router de expo-router
import { router } from 'expo-router';

// Navegar a ruta
router.push('/bar-profile/123');

// Navegar con parámetros
router.push({
  pathname: '/write-review/[barId]',
  params: { barId: bar.id }
});

// Navegar y reemplazar
router.replace('/login');

// Volver atrás
router.back();

// Navegar a tabs
router.push('/(tabs)/search');

// ❌ INCORRECTO: Usar navigation de react-navigation directamente
navigation.navigate('BarProfile', { barId: '123' });
```

### 3. Deep Linking
```typescript
// app.json
{
  "expo": {
    "scheme": "matchmap",
    "web": {
      "bundler": "metro"
    }
  }
}

// Abrir desde deep link:
// matchmap://bar-profile/abc-123
// https://matchmap.app/bar-profile/abc-123

// Manejar deep link en componente
import { useLocalSearchParams } from 'expo-router';

export default function BarProfileScreen() {
  const { barId } = useLocalSearchParams();

  // barId viene del URL
}
```

---

## Expo Modules

### 1. Location
```typescript
// ✅ CORRECTO: Pedir permisos y obtener ubicación
import * as Location from 'expo-location';

async function getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permiso denegado',
        'MatchMap necesita acceso a tu ubicación para mostrarte bares cercanos'
      );
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
}

// ❌ INCORRECTO: No pedir permisos
const location = await Location.getCurrentPositionAsync();
```

### 2. Image Picker
```typescript
// ✅ CORRECTO: Pedir permisos y seleccionar imagen
import * as ImagePicker from 'expo-image-picker';

async function pickImage(): Promise<string | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
}
```

### 3. Secure Store (Credenciales)
```typescript
// ✅ CORRECTO: Guardar tokens de forma segura
import * as SecureStore from 'expo-secure-store';

async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('authToken', token);
}

async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync('authToken');
}

async function deleteAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync('authToken');
}

// ❌ INCORRECTO: Guardar tokens en AsyncStorage
await AsyncStorage.setItem('authToken', token);
```

### 4. Haptics (Feedback Táctil)
```typescript
// ✅ CORRECTO: Feedback táctil en acciones
import * as Haptics from 'expo-haptics';

// Feedback ligero (tocar botón)
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Feedback medio (seleccionar filtro)
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// Feedback pesado (acción importante)
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

// Feedback de éxito
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Feedback de error
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// Feedback de warning
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
```

---

## Performance y Optimización

### 1. Asset Optimization
```typescript
// ✅ CORRECTO: Precargar assets críticos
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';

async function cacheImages() {
  const images = [
    require('./assets/logo.png'),
    require('./assets/placeholder-bar.png'),
  ];

  const cacheImages = images.map(image => {
    return Asset.fromModule(image).downloadAsync();
  });

  await Promise.all(cacheImages);
}

// En _layout.tsx
useEffect(() => {
  cacheImages();
}, []);
```

### 2. Splash Screen
```typescript
// ✅ CORRECTO: Controlar splash screen manualmente
import * as SplashScreen from 'expo-splash-screen';

// Prevenir auto-hide
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Precargar fonts, assets, datos, etc.
        await cacheImages();
        await loadFonts();
        await checkAuthStatus();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View onLayout={onLayoutRootView} style={{ flex: 1 }}>
      {/* App content */}
    </View>
  );
}
```

---

## Checklist de Deployment

### iOS (App Store)
- [ ] Bundle identifier configurado
- [ ] Build number incrementado
- [ ] Icon y splash screen correctos (1024x1024 para icon)
- [ ] Permisos de uso (NSLocationWhenInUseUsageDescription, etc.)
- [ ] App Store Connect configurado
- [ ] Screenshots preparados
- [ ] Privacy Policy URL
- [ ] TestFlight testing completado

### Android (Google Play)
- [ ] Package name configurado
- [ ] Version code incrementado
- [ ] Adaptive icon configurado
- [ ] Permisos declarados en app.json
- [ ] Signing key configurado en EAS
- [ ] Google Play Console configurado
- [ ] Screenshots preparados
- [ ] Privacy Policy URL
- [ ] Internal testing completado

### Ambas Plataformas
- [ ] Variables de entorno configuradas en EAS
- [ ] eas.json configurado correctamente
- [ ] Channel de updates configurado
- [ ] Error tracking configurado (Sentry, etc.)
- [ ] Analytics configurado
- [ ] Deep linking testeado
- [ ] OTA updates probados
