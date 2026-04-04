const fs = require('fs');
const path = require('path');

/**
 * TLS options for node-postgres (pg) when connecting to PostgreSQL over SSL.
 *
 * ## AWS RDS — where to get the CA bundle
 *
 * Use Amazon’s combined bundle so all RDS regions / CA generations verify correctly:
 *
 *   https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
 *
 * Save it on disk (e.g. `backend/certs/rds-global-bundle.pem`) and set:
 *
 *   DB_SSL=true
 *   DB_SSL_CA_PATH=certs/rds-global-bundle.pem
 *
 * Official docs (download links + rotation notes):
 *   https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
 *
 * ## Environment
 *
 *   DB_SSL                     - `true`, `1`, or `require` to enable TLS
 *   DB_SSL_CA_PATH             - Path to PEM bundle (absolute or relative to process.cwd())
 *   DB_SSL_CA_FILE             - Alias for DB_SSL_CA_PATH
 *   DB_SSL_REJECT_UNAUTHORIZED - Set to `false` only for emergencies (disables verification)
 *
 * Schema (non-default namespace): see `pgSchema.js` / DB_SCHEMA (search_path).
 */

function buildPgSslOptions() {
  const v = process.env.DB_SSL;
  const sslEnabled = v === 'true' || v === '1' || v === 'require';
  if (!sslEnabled) {
    return undefined;
  }

  const caPathRaw = process.env.DB_SSL_CA_PATH || process.env.DB_SSL_CA_FILE;
  const ssl = {};

  if (caPathRaw) {
    const caPath = path.isAbsolute(caPathRaw)
      ? caPathRaw
      : path.resolve(process.cwd(), caPathRaw);
    if (!fs.existsSync(caPath)) {
      throw new Error(
        `DB_SSL_CA_PATH file not found: ${caPath}\n` +
          'Download AWS RDS bundle: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem'
      );
    }
    ssl.ca = fs.readFileSync(caPath, 'utf8');
  }

  ssl.rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

  return ssl;
}

module.exports = { buildPgSslOptions };
