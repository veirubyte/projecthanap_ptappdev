-- ============================================================================
-- Project HANAP • Supabase PostgreSQL Unified Database Schema
-- Institution: Camarines Sur Polytechnic Colleges (CSPC)
-- Course: PTAppDev (Platform Technologies & Web Application Development)
-- Target Platform: Supabase (PostgreSQL 15+)
--
-- Security Hardened:
-- - Row Level Security (RLS) enabled on all public tables
-- - Explicit search_path set on all functions (CWE-426 mitigation)
-- - All Foreign Keys fully indexed for high-performance JOINs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. MySQL Compatibility Functions for Supabase PostgreSQL (Hardened search_path)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.utc_timestamp()
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
END;
$$;

CREATE OR REPLACE FUNCTION public.date_sub(ts timestamptz, intvl interval)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN ts - intvl;
END;
$$;

CREATE OR REPLACE FUNCTION public.date_add(ts timestamptz, intvl interval)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN ts + intvl;
END;
$$;

CREATE OR REPLACE FUNCTION public.timestampdiff(unit text, t1 timestamptz, t2 timestamptz)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (t2 - t1))::integer;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Table: account_roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_roles (
  id SERIAL PRIMARY KEY,
  role_code VARCHAR(32) UNIQUE NOT NULL,
  display_name VARCHAR(64) NOT NULL
);

INSERT INTO public.account_roles (id, role_code, display_name) VALUES
  (1, 'student', 'Student'),
  (2, 'staff', 'Staff'),
  (4, 'guest', 'Campus Guest'),
  (5, 'admin', 'Administrator'),
  (6, 'legacy_institutional', 'Unclassified Institutional Account')
ON CONFLICT (role_code) DO UPDATE 
  SET display_name = EXCLUDED.display_name;

SELECT setval(pg_get_serial_sequence('public.account_roles', 'id'), GREATEST((SELECT MAX(id) FROM public.account_roles), 1));

-- ----------------------------------------------------------------------------
-- 2. Table: departments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL
);

INSERT INTO public.departments (name) VALUES
  ('College of Computer Studies (CCS)'),
  ('College of Engineering and Architecture (CEA)'),
  ('College of Arts and Sciences (CAS)'),
  ('College of Business Management (CBM)'),
  ('Campus Security and Safety Office (CSSO)'),
  ('University Library & Learning Commons')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Table: users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES public.account_roles(id) ON UPDATE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  phone_number VARCHAR(50),
  student_id VARCHAR(50),
  department_id INT REFERENCES public.departments(id) ON DELETE SET NULL,
  mfa_enabled SMALLINT NOT NULL DEFAULT 0,
  notify_claims SMALLINT NOT NULL DEFAULT 1,
  notify_chat SMALLINT NOT NULL DEFAULT 1,
  notify_broadcasts SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON public.users(department_id);

-- ----------------------------------------------------------------------------
-- 4. Table: user_mfa
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_mfa (
  user_id INT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  enabled SMALLINT NOT NULL DEFAULT 0,
  code_hash VARCHAR(255),
  code_expires_at TIMESTAMPTZ,
  attempts SMALLINT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 5. Table: password_resets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_resets (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255),
  expires_at TIMESTAMPTZ,
  attempts SMALLINT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON public.password_resets(user_id);

-- ----------------------------------------------------------------------------
-- 6. Table: item_reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_reports (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_type VARCHAR(16) NOT NULL CHECK (report_type IN ('lost', 'found')),
  item_name VARCHAR(150) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  location_found_lost VARCHAR(150) NOT NULL,
  image_path VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'returned', 'archived', 'pending_review')),
  date_reported TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  secret_challenge TEXT,
  custody_mode VARCHAR(32) NOT NULL DEFAULT 'peer_meetup' CHECK (custody_mode IN ('peer_meetup', 'security_desk')),
  secret_answer TEXT,
  custody_received_at TIMESTAMPTZ,
  custody_received_by INT REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_item_reports_user ON public.item_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_item_reports_status ON public.item_reports(status);
CREATE INDEX IF NOT EXISTS idx_item_reports_type ON public.item_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_item_reports_date ON public.item_reports(date_reported DESC);
CREATE INDEX IF NOT EXISTS idx_item_reports_custody_received_by ON public.item_reports(custody_received_by);

-- ----------------------------------------------------------------------------
-- 7. Table: item_report_images
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_report_images (
  id SERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES public.item_reports(id) ON DELETE CASCADE,
  image_path VARCHAR(255) NOT NULL,
  file_data TEXT,
  is_primary SMALLINT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_report_images_report_order ON public.item_report_images(report_id, sort_order);

-- ----------------------------------------------------------------------------
-- 7b. Table: user_sessions (Persistent Express Sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
  sid VARCHAR(128) PRIMARY KEY,
  sess JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);

-- ----------------------------------------------------------------------------
-- 8. Table: claims
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claims (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES public.item_reports(id) ON DELETE CASCADE,
  claimant_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  proof_details TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated', 'returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claims_item ON public.claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON public.claims(claimant_id);

-- ----------------------------------------------------------------------------
-- 9. Table: claim_messages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_messages (
  id SERIAL PRIMARY KEY,
  claim_id INT NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  sender_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claim_messages_claim ON public.claim_messages(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_messages_sender_id ON public.claim_messages(sender_id);

-- ----------------------------------------------------------------------------
-- 10. Table: audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_description VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- ----------------------------------------------------------------------------
-- 12. Row Level Security (RLS) Enablement & Access Policies
-- Enforces the Principle of Least Privilege across Supabase PostgreSQL:
-- - Strict isolation on all tables (RLS enabled by default).
-- - Backend full access exclusively for 'postgres' and 'service_role' roles.
-- - Public anon/authenticated access restricted to read-only active Lost & Found catalog.
-- - Zero exposure of sensitive tables (users, user_mfa, password_resets, user_sessions, audit_logs).
-- ----------------------------------------------------------------------------
ALTER TABLE public.account_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_report_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy: Backend Full Access (postgres, service_role)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow backend full access" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "Allow backend full access" ON public.%I FOR ALL TO postgres, service_role USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 13. Principle of Least Privilege: Role Grants & Backend Isolation
-- ----------------------------------------------------------------------------
-- Revoke all default public permissions from anon, authenticated, and public
-- Project HANAP is a 100% server-rendered Express application connecting via
-- trusted backend roles; direct PostgREST table access is strictly revoked so
-- private columns (such as item_reports.secret_answer and users) cannot be queried.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "Allow public read-only account_roles" ON public.account_roles;
DROP POLICY IF EXISTS "Allow public read-only departments" ON public.departments;
DROP POLICY IF EXISTS "Allow public read-only active items" ON public.item_reports;
DROP POLICY IF EXISTS "Allow public read-only active item images" ON public.item_report_images;

-- Grant schema usage and full control exclusively to trusted backend execution roles
GRANT USAGE ON SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

SELECT setval(pg_get_serial_sequence('public.users', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.users), 1), 1));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
