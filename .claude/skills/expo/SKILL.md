---
name: expo
description: This skill should be used when working with Expo configuration, EAS Build, OTA Updates, Expo Router navigation, and deployment to App Store/Google Play for the MatchMap mobile app.
---

# Expo Skill para MatchMap

## Purpose

Provides comprehensive guidance for Expo-based development, building, and deployment workflows specific to MatchMap.

## Configuration Templates

Use the configuration templates in `assets/` as starting points:

- **app.config.template.json** - Complete app.json configuration with iOS/Android settings, plugins, and permissions
- **eas.config.template.json** - EAS Build profiles (development, preview, production) and submit configuration

## Key Workflows

### EAS Build

**Build profiles:**
- `development` - Development client with simulator support
- `preview` - Internal testing builds (APK for Android)
- `production` - Production builds for store submission

**Commands:**
```bash
# Development
eas build --profile development --platform ios

# Preview/Testing
eas build --profile preview --platform all

# Production
eas build --profile production --platform all
```

**Environment variables:**
Configure secrets in EAS for secure credential management:
```bash
eas secret:create --scope project --name SUPABASE_URL --value "https://..."
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "eyJ..."
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_IOS --value "AIza..."
```

Access in code via expo-constants:
```typescript
import Constants from 'expo-constants';
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
```

### EAS Update (OTA)

**Publish updates:**
```bash
eas update --branch production --message "Fix: Bug description"
eas update --branch preview --message "Feat: New feature"
```

**Automatic update check:**
```typescript
import * as Updates from 'expo-updates';

useEffect(() => {
  async function checkForUpdates() {
    if (__DEV__) return;

    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Show alert to user
      await Updates.reloadAsync();
    }
  }
  checkForUpdates();
}, []);
```

### Expo Router

**Navigation:**
```typescript
import { router } from 'expo-router';

// Navigate
router.push('/bar-profile/123');
router.push({ pathname: '/write-review/[barId]', params: { barId: '123' } });

// Navigate and replace
router.replace('/login');

// Go back
router.back();
```

**Deep linking:**
- App scheme: `matchmap://bar-profile/[id]`
- Universal links: `https://matchmap.app/bar-profile/[id]`

### Essential Expo Modules

**Location:**
```typescript
import * as Location from 'expo-location';

const { status } = await Location.requestForegroundPermissionsAsync();
if (status === 'granted') {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
}
```

**Image Picker:**
```typescript
import * as ImagePicker from 'expo-image-picker';

const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (status === 'granted') {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
}
```

**Secure Store:**
```typescript
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('authToken', token);
const token = await SecureStore.getItemAsync('authToken');
await SecureStore.deleteItemAsync('authToken');
```

**Haptics:**
```typescript
import * as Haptics from 'expo-haptics';

// Light feedback (button tap)
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Success/Error feedback
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
```

## Performance Optimization

**Splash Screen Control:**
```typescript
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

// After loading
useEffect(() => {
  if (appIsReady) {
    SplashScreen.hideAsync();
  }
}, [appIsReady]);
```

**Asset Preloading:**
```typescript
import { Asset } from 'expo-asset';

const images = [
  require('./assets/logo.png'),
  require('./assets/placeholder-bar.png'),
];

await Promise.all(
  images.map(image => Asset.fromModule(image).downloadAsync())
);
```

## Deployment

For complete deployment checklists and procedures, see `references/deployment-guide.md`.

Quick checklist:
- iOS: Bundle identifier, build number, icons, permissions, App Store Connect
- Android: Package name, version code, adaptive icon, signing key, Google Play Console
- Both: Environment variables, deep linking, testing, privacy policy

**Submit to stores:**
```bash
eas submit --platform ios
eas submit --platform android
```

## Common Patterns for MatchMap

### App Configuration with Environment Variables

Use `app.config.js` instead of `app.json` for dynamic configuration:

```javascript
export default {
  expo: {
    name: 'MatchMap',
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      // ... other env vars
    },
  },
};
```

### Permissions Required

- **Location**: For showing nearby bars on map
- **Photo Library**: For uploading bar images
- **Camera** (optional): For taking photos directly

All permissions must have usage descriptions in `app.json` for iOS.

## When to Use This Skill

- Configuring Expo project settings
- Setting up EAS Build profiles
- Publishing OTA updates
- Implementing navigation with Expo Router
- Using Expo modules (Location, ImagePicker, etc.)
- Preparing for App Store/Google Play deployment
- Managing environment variables securely
- Optimizing app performance and load times
