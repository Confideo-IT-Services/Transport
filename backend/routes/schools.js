const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

// Generate unique school code
const generateSchoolCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'SCH-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Get all schools (Super Admin only)
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const [schools] = await db.query(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM students WHERE school_id = s.id) as students,
        (SELECT COUNT(*) FROM teachers WHERE school_id = s.id) as teachers,
        (SELECT COUNT(*) FROM users WHERE school_id = s.id AND role = 'admin') as admins
      FROM schools s
      ORDER BY s.created_at DESC
    `);

    res.json(schools.map(school => ({
      id: school.id,
      name: school.name,
      code: school.code,
      type: school.type,
      location: school.location,
      address: school.address,
      phone: school.phone,
      email: school.email,
      students: school.students,
      teachers: school.teachers,
      admins: school.admins,
      status: school.status,
      createdAt: school.created_at
    })));
  } catch (error) {
    console.error('Get schools error:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// Get school by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [schools] = await db.query(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM students WHERE school_id = s.id) as students,
        (SELECT COUNT(*) FROM teachers WHERE school_id = s.id) as teachers,
        (SELECT COUNT(*) FROM users WHERE school_id = s.id AND role = 'admin') as admins
      FROM schools s
      WHERE s.id = ?
    `, [id]);

    if (schools.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const school = schools[0];
    res.json({
      id: school.id,
      name: school.name,
      code: school.code,
      type: school.type,
      location: school.location,
      address: school.address,
      phone: school.phone,
      email: school.email,
      students: school.students,
      teachers: school.teachers,
      admins: school.admins,
      status: school.status,
      createdAt: school.created_at
    });
  } catch (error) {
    console.error('Get school error:', error);
    res.status(500).json({ error: 'Failed to fetch school' });
  }
});

// Get school admins
router.get('/:id/admins', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [admins] = await db.query(
      `SELECT id, email, name, is_active as isActive 
       FROM users 
       WHERE school_id = ? AND role = 'admin'`,
      [id]
    );

    res.json(admins.map(admin => ({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      schoolId: id,
      isActive: !!admin.isActive
    })));
  } catch (error) {
    console.error('Get school admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Create new school (Super Admin only)
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { name, type, location, address, phone, email, adminName, adminEmail, adminPassword } = req.body;

    if (!name || !email || !adminEmail || !adminPassword) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check if school email already exists
    const [existingSchools] = await connection.query(
      'SELECT id FROM schools WHERE email = ?',
      [email]
    );

    if (existingSchools.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'School with this email already exists' });
    }

    // Check if admin email already exists
    const [existingAdmins] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [adminEmail]
    );

    if (existingAdmins.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    // Generate unique school code
    let schoolCode = generateSchoolCode();
    let [codeExists] = await connection.query('SELECT id FROM schools WHERE code = ?', [schoolCode]);
    while (codeExists.length > 0) {
      schoolCode = generateSchoolCode();
      [codeExists] = await connection.query('SELECT id FROM schools WHERE code = ?', [schoolCode]);
    }

    // Create school
    const schoolId = uuidv4();
    const [schoolResult] = await connection.query(
      `INSERT INTO schools (id, name, code, type, location, address, phone, email, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [schoolId, name, schoolCode, type || 'K-12', location || '', address || '', phone || '', email]
    );

    console.log('✅ School created:', { schoolId, name, code: schoolCode });

    // Create school admin
    const adminId = uuidv4();
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const [adminResult] = await connection.query(
      `INSERT INTO users (id, email, password, name, role, school_id, is_active, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?, true, NOW())`,
      [adminId, adminEmail, hashedPassword, adminName || 'School Admin', schoolId]
    );

    console.log('✅ Admin created:', { adminId, email: adminEmail, schoolId });

    await connection.commit();
    console.log('✅ Transaction committed successfully');

    connection.release();

    res.status(201).json({
      success: true,
      schoolId,
      schoolCode,
      adminId,
      message: 'School and admin created successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Create school error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql ? error.sql.substring(0, 200) : null
    });
    connection.release();
    res.status(500).json({ 
      error: 'Failed to create school',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update own school (School Admin can update their school)
router.put('/my-school', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const schoolId = req.user.schoolId;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required' });
    }

    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    const { name, type, location, address, phone, email } = req.body;

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (type) { updates.push('type = ?'); values.push(type); }
    if (location !== undefined) { updates.push('location = ?'); values.push(location || null); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address || null); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null); }
    if (email) { 
      // Check if email already exists for another school
      const [existing] = await db.query(
        'SELECT id FROM schools WHERE email = ? AND id != ?',
        [email, schoolId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'School email already exists' });
      }
      updates.push('email = ?'); 
      values.push(email); 
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(schoolId);
    const [result] = await db.query(
      `UPDATE schools SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    console.log('✅ School updated by admin:', { schoolId, affectedRows: result.affectedRows });

    res.json({ success: true });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({ error: 'Failed to update school' });
  }
});

// Update school (Super Admin only)
router.put('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, location, address, phone, email, status } = req.body;

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (type) { updates.push('type = ?'); values.push(type); }
    if (location) { updates.push('location = ?'); values.push(location); }
    if (address) { updates.push('address = ?'); values.push(address); }
    if (phone) { updates.push('phone = ?'); values.push(phone); }
    if (email) { updates.push('email = ?'); values.push(email); }
    if (status) { updates.push('status = ?'); values.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const [result] = await db.query(
      `UPDATE schools SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    console.log('✅ School updated:', { id, affectedRows: result.affectedRows });

    res.json({ success: true });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({ error: 'Failed to update school' });
  }
});

// Deactivate school
router.post('/:id/deactivate', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "UPDATE schools SET status = 'inactive' WHERE id = ?",
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Deactivate school error:', error);
    res.status(500).json({ error: 'Failed to deactivate school' });
  }
});

module.exports = router;
