# Protocolo de validación (Ligera / ligapro)

Se reutiliza en **todos** los pasos de desarrollo (0.6 en adelante).

## 1. Branch por paso

- Formato: `feat/<id-del-paso>-<nombre-corto>` (ej. `feat/0.6-app-architecture`).
- **Nunca** merge a `main` sin aprobación explícita de Jonathan.

## 2. Comandos antes de declarar terminado

Correr y pegar la **salida resumida** (último bloque relevante de cada comando) en el reporte del paso (`docs/reports/<id>_REPORT.md`).

### Web (raíz del repo)

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

### Mobile (si el paso toca `mobile/`)

```bash
cd mobile
npm run typecheck          # equivale a npx tsc --noEmit
npx expo-doctor
npx expo export --platform ios
npx expo export --platform android
```

### SQL (si hay migraciones)

- Archivo nuevo en `supabase/migrations/`.
- Tests SQL en `supabase/tests/` que cubran el cambio.
- **Cursor no aplica** migraciones a Supabase; solo escribe el archivo. Claude las revisa y aplica vía MCP después.

### Si un comando falla

- Se arregla, **o**
- Se documenta por qué falla desde antes (comparando contra `main`).

**Prohibido** reportar «pasa» sin haber corrido el comando.

## 3. Migraciones

Cursor **NUNCA** aplica migraciones a Supabase. Solo escribe el archivo `.sql`. Revisión y aplicación manual posterior (Claude + MCP).

## 4. Seguridad

- Ningún secreto en el código commiteado.
- Ninguna service role key ni `ANTHROPIC_API_KEY` en `mobile/`.
- Toda función SQL nueva: `REVOKE ALL ... FROM PUBLIC, anon` y `GRANT EXECUTE` solo a `authenticated`, siguiendo el patrón del proyecto.

## 5. Sin regresiones

Si el paso toca algo existente, el reporte debe listar:

- Qué flujos existentes podrían verse afectados.
- Cómo se verificó que no hay regresión (comandos + prueba manual si aplica).

## 6. Reporte obligatorio

Ruta: `docs/reports/<id-del-paso>_REPORT.md`

Secciones requeridas:

1. **Resumen** — qué se hizo (3–5 líneas).
2. **Archivos creados / modificados / borrados**
3. **Decisiones tomadas** que no estaban en el prompt y por qué
4. **Resultados de comandos** — salida pegada
5. **Qué NO se hizo o quedó pendiente**
6. **Pruebas manuales para Jonathan** — pasos numerados, concretos, qué debería ver
7. **Riesgos o dudas** para revisión de Claude

## 7. Cierre del paso

- Commit con mensaje descriptivo.
- Push del branch.
- Al final del chat del agente: **nombre del branch**, **hash del último commit**, **ruta del reporte**.
