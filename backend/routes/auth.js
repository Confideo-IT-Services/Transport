const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../config/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

// Super Admin Login
router.post('/superadmin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('🔐 Super admin login attempt:', email);

    // Check for super admin in users table
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? AND role = ?',
      [email, 'superadmin']
    );

    if (users.length === 0) {
      console.log('❌ Super admin login failed: User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    console.log('👤 Super admin found:', { id: user.id, name: user.name, email: user.email, is_active: user.is_active });
    console.log('🔑 Password check - stored password starts with:', user.password ? user.password.substring(0, 10) : 'null');

    // Check if password is hashed (bcrypt hashes start with $2a$ or $2b$)
    let validPassword = false;
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      // Password is hashed, use bcrypt compare
      validPassword = await bcrypt.compare(password, user.password);
      console.log('🔐 Using bcrypt comparison');
    } else {
      // Password is plain text (for migration purposes)
      validPassword = password === user.password;
      console.log('⚠️  Password stored as plain text - using direct comparison');
      console.log('⚠️  WARNING: Please update password to use bcrypt hash!');
    }

    if (!validPassword) {
      console.log('❌ Super admin login failed: Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      console.log('❌ Super admin login failed: Account deactivated');
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const token = generateToken(user);
    console.log('✅ Super admin login successful:', { id: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Super admin login error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ error: 'Login failed' });
  }
});

// School Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('🔐 Admin login attempt:', email);

    // Check for admin in users table with school info
    const [users] = await db.query(
      `SELECT u.*, s.name as school_name, s.code as school_code 
       FROM users u 
       LEFT JOIN schools s ON u.school_id = s.id 
       WHERE u.email = ? AND u.role = ?`,
      [email, 'admin']
    );

    if (users.length === 0) {
      console.log('❌ Admin login failed: User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    console.log('👤 User found:', { id: user.id, name: user.name, email: user.email, is_active: user.is_active });

    if (!user.is_active) {
      console.log('❌ Admin login failed: Account deactivated');
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('❌ Admin login failed: Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    console.log('✅ Admin login successful:', { id: user.id, email: user.email, schoolId: user.school_id });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.school_id,
        schoolName: user.school_name
      }
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ error: 'Login failed' });
  }
});

// Teacher Login (username/password)
router.post('/teacher/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check for teacher in teachers table with school info
    const [teachers] = await db.query(
      `SELECT t.*, s.name as school_name, s.code as school_code,
              c.name as class_name, c.section as class_section
       FROM teachers t 
       LEFT JOIN schools s ON t.school_id = s.id 
       LEFT JOIN classes c ON t.class_id = c.id
       WHERE t.username = ?`,
      [username]
    );

    if (teachers.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const teacher = teachers[0];
    const validPassword = await bcrypt.compare(password, teacher.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!teacher.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const token = generateToken({
      id: teacher.id,
      username: teacher.username,
      role: 'teacher',
      school_id: teacher.school_id,
      school_name: teacher.school_name
    });

    res.json({
      token,
      user: {
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        role: 'teacher',
        schoolId: teacher.school_id,
        schoolName: teacher.school_name,
        className: teacher.class_name ? `${teacher.class_name} ${teacher.class_section || ''}`.trim() : null
      }
    });
  } catch (error) {
    console.error('Teacher login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify Token
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Fetch fresh user data
    if (user.role === 'teacher') {
      const [teachers] = await db.query(
        `SELECT t.*, s.name as school_name 
         FROM teachers t 
         LEFT JOIN schools s ON t.school_id = s.id 
         WHERE t.id = ?`,
        [user.id]
      );
      
      if (teachers.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const teacher = teachers[0];
      res.json({
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        role: 'teacher',
        schoolId: teacher.school_id,
        schoolName: teacher.school_name
      });
    } else {
      const [users] = await db.query(
        `SELECT u.*, s.name as school_name 
         FROM users u 
         LEFT JOIN schools s ON u.school_id = s.id 
         WHERE u.id = ?`,
        [user.id]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const dbUser = users[0];
      res.json({
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        schoolId: dbUser.school_id,
        schoolName: dbUser.school_name
      });
    }
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
