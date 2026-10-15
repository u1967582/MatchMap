# 02 · Autenticación y cuenta

**Prioridad:** 🔴 · **Ejecución:** ☁️ código y tests · 💻 configuración de Supabase Auth · 👤 pruebas en dispositivo · **Rama:** `audit/02-auth-cuenta`

## Objetivo
Que registrarse, entrar, recuperar la contraseña, usar el modo invitado y borrar la cuenta funcionen en iOS y Android, y que cumplan los requisitos de las tiendas.

## Alcance
`utils/auth.ts`, `app/index.tsx` (invitado → `signInAnonymously`), `app/(auth)/components/LoginModal.tsx`, `app/auth/callback.tsx`, `app/auth/reset-password.tsx`, edge function `delete-user-account`, `screens/ProfileScreen.tsx`, `screens/EditProfileScreen.tsx`.

## Checklist
- [ ] **Email + contraseña:** registro, verificación de email (si está activa), login, errores comprensibles en español (credenciales mal, email ya usado, sin conexión).
- [ ] **Google** (`signInWithIdToken` / `signInWithOAuth`): funciona en iOS y Android con los client IDs de producción (no solo dev). Comprobar el SHA-1 de la firma de Play en Google Cloud para Android.
- [ ] **Apple:** obligatorio en iOS porque hay login con Google (guideline 4.8). Comprobar nombre/email en el primer login y el caso de «ocultar mi email».
- [ ] **Invitado → usuario registrado:** al registrarse desde invitado no se pierden favoritos ni datos; las acciones de escritura piden registro (enlaza con 01 #4).
- [ ] **Recuperar contraseña (HALLAZGOS #8):** `matchmap://auth/reset-password` y `matchmap://auth/callback` en *Redirect URLs* de Supabase; el email abre la app en iOS y Android con el build de producción. Plantillas de email en español.
- [ ] **Contraseñas filtradas (HALLAZGOS #9):** activar en Auth › Providers › Email. Revisar longitud mínima.
- [ ] **Sesión:** persiste al cerrar la app; refresh de token tras horas en segundo plano; logout limpia stores (favoritos, likes, RevenueCat `logOut`).
- [ ] **Borrado de cuenta (Apple 5.1.1(v) y Google Play):** accesible desde Perfil en ≤ 2 toques, confirma, borra datos (`delete_user_data`) y el usuario de Auth, cierra sesión. Qué pasa con los bares de un propietario y con compras activas. Google exige además un **enlace web** para pedir el borrado sin la app.
- [ ] **Rate limiting y emails:** SMTP propio configurado (el SMTP por defecto de Supabase tiene un límite muy bajo de emails por hora y no sirve para producción).
- [ ] **Logs:** ningún `console.error/warn` de auth imprime emails o tokens (HALLAZGOS #17, `utils/auth.ts`).

## Criterios de aceptación
- Los 4 métodos de entrada y el invitado funcionan en un iPhone y un Android físicos con el build de producción.
- El email de recuperación abre la app y permite cambiar la contraseña.
- Borrar la cuenta deja `auth.users` y las tablas del usuario sin rastro (comprobado con SQL).
- Hay URL pública para solicitar el borrado (requisito de Play).

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=02, nombre=auth-cuenta]
Específico del área: audita el código de los flujos de la checklist y sus casos de error; añade tests
de utils/auth.ts que falten (registro, login, reset, invitado→registro, logout limpia stores, borrado).
Elimina de los logs cualquier email o token. Lo que necesite panel de Supabase (redirect URLs,
contraseñas filtradas, SMTP) déjalo en la sección Hallazgos como tarea 💻/👤 con los pasos exactos.
```
