// Script to setup timetable tables
// This will create the timetable tables if they don't exist

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupTimetableTables() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  try {
    console.log('📋 Setting up timetable tables...\n');
    const connection = await mysql.createConnection(config);

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'sql', 'timetable_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Remove comments and split by semicolons
    const statements = sql
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('--') && line !== 'USE allpulse;')
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length > 10); // Filter out very short statements

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          await connection.query(statement + ';');
          const tableName = statement.match(/CREATE TABLE.*?`?(\w+)`?/i)?.[1] || 
                           statement.match(/CREATE TABLE.*?(\w+)/i)?.[1] || 
                           'statement';
          console.log(`✅ [${i + 1}/${statements.length}] Created table: ${tableName}`);
        } catch (err) {
          // Ignore "table already exists" errors
          if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.message.includes('already exists')) {
            const tableName = statement.match(/CREATE TABLE.*?`?(\w+)`?/i)?.[1] || 
                             statement.match(/CREATE TABLE.*?(\w+)/i)?.[1] || 
                             'table';
            console.log(`ℹ️  [${i + 1}/${statements.length}] Table '${tableName}' already exists, skipping...`);
          } else {
            console.error(`❌ [${i + 1}/${statements.length}] Error:`, err.message);
            console.error('   Statement:', statement.substring(0, 100) + '...');
          }
        }
      }
    }

    await connection.end();
    console.log('\n✅ Timetable tables setup complete!');
    console.log('📝 You can now use the timetable feature.');
  } catch (error) {
    console.error('❌ Setup error:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Database connection is configured in .env');
    console.error('   2. Database "allpulse" exists');
    console.error('   3. Main schema.sql has been run first');
    process.exit(1);
  }
}

setupTimetableTables();

