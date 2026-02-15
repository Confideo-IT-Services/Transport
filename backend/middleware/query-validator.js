/**
 * Query Validation Middleware
 * Ensures all database queries include proper school_id filtering
 * Prevents data leakage and unauthorized access
 */

const FORBIDDEN_PATTERNS = [
  /WHERE\s+school_id\s*[!=<>]/i,           // Direct school_id manipulation
  /UPDATE.*SET.*school_id/i,                // Changing school_id
  /DELETE\s+FROM\s+\w+\s+WHERE\s+school_id\s*IS\s+NULL/i,  // Deleting without school_id
  /TRUNCATE/i,                              // Truncate operations
  /DROP\s+TABLE/i,                          // Drop table operations
  /ALTER\s+TABLE/i,                         // Alter table operations
];

const REQUIRED_PATTERNS = {
  SELECT: /WHERE.*school_id/i,
  UPDATE: /WHERE.*school_id/i,
  DELETE: /WHERE.*school_id/i,
};

/**
 * Validate SQL query for security
 * @param {string} query - SQL query to validate
 * @param {string} schoolId - Expected school ID
 * @param {Array} params - Query parameters
 * @throws {Error} If query is invalid or insecure
 */
function validateQuery(query, schoolId, params = []) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  if (!schoolId) {
    throw new Error('School ID is required for query validation');
  }

  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const upperQuery = normalizedQuery.toUpperCase();

  // Check for forbidden patterns
  FORBIDDEN_PATTERNS.forEach(pattern => {
    if (pattern.test(normalizedQuery)) {
      throw new Error(`Forbidden query pattern detected: ${pattern.toString()}`);
    }
  });

  // Check for required patterns based on query type
  if (upperQuery.startsWith('SELECT')) {
    // Allow SELECT without WHERE if it's a simple lookup (e.g., SELECT COUNT(*))
    // But require school_id in WHERE for table queries
    if (normalizedQuery.includes('FROM') && !REQUIRED_PATTERNS.SELECT.test(normalizedQuery)) {
      // Exception: SELECT with JOIN might have school_id in joined table
      if (!normalizedQuery.includes('JOIN') || !normalizedQuery.includes('school_id')) {
        throw new Error('SELECT query must include school_id in WHERE clause');
      }
    }
  } else if (upperQuery.startsWith('UPDATE')) {
    if (!REQUIRED_PATTERNS.UPDATE.test(normalizedQuery)) {
      throw new Error('UPDATE query must include school_id in WHERE clause');
    }
    
    // Prevent updating school_id
    if (/SET.*school_id/i.test(normalizedQuery)) {
      throw new Error('Cannot update school_id - it is protected');
    }
  } else if (upperQuery.startsWith('DELETE')) {
    if (!REQUIRED_PATTERNS.DELETE.test(normalizedQuery)) {
      throw new Error('DELETE query must include school_id in WHERE clause');
    }
  }

  // Verify school_id is in parameters
  if (params && !params.includes(schoolId)) {
    // Check if school_id might be in a subquery or JOIN
    if (!normalizedQuery.includes('school_id')) {
      throw new Error('Query parameters must include school_id');
    }
  }

  return true;
}

/**
 * Middleware to validate queries before execution
 * Attaches validation function to request object
 */
function queryValidator(req, res, next) {
  const schoolId = req.user?.schoolId;

  // Skip validation for superadmin (they can access all schools)
  if (req.user?.role === 'superadmin') {
    return next();
  }

  // Attach validator function to request
  req.validateQuery = (query, params = []) => {
    return validateQuery(query, schoolId, params);
  };

  next();
}

/**
 * Wrapper for db.query that automatically validates queries
 * @param {Object} db - Database connection/pool
 * @param {string} schoolId - School ID
 * @returns {Function} Wrapped query function
 */
function createSecureQuery(db, schoolId) {
  return async (query, params = []) => {
    // Validate query
    validateQuery(query, schoolId, params);
    
    // Execute query
    return db.query(query, params);
  };
}

module.exports = {
  validateQuery,
  queryValidator,
  createSecureQuery,
  FORBIDDEN_PATTERNS,
  REQUIRED_PATTERNS,
};





