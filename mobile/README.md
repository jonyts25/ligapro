# Ligera — app móvil (Expo)

PoC de arquitectura 0.6: login y «Mis partidos» contra **ligapro-dev** vía `@supabase/supabase-js` + RLS (sin server actions de Next.js).

## Requisitos

- Node.js 22+
- [Expo Go](https://expo.dev/go) en dispositivo físico, o simulador Android / iOS (macOS para simulador iOS)

## Instalación

```bash
cd mobile
npm install
cp .env.example .env
```

Edita `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Usa las mismas credenciales públicas del proyecto **ligapro-dev** (equivalente a `NEXT_PUBLIC_SUPABASE_*` en la web).

## Correr la app

```bash
cd mobile
npm start
```

Luego:

- **Expo Go:** escanea el QR (mismo Wi‑Fi que la máquina de desarrollo).
- **Android emulador:** `a` en la terminal de Expo, o `npm run android`.
- **iOS simulador (macOS):** `i` en la terminal, o `npm run ios`.

## Pantallas incluidas (PoC)

1. **Login** — correo y contraseña (`signInWithPassword`). Sesión en `expo-secure-store`.
2. **Mis partidos** — partidos donde el usuario tiene fila en `match_officials` (misma consulta RLS que describiría la ruta web `mis-partidos`; hoy no existe en Next.js).

## Tipos de base de datos

Fuente de verdad: `../src/types/database.ts` (generado con Supabase CLI en el repo web).

La app los importa **sin copia manual** mediante alias TypeScript:

```json
"@ligapro/database": ["../src/types/database.ts"]
```

### Regenerar tipos (desde la raíz del repo)

Cuando cambie el esquema en Supabase:

```bash
# Ejemplo — ajusta project-id al de ligapro-dev
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

La app móvil los toma automáticamente en el siguiente `npx tsc --noEmit` (no hace falta script de copia mientras el monorepo no esté separado).

## Scripts útiles

| Comando | Descripción |
| --- | --- |
| `npm start` | Servidor de desarrollo Expo |
| `npm run typecheck` | `tsc --noEmit` |
| `npx expo-doctor` | Diagnóstico de dependencias Expo |
| `npx expo export --platform ios` | Prueba de empaquetado iOS |
| `npx expo export --platform android` | Prueba de empaquetado Android |

## Seguridad

- Solo variables `EXPO_PUBLIC_*` (URL + anon key).
- **Nunca** incluir service role, `ANTHROPIC_API_KEY` ni otros secretos de servidor.
