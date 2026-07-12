# Product Scope — LigaPro

## Qué es

LigaPro es una plataforma B2B para administrar ligas y canchas amateur.

## Mercado inicial

Bajío y Jalisco.

## Canal

PWA / web responsive primero. No hay app nativa en el alcance actual.

## Modelo de tenancy

Multi-tenant por organización. Cada organización aísla sus datos operativos (venues, competencias, equipos, partidos, finanzas, etc.).

## Ciclo MVP

```text
organización
→ venues/campos
→ competencia/temporada
→ equipos/planteles
→ fixture
→ horarios
→ publicación
→ captura de resultados/eventos
→ tabla/goleo/disciplina
→ consulta pública
→ registro manual de cargos y pagos por equipo/temporada
→ audit log interno (triggers de base de datos)
```

Registrar pagos manuales (efectivo, transferencia, etc.) **sí** pertenece al MVP. Procesar pagos dentro de la aplicación (Mercado Pago, Stripe, etc.) **no** pertenece al MVP.

El **audit log interno** (trazabilidad automática vía triggers) **sí** pertenece al MVP. Analytics avanzados y vistas públicas de auditoría **no**.

## Fuera del MVP

- sponsors
- procesamiento de pagos dentro de la aplicación (pasarelas, webhooks)
- facturación CFDI
- perfil nacional de jugador
- brackets automáticos complejos
- IA
- storytelling
- app nativa
- chat
- videos
- marketplace
- SMS
