require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🚀 Setting up AllPulse database...\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'allpulse',
    multipleStatements: true, // Allow multiple SQL statements
  };

  try {
    console.log('📋 Connecting to database...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected!\n');

    // Read schema file
    const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
    console.log('📖 Reading schema file...');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Remove the CREATE DATABASE and USE statements since we're already connected to the database
    const cleanedSchema = schema
      .replace(/CREATE DATABASE IF NOT EXISTS allpulse;?/gi, '')
      .replace(/USE allpulse;?/gi, '');

    console.log('🔨 Executing schema...');
    await connection.query(cleanedSchema);
    console.log('✅ Schema executed successfully!\n');

    // Verify tables were created
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`📊 Created ${tables.length} table(s):`);
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });

    // Check for super admin
    const [users] = await connection.execute("SELECT * FROM users WHERE role = 'superadmin'");
    if (users.length > 0) {
      console.log(`\n👤 Super Admin created:`);
      console.log(`   Email: ${users[0].email}`);
      console.log(`   Name: ${users[0].name}`);
    }

    await connection.end();
    console.log('\n✅ Database setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error setting up database:');
    console.error(`   Error Code: ${error.code || 'N/A'}`);
    console.error(`   Error Message: ${error.message}\n`);
    
    if (error.sql) {
      console.error('SQL Error:', error.sql.substring(0, 200));
    }
    
    process.exit(1);
  }
}

setupDatabase();









