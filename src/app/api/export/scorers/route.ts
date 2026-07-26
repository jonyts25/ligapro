import { NextRequest } from "next/server";
import { assertSeasonExportAccess } from "@/lib/export/auth";
import { buildScorersCsv, buildScorersPdf } from "@/lib/export/builders";
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
    const pdf = await buildScorersPdf(ctx);
    return pdfResponse(pdf, `goleadores-${slug}.pdf`);
  }

  const csv = await buildScorersCsv(ctx);
  return csvResponse(csv, `goleadores-${slug}.csv`);
}
