require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createMissingTable() {
  console.log('🔧 Creating teacher_attendance table...\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'allpulse',
    multipleStatements: true,
  };

  try {
    console.log('📋 Connecting to database...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected!\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'sql', 'create_teacher_attendance.sql');
    console.log('📖 Reading SQL file...');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔨 Creating teacher_attendance table...');
    await connection.query(sql);
    console.log('✅ Table created successfully!\n');

    // Verify table was created
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'teacher_attendance'"
    );
    
    if (tables.length > 0) {
      console.log('✅ Verification: teacher_attendance table exists!\n');
      
      // Show table structure
      const [columns] = await connection.execute(
        "DESCRIBE teacher_attendance"
      );
      console.log('📊 Table structure:');
      console.table(columns);
    } else {
      console.log('⚠️  Warning: Table verification failed');
    }

    await connection.end();
    console.log('\n✅ Done! You can now try checking in again.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating table:');
    console.error('Message:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

createMissingTable();



