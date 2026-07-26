import { NextRequest } from "next/server";
import { assertSeasonExportAccess } from "@/lib/export/auth";
import {
  buildStandingsCsv,
  buildStandingsPdf,
} from "@/lib/export/builders";
import { csvResponse, pdfResponse, slugifyFilename } from "@/lib/export/csv";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const organizationId = params.get("organizationId") ?? "";
  const competitionId = params.get("competitionId") ?? "";
  const seasonId = params.get("seasonId") ?? "";
  const format = params.get("format") ?? "csv";

  const ctx = await assertSeasonExportAccess({
    organizationId,
    competitionId,
    seasonId,
  });

  const slug = slugifyFilename(ctx.seasonName);

  if (format === "pdf") {
    const pdf = await buildStandingsPdf(ctx);
    return pdfResponse(pdf, `posiciones-${slug}.pdf`);
  }

  const csv = await buildStandingsCsv(ctx);
  return csvResponse(csv, `posiciones-${slug}.csv`);
}
