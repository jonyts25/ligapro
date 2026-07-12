# ADR 0003 — Players por organización

## Status

Accepted

## Context

En ligas amateur, un “jugador” es primero un registro operativo de la organización (inscripción, número, documentos locales). Un perfil de identidad nacional/global no es parte del MVP y no debe bloquear la operación diaria.

## Decision

`players` viven dentro de una organización (`organization_id`).

Opcionalmente pueden vincularse a un `profiles` (usuario/identidad), pero ese vínculo no es requerido para capturar planteles, alineaciones, goles o disciplina.

## Consequences

- El mismo individuo físico puede existir como player en varias organizaciones sin perfil unificado (aceptado fuera de MVP).
- La operación de liga no depende de onboarding de auth del jugador.
- Un futuro perfil nacional requeriría un ADR y migración explícitos.
