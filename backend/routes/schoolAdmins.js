const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

// Create school admin (Super Admin only)
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { schoolId, email, password, name } = req.body;

    if (!schoolId || !email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if school exists
    const [schools] = await db.query('SELECT id, name FROM schools WHERE id = ?', [schoolId]);
    if (schools.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Check if email already exists
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Create admin
    const adminId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.query(
      `INSERT INTO users (id, email, password, name, role, school_id, is_active, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?, ?, NOW())`,
      [adminId, email, hashedPassword, name, schoolId, 1]
    );

    console.log('✅ School admin created:', { adminId, email, name, schoolId, schoolName: schools[0].name });

    res.status(201).json({ 
      success: true,
      adminId,
      message: 'School admin created successfully'
    });
  } catch (error) {
    console.error('❌ Create school admin error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

module.exports = router;
