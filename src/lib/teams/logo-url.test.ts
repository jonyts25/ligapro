import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getTeamLogoPublicUrl } from "@/lib/teams/logo-url";

describe("getTeamLogoPublicUrl", () => {
  const originalBase = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalBase;
    }
  });

  it("returns null when logo path is empty", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.equal(getTeamLogoPublicUrl(null), null);
    assert.equal(getTeamLogoPublicUrl(undefined), null);
    assert.equal(getTeamLogoPublicUrl(""), null);
  });

  it("returns null when Supabase URL is not configured", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.equal(
      getTeamLogoPublicUrl("org/team/uuid.png"),
      null
    );
  });

  it("builds a public URL for the team-logos bucket", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const path = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/cccccccc-cccc-cccc-cccc-cccccccccccc.png";
    assert.equal(
      getTeamLogoPublicUrl(path),
      `https://example.supabase.co/storage/v1/object/public/team-logos/${path}`
    );
  });
});
