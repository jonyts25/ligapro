-- Align grants with ligapro-dev: authenticated-only execute on 5-arg roster RPC.

REVOKE ALL ON FUNCTION public.create_player_and_add_to_roster(uuid, text, integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_player_and_add_to_roster(uuid, text, integer, text, text)
  TO authenticated;
