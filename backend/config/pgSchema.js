/**
 * Optional PostgreSQL schema (namespace) for app tables — e.g. schoolpulse instead of public.
 *
 * Sets libpq startup option search_path so unqualified names (users, schools, …) resolve correctly.
 *
 * Env:
 *   DB_SCHEMA  - Identifier only: letter/underscore start, then letters, digits, underscores.
 *                Omit or leave empty to use default search_path (public only).
 */

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * @param {string | undefined | null} raw
 * @returns {string | null} normalized schema or null if unset/blank
 */
function normalizeDbSchema(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!IDENT.test(s)) {
    throw new Error(
      `Invalid DB_SCHEMA "${raw}": use only [a-zA-Z0-9_], start with letter or underscore.`
    );
  }
  return s;
}

/**
 * @returns {string | null}
 */
function validatedDbSchemaFromEnv() {
  return normalizeDbSchema(process.env.DB_SCHEMA);
}

/**
 * Extra pg Pool / Client config: libpq startup search_path.
 * @param {string | null} schema — from normalizeDbSchema / validatedDbSchemaFromEnv
 * @returns {{ options?: string }}
 */
function pgSearchPathOptions(schema) {
  if (!schema) return {};
  return { options: `-c search_path=${schema},public` };
}

/**
 * Schema name for pg_catalog / information_schema filters (validated; safe to interpolate only after this).
 * @returns {string}
 */
function getPgCatalogSchemaName() {
  return validatedDbSchemaFromEnv() || 'public';
}

module.exports = {
  normalizeDbSchema,
  validatedDbSchemaFromEnv,
  pgSearchPathOptions,
  getPgCatalogSchemaName,
};
