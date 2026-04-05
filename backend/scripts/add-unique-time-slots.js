require('dotenv').config();
const db = require('../config/database');

async function run() {
  try {
    console.log('🔎 Checking for duplicate time_slots (exact duplicates)...');

    // Count groups that have duplicates
    const [groups] = await db.query(
      `SELECT COUNT(*) as dup_groups FROM (
         SELECT 1 FROM time_slots
         GROUP BY school_id, start_time, end_time, type
         HAVING COUNT(*) > 1
       ) t`,
      []
    );

    const dupGroups = groups[0] && groups[0].dup_groups ? parseInt(groups[0].dup_groups, 10) : 0;
    console.log('Found duplicate groups:', dupGroups);

    if (dupGroups > 0) {
      console.log('➡️ Removing exact duplicates and keeping one row per (school_id, start_time, end_time, type)...');
      // Delete duplicates keeping the first row (ordered by created_at, id)
      await db.query(
        `WITH duplicates AS (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY school_id, start_time, end_time, type ORDER BY created_at NULLS LAST, id) as rn
           FROM time_slots
         )
         DELETE FROM time_slots WHERE id IN (SELECT id FROM duplicates WHERE rn > 1)`
      );
      console.log('✅ Duplicate rows removed');
    } else {
      console.log('No duplicate rows found');
    }

    console.log('\n➕ Creating unique index on (school_id, start_time, end_time, type) concurrently');
    try {
      // CREATE INDEX CONCURRENTLY cannot run inside a transaction; db.query uses a fresh client and will not wrap a transaction here
      await db.query(
        `CREATE UNIQUE INDEX CONCURRENTLY unique_slot_school_times ON time_slots (school_id, start_time, end_time, type)`
      );
      console.log('✅ Unique index created: unique_slot_school_times');
    } catch (e) {
      // If index already exists, ignore
      if (e.code === 'ER_DUP_ENTRY' || (e.message && e.message.includes('already exists'))) {
        console.log('Index already exists or concurrent creation collision — skipping');
      } else {
        throw e;
      }
    }

    console.log('\nAll done.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  }
}

run();
