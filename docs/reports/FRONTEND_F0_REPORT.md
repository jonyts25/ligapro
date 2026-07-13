# Frontend F0 — Reporte de entrega

**Fecha:** 2026-07-13  
**Commit base:** `fb0f870` — `feat: migration 010 immutable audit log and hardening`  
**Estado:** listo para revisión · **sin commit**

---

## 1. Auditoría previa

| Verificación | Resultado |
| --- | --- |
| Working tree limpio al inicio | Sí (HEAD `fb0f870`) |
| Migration 010/010b commiteada | Sí (`fb0f870`) |
| Workspace multi-root | `sports-core.code-workspace` incluye `ligapro` + `../mundial-compas` |
| Mundial Compas legible | Sí (`D:\Proyectos\mundial-compas`) |
| Tailwind 4 | `@import "tailwindcss"` + `@theme inline` |

---

## 2. Mundial Compas — comparación visual

**Acceso:** archivo `D:\Proyectos\sports-core-workspace\sports-core.code-workspace` ya contenía la entrada correcta; no fue necesario modificarlo. Mundial Compas accesible vía ruta relativa `../mundial-compas`.

**Archivos revisados (solo lectura):** `globals.css`, `(app)/layout.tsx`, `(app)/page.tsx`, `AppBottomNav.tsx`, cards/badges en componentes home y quiniela.

| Aspecto | Mundial Compas | LigaPro F0 |
| --- | --- | --- |
| Fondos | `zinc-950`, contenedor estrecho móvil | Azul marino operativo, shell admin ancho |
| Cards | `rounded-2xl`, bordes zinc-800, fondos zinc-900 | Tokens `--surface`, bordes `--border` |
| Navegación | Pill flotante inferior, emojis | Sidebar desktop + barra inferior + drawer “Más” |
| Badges | Emerald/amber pronóstico/estado | Semánticos fijos (danger/warning/success) |
| Jerarquía | CTAs quiniela, banners recreativos | PageHeader operativo, demo admin |
| Responsive | Mobile-first max-w-lg | 375–1440px, sidebar desde lg |

**Similitudes conceptuales:** oscuro deportivo, cards, badges, stats, nav persistente móvil.

**Diferencias intencionales:** sin quinielas, Pitoniso, FIFA, emoji nav, estética apuestas; layout admin; tokens semánticos LigaPro.

**Mundial Compas no fue modificado.**

---

## 3. Navegación móvil corregida

- TopBar: botón menú **activo** con `aria-expanded`, `aria-controls`.
- `MobileMoreDrawer`: Disciplina, Finanzas, Configuración.
- Escape cierra drawer; focus al botón cerrar al abrir; backdrop clickeable.
- Drawer posicionado **sobre** la barra inferior (no la tapa permanentemente).
- Validación Playwright: `opened: true`, `closedWithEscape: true`, `aria-expanded: false` tras cerrar.

**Archivos nuevos/actualizados:**

- `src/components/layout/MobileMoreDrawer.tsx`
- `src/components/layout/NavItemLink.tsx`
- `src/components/layout/nav-items.ts` (`available` flag)
- `TopBar.tsx`, `Sidebar.tsx`, `MobileNavigation.tsx`

---

## 4. Enlaces 404 eliminados

- Solo `/` (`Inicio`) tiene `available: true`.
- Resto: `aria-disabled`, badge **Próximamente**, sin `<Link>`.
- Sidebar, barra móvil y drawer usan el mismo contrato.
- No se crearon páginas vacías.

---

## 5. PWA — validación

**Base PWA preparada:** sí  
**Manifest e iconos:** verificados  
**Instalación en navegador:** manifest e iconos cumplen requisitos en localhost; Chrome puede no mostrar prompt de instalación **sin service worker** (esperado en F0; no afirmar offline)  
**Operación offline:** no  
**Captura offline/sincronización:** futuro

| Campo / recurso | Resultado |
| --- | --- |
| `name` / `short_name` | LigaPro |
| `start_url` | `/` |
| `display` | `standalone` |
| `theme_color` | `#14b8a6` |
| `background_color` | `#070b14` |
| Icono 192 | `/icons/icon-192` → 200 PNG |
| Icono 512 | `/icons/icon-512` → 200 PNG |
| Maskable | `/icons/icon-512?maskable=1` → 200 PNG, `purpose: maskable` |
| Ruta manifest | `/manifest.webmanifest` |

Service worker: **no implementado** (decisión F0).

---

## 6. Verificación visual real

**Herramienta:** Playwright (Chromium headless) contra `npm run dev` @ localhost:3000  
**Resultados:** `docs/reports/assets/frontend-f0/validation-results.json`

| Viewport | Scroll horizontal | Captura |
| --- | --- | --- |
| 375×812 | No | `375x812.png` |
| 768×1024 | No | `768x1024.png` |
| 1024×768 | No | `1024x768.png` |
| 1440×900 | No | `1440x900.png` |
| 375×812 drawer abierto | — | `375x812-drawer-open.png` |

**Consola:** 0 errores  
**Hydration:** 0 indicios de mismatch  
**Checks:** sidebar en desktop, nav inferior en móvil, cards/tabla/branding visibles en capturas

---

## 7. Archivos creados (acumulado F0)

```
docs/DESIGN_SYSTEM.md
docs/reports/assets/frontend-f0/*.png
docs/reports/assets/frontend-f0/validation-results.json
scripts/frontend-f0-visual-check.cjs
src/types/branding.ts
src/lib/utils/cn.ts
src/lib/branding/*
src/features/dashboard/demo-data.ts
src/components/branding/OrganizationBrand.tsx
src/components/layout/*
src/components/ui/*
src/app/manifest.ts
src/app/icon.tsx
src/app/apple-icon.tsx
src/app/icons/icon-192/route.tsx
src/app/icons/icon-512/route.tsx
```

---

## 8. Archivos modificados

```
package.json (+ lucide-react)
package-lock.json
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
```

---

## 9. Dependencias

| Paquete | Versión | Notas |
| --- | --- | --- |
| `lucide-react` | ^1.24.0 | Iconos navegación |

Playwright usado **solo localmente** para validación visual (`--no-save`); no quedó en `package.json`.

---

## 10. Lint / build / git

```
npm run lint  → PASS
npm run build → PASS
```

```
git status    → cambios sin commit
git diff --stat → ver sección abajo
```

---

## 11. Riesgos o pendientes

| Item | Estado |
| --- | --- |
| Service worker | Pendiente F1+ |
| Instalación PWA en Chrome desktop | Puede requerir SW para prompt; manifest listo |
| Módulos F1 | Activar `available: true` al crear rutas |
| Upload logo / DB branding | Fuera de alcance F0 |

---

## 14. Confirmación

- **Mundial Compas:** no modificado  
- **Supabase / migraciones / auth:** no tocados  
- **Commit:** no realizado  
- **F1:** no iniciado

---

## Demo `/`

Shell demo con Liga Deportiva del Bajío, StatCards, partidos ficticios, actividad reciente, EmptyState. Datos en `src/features/dashboard/demo-data.ts`.
