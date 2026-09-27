"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  getMexicoCityDateString,
  shiftMexicoCityDateString,
} from "@/lib/matches/live-matchday-core";

type LiveMatchdayDatePickerProps = {
  organizationId: string;
  selectedDate: string;
};

export function LiveMatchdayDatePicker({
  organizationId,
  selectedDate,
}: LiveMatchdayDatePickerProps) {
  const router = useRouter();
  const base = `/organizaciones/${organizationId}/jornada-en-vivo`;
  const previousDate = shiftMexicoCityDateString(selectedDate, -1);
  const nextDate = shiftMexicoCityDateString(selectedDate, 1);
  const today = getMexicoCityDateString();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`${base}?date=${previousDate}`}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border"
        aria-label="Día anterior"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Link>

      <input
        type="date"
        value={selectedDate}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) return;
          router.push(`${base}?date=${value}`);
        }}
        className="min-h-11 flex-1 rounded-xl border border-border px-3 text-sm"
      />

      <Link
        href={`${base}?date=${nextDate}`}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border"
        aria-label="Día siguiente"
      >
        <ChevronRight className="size-5" aria-hidden />
      </Link>

      {selectedDate !== today ? (
        <Link
          href={base}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Hoy
        </Link>
      ) : null}
    </div>
  );
}
