export type PlatformSalesRow = {
  organizationId: string;
  organizationName: string;
  soldByStaffId: string | null;
  soldByDisplayName: string | null;
  activeSeasonCount: number;
  memberCount: number;
  organizationCreatedAt: string;
};
