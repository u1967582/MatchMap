# Paginación de reseñas en el perfil del bar

## Contexto

`components/BarReviewsSection.tsx` es el único consumidor de la lista de reseñas de un bar (usado desde `app/bar-profile/[barId].tsx`). Actualmente hace una única query a Supabase que trae **todas** las reseñas del bar (`reviews` table, filtradas por `bar_id`, ordenadas por `created_at` descendente) y las renderiza todas en un `FlatList`, sin límite ni paginación.

Las reseñas pueden venir de dos orígenes: escritas en la app (`is_google_review: false`) o importadas de Google (`is_google_review: true`, con `google_author_name` como nombre de usuario).

## Objetivo

Mostrar inicialmente solo 5 reseñas, priorizando las de la app sobre las de Google, con un botón "Cargar más" que revela 5 reseñas adicionales por pulsación, hasta agotar la lista.

## Alcance

Solo afecta a `components/BarReviewsSection.tsx`. No se modifica el backend, la query de Supabase, ni el esquema de datos. El fetch sigue trayendo todas las reseñas de una sola vez (es necesario para calcular el promedio y la distribución de estrellas del header, que se muestran sobre el total, no sobre el subconjunto visible).

## Diseño

### 1. Ordenación con prioridad

Tras transformar `reviewsData` en el array `Review[]`, se ordena con un comparador:

1. Primero las reseñas de la app (`is_google_review === false`) sobre las de Google (`is_google_review === true`).
2. Dentro de cada grupo, por `created_at` descendente (más recientes primero).

Esto se aplica explícitamente en el cliente (no se depende únicamente del `order()` de la query de Supabase), para que la prioridad quede garantizada independientemente del orden en que lleguen los datos.

### 2. Estado de paginación

Nuevo estado local `visibleCount`, inicializado en `5`. Se reinicia a `5` cada vez que se cargan reseñas nuevas (es decir, dentro del mismo efecto que hace el fetch, tras `setReviews(...)`), para cubrir el caso de que `barId` cambie (aunque el componente ya se remonta con `key` en el único punto de uso actual, se mantiene la garantía a nivel de componente).

### 3. Renderizado

El `FlatList` recibe `data={reviews.slice(0, visibleCount)}` en lugar de `data={reviews}`. El resto del `renderItem`, `keyExtractor` y estilos no cambian.

### 4. Botón "Cargar más"

- Se renderiza debajo del `FlatList`, dentro del bloque `{hasReviews && (...)}`.
- Visible solo si `visibleCount < reviews.length`.
- Texto genérico: **"Cargar más reseñas"**.
- Al pulsar: `setVisibleCount(prev => Math.min(prev + 5, reviews.length))`.
- No hay estado de carga/red asociado al botón: como todas las reseñas ya están en memoria tras el fetch inicial, "cargar más" es una operación instantánea de slicing.
- Cuando `visibleCount >= reviews.length`, el botón desaparece (no se deshabilita, se deja de renderizar).

### 5. Header y estadísticas

El header (promedio, distribución de estrellas, contador `totalReviews`) sigue calculándose sobre el array completo `reviews`, no sobre el slice visible. Esto no cambia respecto al comportamiento actual.

## Edge cases

- Bar con ≤5 reseñas en total: el botón "Cargar más" nunca se muestra.
- Bar sin reseñas: sin cambios, se mantiene el estado vacío actual.
- Mezcla de reseñas de app y Google: las de app siempre aparecen antes, sin importar la fecha relativa entre grupos.

## Fuera de alcance

- No se pagina la query de Supabase (server-side pagination) — se descarta porque el header necesita el total de reseñas para sus cálculos, y el volumen de reseñas por bar no justifica el coste de refactor.
- No se añade estado de carga/spinner al botón "Cargar más", al no haber I/O de red involucrado.
- No se toca ningún otro punto de la app que muestre reseñas (p. ej. `bar-stats/[barId].tsx` no usa `BarReviewsSection`).

## Testing

- Test unitario/componente que verifique: con >5 reseñas mezcladas app/Google, se muestran las 5 primeras según prioridad (app antes que Google, luego por fecha); el botón "Cargar más" existe; al pulsarlo una vez se muestran 10 (o el total si hay menos de 10); el botón desaparece cuando se muestran todas.
- Test con ≤5 reseñas: el botón no se renderiza.
