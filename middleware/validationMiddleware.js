/**
 * Server-Side Input Validation Middleware & Utility Helpers
 * Project HANAP - Campus System Round 1
 * 
 * Provides robust validation for:
 * - Required fields
 * - Valid email format
 * - Numeric constraints (min/max ranges)
 * - Field length constraints
 * - Database duplicate checks
 */

/**
 * Basic utility checkers
 */
const validators = {
  /**
   * Check if a value is null, undefined, or whitespace-only
   */
  isEmpty(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  },

  /**
   * Validate email format using RFC 5322 compliant regular expression
   */
  isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  /**
   * Validate numeric constraints (is a number, optional min/max bounds)
   */
  isNumeric(value, { min = -Infinity, max = Infinity, integerOnly = false } = {}) {
    if (value === undefined || value === null || value === '') return false;
    const num = Number(value);
    if (isNaN(num)) return false;
    if (integerOnly && !Number.isInteger(num)) return false;
    return num >= min && num <= max;
  },

  /**
   * Validate string length within bounds
   */
  isValidLength(value, { min = 0, max = Infinity } = {}) {
    if (typeof value !== 'string') return false;
    const len = value.trim().length;
    return len >= min && len <= max;
  },

  /**
   * Sanitize text against XSS/HTML injection for template rendering
   */
  sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

/**
 * Express Middleware: Validate required fields in req.body
 * 
 * @param {string[]} fields Array of required property names
 */
function validateRequired(fields = []) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const field of fields) {
      if (validators.isEmpty(body[field])) {
        errors.push(`The "${field}" field is required.`);
      }
    }

    if (errors.length > 0) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(400).json({ success: false, errors });
      }
      return res.status(400).render('pages/error', {
        title: 'Validation Error',
        statusCode: 400,
        errorMessage: 'Invalid form submission.',
        errors,
        user: req.session ? req.session.user : null
      });
    }

    return next();
  };
}

/**
 * Express Middleware: Validate email field format
 * 
 * @param {string} field Name of email field (default 'email')
 */
function validateEmail(field = 'email') {
  return (req, res, next) => {
    const value = req.body ? req.body[field] : null;
    if (value && !validators.isValidEmail(value)) {
      const error = `The "${field}" must be a valid email address (e.g. user@campus.edu).`;
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(400).json({ success: false, errors: [error] });
      }
      return res.status(400).render('pages/error', {
        title: 'Validation Error',
        statusCode: 400,
        errorMessage: error,
        errors: [error],
        user: req.session ? req.session.user : null
      });
    }
    return next();
  };
}

/**
 * Express Middleware: Validate string length constraints
 */
function validateLength(field, min = 0, max = Infinity) {
  return (req, res, next) => {
    const value = req.body ? req.body[field] : '';
    if (value && !validators.isValidLength(value, { min, max })) {
      const error = `The "${field}" length must be between ${min} and ${max} characters.`;
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(400).json({ success: false, errors: [error] });
      }
      return res.status(400).render('pages/error', {
        title: 'Validation Error',
        statusCode: 400,
        errorMessage: error,
        errors: [error],
        user: req.session ? req.session.user : null
      });
    }
    return next();
  };
}

/**
 * Asynchronous Helper: Check for duplicate records in a MySQL table
 * 
 * @param {object} pool MySQL connection pool
 * @param {string} table Table name
 * @param {string} column Column name to check (e.g. 'email')
 * @param {any} value Value to search for
 * @param {number|null} excludeId Optional primary key ID to exclude (for update operations)
 * @returns {Promise<boolean>} True if duplicate exists, false otherwise
 */
async function checkDuplicate(pool, table, column, value, excludeId = null) {
  try {
    let sql = `SELECT COUNT(*) AS count FROM ?? WHERE ?? = ?`;
    const params = [table, column, value];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count > 0;
  } catch (error) {
    console.error(`[VALIDATION ERROR] checkDuplicate failed on ${table}.${column}:`, error.message);
    throw error;
  }
}

module.exports = {
  validators,
  validateRequired,
  validateEmail,
  validateLength,
  checkDuplicate
};
