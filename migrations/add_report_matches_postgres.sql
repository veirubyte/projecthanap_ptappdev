-- Run once against an existing Supabase PostgreSQL database before deploying
-- the AI lost/found report matching feature.
CREATE TABLE IF NOT EXISTS public.report_matches (
  id SERIAL PRIMARY KEY,
  lost_report_id INT NOT NULL REFERENCES public.item_reports(id) ON DELETE CASCADE,
  found_report_id INT NOT NULL REFERENCES public.item_reports(id) ON DELETE CASCADE,
  confidence SMALLINT NOT NULL CHECK (confidence BETWEEN 80 AND 100),
  explanation VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (lost_report_id, found_report_id),
  CHECK (lost_report_id <> found_report_id)
);

CREATE INDEX IF NOT EXISTS idx_report_matches_found_report
  ON public.report_matches(found_report_id);

ALTER TABLE public.report_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_matches FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.report_matches TO postgres, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.report_matches_id_seq TO postgres, service_role;

DROP POLICY IF EXISTS "Allow backend full access" ON public.report_matches;
CREATE POLICY "Allow backend full access" ON public.report_matches
  FOR ALL TO postgres, service_role
  USING (true)
  WITH CHECK (true);
