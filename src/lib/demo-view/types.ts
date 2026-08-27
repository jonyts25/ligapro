export const DEMO_VIEW_ROLES = [
  "real",
  "owner_admin",
  "captain",
  "referee",
  "scorekeeper",
] as const;

export type DemoViewRole = (typeof DEMO_VIEW_ROLES)[number];

export type SimulatedDemoViewRole = Exclude<DemoViewRole, "real">;

export const DEMO_VIEW_ROLE_LABELS: Record<DemoViewRole, string> = {
  real: "Vista real",
  owner_admin: "Dueño / admin de organización",
  captain: "Capitán",
  referee: "Árbitro / oficial",
  scorekeeper: "Anotador",
};

export const DEMO_VIEW_NO_DATA_MESSAGE =
  "No hay un equipo/partido real asociado a tu cuenta para simular esta vista en esta organización — cambia a una organización de demo donde sí tengas ese rol, o usa datos de ejemplo ya cargados.";
