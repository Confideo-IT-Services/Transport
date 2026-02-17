require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupCompleteSchema() {
  console.log('🚀 Setting up ConventPulse Complete Database Schema...\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'allpulse',
    multipleStatements: true, // Allow multiple SQL statements
  };

  console.log('📋 Connection Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Database: ${config.database}\n`);

  // Expected tables from complete_schema.sql
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
    'id_card_templates'
  ];

  try {
    // First, connect without database to create it if needed
    console.log('📖 Step 1: Checking database connection...');
    const connectionWithoutDB = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      multipleStatements: true,
    });
    console.log('✅ Connected to MySQL server!\n');

    // Check if database exists, create if not
    const [databases] = await connectionWithoutDB.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [config.database]
    );

    if (databases.length === 0) {
      console.log(`📝 Database '${config.database}' doesn't exist. Creating...`);
      await connectionWithoutDB.execute(`CREATE DATABASE IF NOT EXISTS ${config.database}`);
      console.log(`✅ Database '${config.database}' created!\n`);
    } else {
      console.log(`✅ Database '${config.database}' already exists.\n`);
    }
    await connectionWithoutDB.end();

    // Now connect to the specific database
    console.log('📖 Step 2: Connecting to database...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to database!\n');

    // Read complete schema file
    const schemaPath = path.join(__dirname, 'sql', 'complete_schema.sql');
    console.log('📖 Step 3: Reading complete schema file...');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file loaded!\n');
    
    // Remove CREATE DATABASE and USE statements since we're already connected
    const cleanedSchema = schema
      .replace(/CREATE DATABASE IF NOT EXISTS allpulse;?/gi, '')
      .replace(/USE allpulse;?/gi, '')
      .trim();
    
    console.log('🔨 Step 4: Executing complete schema...');
    console.log('   This may take a few moments...\n');
    
    await connection.query(cleanedSchema);
    console.log('✅ Schema executed successfully!\n');

    // Verify tables were created
    console.log('📊 Step 5: Verifying tables...\n');
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(table => Object.values(table)[0]);
    
    console.log(`✅ Found ${tableNames.length} table(s) in database:\n`);
    tableNames.forEach((tableName, index) => {
      const exists = expectedTables.includes(tableName);
      const status = exists ? '✅' : '⚠️ ';
      console.log(`   ${status} ${index + 1}. ${tableName}`);
    });

    // Check for missing expected tables
    const missingTables = expectedTables.filter(table => !tableNames.includes(table));
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Warning: ${missingTables.length} expected table(s) not found:`);
      missingTables.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log(`\n✅ All ${expectedTables.length} expected tables are present!`);
    }

    // Check for super admin
    console.log('\n👤 Step 6: Checking super admin...');
    const [users] = await connection.execute("SELECT * FROM users WHERE role = 'superadmin'");
    if (users.length > 0) {
      console.log('✅ Super Admin found:');
      console.log(`   Email: ${users[0].email}`);
      console.log(`   Name: ${users[0].name}`);
      console.log(`   ID: ${users[0].id}`);
    } else {
      console.log('⚠️  No super admin found (this is normal if using UUID() in INSERT)');
    }

    await connection.end();
    console.log('\n✅ Complete database setup completed successfully!');
    console.log('📝 You can now start using the ConventPulse application.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error setting up database:');
    console.error(`   Error Code: ${error.code || 'N/A'}`);
    console.error(`   Error Message: ${error.message}\n`);
    
    if (error.sql) {
      console.error('SQL Error (first 300 chars):');
      console.error(`   ${error.sql.substring(0, 300)}...\n`);
    }
    
    // Provide helpful troubleshooting tips
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Tip: Check your database credentials in .env file');
      console.error('   - Verify DB_USER and DB_PASSWORD are correct');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(`💡 Tip: Database '${config.database}' doesn't exist`);
      console.error('   - The script will try to create it, but you may need to create it manually');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Tip: Cannot connect to MySQL server');
      console.error('   - Make sure MySQL server is running');
      console.error('   - Check DB_HOST and DB_PORT in your .env file');
      console.error('   - For AWS RDS, use the endpoint URL as DB_HOST');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.error('💡 Tip: Cannot reach the database host');
      console.error('   - Check if DB_HOST is correct');
      console.error('   - Verify network connectivity');
      console.error('   - For AWS RDS, check security groups');
    }
    
    process.exit(1);
  }
}

setupCompleteSchema();