# LigaPro — Sistema de diseño (Frontend F0)

Documento base del sistema visual de LigaPro. Este bloque define tokens, componentes y patrones reutilizables; no incluye autenticación, CRUD ni datos reales.

## Personalidad visual

LigaPro debe sentirse:

- **Deportiva** — contexto de cancha, jornadas y operación en vivo.
- **Profesional y confiable** — para administradores de ligas amateur en México.
- **Operativa y rápida** — información densa pero legible.
- **Moderna** — interfaz oscura, limpia, sin ornamentos innecesarios.

Evitar:

- Estética infantil o de videojuego excesivo.
- Estilo apuestas o quinielas recreativas.
- Branding FIFA, mascotas recreativas o lógica visual del Mundial.

## Paleta semántica

Tema principal: **oscuro**. Los tokens viven en `src/app/globals.css`.

| Token | Uso |
| --- | --- |
| `--background` | Fondo general (#070b14) |
| `--surface` | Tarjetas y paneles (#0f1729) |
| `--surface-elevated` | Encabezados de tabla, hover (#162033) |
| `--border` | Separadores (#243044) |
| `--text-primary` | Texto principal (#f5f5f4) |
| `--text-secondary` | Texto secundario (#a8b3c4) |
| `--muted` | Metadatos (#6b7789) |
| `--brand` | Acento LigaPro (#14b8a6) |
| `--brand-foreground` | Texto sobre brand (#042f2e) |
| `--organization-accent` | Acento de organización (fallback: `--brand`) |
| `--success` | Confirmaciones (#22c55e) |
| `--warning` | Advertencias (#eab308) |
| `--danger` | Errores, adeudos, en vivo (#ef4444) |
| `--info` | Información (#3b82f6) |
| `--card-yellow` / `--card-red` | Colores deportivos reales (tarjetas) |

Los colores semánticos **no** se reemplazan por el branding de organización.

## Branding de organización

Contrato TypeScript (`src/types/branding.ts`):

```ts
export type OrganizationBranding = {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
};
```

- Mapper server-side: `mapOrganizationBranding` (`logo_path` → URL pública del bucket; `brand_color` sanitizado).
- Persistencia: columnas `organizations.brand_color` / `organizations.logo_path` (Migration 011).
- Default LigaPro: `src/lib/branding/defaults.ts` cuando falta color o logo.
- Componente: `OrganizationBrand` — variantes `full` y `compact`, fallback con iniciales.
- `AppShell` aplica `--organization-accent` solo tras sanitizar `#RRGGBB`.
- El acento de organización **no** sustituye danger, warning, success ni tarjetas amarilla/roja.
- Edición: owner/admin en `/organizaciones/{id}/configuracion`. Detalle en `docs/ORGANIZATION_BRANDING.md`.

## Componentes base

| Componente | Ubicación | Propósito |
| --- | --- | --- |
| `AppShell` | `layout/` | Cascarón responsive |
| `Sidebar` | `layout/` | Navegación desktop |
| `MobileNavigation` | `layout/` | Barra inferior móvil |
| `TopBar` | `layout/` | Encabezado móvil |
| `OrganizationBrand` | `branding/` | Logo / iniciales + nombre |
| `PageHeader` | `ui/` | Título de página |
| `SectionHeader` | `ui/` | Título de sección |
| `Card` | `ui/` | Contenedor base |
| `StatCard` | `ui/` | Métrica destacada |
| `StatusBadge` | `ui/` | Estado con color semántico |
| `EmptyState` | `ui/` | Vacío accionable |
| `ResponsiveTableContainer` | `ui/` | Scroll horizontal seguro |

Convenciones:

- Aceptar `className` cuando aplique.
- HTML semántico (`nav`, `main`, `header`, `table`, `button`).
- Sin consultas a Supabase ni lógica de negocio.
- Sin UI kit externo (solo React + Tailwind + componentes propios).

## Navegación

Áreas: Inicio, **Sedes**, **Torneos**, **Equipos**, Partidos, Calendario, Disciplina, Finanzas, Configuración.

- Disponibles (F5): Inicio, Sedes, Torneos, Equipos; Configuración solo owner/admin.
- Resto marcado “Próximamente” sin navegación activa.
- Desktop: sidebar completo (`lg+`).
- Mobile: barra inferior con 5 ítems principales; resto en menú “Más”.
- Ruta activa con `aria-current="page"`.
- Iconos: `lucide-react` (dependencia pequeña y estándar).
- Enlaces conservan `organizationId` en la ruta.

## Responsive

Breakpoints objetivo: 375px, 768px, 1024px, 1440px.

- Sin scroll horizontal global.
- Tablas dentro de `ResponsiveTableContainer`.
- Áreas táctiles mínimas ~44px en navegación y botones.
- Padding inferior en móvil para no tapar contenido con la barra inferior.
- Grid de `StatCard`: 1 → 2 → 4 columnas.

## Accesibilidad

- Skip link al contenido principal.
- Navegación con `aria-label` y `aria-current`.
- `:focus-visible` global con anillo visible.
- Botones reales (`button`, `Link`), no `div` clicables.
- `alt` en logos cuando existen.
- `prefers-reduced-motion` reduce animaciones.
- Estados no dependen solo del color (badges incluyen texto).

## Navegación provisional (F0)

- Solo **Inicio (`/`)** es ruta activa.
- Demás módulos: etiqueta **Próximamente**, `aria-disabled`, sin enlaces (evita 404).
- Móvil: barra inferior (5 ítems) + drawer **Más módulos** (Disciplina, Finanzas, Configuración) desde TopBar.

## PWA

- Manifest: `src/app/manifest.ts` → `/manifest.webmanifest`
- Iconos LigaPro: `icon.tsx`, `apple-icon.tsx`, rutas `/icons/icon-192` y `/icons/icon-512`

**Base PWA preparada:** sí  
**Manifest e iconos:** verificados  
**Instalación en navegador:** manifest cumple criterios; Chrome puede no mostrar prompt sin service worker (esperado en F0)  
**Operación offline:** no  
**Captura offline/sincronización:** futuro

Service worker: no implementado en F0. Recomendación F1+: `@serwist/next` o SW manual; network-first para HTML/API; nunca cachear Supabase.

## Referencia: Mundial Compas

**Workspace:** `sports-core.code-workspace` incluye `ligapro` y `../mundial-compas`. **No se modificó** ese repositorio.

| Aspecto | Mundial Compas | LigaPro F0 |
| --- | --- | --- |
| Fondos | `bg-zinc-950`, layout móvil `max-w-lg` | Azul marino `#070b14`, layout admin ancho |
| Cards | `rounded-2xl border-zinc-800 bg-zinc-900/*` | `Card` con tokens `--surface` |
| Navegación | Barra inferior pill flotante, emojis | Sidebar desktop + barra fija + drawer |
| Badges | Pills emerald/amber (pronósticos) | `StatusBadge` semántico fijo |
| Jerarquía | CTAs quiniela, banners recreativos | Headers operativos, demo admin |
| Responsive | Mobile-first estrecho | 375–1440px, sidebar desde lg |

**Similitudes conceptuales:** tema oscuro, tarjetas, badges, stats, nav persistente móvil.

**Evitado:** quinielas, Pitoniso, FIFA, emoji nav, estética apuestas, importación de código.

## F6 — Fixture y calendario

Componentes en `src/components/fixtures/` reutilizan `Card`, `PageHeader`, `StatusBadge`, `SectionHeader`, `EmptyState` y patrones de formularios F4/F5. Badges de programación: Pendiente / Programado. Sin calendario drag-and-drop ni UI kit externo.

## F7 — Captura

Componentes en `src/components/matches/`: captura mobile-first, timeline, disciplina solo lectura. Sin edición/borrado de eventos en UI.
