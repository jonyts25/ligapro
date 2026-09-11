import { intervalsOverlap } from "@/lib/venues/availability-validation";
import { DAY_LABELS_ES } from "@/lib/venues/types";
import type { OrganizationSeasonFieldBlock } from "@/lib/season-fields/organization-blocks";

export type AvailabilityRuleInterval = {
  fieldId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};

export type AvailabilityGridFieldRow = {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  hasWeeklyAvailability: boolean;
};

export type AvailabilityGridBlockCell = {
  blockId: string;
  competitionId: string;
  competitionName: string;
  seasonName: string;
  seasonId: string;
  dayOfWeek: number;
  dayLabel: string;
  startsAt: string;
  endsAt: string;
};

export type AvailabilityGridCellKind =
  | "unconfigured"
  | "outside_hours"
  | "available"
  | "blocked";

export type AvailabilityGridCell = {
  dayOfWeek: number;
  hour: number;
  hourLabel: string;
  kind: AvailabilityGridCellKind;
  blocks: AvailabilityGridBlockCell[];
};

export type OrganizationAvailabilityGridModel = {
  hourRange: { startHour: number; endHour: number };
  hourSlots: number[];
  dayColumns: Array<{ dayOfWeek: number; label: string }>;
  rows: Array<{
    field: AvailabilityGridFieldRow;
    cells: AvailabilityGridCell[];
  }>;
};

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 22;

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function computeGridHourRange(
  rules: Array<{ startsAt: string; endsAt: string }>
): { startHour: number; endHour: number } {
  if (rules.length === 0) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  let minMinutes = Number.POSITIVE_INFINITY;
  let maxMinutes = Number.NEGATIVE_INFINITY;

  for (const rule of rules) {
    minMinutes = Math.min(minMinutes, timeToMinutes(rule.startsAt));
    maxMinutes = Math.max(maxMinutes, timeToMinutes(rule.endsAt));
  }

  return {
    startHour: Math.floor(minMinutes / 60),
    endHour: Math.ceil(maxMinutes / 60),
  };
}

function hourSlotRange(hour: number): { start: string; end: string } {
  const start = formatHourLabel(hour);
  const end = formatHourLabel(hour + 1);
  return { start, end };
}

function isHourWithinAvailability(
  fieldId: string,
  dayOfWeek: number,
  hour: number,
  rules: AvailabilityRuleInterval[]
): boolean {
  const slot = hourSlotRange(hour);
  return rules.some(
    (rule) =>
      rule.fieldId === fieldId &&
      rule.dayOfWeek === dayOfWeek &&
      intervalsOverlap(rule.startsAt, rule.endsAt, slot.start, slot.end)
  );
}

function blocksForHourSlot(
  fieldId: string,
  dayOfWeek: number,
  hour: number,
  blocks: OrganizationSeasonFieldBlock[]
): AvailabilityGridBlockCell[] {
  const slot = hourSlotRange(hour);
  return blocks
    .filter(
      (block) =>
        block.fieldId === fieldId &&
        block.dayOfWeek === dayOfWeek &&
        intervalsOverlap(block.startsAt, block.endsAt, slot.start, slot.end)
    )
    .map((block) => ({
      blockId: block.id,
      competitionId: block.competitionId,
      competitionName: block.competitionName,
      seasonName: block.seasonName,
      seasonId: block.seasonId,
      dayOfWeek: block.dayOfWeek,
      dayLabel: DAY_LABELS_ES[block.dayOfWeek] ?? String(block.dayOfWeek),
      startsAt: block.startsAt,
      endsAt: block.endsAt,
    }));
}

export function buildOrganizationAvailabilityGridModel(input: {
  fields: AvailabilityGridFieldRow[];
  availabilityRules: AvailabilityRuleInterval[];
  blocks: OrganizationSeasonFieldBlock[];
}): OrganizationAvailabilityGridModel {
  const hourRange = computeGridHourRange(
    input.availabilityRules.map((rule) => ({
      startsAt: rule.startsAt,
      endsAt: rule.endsAt,
    }))
  );

  const hourSlots: number[] = [];
  for (let hour = hourRange.startHour; hour < hourRange.endHour; hour += 1) {
    hourSlots.push(hour);
  }

  const dayColumns = DAY_LABELS_ES.map((label, dayOfWeek) => ({
    dayOfWeek,
    label,
  }));

  const rows = input.fields.map((field) => {
    const cells: AvailabilityGridCell[] = [];

    for (const day of dayColumns) {
      for (const hour of hourSlots) {
        const hourLabel = formatHourLabel(hour);
        const blocks = blocksForHourSlot(
          field.fieldId,
          day.dayOfWeek,
          hour,
          input.blocks
        );

        if (!field.hasWeeklyAvailability) {
          cells.push({
            dayOfWeek: day.dayOfWeek,
            hour,
            hourLabel,
            kind: "unconfigured",
            blocks: [],
          });
          continue;
        }

        if (blocks.length > 0) {
          cells.push({
            dayOfWeek: day.dayOfWeek,
            hour,
            hourLabel,
            kind: "blocked",
            blocks,
          });
          continue;
        }

        const withinAvailability = isHourWithinAvailability(
          field.fieldId,
          day.dayOfWeek,
          hour,
          input.availabilityRules
        );

        cells.push({
          dayOfWeek: day.dayOfWeek,
          hour,
          hourLabel,
          kind: withinAvailability ? "available" : "outside_hours",
          blocks: [],
        });
      }
    }

    return { field, cells };
  });

  return {
    hourRange,
    hourSlots,
    dayColumns,
    rows,
  };
}

const BLOCK_PALETTE = [
  "bg-brand/25 border-brand/50 text-brand",
  "bg-info/25 border-info/50 text-info",
  "bg-warning/25 border-warning/50 text-warning",
  "bg-success/25 border-success/50 text-success",
];

export function blockColorClass(competitionId: string): string {
  if (!competitionId) return BLOCK_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < competitionId.length; i += 1) {
    hash = (hash + competitionId.charCodeAt(i) * (i + 1)) % BLOCK_PALETTE.length;
  }
  return BLOCK_PALETTE[hash];
}
