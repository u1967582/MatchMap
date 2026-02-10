---
name: supabase
description: This skill should be used when working with Supabase database operations, including typed queries, RLS policies, migrations, authentication, storage, and realtime subscriptions for the MatchMap project.
---

# Supabase Skill para MatchMap

## Patrones de Consulta

### 1. Consultas Básicas con Tipos
```typescript
import { Database } from '@/types/supabase';

type Bar = Database['public']['Tables']['bars']['Row'];
type BarInsert = Database['public']['Tables']['bars']['Insert'];
type BarUpdate = Database['public']['Tables']['bars']['Update'];

// ✅ CORRECTO: Con tipos y manejo de errores
async function getBar(id: string): Promise<Bar> {
  const { data, error } = await supabase
    .from('bars')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Failed to fetch bar: ${error.message}`);
  if (!data) throw new Error('Bar not found');

  return data;
}

// ❌ INCORRECTO: Sin tipos ni manejo de errores
async function getBar(id) {
  const { data } = await supabase.from('bars').select('*').eq('id', id).single();
  return data;
}
```

### 2. Consultas con Relaciones
```typescript
// ✅ CORRECTO: Join específico y tipado
const { data: bars } = await supabase
  .from('bars')
  .select(`
    *,
    bar_images!inner (
      id,
      image_url,
      image_order
    ),
    bar_selected_teams!inner (
      teams!inner (
        id,
        name,
        logo_url
      )
    ),
    bar_boosts!left (
      id,
      status,
      end_at
    )
  `)
  .eq('is_active', true)
  .eq('bar_boosts.status', 'active')
  .order('image_order', { foreignTable: 'bar_images', ascending: true });

// ❌ INCORRECTO: Select *, sin ordenamiento
const { data: bars } = await supabase
  .from('bars')
  .select('*, bar_images(*), bar_selected_teams(teams(*))');
```

### 3. Inserción con Validación
```typescript
// ✅ CORRECTO: Con validación y manejo de errores
import { z } from 'zod';

const BarSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500),
  phone: z.string().regex(/^\+?[0-9\s-]+$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

async function createBar(barData: z.infer<typeof BarSchema>) {
  const validated = BarSchema.parse(barData);

  const { data, error } = await supabase
    .from('bars')
    .insert(validated)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Bar already exists');
    }
    throw error;
  }

  return data;
}

// ❌ INCORRECTO: Sin validación
async function createBar(barData) {
  const { data } = await supabase.from('bars').insert(barData);
  return data;
}
```

### 4. RLS Policies - Verificación
```typescript
// ✅ CORRECTO: Verificar RLS antes de operaciones sensibles
async function canUserEditBar(userId: string, barId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bars')
    .select('owner_id')
    .eq('id', barId)
    .single();

  return data?.owner_id === userId;
}

async function updateBar(userId: string, barId: string, updates: BarUpdate) {
  if (!await canUserEditBar(userId, barId)) {
    throw new Error('Unauthorized: You do not own this bar');
  }

  const { data, error } = await supabase
    .from('bars')
    .update(updates)
    .eq('id', barId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### 5. Realtime Subscriptions
```typescript
// ✅ CORRECTO: Con cleanup y tipos
useEffect(() => {
  const channel = supabase
    .channel('bar-updates')
    .on<Bar>(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bars',
        filter: `id=eq.${barId}`,
      },
      (payload) => {
        if (payload.eventType === 'UPDATE') {
          setBar(payload.new);
        } else if (payload.eventType === 'DELETE') {
          router.back();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [barId]);

// ❌ INCORRECTO: Sin cleanup
useEffect(() => {
  supabase
    .channel('bar-updates')
    .on('postgres_changes', { table: 'bars' }, (payload) => {
      setBar(payload.new);
    })
    .subscribe();
}, []);
```

### 6. Auth con Google OAuth
```typescript
// ✅ CORRECTO: Con manejo de deep linking
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

async function signInWithGoogle() {
  try {
    const redirectUrl = Linking.createURL('/');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUrl
    );

    if (result.type === 'success') {
      const url = Linking.parse(result.url);
      const refresh_token = url.queryParams?.refresh_token;
      const access_token = url.queryParams?.access_token;

      if (access_token && refresh_token) {
        await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
      }
    }
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
}
```

### 7. Storage - Upload de Imágenes
```typescript
// ✅ CORRECTO: Con resize y compresión
import * as ImageManipulator from 'expo-image-manipulator';

async function uploadBarImage(
  barId: string,
  imageUri: string,
  type: 'profile' | 'cover' | 'gallery'
): Promise<string> {
  // 1. Resize y comprimir
  const manipulated = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: type === 'profile' ? 400 : 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2. Convertir a blob
  const response = await fetch(manipulated.uri);
  const blob = await response.blob();

  // 3. Upload a Supabase Storage
  const fileName = `${barId}/${type}_${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from('bar-images')
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  // 4. Obtener URL pública
  const { data: publicData } = supabase.storage
    .from('bar-images')
    .getPublicUrl(data.path);

  return publicData.publicUrl;
}

// ❌ INCORRECTO: Sin optimización de imagen
async function uploadBarImage(barId, imageUri) {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const { data } = await supabase.storage.from('bar-images').upload(`${barId}/${Date.now()}.jpg`, blob);
  return data.path;
}
```

## Migraciones SQL

### Template de Migración

For database migrations, use the comprehensive SQL template located in `assets/migration.template.sql`.

The template includes 7 standardized sections:
1. **CREATE TABLES** - Table definitions with constraints
2. **CREATE INDEXES** - Performance optimization
3. **ENABLE RLS** - Row Level Security activation
4. **CREATE RLS POLICIES** - Access control policies
5. **CREATE FUNCTIONS/TRIGGERS** - Automated logic (e.g., updated_at)
6. **GRANTS** - Permission assignments
7. **ROLLBACK** - Commented cleanup code for reference

**Usage:**
1. Copy `assets/migration.template.sql`
2. Replace placeholders (YYYYMMDDHHMMSS, {{DATE}}, table_name, etc.)
3. Customize for your specific migration needs
4. Run in Supabase SQL Editor

## Checklist de Seguridad

- [ ] RLS activado en todas las tablas
- [ ] Políticas RLS probadas con usuarios reales
- [ ] Service key solo en backend/Edge Functions
- [ ] Anon key en frontend
- [ ] Validación de datos antes de insertar
- [ ] Indexes en columnas de búsqueda frecuente
- [ ] Triggers para updated_at donde sea necesario
- [ ] Storage policies configuradas
- [ ] CORS configurado correctamente
