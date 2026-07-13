# Organization branding — LigaPro

## Organization vs venue

| Concepto | Tabla | Significado |
| --- | --- | --- |
| **Organization** | `organizations` | Cliente que opera LigaPro: complejo deportivo, cancha (como negocio), organizador, administradora de torneos o liga amateur. |
| **Venue / field** | `venues`, `fields` | Sedes y campos físicos. No se crean en F2. |

No confundir: branding vive en la organización; las canchas son un paso posterior.

## Creación atómica (onboarding)

RPC `create_organization_with_owner(p_name, p_brand_color DEFAULT NULL)`:

1. Requiere `auth.uid()` con profile.
2. Exige **cero** membresías vigentes.
3. Inserta `organizations` + `organization_members` (`organization_owner`) en la misma transacción.
4. Genera `slug` seguro (no depende de unicidad del nombre).
5. Retorna `organization_id` (uuid).
6. Sin parámetro `profile_id` / actor externo.
7. Auditoría vía triggers 010 normales.

No puede quedar una organization huérfana: si falla la membresía, se revierte todo.

Frontend: Server Action `createOrganizationAction` → RPC → redirect a `/organizaciones/{id}/configuracion?setup=1`.

## Ownership inicial

El creador es siempre `organization_owner`. Crear una segunda organización desde onboarding no está permitido en F2 (la UI redirige; la RPC rechaza usuarios con membresías).

## Branding permitido

Solo:

- `name` (3–100 caracteres tras trim)
- `brand_color` (`#RRGGBB` mayúsculas o NULL → acento LigaPro)
- `logo_path` (path Storage, nunca URL completa)

Layout, tipografía, fondos y colores semánticos (danger/warning/success/tarjetas) siguen siendo de LigaPro.

## Bucket `organization-logos`

| Propiedad | Valor |
| --- | --- |
| Público | `true` (lectura por URL pública) |
| Tamaño máx. | 2 MB |
| MIME | `image/png`, `image/jpeg`, `image/webp` |

- Contiene **solo** branding público.
- No usar para documentos privados.
- Listado/escritura siguen controlados por policies (anon no lista metadata).

## Path convention

```text
{organizationId}/{assetUuid}.{png|jpg|jpeg|webp}
```

Ejemplo: `8c0…-org-id/4d1…-asset-id.webp`

Prohibido: `..`, rutas absolutas, otras orgs, SVG/GIF, nombres sin UUID.

## RLS Storage (`storage.objects`)

| Operación | Quién |
| --- | --- |
| INSERT | owner/admin de la org de la primera carpeta |
| SELECT metadata/listado | owner/admin de esa org |
| DELETE | owner/admin de esa org |
| UPDATE | **sin policy** (no upsert) |

Cada carga usa un nombre versionado nuevo.

## Tipos y tamaño

Cliente y bucket: PNG/JPEG/WebP ≤ 2 MB. Sin SVG, GIF ni documentos. Sin base64/binarios en Postgres.

## Reemplazo y eliminación

1. Upload autenticado (sin service role, sin upsert).
2. RPC `set_organization_logo(org, path)`.
3. Si falla DB → eliminar objeto recién subido.
4. Si OK → borrar logo anterior best effort.
5. Quitar: `set_organization_logo(..., NULL)` + borrar objeto previo best effort.

La DB es la fuente de verdad del logo activo.

## Fallbacks

- Sin color → `--brand` LigaPro.
- Sin logo → iniciales vía `OrganizationBrand`.
- Mapper: `mapOrganizationBranding` + `sanitizeAccentForCss`.

## Autorización

| Rol | Ver branding | Editar branding / logo / config |
| --- | --- | --- |
| owner | sí | sí |
| admin | sí | sí |
| member | sí | no (`notFound()` en `/configuracion`) |
| externo | no | no |

## Riesgo: objetos huérfanos

Si falla la limpieza del logo anterior tras un reemplazo exitoso, puede quedar un objeto en Storage. Riesgo menor: el archivo es branding público; no se revierte el logo nuevo. Limpieza operativa futura opcional.

## PWA

Auth, onboarding y branding requieren internet. Sin service worker ni cache de datos privados.

## Dashboard

Métricas del inicio de organización siguen siendo **demostración** (badge “Datos de demostración”).
