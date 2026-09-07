export type TournamentWizardActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | number | boolean | null>;
};

export const initialTournamentWizardActionState: TournamentWizardActionState = {
  ok: false,
  message: null,
};

export type WizardSeasonTeam = {
  seasonTeamId: string;
  teamId: string;
  name: string;
  playerCount: number;
};

export type WizardField = {
  id: string;
  venueId: string;
  name: string;
};

export type WizardContext = {
  organizationId: string;
  competitionId: string;
  seasonId: string;
  competitionName: string;
  seasonName: string;
  fields: WizardField[];
  teams: WizardSeasonTeam[];
  fixtureGenerated: boolean;
  canGenerateFixture: boolean;
};

export type WizardPlayerEntry = {
  seasonTeamId: string;
  bulkList: string;
};

export const WIZARD_STEPS = [
  { key: "inicio", label: "Tu torneo" },
  { key: "equipos", label: "Equipos" },
  { key: "jugadores", label: "Jugadores" },
  { key: "horarios", label: "Horarios" },
  { key: "generar", label: "Fixture" },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];
