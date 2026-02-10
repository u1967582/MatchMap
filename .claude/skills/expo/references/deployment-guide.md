# Deployment Checklist para MatchMap

Complete guide for deploying MatchMap to iOS App Store and Google Play.

## iOS (App Store)

Pre-deployment checklist:

- [ ] Bundle identifier configurado (`com.matchmap.app`)
- [ ] Build number incrementado
- [ ] Icon y splash screen correctos (1024x1024 para icon)
- [ ] Permisos de uso configurados:
  - [ ] NSLocationWhenInUseUsageDescription
  - [ ] NSPhotoLibraryUsageDescription
- [ ] App Store Connect configurado
- [ ] Screenshots preparados (todos los tamaños requeridos)
- [ ] Privacy Policy URL proporcionada
- [ ] TestFlight testing completado
- [ ] Apple Developer account configurado
- [ ] Certificates y provisioning profiles válidos

## Android (Google Play)

Pre-deployment checklist:

- [ ] Package name configurado (`com.matchmap.app`)
- [ ] Version code incrementado
- [ ] Adaptive icon configurado
- [ ] Permisos declarados en app.json:
  - [ ] ACCESS_COARSE_LOCATION
  - [ ] ACCESS_FINE_LOCATION
  - [ ] READ_EXTERNAL_STORAGE
  - [ ] WRITE_EXTERNAL_STORAGE
- [ ] Signing key configurado en EAS
- [ ] Google Play Console configurado
- [ ] Screenshots preparados (todos los tamaños requeridos)
- [ ] Privacy Policy URL proporcionada
- [ ] Internal testing completado
- [ ] Google Play Developer account configurado

## Ambas Plataformas

Cross-platform deployment requirements:

- [ ] Variables de entorno configuradas en EAS:
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY
  - [ ] GOOGLE_MAPS_API_KEY_IOS
  - [ ] GOOGLE_MAPS_API_KEY_ANDROID
  - [ ] REVENUECAT_API_KEY_IOS
  - [ ] REVENUECAT_API_KEY_ANDROID
- [ ] eas.json configurado correctamente
- [ ] Channel de updates configurado (production, preview)
- [ ] Error tracking configurado (Sentry, etc.)
- [ ] Analytics configurado
- [ ] Deep linking testeado:
  - [ ] matchmap://bar-profile/[id]
  - [ ] https://matchmap.app/bar-profile/[id]
- [ ] OTA updates probados
- [ ] Performance testing completado
- [ ] Security audit realizado
- [ ] Terms of Service finalizados
- [ ] Privacy Policy finalizada
- [ ] App description y keywords optimizados

## Deployment Commands

### iOS Build
```bash
eas build --profile production --platform ios
```

### Android Build
```bash
eas build --profile production --platform android
```

### Both Platforms
```bash
eas build --profile production --platform all
```

### Submit to Stores
```bash
# iOS
eas submit --platform ios

# Android
eas submit --platform android
```

## Post-Deployment

After successful deployment:

- [ ] Monitor crash reports
- [ ] Check analytics for adoption
- [ ] Monitor app reviews
- [ ] Prepare OTA updates for quick fixes
- [ ] Set up alerting for critical errors
- [ ] Document version release notes
