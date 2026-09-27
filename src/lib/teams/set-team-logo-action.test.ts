import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ACTIONS_PATH = path.join(process.cwd(), "src/lib/teams/actions.ts");

describe("setTeamLogoAction", () => {
  it("exports an async server action that calls set_team_logo RPC", () => {
    const source = readFileSync(ACTIONS_PATH, "utf8");

    assert.match(source, /export async function setTeamLogoAction\(/);
    assert.match(source, /\.rpc\("set_team_logo"/);
    assert.match(source, /p_team_id: input\.teamId/);
    assert.match(source, /p_logo_path: input\.logoPath/);
    assert.match(source, /requireOrganizationAdmin/);
    assert.match(source, /revalidateTeamLogoSurfaces/);
  });

  it("revalidates team, season-team, calendar and public surfaces", () => {
    const source = readFileSync(ACTIONS_PATH, "utf8");

    assert.match(
      source,
      /revalidatePath\(`\/organizaciones\/\$\{organizationId\}\/equipos\/\$\{teamId\}`\)/
    );
    assert.match(source, /revalidatePath\(`\$\{base\}\/equipos\/\$\{row\.id\}`\)/);
    assert.match(source, /revalidatePath\(`\$\{publicBase\}\/calendario`\)/);
  });
});
