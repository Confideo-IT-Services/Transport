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
        classId: teacher.class_id || null,
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
    if (user.role === 'parent') {
      // For parents, get info from students table
      const parentPhone = user.phone || user.id.replace('parent-', '');
      const cleanedPhone = parentPhone.replace(/\D/g, '');
      
      const [students] = await db.query(
        `SELECT DISTINCT s.school_id, s.parent_phone, s.parent_email, s.parent_name,
                sch.name as school_name
         FROM students s
         JOIN schools sch ON s.school_id = sch.id
         WHERE s.parent_phone = ? AND s.status = 'approved'
         LIMIT 1`,
        [cleanedPhone]
      );
      
      if (students.length === 0) {
        return res.status(404).json({ error: 'Parent not found' });
      }
      
      const studentData = students[0];
      res.json({
        id: `parent-${cleanedPhone}`,
        name: studentData.parent_name || 'Parent',
        phone: cleanedPhone,
        email: studentData.parent_email || null,
        role: 'parent',
        schoolId: studentData.school_id,
        schoolName: studentData.school_name
      });
    } else if (user.role === 'teacher') {
      const [teachers] = await db.query(
        `SELECT t.*, s.name as school_name,
                c.name as class_name, c.section as class_section
         FROM teachers t 
         LEFT JOIN schools s ON t.school_id = s.id 
         LEFT JOIN classes c ON t.class_id = c.id
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
        email: teacher.email,
        phone: teacher.phone,
        role: 'teacher',
        schoolId: teacher.school_id,
        schoolName: teacher.school_name,
        classId: teacher.class_id || null,
        className: teacher.class_name ? `${teacher.class_name} ${teacher.class_section || ''}`.trim() : null
      });
    } else {
      const [users] = await db.query(
        `SELECT u.*, s.name as school_name, s.code as school_code, 
                s.type as school_type, s.location as school_location,
                s.address as school_address, s.phone as school_phone, s.email as school_email
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
        phone: dbUser.phone,
        role: dbUser.role,
        schoolId: dbUser.school_id,
        schoolName: dbUser.school_name,
        schoolCode: dbUser.school_code,
        schoolType: dbUser.school_type,
        schoolLocation: dbUser.school_location,
        schoolAddress: dbUser.school_address,
        schoolPhone: dbUser.school_phone,
        schoolEmail: dbUser.school_email
      });
    }
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Update own profile (self-update)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { name, email, phone } = req.body;

    if (userRole === 'teacher') {
      // Update teacher profile
      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      
      if (email !== undefined) {
        // Check if email already exists for another teacher
        const [existing] = await db.query(
          'SELECT id FROM teachers WHERE email = ? AND id != ? AND school_id = ?',
          [email, userId, req.user.schoolId]
        );
        if (existing.length > 0) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        updates.push('email = ?');
        values.push(email || null);
      }
      
      if (phone !== undefined) {
        updates.push('phone = ?');
        values.push(phone || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(userId);
      await db.query(
        `UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      // Fetch updated teacher data
      const [teachers] = await db.query(
        `SELECT t.*, s.name as school_name,
                c.name as class_name, c.section as class_section
         FROM teachers t 
         LEFT JOIN schools s ON t.school_id = s.id 
         LEFT JOIN classes c ON t.class_id = c.id
         WHERE t.id = ?`,
        [userId]
      );

      if (teachers.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      const teacher = teachers[0];
      res.json({
        success: true,
        user: {
          id: teacher.id,
          name: teacher.name,
          username: teacher.username,
          email: teacher.email,
          phone: teacher.phone,
          role: 'teacher',
          schoolId: teacher.school_id,
          schoolName: teacher.school_name,
          className: teacher.class_name ? `${teacher.class_name} ${teacher.class_section || ''}`.trim() : null
        }
      });
    } else if (userRole === 'admin') {
      // Update admin profile
      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      
      // Note: Email updates for admin might be restricted, but we'll allow it
      // You can add additional validation here if needed
      if (email !== undefined && email !== null) {
        // Check if email already exists for another admin
        const [existing] = await db.query(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, userId]
        );
        if (existing.length > 0) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        updates.push('email = ?');
        values.push(email);
      }

      // Add phone support for admins
      if (phone !== undefined) {
        updates.push('phone = ?');
        values.push(phone || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(userId);
      await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      // Fetch updated user data with school details
      const [users] = await db.query(
        `SELECT u.*, s.name as school_name, s.code as school_code,
                s.type as school_type, s.location as school_location,
                s.address as school_address, s.phone as school_phone, s.email as school_email
         FROM users u 
         LEFT JOIN schools s ON u.school_id = s.id 
         WHERE u.id = ?`,
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const dbUser = users[0];
      res.json({
        success: true,
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          phone: dbUser.phone,
          role: dbUser.role,
          schoolId: dbUser.school_id,
          schoolName: dbUser.school_name,
          schoolCode: dbUser.school_code,
          schoolType: dbUser.school_type,
          schoolLocation: dbUser.school_location,
          schoolAddress: dbUser.school_address,
          schoolPhone: dbUser.school_phone,
          schoolEmail: dbUser.school_email
        }
      });
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    if (userRole === 'teacher') {
      // Get teacher's current password
      const [teachers] = await db.query(
        'SELECT password FROM teachers WHERE id = ?',
        [userId]
      );

      if (teachers.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      const teacher = teachers[0];
      const isPasswordValid = await bcrypt.compare(currentPassword, teacher.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query(
        'UPDATE teachers SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      );

      res.json({ success: true, message: 'Password updated successfully' });
    } else if (userRole === 'admin') {
      // Get admin's current password
      const [users] = await db.query(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const dbUser = users[0];
      const isPasswordValid = await bcrypt.compare(currentPassword, dbUser.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      );

      res.json({ success: true, message: 'Password updated successfully' });
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Parent Login (phone only - no OTP for now)
router.post('/parent/login', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const cleanedPhone = phone.replace(/\D/g, '');

    // Find student(s) with this parent phone
    const [students] = await db.query(
      `SELECT DISTINCT s.school_id, s.parent_phone, s.parent_email, s.parent_name,
              sch.name as school_name
       FROM students s
       JOIN schools sch ON s.school_id = sch.id
       WHERE s.parent_phone = ? AND s.status = 'approved'
       LIMIT 1`,
      [cleanedPhone]
    );

    if (students.length === 0) {
      return res.status(401).json({ 
        error: 'No student found with this parent phone number. Please contact the school.' 
      });
    }

    const studentData = students[0];

    // Generate token for parent
    const token = generateToken({
      id: `parent-${cleanedPhone}`,
      phone: cleanedPhone,
      role: 'parent',
      school_id: studentData.school_id,
      school_name: studentData.school_name
    });

    console.log('✅ Parent login successful:', { phone: cleanedPhone, schoolId: studentData.school_id });

    res.json({
      token,
      user: {
        id: `parent-${cleanedPhone}`,
        name: studentData.parent_name || 'Parent',
        phone: cleanedPhone,
        email: studentData.parent_email || null,
        role: 'parent',
        schoolId: studentData.school_id,
        schoolName: studentData.school_name
      }
    });
  } catch (error) {
    console.error('❌ Parent login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
