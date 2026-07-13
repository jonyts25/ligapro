export type OrganizationBranding = {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  brand_color: string | null;
  logo_path: string | null;
};
