const WEBHOOK_SECRET_HEADER = "x-ligera-webhook-secret";

type AutoGenerateBody = {
  match_id?: string;
};

export async function handleAutoGenerateChronicle(
  request: Request
): Promise<Response> {
  const configuredSecret = process.env.CHRONICLE_WEBHOOK_SECRET;
  const providedSecret = request.headers.get(WEBHOOK_SECRET_HEADER);

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: AutoGenerateBody;
  try {
    body = (await request.json()) as AutoGenerateBody;
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const matchId = body.match_id?.trim();
  if (!matchId) {
    return Response.json({ ok: false, message: "match_id is required." }, { status: 400 });
  }

  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
    const { generateChronicleForMatch } = await import(
      "@/lib/chronicles/generate-chronicle"
    );
    const supabase = createServiceRoleClient();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, organization_id, season_id, seasons!inner(competition_id)")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) {
      throw new Error(matchError.message);
    }

    if (!match) {
      return Response.json({ ok: false, message: "Match not found." }, { status: 404 });
    }

    const seasonRel = match.seasons as
      | { competition_id: string }
      | { competition_id: string }[];
    const season = Array.isArray(seasonRel) ? seasonRel[0] : seasonRel;

    if (!season?.competition_id) {
      return Response.json(
        { ok: false, message: "Match season not found." },
        { status: 404 }
      );
    }

    const result = await generateChronicleForMatch({
      supabase,
      organizationId: match.organization_id,
      competitionId: season.competition_id,
      seasonId: match.season_id,
      matchId: match.id,
      actorProfileId: null,
      confirmRegenerate: false,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
