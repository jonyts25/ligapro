-- Allow org owner/admin to mark ai_jobs done/error after synchronous generation
-- from enqueueChronicleAction (previously only INSERT was granted; worker used service role).

CREATE POLICY ai_jobs_update_owner_or_admin
  ON public.ai_jobs FOR UPDATE TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  )
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

GRANT UPDATE ON TABLE public.ai_jobs TO authenticated;
