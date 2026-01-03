require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'allpulse',
    connectTimeout: 10000, // 10 seconds
    connectionLimit: 1,
  };

  console.log('📋 Connection Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   Password: ${config.password ? '***' + config.password.slice(-2) : '(empty)'}\n`);

  try {
    console.log('⏳ Attempting to connect...');
    const connection = await mysql.createConnection(config);
    
    console.log('✅ SUCCESS! Database connection established!\n');
    
    // Test a simple query
    console.log('🧪 Testing query...');
    const [rows] = await connection.execute('SELECT 1 as test, DATABASE() as current_db, NOW() as server_time');
    console.log('✅ Query successful!');
    console.log('   Result:', rows[0]);
    
    // Check if database exists and show tables
    try {
      const [tables] = await connection.execute('SHOW TABLES');
      console.log(`\n📊 Found ${tables.length} table(s) in database '${config.database}':`);
      tables.forEach((table, index) => {
        const tableName = Object.values(table)[0];
        console.log(`   ${index + 1}. ${tableName}`);
      });
    } catch (err) {
      console.log(`\n⚠️  Could not list tables: ${err.message}`);
      console.log('   This might mean the database schema hasn\'t been created yet.');
    }
    
    await connection.end();
    console.log('\n✅ Connection closed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FAILED! Database connection error:');
    console.error(`   Error Code: ${error.code || 'N/A'}`);
    console.error(`   Error Message: ${error.message}\n`);
    
    // Provide helpful suggestions
    console.log('💡 Troubleshooting suggestions:');
    if (error.code === 'ECONNREFUSED') {
      console.log('   - MySQL server is not running on the specified host/port');
      console.log('   - Check if MySQL service is started');
      console.log('   - Verify the host and port in your .env file');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('   - Invalid username or password');
      console.log('   - Check DB_USER and DB_PASSWORD in your .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('   - Database does not exist');
      console.log('   - Create the database or update DB_NAME in your .env file');
      console.log('   - Run: CREATE DATABASE allpulse;');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.log('   - Cannot reach the database host');
      console.log('   - Check if DB_HOST is correct (for AWS RDS, use the endpoint URL)');
      console.log('   - Verify network connectivity and security groups');
    } else {
      console.log('   - Check your .env file configuration');
      console.log('   - Ensure MySQL server is running');
      console.log('   - Verify database credentials');
    }
    
    process.exit(1);
  }
}

testConnection();

