import fs from "node:fs";
import path from "node:path";

const INJECT = {
  p_season_id:
    "PERFORM public.__assert_season_not_archived(p_season_id);",
  p_match_id:
    "PERFORM public.__assert_season_not_archived_for_match(p_match_id);",
  p_season_team_id:
    "PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);",
  p_suspension_id:
    "PERFORM public.__assert_season_not_archived_for_suspension(p_suspension_id);",
  p_season_team_player_id:
    "PERFORM public.__assert_season_not_archived_for_season_team_player(p_season_team_player_id);",
  p_event_id:
    "PERFORM public.__assert_season_not_archived_for_match_event(p_event_id);",
  p_charge_id:
    "PERFORM public.__assert_season_not_archived_for_team_charge(p_charge_id);",
  p_payment_id:
    "PERFORM public.__assert_season_not_archived_for_team_payment(p_payment_id);",
  p_round_id:
    "PERFORM public.__assert_season_not_archived_for_knockout_round(p_round_id);",
  p_tie_id:
    "PERFORM public.__assert_season_not_archived_for_knockout_tie(p_tie_id);",
  p_token:
    "PERFORM public.__assert_season_not_archived_for_captain_invitation(p_token);",
};

const targets = {
  create_season_round_robin_fixture: ["p_season_id"],
  create_season_knockout_bracket: ["p_season_id"],
  generate_knockout_from_groups: ["p_season_id"],
  schedule_match: ["p_match_id"],
  unschedule_match: ["p_match_id"],
  confirm_match_calendar: ["p_match_id"],
  apply_recurring_slot_to_season: ["p_season_id"],
  set_season_field_blocks: ["p_season_id"],
  set_season_groups: ["p_season_id"],
  assign_teams_to_groups: ["p_season_id"],
  propose_match_reschedule: ["p_match_id"],
  respond_match_reschedule: ["p_match_id"],
  resolve_match_reschedule: ["p_match_id"],
  record_match_event: ["p_match_id"],
  update_match_result: ["p_match_id"],
  void_match_event: ["p_event_id"],
  waive_discipline_suspension: ["p_suspension_id"],
  adjust_discipline_suspension_length: ["p_suspension_id"],
  create_administrative_suspension: ["p_season_team_player_id"],
  void_team_charge: ["p_charge_id"],
  void_team_payment: ["p_payment_id"],
  create_player_and_add_to_roster: ["p_season_team_id"],
  add_player_to_season_team: ["p_season_team_id"],
  set_season_team_player_status: ["p_season_team_player_id"],
  deactivate_season_team_player: ["p_season_team_player_id"],
  set_season_team_captain: ["p_season_team_id"],
  set_season_team_vice_captain: ["p_season_team_id"],
  set_roster_lock: ["p_season_team_id"],
  enroll_team_in_season: ["p_season_id"],
  release_player_transfer_lock: ["p_season_id"],
  configure_knockout_round: ["p_round_id"],
  set_knockout_tie_penalty_winner: ["p_round_id"],
  advance_knockout_round: ["p_season_id"],
  invite_captain_to_roster: ["p_season_team_id"],
  create_captain_player_with_invitation: ["p_season_team_id"],
  accept_captain_invitation: ["p_token"],
  set_player_payment_mark: ["p_season_team_id"],
  __schedule_match_core: ["p_match_id"],
};

const dir = path.join("supabase", "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const latest = new Map();
for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), "utf8");
  const re = /CREATE OR REPLACE FUNCTION public\.(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(content))) latest.set(m[1], { file: f, content });
}

function extractFunction(content, name) {
  const marker = `CREATE OR REPLACE FUNCTION public.${name}`;
  const start = content.indexOf(marker);
  if (start < 0) return null;
  const asPos = content.indexOf("AS $$", start);
  if (asPos < 0) return null;
  const bodyStart = asPos + 5;
  const end = content.indexOf("\n$$;", bodyStart);
  if (end < 0) return null;
  const tail = content.slice(end, end + 4);
  return {
    header: content.slice(start, asPos + 5),
    body: content.slice(bodyStart, end),
    tail,
    after: content.slice(end + 4),
  };
}

function injectBody(body, key) {
  const line = INJECT[key];
  if (!line) throw new Error(`no inject for ${key}`);
  if (body.includes("__assert_season_not_archived")) return body;
  const match = body.match(/^(\s*BEGIN\s*\r?\n)/m);
  if (!match) throw new Error(`no BEGIN in ${key}`);
  const at = match.index + match[1].length;
  return `${body.slice(0, at)}  ${line}\n${body.slice(at)}`;
}

const out = [];
for (const [fn, keys] of Object.entries(targets)) {
  const meta = latest.get(fn);
  if (!meta) {
    console.error("missing", fn);
    continue;
  }
  const ex = extractFunction(meta.content, fn);
  if (!ex) {
    console.error("extract fail", fn);
    continue;
  }
  let body = ex.body;
  for (const k of keys) body = injectBody(body, k);
  out.push(`-- patched from ${meta.file}\n${ex.header}\n${body}${ex.tail}`);
  // preserve REVOKE/GRANT after function if present
  const after = ex.after;
  const grantMatch = after.match(
    /^(\s*REVOKE[\s\S]*?GRANT[\s\S]*?;)/m
  );
  if (grantMatch) out.push(grantMatch[1]);
}

fs.writeFileSync(
  path.join("supabase", "migrations", "_generated_rpc_patches.sql"),
  out.join("\n\n")
);
console.log("generated", Object.keys(targets).length, "targets");
