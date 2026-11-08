/**
 * Automated Database Schema Synchronization & Migration Runner
 * Project HANAP - Campus System Round 1
 */
const pool = require('../config/db');

let isMigrated = false;

async function autoMigrate() {
  if (isMigrated) return;
  isMigrated = true;

  if (pool.isPostgres) {
    // Supabase PostgreSQL schema is defined in supabase_schema.sql.
    // Ensure core tables exist safely in a single batch network roundtrip.
    try {
      const connection = await pool.getConnection();
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS public.item_report_images (
            id SERIAL PRIMARY KEY,
            report_id INT NOT NULL REFERENCES public.item_reports(id) ON DELETE CASCADE,
            image_path VARCHAR(255) NOT NULL,
            is_primary SMALLINT NOT NULL DEFAULT 0,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS public.password_resets (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            code_hash VARCHAR(255) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            attempts SMALLINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS public.user_sessions (
            sid VARCHAR(128) PRIMARY KEY,
            sess JSONB NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);
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
          CREATE INDEX IF NOT EXISTS idx_report_matches_found_report ON public.report_matches(found_report_id);
          ALTER TABLE public.item_report_images ADD COLUMN IF NOT EXISTS file_data TEXT;
          ALTER TABLE public.item_reports ALTER COLUMN secret_challenge TYPE TEXT;
          ALTER TABLE public.item_reports ALTER COLUMN secret_answer TYPE TEXT;

          -- Enforce Row Level Security (RLS) across all public tables
          ALTER TABLE public.account_roles ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.user_mfa ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.item_reports ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.item_report_images ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.claim_messages ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.guardian_student_links ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.report_matches ENABLE ROW LEVEL SECURITY;

          -- Revoke direct PostgREST anon/authenticated access so private columns (e.g. secret_answer) are never exposed
          REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
          REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
          REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated, PUBLIC;
          GRANT ALL ON public.report_matches TO postgres, service_role;
          GRANT USAGE, SELECT ON SEQUENCE public.report_matches_id_seq TO postgres, service_role;
          DROP POLICY IF EXISTS "Allow public read-only active items" ON public.item_reports;
          DROP POLICY IF EXISTS "Allow public read-only active item images" ON public.item_report_images;
          DROP POLICY IF EXISTS "Allow public read-only account_roles" ON public.account_roles;
          DROP POLICY IF EXISTS "Allow public read-only departments" ON public.departments;

          -- Ensure backend full access policy exists for postgres and service_role
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
        `);
        console.log('[MIGRATION] Supabase PostgreSQL tables and RLS security verified successfully.');
      } finally {
        connection.release();
      }
    } catch (pgErr) {
      console.warn('[MIGRATION NOTICE] Supabase schema check note:', pgErr.message);
    }
    return;
  }

  // MySQL migration runner
  try {
    const connection = await pool.getConnection();
    try {
      // 1. Check item_reports columns
      const [itemReportCols] = await connection.query('DESCRIBE item_reports');
      const itemReportColNames = itemReportCols.map(c => c.Field);

      if (!itemReportColNames.includes('custody_received_at')) {
        console.log('[MIGRATION] Adding custody_received_at to item_reports...');
        await connection.query('ALTER TABLE `item_reports` ADD COLUMN `custody_received_at` timestamp NULL DEFAULT NULL AFTER `secret_answer`');
      }

      if (!itemReportColNames.includes('custody_received_by')) {
        console.log('[MIGRATION] Adding custody_received_by to item_reports...');
        await connection.query('ALTER TABLE `item_reports` ADD COLUMN `custody_received_by` int(11) DEFAULT NULL AFTER `custody_received_at`');
        try {
          await connection.query('ALTER TABLE `item_reports` ADD CONSTRAINT `fk_item_reports_custody_received_by` FOREIGN KEY (`custody_received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL');
        } catch (fkErr) {
          // Ignore if constraint already exists
        }
      }

      // 2. Ensure item_report_images table exists
      console.log('[MIGRATION] Ensuring item_report_images table exists...');
      const [tableStatus] = await connection.query("SHOW TABLE STATUS WHERE Name = 'item_reports'");
      const collation = (tableStatus[0] && tableStatus[0].Collation) || 'utf8mb4_general_ci';
      const charset = collation.split('_')[0];

      await connection.query(`
        CREATE TABLE IF NOT EXISTS item_report_images (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          report_id INT NOT NULL,
          image_path VARCHAR(255) NOT NULL,
          is_primary TINYINT(1) NOT NULL DEFAULT 0,
          sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_item_report_images_report_order (report_id, sort_order),
          CONSTRAINT fk_item_report_images_report
            FOREIGN KEY (report_id) REFERENCES item_reports(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
      `);

      // If item_report_images was already created with a different collation, align it
      await connection.query(`ALTER TABLE item_report_images CONVERT TO CHARACTER SET ${charset} COLLATE ${collation}`);

      // 3. Migrate any legacy image_path from item_reports into item_report_images
      await connection.query(`
        INSERT INTO item_report_images (report_id, image_path, is_primary, sort_order)
        SELECT r.id, r.image_path, 1, 0
        FROM item_reports r
        WHERE r.image_path IS NOT NULL
          AND r.image_path <> ''
          AND NOT EXISTS (
            SELECT 1
            FROM item_report_images existing_image
            WHERE existing_image.report_id = r.id
              AND existing_image.image_path = r.image_path
          )
      `);

      // 4. Ensure password_resets table exists for self-service password recovery
      console.log('[MIGRATION] Ensuring password_resets table exists...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          code_hash VARCHAR(255) NOT NULL,
          expires_at DATETIME NOT NULL,
          attempts TINYINT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_password_resets_user (user_id),
          CONSTRAINT fk_password_resets_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
      `);

      // 5. Ensure user_sessions table exists for persistent session storage
      console.log('[MIGRATION] Ensuring user_sessions table exists...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          sid VARCHAR(128) NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          INDEX idx_user_sessions_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
      `);

      // 6. Persist AI-confirmed active lost/found report matches
      await connection.query(`
        CREATE TABLE IF NOT EXISTS report_matches (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          lost_report_id INT NOT NULL,
          found_report_id INT NOT NULL,
          confidence SMALLINT UNSIGNED NOT NULL,
          explanation VARCHAR(500) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_report_matches_pair (lost_report_id, found_report_id),
          KEY idx_report_matches_found_report (found_report_id),
          CONSTRAINT fk_report_matches_lost_report
            FOREIGN KEY (lost_report_id) REFERENCES item_reports(id) ON DELETE CASCADE,
          CONSTRAINT fk_report_matches_found_report
            FOREIGN KEY (found_report_id) REFERENCES item_reports(id) ON DELETE CASCADE,
          CONSTRAINT chk_report_matches_confidence CHECK (confidence BETWEEN 80 AND 100),
          CONSTRAINT chk_report_matches_distinct_reports CHECK (lost_report_id <> found_report_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
      `);

      // 7. Ensure file_data column exists in item_report_images
      const [imgCols] = await connection.query('DESCRIBE item_report_images');
      const imgColNames = imgCols.map(c => c.Field);
      if (!imgColNames.includes('file_data')) {
        console.log('[MIGRATION] Adding file_data to item_report_images...');
        try {
          await connection.query('ALTER TABLE `item_report_images` ADD COLUMN `file_data` LONGTEXT NULL DEFAULT NULL AFTER `image_path`');
        } catch (colErr) {
          // Column already added concurrently
        }
      }

      console.log('[MIGRATION] All database tables and columns synchronized successfully.');
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('[MIGRATION ERROR] Database migration error:', err);
    throw err;
  }
}

if (require.main === module) {
  autoMigrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = autoMigrate;
