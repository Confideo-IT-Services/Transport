/**
 * Audit Logger - Tracks all database operations for security and compliance
 * Logs: SELECT, INSERT, UPDATE, DELETE operations with context
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Log a database operation to audit trail
 * @param {Object} options - Audit log options
 * @param {string} options.schoolId - School ID
 * @param {string} options.userId - User ID performing the action
 * @param {string} options.action - Action type (SELECT, INSERT, UPDATE, DELETE)
 * @param {string} options.tableName - Table name
 * @param {string} options.recordId - Record ID (if applicable)
 * @param {Object} options.oldValues - Old values (for UPDATE)
 * @param {Object} options.newValues - New values (for INSERT/UPDATE)
 * @param {Object} options.request - Express request object (optional)
 * @returns {Promise<void>}
 */
async function logAudit({
  schoolId,
  userId,
  action,
  tableName,
  recordId = null,
  oldValues = null,
  newValues = null,
  request = null,
}) {
  try {
    const auditId = uuidv4();
    const ipAddress = request?.ip || request?.connection?.remoteAddress || null;
    const userAgent = request?.headers?.['user-agent'] || null;

    await db.query(
      `INSERT INTO audit_logs (
        id, school_id, user_id, action, table_name, record_id,
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        auditId,
        schoolId,
        userId,
        action.toUpperCase(),
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (error) {
    // Don't throw - audit logging should never break the application
    console.error('Audit logging error:', error);
  }
}

/**
 * Log SELECT operation (read access)
 */
async function logSelect(schoolId, userId, tableName, filters = {}, request = null) {
  return logAudit({
    schoolId,
    userId,
    action: 'SELECT',
    tableName,
    newValues: filters,
    request,
  });
}

/**
 * Log INSERT operation
 */
async function logInsert(schoolId, userId, tableName, recordId, newValues, request = null) {
  return logAudit({
    schoolId,
    userId,
    action: 'INSERT',
    tableName,
    recordId,
    newValues,
    request,
  });
}

/**
 * Log UPDATE operation
 */
async function logUpdate(schoolId, userId, tableName, recordId, oldValues, newValues, request = null) {
  return logAudit({
    schoolId,
    userId,
    action: 'UPDATE',
    tableName,
    recordId,
    oldValues,
    newValues,
    request,
  });
}

/**
 * Log DELETE operation
 */
async function logDelete(schoolId, userId, tableName, recordId, oldValues, request = null) {
  return logAudit({
    schoolId,
    userId,
    action: 'DELETE',
    tableName,
    recordId,
    oldValues,
    request,
  });
}

/**
 * Get audit logs for a school
 * @param {string} schoolId - School ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
async function getAuditLogs(schoolId, options = {}) {
  const {
    startDate = null,
    endDate = null,
    action = null,
    tableName = null,
    userId = null,
    limit = 100,
    offset = 0,
  } = options;

  let query = `
    SELECT * FROM audit_logs 
    WHERE school_id = ?
  `;
  const params = [schoolId];

  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  if (action) {
    query += ' AND action = ?';
    params.push(action.toUpperCase());
  }

  if (tableName) {
    query += ' AND table_name = ?';
    params.push(tableName);
  }

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [logs] = await db.query(query, params);
  return logs;
}

/**
 * Get audit statistics for a school
 * @param {string} schoolId - School ID
 * @param {string} startDate - Start date (optional)
 * @param {string} endDate - End date (optional)
 * @returns {Promise<Object>}
 */
async function getAuditStats(schoolId, startDate = null, endDate = null) {
  let query = `
    SELECT 
      action,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT table_name) as tables_accessed
    FROM audit_logs
    WHERE school_id = ?
  `;
  const params = [schoolId];

  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY action';

  const [stats] = await db.query(query, params);
  return stats;
}

module.exports = {
  logAudit,
  logSelect,
  logInsert,
  logUpdate,
  logDelete,
  getAuditLogs,
  getAuditStats,
};


