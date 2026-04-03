require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function fixSuperAdminPassword() {
  console.log('🔧 Fixing superadmin password...\n');

  const email = process.argv[2] || 'superadmin@conventpulse.com';
  const newPassword = process.argv[3] || 'SuperAdmin@123';

  try {
    const [users] = await db.query(
      'SELECT id, email, password FROM users WHERE email = ? AND role = ?',
      [email, 'superadmin']
    );

    if (users.length === 0) {
      console.log(`❌ Super admin with email ${email} not found`);
      process.exit(1);
    }

    const user = users[0];
    console.log('👤 Found super admin:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current password (first 20 chars): ${user.password ? user.password.substring(0, 20) : 'null'}\n`);

    console.log('🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`   New password hash: ${hashedPassword.substring(0, 30)}...\n`);

    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

    console.log('✅ Password updated successfully!');
    console.log(`\n📝 Login credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

fixSuperAdminPassword();
