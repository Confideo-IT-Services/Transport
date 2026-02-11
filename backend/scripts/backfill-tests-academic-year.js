// backend/scripts/backfill-tests-academic-year.js
// Backfill script to assign academic_year_id to existing tests
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

// Use same database config as backend
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'schoolpulse',
};

async function backfillTestsAcademicYear() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('🔄 Starting backfill of academic_year_id for existing tests...\n');

    // Step 1: Get all tests without academic_year_id
    const [testsWithoutYear] = await connection.query(
      `SELECT t.id, t.test_date, t.school_id, t.class_id
       FROM tests t
       WHERE t.academic_year_id IS NULL`
    );

    console.log(`📊 Found ${testsWithoutYear.length} tests without academic_year_id\n`);

    if (testsWithoutYear.length === 0) {
      console.log('✅ All tests already have academic_year_id. Nothing to backfill.');
      return;
    }

    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Step 2: For each test, find matching academic year by date
    for (const test of testsWithoutYear) {
      try {
        if (!test.test_date) {
          console.log(`⚠️  Test ${test.id} has no test_date. Skipping...`);
          skipped++;
          continue;
        }

        // Find academic year where test_date falls between start_date and end_date
        const [matchingYears] = await connection.query(
          `SELECT id, name, start_date, end_date
           FROM academic_years
           WHERE school_id = ?
             AND ? BETWEEN start_date AND end_date
           ORDER BY start_date DESC
           LIMIT 1`,
          [test.school_id, test.test_date]
        );

        if (matchingYears.length > 0) {
          const academicYearId = matchingYears[0].id;
          await connection.query(
            'UPDATE tests SET academic_year_id = ? WHERE id = ?',
            [academicYearId, test.id]
          );
          updated++;
          console.log(`✅ Updated test ${test.id} → Academic Year: ${matchingYears[0].name}`);
        } else {
          // Fallback: Use currently active academic year for that school
          const [activeYear] = await connection.query(
            `SELECT id, name FROM academic_years
             WHERE school_id = ? AND status = 'active'
             LIMIT 1`,
            [test.school_id]
          );

          if (activeYear.length > 0) {
            await connection.query(
              'UPDATE tests SET academic_year_id = ? WHERE id = ?',
              [activeYear[0].id, test.id]
            );
            updated++;
            console.log(`⚠️  Test ${test.id} (date: ${test.test_date}) → Fallback to active year: ${activeYear[0].name}`);
          } else {
            console.log(`❌ Test ${test.id} (date: ${test.test_date}) → No matching academic year found. Skipping.`);
            skipped++;
            errors.push({
              testId: test.id,
              testDate: test.test_date,
              reason: 'No matching academic year found'
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error updating test ${test.id}:`, error.message);
        errors.push({
          testId: test.id,
          error: error.message
        });
        skipped++;
      }
    }

    console.log(`\n📊 Backfill Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    if (errors.length > 0) {
      console.log(`   ❌ Errors: ${errors.length}`);
      console.log('\nErrors:', errors);
    }

    // Step 3: Verify all tests have academic_year_id
    const [remaining] = await connection.query(
      'SELECT COUNT(*) as count FROM tests WHERE academic_year_id IS NULL'
    );

    if (remaining[0].count > 0) {
      console.log(`\n⚠️  Warning: ${remaining[0].count} tests still have NULL academic_year_id`);
      console.log('   You may need to create academic years or manually update these tests.');
    } else {
      console.log('\n✅ All tests now have academic_year_id!');
      console.log('\n📝 Next step: Run the final migration to make the column NOT NULL:');
      console.log('   ALTER TABLE tests MODIFY COLUMN academic_year_id VARCHAR(36) NOT NULL;');
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the backfill
backfillTestsAcademicYear()
  .then(() => {
    console.log('\n✅ Backfill script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill script failed:', error);
    process.exit(1);
  });

