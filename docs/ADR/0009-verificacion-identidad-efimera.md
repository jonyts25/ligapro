# ADR 0009 — Verificación de identidad efímera (Opción C)

**Estado:** aceptado  
**Fecha:** 2026-07-26  
**Migration:** 023

## Contexto

Algunas ligas requieren verificar identidad de jugadores antes de activarlos en plantel, pero almacenar documentos oficiales (INE, pasaporte) obliga a protección de datos personales sensibles, retención, acceso auditado y responsabilidad legal.

## Decisión — Opción C: verificación sin documento

- Estado de verificación en `players.verification_status` (`not_required` | `pending` | `approved` | `rejected`).
- Historial de revisiones en `player_verification_reviews` (solo decisión + motivo si rechazo).
- **No** bucket de storage, **no** columnas de archivo/ruta/URL de documento.
- Capitán/subcapitán puede **solicitar** verificación (`request_player_verification`); owner/admin **aprueba/rechaza** (`review_player_verification`).
- Con `season_rules.require_player_verification = true`, jugadores `pending`/`rejected` no se activan en roster (admin bypass).

## Candado de transferencia

- `season_rules.transfer_lock_days` (0 = desactivado).
- Tras baja (`inactive`), el jugador no puede activarse en otro `season_team` de la misma season hasta que expire el plazo (capitán/subcapitán sujetos; admin bypass).
- Fecha de liberación: `season_team_players.updated_at` al pasar a `inactive`.
- Excepción puntual: RPC `release_player_transfer_lock` (owner/admin, motivo obligatorio) → tabla `player_transfer_lock_releases`.

## Fuera de alcance

Almacenamiento de documentos, PDF/CSV, credenciales imprimibles, registro QR público, aprobación admin sobre altas del capitán, expiración automática de verificación aprobada.
