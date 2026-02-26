const mysql = require('mysql2/promise');

const IST_OFFSET = '+05:30';

const rawPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'allpulse',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Wrap getConnection so every connection uses IST
const pool = {
  getConnection: async () => {
    const conn = await rawPool.getConnection();
    await conn.query(`SET time_zone = ?`, [IST_OFFSET]);
    return conn;
  },
  query: (...args) => rawPool.query(...args),
  execute: (...args) => rawPool.execute(...args)
};

// Ensure first connection has IST set (rawPool.query uses internal getConnection, so we set on first use via getConnection wrapper - but query goes to rawPool. So we need to wrap query too.)
// Actually rawPool.query() gets a connection from the pool without going through our wrapper. So we must wrap query and execute to use a connection that had SET time_zone run. The only way is to have getConnection set it and then have all code use getConnection. But the codebase uses pool.query() everywhere. So we need to override query to do: getConnection (our wrapper), then conn.query, then release. Let me do that.
async function queryWithIST(...args) {
  const conn = await rawPool.getConnection();
  try {
    await conn.query(`SET time_zone = ?`, [IST_OFFSET]);
    return await conn.query(...args);
  } finally {
    conn.release();
  }
}
async function executeWithIST(...args) {
  const conn = await rawPool.getConnection();
  try {
    await conn.query(`SET time_zone = ?`, [IST_OFFSET]);
    return await conn.execute(...args);
  } finally {
    conn.release();
  }
}

const poolExport = {
  getConnection: pool.getConnection,
  query: queryWithIST,
  execute: executeWithIST
};

// Test connection on startup
poolExport.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully (IST)');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

module.exports = poolExport;
