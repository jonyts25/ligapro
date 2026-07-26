import { NextRequest } from "next/server";
import { assertCredentialPdfAccess } from "@/lib/export/auth";
import { buildCredentialPdf } from "@/lib/export/pdf-credential";
import { pdfResponse, slugifyFilename } from "@/lib/export/csv";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("mode");

  if (mode === "captain") {
    const seasonTeamId = params.get("seasonTeamId") ?? "";
    const seasonTeamPlayerId = params.get("seasonTeamPlayerId") ?? "";
    const data = await assertCredentialPdfAccess({
      mode: "captain",
      seasonTeamId,
      seasonTeamPlayerId,
    });
    const pdf = await buildCredentialPdf(data);
    const slug = slugifyFilename(data.credential.fullName);
    return pdfResponse(pdf, `credencial-${slug}.pdf`);
  }

  if (mode === "capture") {
    const data = await assertCredentialPdfAccess({
      mode: "capture",
      organizationId: params.get("organizationId") ?? "",
      competitionId: params.get("competitionId") ?? "",
      seasonId: params.get("seasonId") ?? "",
      matchId: params.get("matchId") ?? "",
      seasonTeamPlayerId: params.get("seasonTeamPlayerId") ?? "",
    });
    const pdf = await buildCredentialPdf(data);
    const slug = slugifyFilename(data.credential.fullName);
    return pdfResponse(pdf, `credencial-${slug}.pdf`);
  }

  return new Response("Parámetros inválidos", { status: 400 });
}
