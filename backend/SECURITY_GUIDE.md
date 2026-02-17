# Security Guide - Multi-Tenant Data Isolation

This guide explains the security measures implemented to ensure data isolation between schools in the ConventPulse system.

## Overview

ConventPulse uses a **shared database with application-level isolation** approach. All schools share the same database, but data is isolated using `school_id` foreign keys and security middleware.

## Security Layers

### 1. SecureQueryBuilder

A utility class that automatically ensures all queries include `school_id` filtering.

**Location:** `backend/utils/query-builder.js`

**Usage:**
```javascript
const SecureQueryBuilder = require('../utils/query-builder');

// In your route
const builder = new SecureQueryBuilder(req.user.schoolId, req.user.id);

// SELECT query
const { query, params } = builder.select(
  'students',
  ['id', 'name', 'status'],
  'status = ?',  // additional WHERE
  ['approved'],  // additional params
  'name ASC',    // ORDER BY
  50             // LIMIT
);
const [students] = await db.query(query, params);

// INSERT query (school_id automatically added)
const { query, params } = builder.insert('students', {
  name: 'John Doe',
  parent_phone: '1234567890',
  status: 'pending'
});

// UPDATE query (school_id automatically filtered)
const { query, params } = builder.update(
  'students',
  { status: 'approved' },
  'id = ?',
  [studentId]
);

// DELETE query (school_id automatically filtered)
const { query, params } = builder.delete('students', 'id = ?', [studentId]);
```

**Benefits:**
- ✅ Prevents forgetting `school_id` in queries
- ✅ Automatic `school_id` inclusion in INSERT
- ✅ Automatic `school_id` filtering in SELECT/UPDATE/DELETE
- ✅ Prevents `school_id` updates

### 2. Query Validation Middleware

Validates SQL queries before execution to prevent security issues.

**Location:** `backend/middleware/query-validator.js`

**Features:**
- Checks for forbidden patterns (DROP, TRUNCATE, etc.)
- Ensures `school_id` is in WHERE clauses
- Prevents `school_id` updates
- Validates query parameters

**Usage:**
```javascript
const { queryValidator } = require('../middleware/query-validator');

// Add to route
router.get('/students', authenticateToken, queryValidator, async (req, res) => {
  // req.validateQuery() is now available
  req.validateQuery(query, params);
  // ...
});
```

### 3. Audit Logging

Tracks all database operations for security auditing and compliance.

**Location:** `backend/utils/audit-logger.js`

**Features:**
- Logs SELECT, INSERT, UPDATE, DELETE operations
- Records user, IP address, user agent
- Stores old/new values for updates
- Queryable audit trail

**Usage:**
```javascript
const { logSelect, logInsert, logUpdate, logDelete } = require('../utils/audit-logger');

// Log SELECT
await logSelect(schoolId, userId, 'students', { status: 'approved' }, req);

// Log INSERT
await logInsert(schoolId, userId, 'students', studentId, newValues, req);

// Log UPDATE
await logUpdate(schoolId, userId, 'students', studentId, oldValues, newValues, req);

// Log DELETE
await logDelete(schoolId, userId, 'students', studentId, oldValues, req);

// Get audit logs
const { getAuditLogs } = require('../utils/audit-logger');
const logs = await getAuditLogs(schoolId, {
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  action: 'SELECT',
  limit: 100
});
```

### 4. Database Constraints

Database-level constraints ensure data integrity.

**Location:** `backend/sql/add-security-constraints.sql`

**Constraints Added:**
- CHECK constraints ensuring `school_id` is NOT NULL
- Composite indexes for performance
- Foreign key constraints (already in main schema)

**To Apply:**
```bash
mysql -h your-host -u your-user -p allpulse < backend/sql/add-security-constraints.sql
```

### 5. Security Audit Script

Automated script to check for security issues.

**Location:** `backend/scripts/audit-data-isolation.js`

**Checks:**
- Orphaned records (missing `school_id`)
- Invalid `school_id` references
- Missing indexes
- Data isolation violations
- Suspicious access patterns

**To Run:**
```bash
node backend/scripts/audit-data-isolation.js
```

## Implementation Guide

### Step 1: Apply Database Constraints

```bash
mysql -h your-host -u your-user -p allpulse < backend/sql/add-security-constraints.sql
```

### Step 2: Update Routes (Gradually)

You can update routes gradually. Two approaches:

**Option A: Use SecureQueryBuilder (Recommended)**
```javascript
const SecureQueryBuilder = require('../utils/query-builder');

router.get('/students', authenticateToken, requireAdmin, async (req, res) => {
  const builder = new SecureQueryBuilder(req.user.schoolId, req.user.id);
  const { query, params } = builder.select('students', '*', 'status = ?', ['approved']);
  const [students] = await db.query(query, params);
  res.json(students);
});
```

**Option B: Keep Current Approach (Still Secure)**
```javascript
// Current approach is fine if school_id is always included
router.get('/students', authenticateToken, requireAdmin, async (req, res) => {
  const schoolId = req.user.schoolId;
  const [students] = await db.query(
    'SELECT * FROM students WHERE school_id = ?',
    [schoolId]
  );
  res.json(students);
});
```

### Step 3: Add Audit Logging

Add audit logging to critical operations:

```javascript
const { logSelect, logInsert, logUpdate } = require('../utils/audit-logger');

// After SELECT
await logSelect(req.user.schoolId, req.user.id, 'students', {}, req);

// After INSERT
await logInsert(req.user.schoolId, req.user.id, 'students', studentId, newValues, req);

// After UPDATE
await logUpdate(req.user.schoolId, req.user.id, 'students', studentId, oldValues, newValues, req);
```

### Step 4: Run Security Audits Regularly

Set up a cron job or scheduled task:

```bash
# Daily audit
0 2 * * * node /path/to/backend/scripts/audit-data-isolation.js >> /var/log/security-audit.log
```

## Best Practices

### ✅ DO:

1. **Always use `school_id` in queries**
   ```javascript
   // ✅ Good
   WHERE school_id = ? AND status = 'approved'
   
   // ❌ Bad
   WHERE status = 'approved'
   ```

2. **Use SecureQueryBuilder for new routes**
   ```javascript
   const builder = new SecureQueryBuilder(schoolId);
   const { query, params } = builder.select('students');
   ```

3. **Log critical operations**
   ```javascript
   await logUpdate(schoolId, userId, 'students', id, oldValues, newValues, req);
   ```

4. **Run security audits regularly**
   ```bash
   node backend/scripts/audit-data-isolation.js
   ```

5. **Verify `school_id` in middleware**
   ```javascript
   if (!req.user.schoolId && req.user.role !== 'superadmin') {
     return res.status(403).json({ error: 'School context required' });
   }
   ```

### ❌ DON'T:

1. **Don't trust client-provided `school_id`**
   ```javascript
   // ❌ Bad - client can manipulate
   const schoolId = req.body.schoolId;
   
   // ✅ Good - use from authenticated user
   const schoolId = req.user.schoolId;
   ```

2. **Don't allow `school_id` updates**
   ```javascript
   // ❌ Bad
   UPDATE students SET school_id = ? WHERE id = ?
   
   // ✅ Good - SecureQueryBuilder prevents this
   ```

3. **Don't skip `school_id` in JOINs**
   ```javascript
   // ✅ Good
   SELECT * FROM students s
   JOIN classes c ON c.id = s.class_id
   WHERE s.school_id = ? AND c.school_id = ?
   ```

4. **Don't expose audit logs to non-admins**
   ```javascript
   // Only admins should access audit logs
   if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
     return res.status(403).json({ error: 'Access denied' });
   }
   ```

## Monitoring

### Check Audit Logs

```sql
-- Recent activity by school
SELECT 
  school_id,
  action,
  COUNT(*) as count
FROM audit_logs
WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY school_id, action;

-- Suspicious patterns
SELECT 
  user_id,
  COUNT(*) as query_count,
  GROUP_CONCAT(DISTINCT table_name) as tables
FROM audit_logs
WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY user_id
HAVING query_count > 1000;
```

### Security Metrics

- **Orphaned Records:** Should be 0
- **Invalid References:** Should be 0
- **Missing Indexes:** Should be 0
- **Data Isolation Violations:** Should be 0

## Troubleshooting

### Issue: "Query must include school_id filter"

**Solution:** Use SecureQueryBuilder or ensure `school_id` is in WHERE clause.

### Issue: "Cannot update school_id"

**Solution:** This is by design. `school_id` cannot be changed after creation.

### Issue: Audit logs table doesn't exist

**Solution:** Run the complete schema migration:
```bash
mysql -h your-host -u your-user -p allpulse < backend/sql/complete_schema.sql
```

### Issue: Security audit finds orphaned records

**Solution:** 
1. Identify the records
2. Either assign correct `school_id` or delete them
3. Fix the code that created them

## Migration Path

### For Existing Routes

1. **Phase 1:** Add audit logging (non-breaking)
2. **Phase 2:** Gradually migrate to SecureQueryBuilder
3. **Phase 3:** Add query validation middleware
4. **Phase 4:** Run security audits regularly

### Example Migration

**Before:**
```javascript
router.get('/students', authenticateToken, requireAdmin, async (req, res) => {
  const schoolId = req.user.schoolId;
  const [students] = await db.query(
    'SELECT * FROM students WHERE school_id = ?',
    [schoolId]
  );
  res.json(students);
});
```

**After:**
```javascript
const SecureQueryBuilder = require('../utils/query-builder');
const { logSelect } = require('../utils/audit-logger');

router.get('/students', authenticateToken, requireAdmin, async (req, res) => {
  const schoolId = req.user.schoolId;
  const userId = req.user.id;
  const builder = new SecureQueryBuilder(schoolId, userId);
  
  const { query, params } = builder.select('students');
  const [students] = await db.query(query, params);
  
  await logSelect(schoolId, userId, 'students', {}, req);
  
  res.json(students);
});
```

## Support

For security concerns or questions:
1. Review this guide
2. Check example routes in `backend/routes/example-secure-route.js`
3. Run security audit: `node backend/scripts/audit-data-isolation.js`
4. Review audit logs in database

---

**Last Updated:** 2025-01-XX
**Version:** 1.0










