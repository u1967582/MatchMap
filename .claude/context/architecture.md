# Arquitectura de MatchMap

## Vista General
```
┌─────────────────────────────────────────────────────────┐
│                     Mobile App (Expo)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Screens    │  │  Components  │  │    Hooks     │ │
│  │ (UI Layer)   │  │  (Reusable)  │  │   (Logic)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                   │                  │        │
│         └───────────────────┴──────────────────┘        │
│                            │                             │
└────────────────────────────┼─────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase Backend                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Database   │  │     Auth     │  │    Storage   │ │
│  │ (PostgreSQL) │  │ (Google OAuth)│  │   (Images)   │ │
│  └──────┬───────┘  └──────────────┘  └──────────────┘ │
│         │                                               │
│         │ RLS Policies                                  │
│         │                                               │
│  ┌──────▼──────────────────────────────────────────┐  │
│  │              Database Schema                     │  │
│  │  bars → reviews → users                          │  │
│  │  bars → events → matches                         │  │
│  │  bars → bar_boosts → boost_payments              │  │
│  │  bars → favorites                                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Capas de la Aplicación

### 1. Presentation Layer (app/, screens/)
Expo Router para navegación:
- `app/(tabs)/`: Tabs principales (index, search, favorites, profile)
- `app/(auth)/`: Modals de autenticación
- `app/bar-profile/[barId].tsx`: Perfiles dinámicos
- `app/write-review/[barId].tsx`: Escribir reseñas

### 2. Component Layer (components/)
Dividido por responsabilidad:
- `components/ds/`: Design System (AppText, AppButton, AppCard, etc.)
- `components/Map.tsx`: Mapa principal con marcadores
- `components/BarCard.tsx`: Cards de bares
- `components/primitives/`: Button, Input, Card (primitivos)
- `components/shared/`: Loading, Error, Empty states

### 3. Business Logic Layer (hooks/)
Custom hooks con lógica:
- `hooks/useBars.ts`: Fetching y filtering de bares
- `hooks/useAuth.ts`: Estado de autenticación
- `hooks/useBoosts.ts`: Sistema de boosts
- `hooks/useLocation.ts`: Geolocalización

### 4. Data Layer (lib/)
Servicios y utilidades:
- `lib/supabase.ts`: Cliente de Supabase
- `lib/revenuecat.ts`: Configuración de RevenueCat
- `lib/types/`: Tipos TypeScript
- `lib/utils/`: Funciones helper

### 5. Backend (Supabase)
- PostgreSQL con RLS
- Auth (email + OAuth)
- Storage para imágenes
- Realtime subscriptions

## Flujo de Datos

### Ejemplo: Ver Bares en Mapa
```
1. Usuario abre app
   ↓
2. useLocation hook → Obtiene coordenadas
   ↓
3. useBars hook → Query a Supabase
   ↓
4. RLS Policy verifica permisos
   ↓
5. PostgreSQL ejecuta query con índices
   ↓
6. Datos retornan a hook
   ↓
7. Hook actualiza estado React
   ↓
8. MapScreen re-renderiza con markers
```

### Ejemplo: Activar Boost
```
1. Usuario selecciona plan (7d, 1m, 1y)
   ↓
2. Frontend → RevenueCat → Stripe Checkout
   ↓
3. Usuario completa pago en Stripe
   ↓
4. Webhook de Stripe → RevenueCat
   ↓
5. RevenueCat webhook → Supabase Edge Function
   ↓
6. Edge Function crea registro en bar_boosts
   ↓
7. Edge Function crea registro en boost_payments
   ↓
8. Realtime subscription notifica al cliente
   ↓
9. UI actualiza mostrando boost activo
```

## Patrones de Diseño

### 1. Repository Pattern (en hooks)
```typescript
// Hook actúa como repository
export function useBars(filters: BarFilters) {
  const [bars, setBars] = useState<Bar[]>([]);

  async function fetchBars() {
    const query = supabase.from('bars').select('*');

    if (filters.city) {
      query.eq('city', filters.city);
    }

    const { data } = await query;
    setBars(data);
  }

  return { bars, fetchBars, ... };
}
```

### 2. Compound Components
```typescript
<BarCard bar={bar}>
  <BarCard.Image />
  <BarCard.Title />
  <BarCard.Rating />
  <BarCard.Actions />
</BarCard>
```

### 3. Render Props (cuando sea necesario)
```typescript
<DataFetcher
  fetcher={() => supabase.from('bars').select()}
  render={({ data, isLoading }) => (
    isLoading ? <Loading /> : <BarList bars={data} />
  )}
/>
```

### 4. Higher-Order Components (raro, preferir hooks)
```typescript
export const withAuth = (Component) => {
  return (props) => {
    const { user, isLoading } = useAuth();

    if (isLoading) return <Loading />;
    if (!user) return <Redirect to="/auth/login" />;

    return <Component {...props} user={user} />;
  };
};
```

## Seguridad

### RLS Políticas Estándar

**Lectura pública, escritura privada:**
```sql
-- Users can read all active bars
CREATE POLICY "Anyone can view active bars"
  ON bars FOR SELECT
  USING (is_active = true);

-- Only owners can update their bars
CREATE POLICY "Owners can update own bars"
  ON bars FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());
```

**Solo propietario:**
```sql
-- Users can only see their own data
CREATE POLICY "Users view own data"
  ON favorites FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

## Performance

### Optimizaciones Implementadas

1. **Indexes en BD:**
   - `bars(latitude, longitude)` → Geo queries
   - `bars(is_active)` → Filtrado común
   - `matches(date)` → Búsqueda por fecha
   - `bar_boosts(status, end_at)` → Boosts activos

2. **React Native:**
   - FlatList con `getItemLayout`
   - Image caching con expo-image
   - Memoización de callbacks
   - Lazy loading de tabs

3. **Network:**
   - Debounce en búsquedas
   - Optimistic updates
   - Cache con react-query (si se implementa)

## Deployment

### Proceso de Release
```bash
# 1. Preparar release
git checkout main
git pull origin main

# 2. Incrementar versión
# Editar app.json: "version": "1.2.3"

# 3. Build iOS
eas build --platform ios --profile production

# 4. Build Android
eas build --platform android --profile production

# 5. Submit a stores (cuando builds están listos)
eas submit --platform ios
eas submit --platform android
```

### Profiles en eas.json
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

## Monitoring

### Métricas Clave
- Crash rate (< 1%)
- ANR rate (< 0.5%)
- API response time (< 500ms p95)
- Database query time (< 200ms p95)
- Image load time (< 2s p95)

### Logging
```typescript
// Usar console.log solo en desarrollo
if (__DEV__) {
  console.log('Debug info:', data);
}

// En producción, enviar a servicio de logging
import * as Sentry from '@sentry/react-native';
Sentry.captureException(error);
```

---

**Nota**: Esta arquitectura es evolutiva. A medida que la app crece, podemos introducir:
- State management global (Zustand, Redux)
- Backend for Frontend (Edge Functions más complejas)
- GraphQL si REST se queda corto
- Micro-frontends si el código crece mucho
