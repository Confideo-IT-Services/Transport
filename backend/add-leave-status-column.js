require('dotenv').config();
const mysql = require('mysql2/promise');

async function addStatusColumn() {
  console.log('🔧 Adding status column to teacher_leaves table...\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'allpulse',
  };

  try {
    console.log('📋 Connecting to database...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected!\n');

    // Check if status column exists
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'teacher_leaves' 
       AND COLUMN_NAME = 'status'`,
      [config.database]
    );

    if (columns.length > 0) {
      console.log('✅ Status column already exists!\n');
    } else {
      console.log('🔨 Adding status column...');
      await connection.execute(
        `ALTER TABLE teacher_leaves 
         ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER reason`
      );
      console.log('✅ Status column added successfully!\n');

      // Update existing leaves to 'approved' if they don't have status (for backward compatibility)
      await connection.execute(
        `UPDATE teacher_leaves SET status = 'approved' WHERE status IS NULL OR status = ''`
      );
      console.log('✅ Updated existing leaves to approved status\n');
    }

    // Add index for status if it doesn't exist
    try {
      await connection.execute(
        `CREATE INDEX idx_leave_status ON teacher_leaves(status)`
      );
      console.log('✅ Index created on status column\n');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Index already exists\n');
      } else {
        throw error;
      }
    }

    await connection.end();
    console.log('✅ Done! Status column is ready.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:');
    console.error('Message:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  }
}

addStatusColumn();
