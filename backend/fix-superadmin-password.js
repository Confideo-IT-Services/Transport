require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function fixSuperAdminPassword() {
  console.log('🔧 Fixing superadmin password...\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'allpulse',
  };

  // Get email and password from command line or use defaults
  const email = process.argv[2] || 'superadmin@allpulse.com';
  const newPassword = process.argv[3] || 'SuperAdmin@123';

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Check if user exists
    const [users] = await connection.execute(
      'SELECT id, email, password FROM users WHERE email = ? AND role = ?',
      [email, 'superadmin']
    );

    if (users.length === 0) {
      console.log(`❌ Super admin with email ${email} not found`);
      await connection.end();
      process.exit(1);
    }

    const user = users[0];
    console.log('👤 Found super admin:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current password (first 20 chars): ${user.password ? user.password.substring(0, 20) : 'null'}\n`);

    // Hash the new password
    console.log('🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`   New password hash: ${hashedPassword.substring(0, 30)}...\n`);

    // Update password in database
    await connection.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, user.id]
    );

    console.log('✅ Password updated successfully!');
    console.log(`\n📝 Login credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}\n`);

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

fixSuperAdminPassword();









