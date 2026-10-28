-- ============================================================================
-- Project HANAP • Supabase PostgreSQL Unified Database Schema
-- Institution: Camarines Sur Polytechnic Colleges (CSPC)
-- Course: PTAppDev (Platform Technologies & Web Application Development)
-- Target Platform: Supabase (PostgreSQL 15+)
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your Project -> Go to "SQL Editor" -> Click "New query"
-- 3. Paste this entire script and click "Run" (Ctrl+Enter)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. MySQL Compatibility Functions for Supabase PostgreSQL
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION utc_timestamp()
RETURNS timestamptz AS $$
BEGIN
  RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION date_sub(ts timestamptz, intvl interval)
RETURNS timestamptz AS $$
BEGIN
  RETURN ts - intvl;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION date_add(ts timestamptz, intvl interval)
RETURNS timestamptz AS $$
BEGIN
  RETURN ts + intvl;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION timestampdiff(unit text, t1 timestamptz, t2 timestamptz)
RETURNS integer AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (t2 - t1))::integer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
  (3, 'parent', 'Parent / Guardian'),
  (4, 'guest', 'Guest'),
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
  mfa_enabled SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users(role_id);

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
  user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
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
  secret_challenge VARCHAR(500),
  custody_mode VARCHAR(32) NOT NULL DEFAULT 'peer_meetup' CHECK (custody_mode IN ('peer_meetup', 'security_desk')),
  secret_answer VARCHAR(500),
  custody_received_at TIMESTAMPTZ,
  custody_received_by INT REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_item_reports_user ON public.item_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_item_reports_status ON public.item_reports(status);
CREATE INDEX IF NOT EXISTS idx_item_reports_type ON public.item_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_item_reports_date ON public.item_reports(date_reported DESC);

-- ----------------------------------------------------------------------------
-- 7. Table: item_report_images
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_report_images (
  id SERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES public.item_reports(id) ON DELETE CASCADE,
  image_path VARCHAR(255) NOT NULL,
  is_primary SMALLINT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_report_images_report_order ON public.item_report_images(report_id, sort_order);

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

-- ----------------------------------------------------------------------------
-- 10. Table: guardian_student_links
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardian_student_links (
  id SERIAL PRIMARY KEY,
  guardian_user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON public.guardian_student_links(guardian_user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_student ON public.guardian_student_links(student_user_id);

-- ----------------------------------------------------------------------------
-- 11. Table: audit_logs
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
-- 12. Seed Default Administrative User
-- Default credentials:
-- Email: admin@cspc.edu.ph
-- Password: password123
-- ----------------------------------------------------------------------------
INSERT INTO public.users (id, role_id, full_name, email, password_hash, created_at)
VALUES (
  1,
  5, -- Admin Role
  'HANAP Administrator',
  'admin@cspc.edu.ph',
  '$2b$10$tA84vPOy50ZVHkLWROKJF.UDd7tA5qZuAftoYjX6KjsNG12VB9VZ.',
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.users', 'id'), GREATEST((SELECT MAX(id) FROM public.users), 1));

-- Grant permissions to public roles (standard for Supabase connection)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
