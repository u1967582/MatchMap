# 09 · Rendimiento

**Prioridad:** 🟡 (solo se arregla antes del lanzamiento lo que sea grave) · **Ejecución:** ☁️ análisis + 💻 medición en dispositivo · **Rama:** `audit/09-rendimiento`

## Objetivo
Que la app abra rápido y el mapa y las listas vayan fluidos en un móvil Android de gama media.

## Checklist
- [ ] **Arranque en frío** con build de producción: medir en iPhone y Android de gama media (objetivo < 3 s hasta el mapa usable).
- [ ] **Mapa:** número de marcadores cargados a la vez, clustering, que no se recarguen todos al mover el mapa; sin cientos de re-renders (React DevTools / logs de render).
- [ ] **Listas:** `FlashList` en listas largas (partidos, reseñas, búsqueda) con `estimatedItemSize`; sin `ScrollView` anidados con listas virtualizadas.
- [ ] **Imágenes:** `expo-image` con caché y tamaños redimensionados (ver ajustes de subida); sin descargar originales grandes en miniaturas.
- [ ] **Consultas:** sin N+1 a Supabase en mapa/ficha; selects con solo las columnas necesarias; paginación.
- [ ] **Tamaño del bundle y de la app:** anotar tamaño de descarga de iOS y Android; Hermes activo.

## Criterios de aceptación
- Ningún flujo principal con bloqueos visibles (> 1 s congelado) en el Android de prueba.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |
