export type PlayerCredentialData = {
  seasonTeamPlayerId: string;
  playerId: string;
  organizationId: string;
  seasonId: string;
  fullName: string;
  jerseyNumber: number | null;
  teamName: string;
  photoPath: string | null;
  photoUrl: string | null;
  verificationStatus: string;
  requirePlayerVerification: boolean;
  canUploadPhoto: boolean;
};

export type RosterCredentialRow = {
  seasonTeamPlayerId: string;
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
  photoUrl: string | null;
  verificationStatus: string;
  requirePlayerVerification: boolean;
  registrationStatus: string;
  credentialHref: string;
};
