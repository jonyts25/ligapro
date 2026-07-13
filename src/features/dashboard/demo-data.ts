/**
 * Datos ficticios locales para la demo del shell (Frontend F0).
 * No consultar Supabase ni usar en producción.
 * Torneos/temporadas/equipos ya son métricas reales (F4–F5).
 */

export const DEMO_STATS = [
  { label: "Partidos esta semana", value: "9", hint: "Jornada 6" },
  { label: "Adeudos", value: "$4,250", hint: "MXN pendientes" },
] as const;

export type DemoMatch = {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  statusLabel: string;
};

export const DEMO_UPCOMING_MATCHES: DemoMatch[] = [
  {
    id: "demo-1",
    date: "12 jul 2026",
    time: "18:00",
    homeTeam: "Halcones FC",
    awayTeam: "Águilas del Sur",
    venue: "Unidad Deportiva Norte",
    status: "scheduled",
    statusLabel: "Programado",
  },
  {
    id: "demo-2",
    date: "13 jul 2026",
    time: "20:30",
    homeTeam: "Leones 7",
    awayTeam: "Cóndores CDMX",
    venue: "Estadio Municipal",
    status: "scheduled",
    statusLabel: "Programado",
  },
  {
    id: "demo-3",
    date: "14 jul 2026",
    time: "17:00",
    homeTeam: "Titanes JR",
    awayTeam: "Rayos del Bajío",
    venue: "Cancha La Aurora",
    status: "live",
    statusLabel: "En juego",
  },
];

export type DemoActivity = {
  id: string;
  title: string;
  detail: string;
  time: string;
  variant: "success" | "warning" | "danger" | "info" | "default";
  statusLabel: string;
};

export const DEMO_RECENT_ACTIVITY: DemoActivity[] = [
  {
    id: "act-1",
    title: "Resultado registrado",
    detail: "Halcones FC 2 – 1 Rayos del Bajío",
    time: "Hace 2 h",
    variant: "success",
    statusLabel: "Finalizado",
  },
  {
    id: "act-2",
    title: "Tarjeta amarilla",
    detail: "Jugador #8 · Leones 7 · min 67",
    time: "Hace 4 h",
    variant: "warning",
    statusLabel: "Amonestación",
  },
  {
    id: "act-3",
    title: "Pago pendiente",
    detail: "Cóndores CDMX · cuota de inscripción",
    time: "Ayer",
    variant: "danger",
    statusLabel: "Adeudo",
  },
  {
    id: "act-4",
    title: "Partido reprogramado",
    detail: "Águilas del Sur vs Titanes JR · sáb 19 jul",
    time: "Ayer",
    variant: "info",
    statusLabel: "Calendario",
  },
];
