/**
 * SecureQueryBuilder - Ensures all queries include school_id filtering
 * Prevents data leakage between schools in multi-tenant environment
 */

class SecureQueryBuilder {
  constructor(schoolId, userId = null) {
    if (!schoolId) {
      throw new Error('School ID is required for secure queries');
    }
    this.schoolId = schoolId;
    this.userId = userId;
  }

  /**
   * Build a SELECT query with automatic school_id filtering
   * @param {string} table - Table name
   * @param {string|Array} fields - Fields to select (default: '*')
   * @param {string} additionalWhere - Additional WHERE conditions (without WHERE keyword)
   * @param {Array} additionalParams - Parameters for additional WHERE conditions
   * @param {string} orderBy - ORDER BY clause
   * @param {number} limit - LIMIT clause
   * @returns {Object} { query, params }
   */
  select(table, fields = '*', additionalWhere = '', additionalParams = [], orderBy = '', limit = null) {
    const fieldsStr = Array.isArray(fields) ? fields.join(', ') : fields;
    let whereClause = `WHERE school_id = ?`;
    const params = [this.schoolId];

    if (additionalWhere) {
      whereClause += ` AND ${additionalWhere}`;
      params.push(...additionalParams);
    }

    let query = `SELECT ${fieldsStr} FROM ${table} ${whereClause}`;
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }

    return { query, params };
  }

  /**
   * Build an UPDATE query with automatic school_id filtering
   * @param {string} table - Table name
   * @param {Object} updates - Object with field: value pairs
   * @param {string} additionalWhere - Additional WHERE conditions
   * @param {Array} additionalParams - Parameters for additional WHERE
   * @returns {Object} { query, params }
   */
  update(table, updates, additionalWhere = '', additionalParams = []) {
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('Updates object cannot be empty');
    }

    // Prevent school_id from being updated
    if ('school_id' in updates) {
      throw new Error('Cannot update school_id - it is protected');
    }

    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const params = [...Object.values(updates), this.schoolId];

    let whereClause = `WHERE school_id = ?`;
    if (additionalWhere) {
      whereClause += ` AND ${additionalWhere}`;
      params.push(...additionalParams);
    }

    const query = `UPDATE ${table} SET ${setClause} ${whereClause}`;

    return { query, params };
  }

  /**
   * Build a DELETE query with automatic school_id filtering
   * @param {string} table - Table name
   * @param {string} additionalWhere - Additional WHERE conditions
   * @param {Array} additionalParams - Parameters for additional WHERE
   * @returns {Object} { query, params }
   */
  delete(table, additionalWhere = '', additionalParams = []) {
    let whereClause = `WHERE school_id = ?`;
    const params = [this.schoolId];

    if (additionalWhere) {
      whereClause += ` AND ${additionalWhere}`;
      params.push(...additionalParams);
    }

    const query = `DELETE FROM ${table} ${whereClause}`;

    return { query, params };
  }

  /**
   * Build an INSERT query with automatic school_id inclusion
   * @param {string} table - Table name
   * @param {Object} data - Object with field: value pairs
   * @returns {Object} { query, params }
   */
  insert(table, data) {
    if (!data || Object.keys(data).length === 0) {
      throw new Error('Data object cannot be empty');
    }

    // Ensure school_id is included
    const finalData = { ...data, school_id: this.schoolId };

    const fields = Object.keys(finalData);
    const placeholders = fields.map(() => '?').join(', ');
    const params = Object.values(finalData);

    const query = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;

    return { query, params };
  }

  /**
   * Build a JOIN query with automatic school_id filtering
   * @param {string} mainTable - Main table name
   * @param {Array} joins - Array of { type, table, on } objects
   * @param {string|Array} fields - Fields to select
   * @param {string} additionalWhere - Additional WHERE conditions
   * @param {Array} additionalParams - Parameters for additional WHERE
   * @param {string} orderBy - ORDER BY clause
   * @returns {Object} { query, params }
   */
  join(mainTable, joins, fields = '*', additionalWhere = '', additionalParams = [], orderBy = '') {
    const fieldsStr = Array.isArray(fields) ? fields.join(', ') : fields;
    
    let query = `SELECT ${fieldsStr} FROM ${mainTable}`;
    
    joins.forEach(join => {
      const joinType = join.type || 'INNER';
      query += ` ${joinType} JOIN ${join.table} ON ${join.on}`;
    });

    let whereClause = `WHERE ${mainTable}.school_id = ?`;
    const params = [this.schoolId];

    if (additionalWhere) {
      whereClause += ` AND ${additionalWhere}`;
      params.push(...additionalParams);
    }

    query += ` ${whereClause}`;

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    return { query, params };
  }

  /**
   * Execute a raw query with school_id validation
   * WARNING: Use with caution - only for complex queries that can't use builder methods
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Object} { query, params } (validated)
   */
  raw(query, params = []) {
    // Validate that query includes school_id check
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ');
    
    if (!normalizedQuery.includes('school_id')) {
      throw new Error('Raw query must include school_id filter for security');
    }

    // Ensure school_id is in params
    if (!params.includes(this.schoolId)) {
      throw new Error('Raw query params must include school_id');
    }

    return { query, params };
  }
}

module.exports = SecureQueryBuilder;















