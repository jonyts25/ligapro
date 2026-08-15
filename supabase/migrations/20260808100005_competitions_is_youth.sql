-- Flag youth competitions so public pages can redact player names.

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS is_youth boolean NOT NULL DEFAULT false;
