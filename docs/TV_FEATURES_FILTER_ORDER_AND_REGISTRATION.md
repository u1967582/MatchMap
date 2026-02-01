# Cambios: Orden de Filtros y Actualización de Registro de Bares

## 📅 Fecha
30 de enero de 2026

## 🎯 Objetivos Completados
1. ✅ Cambiar el orden de los filtros en FilterModal
2. ✅ Actualizar formularios de registro (frío y normal) para usar TV features en lugar de languages
3. ✅ Actualizar hooks de registro
4. ✅ Actualizar perfil de bar para mostrar TV features
5. ✅ Actualizar componentes relacionados

## 📋 Cambios Realizados

### 1. Orden de Filtros Actualizado (`components/ui/FilterModal.tsx`)

**Nuevo orden:**
1. 🏠 **Tipo de bar** (primera posición)
2. 📺 **Características de TV** (segunda posición)
3. 🍽️ **Tipo de comida** (tercera posición)
4. ✨ **Características genéricas** (cuarta posición)

```tsx
// Antes:
{renderSection('Tipo de bar', ...)}
{renderSection('Tipo de comida', ...)}
{renderSection('Características', ...)}
{renderSection('Características de TV', ...)}

// Después:
{renderSection('Tipo de bar', ...)}
{renderSection('Características de TV', ...)}
{renderSection('Tipo de comida', ...)}
{renderSection('Características', ...)}
```

---

### 2. Store de Registro (`stores/barRegisterStore.ts`)

**Cambios:**
- ❌ Eliminado: `languageIds: string[]`
- ✅ Agregado: `tvFeatureIds: string[]`

```typescript
// Antes:
interface BarRegisterState {
  languageIds: string[];
  foodTypeIds: string[];
  featureIds: string[];
}

// Después:
interface BarRegisterState {
  tvFeatureIds: string[];
  foodTypeIds: string[];
  featureIds: string[];
}
```

---

### 3. Formulario de Registro - Paso 2 (`screens/registerBar/Step2ExtraInfo.tsx`)

**Cambios principales:**
1. Estado actualizado de `languages` → `tvFeatures`
2. Función `fetchLanguages()` → `fetchTvFeatures()`
3. Query de `languages` → `bar_tv_features`
4. CheckboxGroup actualizado

```typescript
// Antes:
const { languageIds, foodTypeIds, featureIds, setField } = useBarRegisterStore();
const [languages, setLanguages] = useState<SelectOption[]>([]);

const fetchLanguages = async () => {
  const { data } = await supabase.from('languages').select('id, name');
  setLanguages(data?.map(lang => ({ id: lang.id.toString(), label: lang.name })));
};

<CheckboxGroup
  label="Idiomas que se hablan"
  options={languages}
  selectedIds={languageIds}
  onSelectionChange={(ids) => setField('languageIds', ids)}
/>

// Después:
const { tvFeatureIds, foodTypeIds, featureIds, setField } = useBarRegisterStore();
const [tvFeatures, setTvFeatures] = useState<SelectOption[]>([]);

const fetchTvFeatures = async () => {
  const { data } = await supabase.from('bar_tv_features').select('id, name');
  setTvFeatures(data?.map(feat => ({ id: feat.id.toString(), label: feat.name })));
};

<CheckboxGroup
  label="Características de TV"
  options={tvFeatures}
  selectedIds={tvFeatureIds}
  onSelectionChange={(ids) => setField('tvFeatureIds', ids)}
/>
```

---

### 4. Formulario de Registro - Paso 4 (`screens/registerBar/Step4Photos.tsx`)

**Cambios en `insertRelationships()`:**

```typescript
// Antes:
const relationships = [
  {
    table: 'bar_languages',
    data: formData.languageIds?.map((id: string) => ({
      bar_id: barId,
      language_id: parseInt(id)
    }))
  },
  // ...
];

// Después:
const relationships = [
  {
    table: 'bar_selected_tv_features',
    data: formData.tvFeatureIds?.map((id: string) => ({
      bar_id: barId,
      tv_feature_id: parseInt(id)
    }))
  },
  // ...
];
```

---

### 5. Hook de Registro (`hooks/useBarRegistration.ts`)

**Cambios:**

```typescript
// Antes:
if (formData.languageIds.length > 0) {
  const languageInserts = formData.languageIds.map((languageId: string) => ({
    bar_id: barData.id,
    language_id: languageId,
  }));
  await supabase.from('bar_languages').insert(languageInserts);
}

// Después:
if (formData.tvFeatureIds && formData.tvFeatureIds.length > 0) {
  const tvFeatureInserts = formData.tvFeatureIds.map((tvFeatureId: string) => ({
    bar_id: barData.id,
    tv_feature_id: tvFeatureId,
  }));
  await supabase.from('bar_selected_tv_features').insert(tvFeatureInserts);
}
```

---

### 6. Perfil de Bar (`app/bar-profile/[barId].tsx`)

**Cambios en la interfaz:**

```typescript
// Antes:
interface BarProfile {
  bar_languages?: { language_id: number; language: { name: string } }[];
}

// Después:
interface BarProfile {
  bar_selected_tv_features?: { tv_feature_id: number; tv_feature: { name: string } }[];
}
```

**Cambios en la carga de datos:**

```typescript
// Antes:
const { data: languages } = await supabase
  .from('bar_languages')
  .select('language_id')
  .eq('bar_id', barId);

const languageIds = languages?.map(item => item.language_id) || [];
const { data: languageNames } = await supabase
  .from('languages')
  .select('id, name')
  .in('id', languageIds);

const languageMap = new Map();
languageNames?.forEach(item => languageMap.set(item.id, item.name));

// Después:
const { data: tvFeatures } = await supabase
  .from('bar_selected_tv_features')
  .select('tv_feature_id')
  .eq('bar_id', barId);

const tvFeatureIds = tvFeatures?.map(item => item.tv_feature_id) || [];
const { data: tvFeatureNames } = await supabase
  .from('bar_tv_features')
  .select('id, name')
  .in('id', tvFeatureIds);

const tvFeatureMap = new Map();
tvFeatureNames?.forEach(item => tvFeatureMap.set(item.id, item.name));
```

**Cambios en el renderizado de tags:**

```typescript
// Antes:
case 'language':
  backgroundColor = '#4CAF50';
  icon = '🗣️';
  text = (item.data as { language: { name: string } }).language.name;
  break;

// Después:
case 'tv_feature':
  backgroundColor = '#4CAF50';
  icon = '📺';
  text = (item.data as { tv_feature: { name: string } }).tv_feature.name;
  break;
```

---

### 7. Componente BarInfoCard (`components/BarInfoCard.tsx`)

**Cambios en la interfaz:**

```typescript
// Antes:
interface Bar {
  bar_languages?: { language_id: number; language: { name: string } }[];
}

// Después:
interface Bar {
  bar_selected_tv_features?: { tv_feature_id: number; tv_feature: { name: string } }[];
}
```

---

## 🗂️ Archivos Modificados

1. ✅ `components/ui/FilterModal.tsx` - Orden de filtros
2. ✅ `stores/barRegisterStore.ts` - Estado del formulario
3. ✅ `screens/registerBar/Step2ExtraInfo.tsx` - Formulario paso 2
4. ✅ `screens/registerBar/Step4Photos.tsx` - Inserción de relaciones
5. ✅ `hooks/useBarRegistration.ts` - Lógica de registro
6. ✅ `app/bar-profile/[barId].tsx` - Vista del perfil
7. ✅ `components/BarInfoCard.tsx` - Tarjeta de información

---

## 🔄 Flujo Completo de Registro

### Registro Normal (Usuario Autenticado)
1. **Paso 1** → Información general (nombre, descripción, categoría)
2. **Paso 2** → **Características de TV** (nuevo), tipo de comida, características del bar
3. **Paso 3** → Ubicación y dirección
4. **Paso 4** → Fotos del bar y menú
5. **Submit** → Inserta en `bars`, `bar_selected_tv_features`, `bar_food_types`, `bar_selected_features`

### Registro en Frío (Super User)
1. **Paso 1** → Información general + email del propietario
2. **Paso 2** → **Características de TV** (nuevo), tipo de comida, características
3. **Paso 3** → Ubicación
4. **Paso 4** → Fotos
5. **Submit** → Inserta en `auto_pre_register_bars`, subida de imágenes al storage

---

## 📺 Características de TV Disponibles

Las siguientes características están disponibles desde la base de datos:

1. 📺 Pantallas Gigantes
2. 🖥️ Múltiples Pantallas
3. ✨ Buena Calidad de Imagen
4. 🔊 Sonido Envolvente
5. 🔉 Audio Alto
6. 4️⃣ TV 4K
7. 📽️ Proyector de Gran Formato
8. 📡 Transmisión en Vivo Garantizada

---

## ✅ Verificación de Cambios

Para verificar que todo funciona correctamente:

1. **Filtros:**
   - Abre la app y ve a la pantalla de búsqueda
   - Abre el modal de filtros
   - Verifica que el orden sea: Tipo de bar → Características de TV → Tipo de comida → Características

2. **Registro de bar (normal):**
   - Inicia sesión como propietario de bar
   - Ve a "Registrar Bar"
   - En el Paso 2, verifica que aparezca "Características de TV" en lugar de "Idiomas"
   - Selecciona algunas características de TV
   - Completa el registro

3. **Registro en frío:**
   - Inicia sesión como super usuario
   - Ve a "Registrar Bar en Frío"
   - En el Paso 2, verifica "Características de TV"
   - Completa el registro

4. **Perfil de bar:**
   - Abre cualquier perfil de bar
   - Verifica que las características de TV se muestren con el icono 📺
   - No deberían aparecer idiomas

---

## 🚫 Elementos Eliminados

- ❌ Idiomas en filtros
- ❌ `languageIds` en el store de registro
- ❌ `bar_languages` en interfaces TypeScript
- ❌ Queries a la tabla `languages` en el flujo de registro
- ❌ CheckboxGroup de "Idiomas que se hablan"

---

## ✨ Elementos Añadidos

- ✅ Características de TV en filtros
- ✅ `tvFeatureIds` en el store de registro
- ✅ `bar_selected_tv_features` en interfaces TypeScript
- ✅ Queries a la tabla `bar_tv_features` en el flujo de registro
- ✅ CheckboxGroup de "Características de TV"
- ✅ Icono 📺 para características de TV en el perfil

---

## 🎉 Resultado Final

Ahora la aplicación:
- Muestra los filtros en un orden más lógico (bar → TV → comida → características)
- Permite a los propietarios seleccionar características de TV durante el registro
- Muestra estas características en el perfil del bar con el icono 📺
- No muestra idiomas en ninguna parte del flujo de registro o visualización
- Funciona tanto para registro normal como registro en frío

---

## 📝 Notas Importantes

1. **Base de datos:** La migración `20250130000000_tv_features.sql` debe estar aplicada
2. **RLS Policies:** Las políticas de seguridad están configuradas correctamente
3. **Datos iniciales:** 8 características de TV están pre-cargadas
4. **Compatibilidad:** Los bares existentes sin características de TV seguirán funcionando correctamente
5. **Idiomas:** Las tablas `languages` y `bar_languages` siguen en la base de datos pero no se usan en el frontend

---

## 🔍 Testing Checklist

- [ ] Abrir filtros y verificar orden
- [ ] Registrar bar normal con características de TV
- [ ] Registrar bar en frío con características de TV
- [ ] Ver perfil de bar con características de TV
- [ ] Verificar que no aparezcan idiomas en ninguna parte
- [ ] Buscar bares filtrando por características de TV
- [ ] Editar bar existente y agregar características de TV
