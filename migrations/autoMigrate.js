/**
 * Automated Database Schema Synchronization & Migration Runner
 * Project HANAP - Campus System Round 1
 */
const pool = require('../config/db');

async function autoMigrate() {
  if (pool.isPostgres) {
    // Supabase PostgreSQL schema is defined in supabase_schema.sql.
    // Ensure core tables exist safely without MySQL-specific syntax.
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
          )
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS public.password_resets (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            code_hash VARCHAR(255) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            attempts SMALLINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS public.user_sessions (
            sid VARCHAR(128) PRIMARY KEY,
            sess JSONB NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
          )
        `);
        await connection.query(`
          CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at)
        `);
        await connection.query(`
          ALTER TABLE public.item_report_images ADD COLUMN IF NOT EXISTS file_data TEXT
        `);
        console.log('[MIGRATION] Supabase PostgreSQL tables verified successfully.');
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

      // 6. Ensure file_data column exists in item_report_images
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
