/**
 * Migration Script: Upgrade Notifications System
 * 
 * This script safely migrates the notifications table to add:
 * - event_date (DATE)
 * - scheduled_at (DATETIME)
 * - whatsapp_enabled (BOOLEAN)
 * - created_by (VARCHAR(36))
 * 
 * And creates:
 * - notification_classes mapping table
 * 
 * Usage:
 *   node backend/scripts/migrate-notifications-upgrade.js
 * 
 * Make sure your .env file has correct database credentials
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'allpulse',
  multipleStatements: true
};

async function checkColumnExists(connection, tableName, columnName) {
  try {
    const [rows] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = ? 
       AND COLUMN_NAME = ?`,
      [dbConfig.database, tableName, columnName]
    );
    return rows.length > 0;
  } catch (error) {
    console.error(`Error checking column ${columnName}:`, error.message);
    return false;
  }
}

async function checkTableExists(connection, tableName) {
  try {
    const [rows] = await connection.query(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = ?`,
      [dbConfig.database, tableName]
    );
    return rows.length > 0;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error.message);
    return false;
  }
}

async function migrateNotifications() {
  console.log('🔌 Connecting to database...');
  console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log(`   User: ${dbConfig.user}\n`);

  const connection = await mysql.createConnection(dbConfig);

  try {
    await connection.beginTransaction();

    console.log('🌱 Starting notifications upgrade migration...\n');

    // Step 1: Add new columns to notifications table
    console.log('📝 Step 1: Adding new columns to notifications table...');
    
    const columnsToAdd = [
      { name: 'event_date', type: 'DATE NULL', comment: 'Event date for future reminders' },
      { name: 'scheduled_at', type: 'DATETIME NULL', comment: 'Scheduled sending time' },
      { name: 'whatsapp_enabled', type: 'BOOLEAN DEFAULT FALSE', comment: 'Flag for WhatsApp integration' },
      { name: 'created_by', type: 'VARCHAR(36) NULL', comment: 'Admin user who created the notification' }
    ];

    for (const column of columnsToAdd) {
      const exists = await checkColumnExists(connection, 'notifications', column.name);
      if (exists) {
        console.log(`   ⏭️  Column '${column.name}' already exists, skipping...`);
      } else {
        await connection.query(
          `ALTER TABLE notifications ADD COLUMN ${column.name} ${column.type} COMMENT '${column.comment}'`
        );
        console.log(`   ✅ Added column '${column.name}'`);
      }
    }

    // Step 2: Add foreign key for created_by
    console.log('\n📝 Step 2: Adding foreign key constraint...');
    try {
      // Check if foreign key already exists
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME 
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'notifications' 
         AND CONSTRAINT_NAME = 'fk_notifications_created_by'`,
        [dbConfig.database]
      );

      if (fkRows.length > 0) {
        console.log('   ⏭️  Foreign key already exists, skipping...');
      } else {
        await connection.query(
          `ALTER TABLE notifications 
           ADD CONSTRAINT fk_notifications_created_by 
           FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`
        );
        console.log('   ✅ Added foreign key constraint');
      }
    } catch (error) {
      if (error.code === 'ER_DUP_KEY' || error.code === 'ER_DUP_KEYNAME') {
        console.log('   ⏭️  Foreign key already exists, skipping...');
      } else {
        throw error;
      }
    }

    // Step 3: Create notification_classes mapping table
    console.log('\n📝 Step 3: Creating notification_classes mapping table...');
    const tableExists = await checkTableExists(connection, 'notification_classes');
    
    if (tableExists) {
      console.log('   ⏭️  Table notification_classes already exists, skipping...');
    } else {
      await connection.query(`
        CREATE TABLE notification_classes (
          id VARCHAR(36) PRIMARY KEY,
          notification_id VARCHAR(36) NOT NULL,
          class_id VARCHAR(36) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_notification_id (notification_id),
          INDEX idx_class_id (class_id),
          FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
          UNIQUE KEY unique_notification_class (notification_id, class_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✅ Created notification_classes table');
    }

    await connection.commit();

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verification:');
    console.log('   Run these queries to verify:');
    console.log('   - DESCRIBE notifications;');
    console.log('   - DESCRIBE notification_classes;');
    console.log('   - SHOW TABLES LIKE \'notification_classes\';');

  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration
migrateNotifications()
  .then(() => {
    console.log('\n✨ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed');
    process.exit(1);
  });


