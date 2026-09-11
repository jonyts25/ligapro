import {
  isFieldEffectivelyAvailable,
  type AvailabilityInterval,
  type FieldDetail,
  type FieldRecord,
} from "@/lib/venues/types";

export type DirectFieldInsertInput = {
  organizationId: string;
  name: string;
  address: string | null;
  surfaceType: string | null;
  isActive: boolean;
};

export function buildDirectFieldInsertRow(input: DirectFieldInsertInput) {
  return {
    organization_id: input.organizationId,
    name: input.name.trim(),
    address: input.address,
    surface_type: input.surfaceType,
    is_active: input.isActive,
    venue_id: null as string | null,
  };
}

export function mapOrganizationFieldDetail(
  field: FieldRecord,
  intervals: AvailabilityInterval[]
): FieldDetail {
  return {
    ...field,
    intervals,
    effectivelyAvailable: isFieldEffectivelyAvailable(field.is_active),
  };
}
