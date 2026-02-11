/**
 * Security Audit Script
 * Checks for data isolation violations and security issues
 */

require('dotenv').config();
const db = require('../config/database');

async function auditDataIsolation() {
  console.log('🔍 Starting Security Audit for Data Isolation...\n');

  const issues = [];
  const warnings = [];

  try {
    // 1. Check for orphaned records (missing school_id)
    console.log('1️⃣ Checking for orphaned records (missing school_id)...');
    const tablesWithSchoolId = [
      'students', 'teachers', 'classes', 'academic_years', 'subjects',
      'homework', 'attendance', 'test_results', 'student_fees', 'notifications'
    ];

    for (const table of tablesWithSchoolId) {
      try {
        const [result] = await db.query(
          `SELECT COUNT(*) as count FROM ${table} WHERE school_id IS NULL`
        );
        
        if (result[0].count > 0) {
          issues.push({
            severity: 'HIGH',
            table,
            issue: `${result[0].count} record(s) with NULL school_id`,
            recommendation: 'All records must have a school_id. Review and fix immediately.'
          });
        }
      } catch (error) {
        if (error.message.includes("doesn't exist")) {
          warnings.push({ table, warning: 'Table does not exist' });
        } else {
          console.error(`Error checking ${table}:`, error.message);
        }
      }
    }

    // 2. Check for cross-school data access patterns
    console.log('2️⃣ Checking audit logs for suspicious patterns...');
    try {
      const [suspicious] = await db.query(`
        SELECT 
          school_id,
          user_id,
          COUNT(*) as query_count,
          GROUP_CONCAT(DISTINCT table_name) as tables_accessed
        FROM audit_logs
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY school_id, user_id
        HAVING query_count > 1000
        ORDER BY query_count DESC
        LIMIT 10
      `);

      if (suspicious.length > 0) {
        warnings.push({
          severity: 'MEDIUM',
          issue: 'High query volume detected',
          details: suspicious,
          recommendation: 'Review these users for potential abuse or inefficient queries'
        });
      }
    } catch (error) {
      if (error.message.includes("doesn't exist")) {
        warnings.push({ warning: 'Audit logs table does not exist. Run schema migration.' });
      }
    }

    // 3. Check for students with invalid school_id
    console.log('3️⃣ Checking for invalid school_id references...');
    const [invalidStudents] = await db.query(`
      SELECT s.id, s.name, s.school_id
      FROM students s
      LEFT JOIN schools sch ON s.school_id = sch.id
      WHERE s.school_id IS NOT NULL AND sch.id IS NULL
      LIMIT 10
    `);

    if (invalidStudents.length > 0) {
      issues.push({
        severity: 'HIGH',
        issue: `${invalidStudents.length} student(s) with invalid school_id`,
        details: invalidStudents,
        recommendation: 'Fix or remove these orphaned records'
      });
    }

    // 4. Check for teachers with invalid school_id
    const [invalidTeachers] = await db.query(`
      SELECT t.id, t.name, t.school_id
      FROM teachers t
      LEFT JOIN schools sch ON t.school_id = sch.id
      WHERE t.school_id IS NOT NULL AND sch.id IS NULL
      LIMIT 10
    `);

    if (invalidTeachers.length > 0) {
      issues.push({
        severity: 'HIGH',
        issue: `${invalidTeachers.length} teacher(s) with invalid school_id`,
        details: invalidTeachers,
        recommendation: 'Fix or remove these orphaned records'
      });
    }

    // 5. Check for missing indexes on school_id
    console.log('4️⃣ Checking for missing indexes on school_id...');
    const tablesToCheck = [
      'students', 'teachers', 'classes', 'academic_years', 'subjects',
      'homework', 'attendance', 'test_results', 'student_fees'
    ];

    for (const table of tablesToCheck) {
      try {
        const [indexes] = await db.query(`SHOW INDEXES FROM ${table} WHERE Column_name = 'school_id'`);
        if (indexes.length === 0) {
          warnings.push({
            severity: 'LOW',
            table,
            issue: 'Missing index on school_id',
            recommendation: `CREATE INDEX idx_school_id ON ${table}(school_id)`
          });
        }
      } catch (error) {
        // Table might not exist, skip
      }
    }

    // 6. Check for recent data isolation violations in audit logs
    console.log('5️⃣ Checking for data isolation violations...');
    try {
      const [violations] = await db.query(`
        SELECT 
          al.*,
          u.name as user_name,
          u.role,
          s.name as school_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN schools s ON al.school_id = s.id
        WHERE al.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND al.action = 'SELECT'
          AND (
            u.school_id IS NULL OR 
            u.school_id != al.school_id
          )
        ORDER BY al.created_at DESC
        LIMIT 20
      `);

      if (violations.length > 0) {
        issues.push({
          severity: 'CRITICAL',
          issue: 'Potential data isolation violations detected',
          details: violations,
          recommendation: 'Review these audit logs immediately - users may be accessing other schools\' data'
        });
      }
    } catch (error) {
      if (!error.message.includes("doesn't exist")) {
        console.error('Error checking violations:', error.message);
      }
    }

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUDIT RESULTS');
    console.log('='.repeat(60) + '\n');

    if (issues.length === 0 && warnings.length === 0) {
      console.log('✅ No security issues found!');
    } else {
      if (issues.length > 0) {
        console.log(`\n❌ ISSUES FOUND (${issues.length}):\n`);
        issues.forEach((issue, index) => {
          console.log(`${index + 1}. [${issue.severity}] ${issue.issue}`);
          if (issue.table) console.log(`   Table: ${issue.table}`);
          if (issue.recommendation) console.log(`   Recommendation: ${issue.recommendation}`);
          console.log('');
        });
      }

      if (warnings.length > 0) {
        console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
        warnings.forEach((warning, index) => {
          console.log(`${index + 1}. ${warning.issue || warning.warning}`);
          if (warning.table) console.log(`   Table: ${warning.table}`);
          if (warning.recommendation) console.log(`   Recommendation: ${warning.recommendation}`);
          console.log('');
        });
      }
    }

    console.log('='.repeat(60));
    console.log('\n✅ Audit complete!\n');

    // Return results for programmatic use
    return { issues, warnings };

  } catch (error) {
    console.error('❌ Audit error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  auditDataIsolation()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = auditDataIsolation;

