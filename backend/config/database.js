const { Pool } = require('pg');
const { buildPgSslOptions } = require('./pgSsl');
const { validatedDbSchemaFromEnv, pgSearchPathOptions } = require('./pgSchema');

let validatedSchema;
try {
  validatedSchema = validatedDbSchemaFromEnv();
} catch (e) {
  console.error('❌', e.message);
  throw e;
}

const rawPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'allpulse',
  max: 10,
  ssl: buildPgSslOptions(),
  ...pgSearchPathOptions(validatedSchema),
});

/**
 * Convert mysql2-style ? placeholders to PostgreSQL $1, $2, ...
 */
function translatePlaceholders(sql, params) {
  const values = params == null ? [] : [...params];
  let n = 0;
  const text = sql.replace(/\?/g, () => `$${++n}`);
  if (n !== values.length) {
    throw new Error(`SQL placeholder mismatch: ${n} placeholders, ${values.length} parameters`);
  }
  return { text, values };
}

function mapPgError(err) {
  if (!err || !err.code) return err;
  const c = err.code;
  if (c === '23505') err.code = 'ER_DUP_ENTRY';
  else if (c === '42P01') err.code = 'ER_NO_SUCH_TABLE';
  else if (c === '23503') err.code = 'ER_NO_REFERENCED_ROW_2';
  else if (c === '23514') err.code = 'ER_TRUNCATED_WRONG_VALUE';
  else if (c === '22001') err.code = 'ER_TRUNCATED_WRONG_VALUE';
  else if (c === '42703') err.code = 'ER_BAD_FIELD_ERROR';
  else if (c === '28P01') err.code = 'ER_ACCESS_DENIED_ERROR';
  else if (c === '3D000') err.code = 'ER_BAD_DB_ERROR';
  return err;
}

function toMysql2Tuple(pgResult) {
  const cmd = pgResult.command;
  if (cmd === 'SELECT' || cmd === 'WITH' || cmd === 'SHOW' || cmd === 'COPY') {
    return [pgResult.rows, pgResult.fields];
  }
  const header = {
    affectedRows: pgResult.rowCount || 0,
    insertId: 0,
    warningStatus: 0,
    changedRows: 0,
  };
  return [header, undefined];
}

async function runQuery(client, sql, params) {
  const { text, values } = translatePlaceholders(sql, params);
  try {
    const pgResult = await client.query(text, values);
    return toMysql2Tuple(pgResult);
  } catch (e) {
    mapPgError(e);
    throw e;
  }
}

async function queryWithIST(sql, params) {
  const client = await rawPool.connect();
  try {
    await client.query(`SET TIME ZONE 'Asia/Kolkata'`);
    return await runQuery(client, sql, params);
  } finally {
    client.release();
  }
}

async function executeWithIST(sql, params) {
  return queryWithIST(sql, params);
}

function wrapConnection(client) {
  return {
    query: async (sql, params) => {
      return runQuery(client, sql, params);
    },
    beginTransaction: async () => {
      await client.query('BEGIN');
    },
    commit: async () => {
      await client.query('COMMIT');
    },
    rollback: async () => {
      await client.query('ROLLBACK');
    },
    release: () => client.release(),
  };
}

const poolExport = {
  getConnection: async () => {
    const client = await rawPool.connect();
    await client.query(`SET TIME ZONE 'Asia/Kolkata'`);
    return wrapConnection(client);
  },
  query: queryWithIST,
  execute: executeWithIST,
};

poolExport
  .getConnection()
  .then((connection) => {
    const schemaNote = validatedSchema ? `, schema: ${validatedSchema}` : '';
    console.log(`✅ Database connected successfully (PostgreSQL, Asia/Kolkata${schemaNote})`);
    connection.release();
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
  });

module.exports = poolExport;
