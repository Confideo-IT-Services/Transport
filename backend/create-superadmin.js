/**
 * Create a platform superadmin user (PostgreSQL-compatible via shared db pool).
 *
 * Usage:
 *   node create-superadmin.js <email> <password> [display_name]
 *
 * If the email already exists, the script exits with an error. To change an
 * existing superadmin's password, use fix-superadmin-password.js instead.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/database');

async function createSuperAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Super Admin';

  if (!email || !password) {
    console.error('\nUsage: node create-superadmin.js <email> <password> [display_name]\n');
    console.error('Example:');
    console.error('  node create-superadmin.js admin@school.org "YourSecurePass123!" "Platform Admin"\n');
    process.exit(1);
  }

  const emailNorm = String(email).trim().toLowerCase();
  if (!emailNorm.includes('@')) {
    console.error('❌ Invalid email.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Password should be at least 8 characters.');
    process.exit(1);
  }

  try {
    const [existing] = await db.query('SELECT id, role FROM users WHERE LOWER(TRIM(email)) = ?', [
      emailNorm,
    ]);

    if (existing.length > 0) {
      const row = existing[0];
      if (String(row.role).toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin') {
        console.error(
          `❌ ${emailNorm} is already a superadmin. To reset password run:\n   node fix-superadmin-password.js ${emailNorm} <new_password>\n`
        );
      } else {
        console.error(
          `❌ Email ${emailNorm} is already registered (role: ${row.role}). Use a different email.`
        );
      }
      process.exit(1);
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const displayName = String(name).trim() || 'Super Admin';

    await db.query(
      `INSERT INTO users (id, email, password, name, role, school_id, is_active, created_at)
       VALUES (?, ?, ?, ?, 'superadmin', NULL, ?, NOW())`,
      [id, emailNorm, hashedPassword, displayName, 1]
    );

    console.log('✅ Super admin created successfully.\n');
    console.log('   ID:', id);
    console.log('   Email:', emailNorm);
    console.log('   Name:', displayName);
    console.log('   Role: superadmin');
    console.log('\n📝 Sign in at the app superadmin login with the email and password you set.\n');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
      console.error('❌ That email is already in use (unique constraint).');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

createSuperAdmin();
