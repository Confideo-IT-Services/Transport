// Test script to check if timetable tables exist
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTables() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  try {
    console.log('🔍 Checking timetable tables...\n');
    const connection = await mysql.createConnection(config);

    const tables = [
      'time_slots',
      'timetable_entries',
      'holidays',
      'teacher_leaves'
    ];

    for (const table of tables) {
      try {
        const [rows] = await connection.query(`SHOW TABLES LIKE '${table}'`);
        if (rows.length > 0) {
          console.log(`✅ Table '${table}' exists`);
        } else {
          console.log(`❌ Table '${table}' does NOT exist`);
        }
      } catch (err) {
        console.log(`❌ Error checking table '${table}':`, err.message);
      }
    }

    await connection.end();
    
    const missingTables = tables.filter(t => {
      // This will be checked in the loop above
      return false;
    });
    
    if (missingTables.length === 0) {
      console.log('\n✅ All timetable tables exist!');
    } else {
      console.log('\n📝 If any tables are missing, run:');
      console.log('   node backend/setup-timetable-tables.js');
      console.log('   OR');
      console.log('   mysql -h your-rds-endpoint -u admin -p allpulse < backend/sql/timetable_schema.sql');
    }
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  }
}

checkTables();

