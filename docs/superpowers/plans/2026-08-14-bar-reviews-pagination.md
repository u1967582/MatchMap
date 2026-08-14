# Paginación de reseñas en perfil del bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `components/BarReviewsSection.tsx`, mostrar solo 5 reseñas inicialmente (priorizando las de la app sobre las de Google, luego por fecha descendente), con un botón "Cargar más reseñas" que revela 5 reseñas adicionales por pulsación hasta agotar la lista.

**Architecture:** Todo el cambio es client-side dentro de `BarReviewsSection.tsx`. El fetch a Supabase no cambia (sigue trayendo todas las reseñas para calcular el header de promedio/distribución). Se añade: (1) un `sort` explícito sobre el array transformado antes de guardarlo en estado, y (2) un estado `visibleCount` que controla cuántas reseñas del array ordenado se pasan al `FlatList`, con un botón que lo incrementa de 5 en 5.

**Tech Stack:** React Native, TypeScript, Jest + `@testing-library/react-native`, mock de Supabase vía `test-utils/mockSupabase.ts`.

## Global Constraints

- No se modifica la query de Supabase ni el backend (spec: "Fuera de alcance").
- El botón "Cargar más" usa texto genérico: **"Cargar más reseñas"** (sin contador).
- El botón desaparece (no se deshabilita) cuando ya no quedan reseñas por mostrar.
- Orden de prioridad: reseñas de la app (`is_google_review === false`) antes que las de Google; dentro de cada grupo, `created_at` descendente.
- El header (promedio, distribución, `totalReviews`) sigue calculándose sobre el array completo, no sobre el slice visible.
- Tras cada cambio, `npm test` debe poder ejecutarse y pasar (memoria de proyecto: tests obligatorios tras cada feature).

---

## Task 1: Ordenación con prioridad + paginación client-side + botón "Cargar más"

**Files:**
- Modify: `components/BarReviewsSection.tsx:76-119` (transformación de datos y estado), `components/BarReviewsSection.tsx:312-322` (render del `FlatList` y nuevo botón), `components/BarReviewsSection.tsx:327-507` (estilos, añadir `loadMoreButton`/`loadMoreText`)
- Test: `components/__tests__/BarReviewsSection.test.tsx` (crear)

**Interfaces:**
- Consumes: `Review` interface ya definida en el propio archivo (`id, rating, comment, created_at, user, likes?, is_google_review?`).
- Produces: nada consumido por otros archivos — `BarReviewsSection` es un componente hoja, solo se usa desde `app/bar-profile/[barId].tsx` sin cambios de props.

- [ ] **Step 1: Escribir el test que falla**

Crear `components/__tests__/BarReviewsSection.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('~/utils/supabase');

import { createQueryBuilderMock } from '../../test-utils/mockSupabase';
import { supabase } from '~/utils/supabase';
import BarReviewsSection from '~/components/BarReviewsSection';

const mockedFrom = supabase.from as jest.Mock;

// 8 reseñas: 3 de Google (más recientes que las de la app, para probar
// que la prioridad de app-primero gana a la fecha) y 5 de la app.
const REVIEWS = [
  { id: 'g1', rating: 5, comment: 'Google review 1', created_at: '2026-08-10T00:00:00Z', likes: 0, is_google_review: true, google_author_name: 'Google User 1', user: null },
  { id: 'g2', rating: 4, comment: 'Google review 2', created_at: '2026-08-09T00:00:00Z', likes: 0, is_google_review: true, google_author_name: 'Google User 2', user: null },
  { id: 'g3', rating: 3, comment: 'Google review 3', created_at: '2026-08-08T00:00:00Z', likes: 0, is_google_review: true, google_author_name: 'Google User 3', user: null },
  { id: 'a1', rating: 5, comment: 'App review 1', created_at: '2026-08-01T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user1', profile_image_url: '' } },
  { id: 'a2', rating: 4, comment: 'App review 2', created_at: '2026-08-02T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user2', profile_image_url: '' } },
  { id: 'a3', rating: 3, comment: 'App review 3', created_at: '2026-08-03T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user3', profile_image_url: '' } },
  { id: 'a4', rating: 2, comment: 'App review 4', created_at: '2026-08-04T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user4', profile_image_url: '' } },
  { id: 'a5', rating: 1, comment: 'App review 5', created_at: '2026-08-05T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user5', profile_image_url: '' } },
];

// Orden esperado tras la prioridad (app primero, por fecha desc dentro de
// cada grupo; luego Google, por fecha desc): a5, a4, a3, a2, a1, g1, g2, g3
const EXPECTED_ORDER = ['App review 5', 'App review 4', 'App review 3', 'App review 2', 'App review 1', 'Google review 1', 'Google review 2', 'Google review 3'];

const mockFetch = (reviews: any[]) => {
  mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: reviews, error: null }));
  mockedFrom.mockReturnValueOnce(
    createQueryBuilderMock({ data: { rating: 0, review_count: reviews.length }, error: null })
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BarReviewsSection - paginación', () => {
  it('muestra solo las primeras 5 reseñas, priorizando las de la app sobre las de Google', async () => {
    mockFetch(REVIEWS);
    const { getByText, queryByText } = render(<BarReviewsSection barId="bar-1" />);

    await waitFor(() => {
      EXPECTED_ORDER.slice(0, 5).forEach((comment) => {
        expect(getByText(comment)).toBeTruthy();
      });
    });

    EXPECTED_ORDER.slice(5).forEach((comment) => {
      expect(queryByText(comment)).toBeNull();
    });
  });

  it('el botón "Cargar más reseñas" revela 5 reseñas adicionales y luego desaparece', async () => {
    mockFetch(REVIEWS);
    const { getByText, queryByText } = render(<BarReviewsSection barId="bar-1" />);

    await waitFor(() => expect(getByText('Cargar más reseñas')).toBeTruthy());

    fireEvent.press(getByText('Cargar más reseñas'));

    await waitFor(() => {
      EXPECTED_ORDER.forEach((comment) => {
        expect(getByText(comment)).toBeTruthy();
      });
    });

    expect(queryByText('Cargar más reseñas')).toBeNull();
  });

  it('no muestra el botón "Cargar más reseñas" si hay 5 reseñas o menos', async () => {
    mockFetch(REVIEWS.slice(0, 5));
    const { getByText, queryByText } = render(<BarReviewsSection barId="bar-1" />);

    await waitFor(() => expect(getByText('App review 1')).toBeTruthy());

    expect(queryByText('Cargar más reseñas')).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npx jest components/__tests__/BarReviewsSection.test.tsx`
Expected: FAIL — las reseñas 6, 7 y 8 (Google) se muestran igualmente porque no hay slicing ni orden de prioridad, y el texto "Cargar más reseñas" no existe en el árbol.

- [ ] **Step 3: Implementar orden de prioridad y estado de paginación**

En `components/BarReviewsSection.tsx`, añadir el estado junto a los demás `useState` (tras la línea `const [busyById, setBusyById] = useState<Record<string, boolean>>({});`):

```tsx
  const [visibleCount, setVisibleCount] = useState(5);
```

Sustituir el bloque de transformación de datos (líneas 76-93 actuales) para ordenar antes de guardar en estado:

```tsx
        if (reviewsData) {
          // Transform the data to match our interface
          const transformedData: Review[] = reviewsData.map((item: any) => ({
            id: item.id,
            rating: item.rating,
            comment: item.comment,
            created_at: item.created_at,
            likes: item.likes ?? 0,
            is_google_review: item.is_google_review ?? false,
            user: {
              username: item.is_google_review
                ? (item.google_author_name || 'Google')
                : (item.user?.username || 'Anonymous'),
              profile_image_url: item.user?.profile_image_url || '',
            },
          }));

          // Priorizar reseñas de la app sobre las de Google; dentro de cada
          // grupo, más recientes primero.
          const sortedData = [...transformedData].sort((a, b) => {
            if (a.is_google_review !== b.is_google_review) {
              return a.is_google_review ? 1 : -1;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          setReviews(sortedData);
          setVisibleCount(5);

          // Calculate distribution from reviews
          const ratings = [0, 0, 0, 0, 0];
          sortedData.forEach((r) => {
            if (r.rating >= 1 && r.rating <= 5) ratings[r.rating - 1]++;
          });
          setDistribution(ratings);

          // Compute totals from fetched reviews (fallback to bars data if needed)
          const total = sortedData.length;
          setTotalReviews(total);

          const computedAvg = total > 0
            ? sortedData.reduce((sum, r) => sum + (r.rating || 0), 0) / total
            : 0;
          setAverage(typeof barData?.rating === 'number' && barData.rating > 0 ? barData.rating : computedAvg);
        }
```

- [ ] **Step 4: Aplicar el slice al `FlatList` y añadir el botón "Cargar más reseñas"**

Sustituir el bloque final de renderizado de la lista (líneas 312-322 actuales):

```tsx
      {/* Lista de reseñas - solo cuando hay reseñas */}
      {hasReviews && (
        <>
          <FlatList
            data={reviews.slice(0, visibleCount)}
            keyExtractor={(item) => item.id}
            renderItem={renderReview}
            style={styles.reviewList}
            contentContainerStyle={{ paddingBottom: visibleCount < reviews.length ? 0 : 40 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
          {visibleCount < reviews.length && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => setVisibleCount((prev) => Math.min(prev + 5, reviews.length))}
              activeOpacity={0.7}
            >
              <AppText maxScale={1.0} style={styles.loadMoreText}>Cargar más reseñas</AppText>
            </TouchableOpacity>
          )}
        </>
      )}
```

Nota: `scrollEnabled={false}` se añade porque `BarReviewsSection` ya vive dentro de un scroll padre en `app/bar-profile/[barId].tsx` (patrón habitual en esta pantalla); con la lista acotada a un máximo de "todas las reseñas cargadas hasta el momento" (nunca más de las que el usuario pidió ver), un `FlatList` no virtualizado dentro de un `ScrollView` es aceptable. Si `BarReviewsSection` se usa en el futuro fuera de un scroll padre, revisar esta propiedad.

Añadir los estilos nuevos en el objeto `styles` (junto a `ctaButton`/`ctaText`, al final del `StyleSheet.create`):

```tsx
  loadMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  loadMoreText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
```

- [ ] **Step 5: Ejecutar el test para verificar que pasa**

Run: `npx jest components/__tests__/BarReviewsSection.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Ejecutar la suite completa**

Run: `npm test`
Expected: PASS — sin regresiones en el resto de tests.

- [ ] **Step 7: Commit**

```bash
git add components/BarReviewsSection.tsx components/__tests__/BarReviewsSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(bar-profile): paginar reseñas de 5 en 5 priorizando las de la app

Antes se mostraban todas las reseñas de golpe. Ahora se ordenan
priorizando las de la app sobre las de Google y se muestran solo 5
inicialmente, con un botón "Cargar más reseñas" que revela 5 más por
pulsación hasta agotar la lista.
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Orden de prioridad (app antes que Google, luego fecha desc) → Step 3.
- `visibleCount` inicial en 5, reset en cada fetch → Step 3 (`setVisibleCount(5)` tras `setReviews`).
- Slice del `FlatList` → Step 4.
- Botón "Cargar más reseñas", texto genérico, incrementa de 5 en 5, desaparece al agotar → Step 4.
- Header calculado sobre el array completo, no el slice → Step 3 (usa `sortedData`, no el slice).
- Edge case ≤5 reseñas → cubierto por el tercer test del Step 1.
- Testing (spec dice explícitamente qué probar) → cubierto por los 3 tests del Step 1.

**Placeholder scan:** sin TBD/TODO; todos los pasos incluyen código completo.

**Type consistency:** `visibleCount` es `number` en todo el archivo; `Review[]` no cambia de forma; `styles.loadMoreButton`/`styles.loadMoreText` se usan con los mismos nombres en Step 4.
