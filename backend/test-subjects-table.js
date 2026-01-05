// Test script to check if subjects table exists
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTable() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  try {
    console.log('🔍 Checking subjects table...\n');
    const connection = await mysql.createConnection(config);

    const [rows] = await connection.query("SHOW TABLES LIKE 'subjects'");
    if (rows.length > 0) {
      console.log('✅ Subjects table exists');
      
      // Check structure
      const [columns] = await connection.query("DESCRIBE subjects");
      console.log('\n📋 Table structure:');
      columns.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });
    } else {
      console.log('❌ Subjects table does NOT exist');
      console.log('\n📝 Run: node setup-subjects-table.js');
    }

    await connection.end();
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  }
}

checkTable();




