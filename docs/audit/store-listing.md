# Ficha de tienda · borrador (área 11)

Borrador en español para App Store Connect y Google Play Console. Todo lo que se describe existe en el código a fecha 2026-10-15; no se prometen funciones que no estén. Los límites de caracteres están comprobados. 👤 Revisar el tono, elegir entre las alternativas y pegarlo en los paneles.

## Nombre y subtítulo

| Campo | Límite | Propuesta | Caracteres |
|---|---|---|---|
| Nombre (App Store) | 30 | `MatchMap: bares con fútbol` | 26 |
| Subtítulo (App Store) | 30 | `Encuentra dónde ver el partido` | 30 |
| Título (Google Play) | 30 | `MatchMap: dónde ver el partido` | 30 |
| Descripción corta (Google Play) | 80 | `Encuentra bares que emiten el partido cerca de ti, con mapa, horarios y reseñas.` | 80 |

Alternativa de nombre más corta: `MatchMap` (si se prefiere la marca sola; el subtítulo hace el trabajo de ASO).

## Palabras clave (App Store, 100 caracteres)
Apple ya indexa el nombre y el subtítulo, así que no se repiten «bares», «fútbol», «ver», «partido» ni «dónde».

```
deporte,tv,pantalla,cerca,mapa,liga,copa,terraza,directo,retransmision,pub,jornada,derbi,gol
```
92 caracteres. No se incluyen nombres de equipos ni de competiciones: son marcas registradas y Apple puede rechazar la ficha por ello (guideline 2.3.7).

## Texto promocional (App Store, 170 caracteres, editable sin enviar a revisión)
```
¿Hay partido? Abre el mapa y mira qué bares lo emiten cerca de ti. Activa los avisos de tu equipo y llega a tiempo al pitido inicial.
```

## Descripción larga (App Store y Google Play)

```
MatchMap te dice qué bares de tu zona emiten el partido que quieres ver.

Abre el mapa, elige el partido y descubre al momento los bares cercanos que lo ponen, con su dirección, su horario, sus fotos y las opiniones de otros aficionados.

ENCUENTRA TU BAR
• Mapa con los bares que tienes cerca y lo que emiten.
• Búsqueda y filtros por partido, competición, tipo de comida, pantallas y otros servicios.
• Ficha completa de cada bar: fotos, carta, horario, contacto y cómo llegar.

NO TE PIERDAS NINGÚN PARTIDO
• Calendario de partidos de las principales competiciones.
• Elige tu equipo favorito y te avisamos antes de que juegue.

TU EXPERIENCIA, TU OPINIÓN
• Guarda tus bares favoritos.
• Escribe reseñas y valora el ambiente, las pantallas y el servicio.

¿TIENES UN BAR?
• Da de alta tu bar gratis o reclama el que ya aparece en el mapa.
• Gestiona tus fotos, tu carta y los partidos que vas a emitir.
• Publica novedades y consulta cuántas personas ven tu ficha.
• Destaca tu bar en el mapa los días de partido con Boost (compra opcional dentro de la app).

Puedes explorar sin crear una cuenta. La ubicación solo se usa mientras usas la app, para enseñarte los bares que tienes cerca.

MatchMap es gratuita para los aficionados y se financia con anuncios. Tú decides si los anuncios pueden ser personalizados.
```

⚠️ Comprobaciones antes de publicar:
- «principales competiciones»: confirmar qué competiciones carga `sync-football` en prod y, si se quiere, nombrarlas en genérico (sin logotipos).
- «cuántas personas ven tu ficha»: las estadísticas de bar (`fn_get_bar_stats_*`) deben estar visibles para todos los propietarios en el build de lanzamiento.
- «cómo llegar»: si el botón de ruta (HALLAZGOS #16) no se termina, cambiarlo por «dirección y mapa».
- Los bares de apuestas deportivas no se mencionan en la ficha a propósito (ver 11-H8).

## URLs y contacto
| Campo | Valor | Estado |
|---|---|---|
| URL de política de privacidad | `[URL pública de la política]` | 👤 Publicar el borrador (`docs/audit/politica-privacidad-borrador.md`) |
| URL de soporte (obligatoria en App Store) | `[URL de soporte]` | 👤 Puede ser una página con la FAQ y el email |
| URL de marketing (opcional) | `[web de MatchMap]` | 👤 |
| URL para borrar la cuenta (Google Play) | `[URL de borrado]` | 👤 11-H6 |
| Email de contacto | `[email único]` | 👤 11-H7: hoy hay dos (`support@matchmap.com` y `privacy@matchmap.app`) |

## Categoría y clasificación
- **Categoría principal:** Viajes, Comida y bebida o Deportes. Recomendación: **Comida y bebida** (el usuario busca un local); secundaria **Deportes**. ⚠️ Decisión de ASO tuya.
- **Edad:** ver 11-H8 en `areas/11-cumplimiento-legal.md`.
- **Contiene anuncios:** Sí (AdMob). **Compras dentro de la app:** Sí (Boost, consumibles).

## Recursos gráficos (👤)
- App Store: capturas de iPhone de 6,9" (1320 × 2868) y de 6,5" (1284 × 2778 o 1242 × 2688). `supportsTablet: false`, así que no hacen falta capturas de iPad.
- Google Play: icono de 512 × 512, gráfico destacado de 1024 × 500 y al menos 2 capturas de teléfono.
- Pantallas recomendadas: mapa con bares, ficha de bar, lista de partidos, filtros, reseñas y panel del propietario.

## Notas para el revisor (App Store Connect › Información de revisión · Play Console › Acceso a la app)

```
Gracias por revisar MatchMap.

QUÉ ES
MatchMap muestra en un mapa los bares que emiten partidos de fútbol cerca del usuario.

CUENTA DE PRUEBA
Usuario: [email de la cuenta demo]
Contraseña: [contraseña]
Esta cuenta es propietaria del bar de prueba "[nombre del bar]", desde el que se puede ver la compra de Boost.

CÓMO PROBARLA
1. Sin cuenta: en la pantalla de bienvenida pulse "Explorar sin cuenta →". Puede usar el mapa, la búsqueda y las fichas de los bares. Escribir reseñas, guardar favoritos o dar de alta un bar piden iniciar sesión.
2. Con la cuenta de prueba: inicie sesión con email y contraseña. También funcionan Iniciar sesión con Apple y con Google.
3. Boost (compra integrada, consumible): Perfil → su bar → ficha del bar → "Boost". La compra se hace con In-App Purchase a través de RevenueCat. No hay pagos fuera de la tienda.
4. Borrar la cuenta: Perfil → Editar perfil → "Eliminar cuenta". Se borran la cuenta, el perfil, las reseñas, los bares y las fotos del usuario.
5. Reportar contenido: en la ficha de un bar, "Reportar información". [Añadir cómo reportar una reseña y bloquear a un usuario cuando las áreas 03/11-H5 lo implementen.]

PERMISOS
- Ubicación (solo mientras se usa la app): para mostrar los bares cercanos en el mapa. La app funciona sin ella usando la búsqueda.
- Cámara y fotos: solo cuando el usuario sube una imagen (perfil, bar, carta o publicaciones).
- Notificaciones: aviso antes de que juegue el equipo favorito del usuario.
- Seguimiento (ATT): la app muestra anuncios de Google AdMob. En el EEE primero aparece el formulario de consentimiento de Google (UMP) y después la solicitud de App Tracking Transparency. Si se deniega, los anuncios no usan el IDFA. El consentimiento se puede cambiar en Perfil → "Privacidad de anuncios".

CONTENIDO DE APUESTAS
Algunos locales son salones de apuestas deportivas. Están ocultos por defecto y solo se muestran a quien declara ser mayor de edad desde Perfil. La app no permite apostar.
```

👤 Antes de enviar: crear la cuenta demo (D6), asegurarse de que su bar está aprobado y de que hay partidos futuros en el mapa en la zona del revisor (o indicar una ciudad, p. ej. «busque Barcelona»).
