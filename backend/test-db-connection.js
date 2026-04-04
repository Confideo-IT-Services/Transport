require('dotenv').config();
const { Client } = require('pg');
const { buildPgSslOptions } = require('./config/pgSsl');
const {
  validatedDbSchemaFromEnv,
  pgSearchPathOptions,
  getPgCatalogSchemaName,
} = require('./config/pgSchema');

let schemaOpts = {};
try {
  schemaOpts = pgSearchPathOptions(validatedDbSchemaFromEnv());
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}

async function testConnection() {
  console.log('🔍 Testing database connection...\n');

  const catalogSchema = getPgCatalogSchemaName();

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'allpulse',
    connectionTimeoutMillis: 10000,
    ssl: buildPgSslOptions(),
    ...schemaOpts,
  };

  console.log('📋 Connection Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   DB_SCHEMA (catalog): ${catalogSchema}`);
  console.log(`   Password: ${config.password ? '***' + config.password.slice(-2) : '(empty)'}\n`);

  const client = new Client(config);

  try {
    console.log('⏳ Attempting to connect...');
    await client.connect();

    console.log('✅ SUCCESS! Database connection established!\n');

    console.log('🧪 Testing query...');
    const { rows } = await client.query(
      'SELECT 1 AS test, current_database() AS current_db, NOW() AS server_time'
    );
    console.log('✅ Query successful!');
    console.log('   Result:', rows[0]);

    try {
      const sp = await client.query('SHOW search_path');
      console.log('   search_path:', sp.rows[0]?.search_path);

      const tablesRes = await client.query(
        `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1 ORDER BY tablename`,
        [catalogSchema]
      );
      console.log(`\n📊 Found ${tablesRes.rows.length} table(s) in schema '${catalogSchema}':`);
      tablesRes.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.tablename}`);
      });
    } catch (err) {
      console.log(`\n⚠️  Could not list tables: ${err.message}`);
    }

    await client.end();
    console.log('\n✅ Connection closed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FAILED! Database connection error:');
    console.error(`   Error Code: ${error.code || 'N/A'}`);
    console.error(`   Error Message: ${error.message}\n`);

    console.log('💡 Troubleshooting suggestions:');
    if (error.code === 'ECONNREFUSED') {
      console.log('   - PostgreSQL is not reachable on the specified host/port');
      console.log('   - Verify DB_HOST and DB_PORT in your .env file');
    } else if (error.code === '28P01') {
      console.log('   - Invalid username or password');
      console.log('   - Check DB_USER and DB_PASSWORD in your .env file');
    } else if (error.code === '3D000') {
      console.log('   - Database does not exist');
      console.log('   - Create the database or update DB_NAME in your .env file');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.log('   - Cannot reach the database host');
      console.log('   - For AWS RDS, use the endpoint URL as DB_HOST and security groups allow access');
    } else {
      console.log('   - Check your .env file configuration');
      console.log('   - Ensure PostgreSQL is running and credentials are correct');
    }

    try {
      await client.end();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  }
}

testConnection();
