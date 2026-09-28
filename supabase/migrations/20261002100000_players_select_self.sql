-- Migration 043 (step 3.2): allow claimed players to read their own player row

CREATE POLICY players_select_self
  ON public.players FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
