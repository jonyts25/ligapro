import { NextRequest } from "next/server";
import { assertRosterExportAccess } from "@/lib/export/auth";
import { buildRosterCsv, buildRosterPdf } from "@/lib/export/builders";
import { csvResponse, pdfResponse, slugifyFilename } from "@/lib/export/csv";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const organizationId = params.get("organizationId") ?? "";
  const competitionId = params.get("competitionId") ?? "";
  const seasonId = params.get("seasonId") ?? "";
  const seasonTeamId = params.get("seasonTeamId") ?? "";
  const format = params.get("format") ?? "csv";

  const ctx = await assertRosterExportAccess({
    organizationId,
    competitionId,
    seasonId,
    seasonTeamId,
  });

  const slug = slugifyFilename(ctx.teamName);

  if (format === "pdf") {
    const pdf = buildRosterPdf(ctx);
    return pdfResponse(pdf, `plantel-${slug}.pdf`);
  }

  const csv = buildRosterCsv(ctx);
  return csvResponse(csv, `plantel-${slug}.csv`);
}
