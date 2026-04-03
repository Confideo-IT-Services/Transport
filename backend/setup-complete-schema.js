/**
 * PostgreSQL: verifies connectivity and lists core tables.
 * Schema must be applied separately (e.g. migrated RDS). The MySQL `complete_schema.sql`
 * file is not executed here.
 */
require('dotenv').config();
const { Client } = require('pg');

function buildSslOption() {
  const v = process.env.DB_SSL;
  if (v === 'true' || v === '1' || v === 'require') {
    return { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
  }
  return undefined;
}

async function setupCompleteSchema() {
  console.log('🚀 ConventPulse database verification (PostgreSQL)\n');

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'allpulse',
    ssl: buildSslOption(),
  };

  console.log('📋 Connection Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Database: ${config.database}\n`);

  const expectedTables = [
    'schools',
    'users',
    'academic_years',
    'subjects',
    'teachers',
    'classes',
    'students',
    'registration_links',
    'time_slots',
    'timetable_entries',
    'holidays',
    'teacher_leaves',
    'attendance',
    'teacher_attendance',
    'homework',
    'homework_submissions',
    'tests',
    'test_subjects',
    'test_results',
    'fee_categories',
    'fee_structure',
    'student_fees',
    'fee_payments',
    'notifications',
    'notification_recipients',
    'id_card_templates',
  ];

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL.\n');

    const { rows: tables } = await client.query(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tableNames = tables.map((t) => t.tablename);

    console.log(`📊 Found ${tableNames.length} table(s) in schema public:\n`);
    tableNames.forEach((tableName, index) => {
      const exists = expectedTables.includes(tableName);
      const status = exists ? '✅' : '⚠️ ';
      console.log(`   ${status} ${index + 1}. ${tableName}`);
    });

    const missingTables = expectedTables.filter((t) => !tableNames.includes(t));
    if (missingTables.length > 0) {
      console.log(`\n⚠️  ${missingTables.length} expected table(s) not found:`);
      missingTables.forEach((t) => console.log(`   - ${t}`));
    } else {
      console.log(`\n✅ All ${expectedTables.length} expected tables are present!`);
    }

    const { rows: users } = await client.query(
      "SELECT id, email, name FROM users WHERE role = 'superadmin' LIMIT 5"
    );
    console.log('\n👤 Super admin check:');
    if (users.length > 0) {
      console.log(`   Found ${users.length} super admin user(s) (showing first).`);
      console.log(`   Email: ${users[0].email}`);
    } else {
      console.log('   ⚠️  No super admin user found.');
    }

    await client.end();
    console.log('\n✅ Verification completed.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:');
    console.error(`   ${error.message}\n`);

    if (error.code === '28P01') {
      console.error('💡 Check DB_USER and DB_PASSWORD in .env');
    } else if (error.code === '3D000') {
      console.error(`💡 Database '${config.database}' does not exist — create it or set DB_NAME`);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.error('💡 Check DB_HOST / network / AWS security groups for RDS');
    }

    try {
      await client.end();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  }
}

setupCompleteSchema();
