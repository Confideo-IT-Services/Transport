const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Generate unique link code
function generateLinkCode() {
  return `REG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

// Create registration link
// Body: name (optional), linkType: 'class'|'all_classes'|'teacher'|'others', classId (optional), teacherId (optional), section (optional), fieldConfig, expiresAt
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { name, linkType, classId, teacherId, section, fieldConfig, expiresAt } = req.body;
    const schoolId = req.user.schoolId;
    const type = linkType || 'class';

    if (!schoolId) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'School ID is required' });
    }

    if (!['class', 'all_classes', 'teacher', 'others'].includes(type)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Invalid linkType. Use: class, all_classes, teacher, others' });
    }

    const linkName = (name && typeof name === 'string') ? name.trim() : '';
    if (!linkName) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Link name is required' });
    }

    let finalClassId = null;
    let finalSection = section || '';

    if (type === 'class') {
      if (!classId) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Class is required for this link type' });
      }
      const [classes] = await connection.query(
        'SELECT id, name, section FROM classes WHERE id = ? AND school_id = ?',
        [classId, schoolId]
      );
      if (classes.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Class not found' });
      }
      finalClassId = classId;
      finalSection = classes[0].section || finalSection;
    }

    if (type === 'teacher' && teacherId) {
      const [teachers] = await connection.query(
        'SELECT id FROM teachers WHERE id = ? AND school_id = ?',
        [teacherId, schoolId]
      );
      if (teachers.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Teacher not found' });
      }
    }

    let linkCode = generateLinkCode();
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      const [existing] = await connection.query(
        'SELECT id FROM registration_links WHERE link_code = ?',
        [linkCode]
      );
      if (existing.length === 0) isUnique = true;
      else { linkCode = generateLinkCode(); attempts++; }
    }

    if (!isUnique) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({ error: 'Failed to generate unique link code' });
    }

    const linkId = uuidv4();
    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;

    await connection.query(
      `INSERT INTO registration_links 
       (id, school_id, name, link_type, teacher_id, class_id, link_code, field_config, expires_at, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        linkId,
        schoolId,
        linkName,
        type,
        type === 'teacher' ? teacherId : null,
        finalClassId,
        linkCode,
        JSON.stringify(fieldConfig || []),
        expiresAtDate,
        1
      ]
    );

    await connection.commit();
    connection.release();

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const registrationUrl = `${baseUrl}/register?code=${linkCode}`;

    console.log('✅ Registration link created:', { linkId, linkCode, linkType: type, classId: finalClassId, teacherId: type === 'teacher' ? teacherId : null, schoolId });

    res.status(201).json({
      success: true,
      id: linkId,
      linkCode,
      link: registrationUrl,
      name: name && String(name).trim() ? String(name).trim() : null,
      linkType: type,
      classId: finalClassId,
      teacherId: type === 'teacher' ? teacherId : null,
      fieldConfig: fieldConfig || [],
      expiresAt: expiresAtDate,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('❌ Create registration link error:', error);
    res.status(500).json({ 
      error: 'Failed to create registration link',
      details: error.message 
    });
  }
});

// Get all registration links for a school
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ error: 'School ID is required' });
    }

    console.log('🔍 Fetching registration links for school:', schoolId);

    const [links] = await db.query(
      `SELECT rl.*, c.name as class_name, c.section as class_section, t.name as teacher_name
       FROM registration_links rl
       LEFT JOIN classes c ON rl.class_id = c.id
       LEFT JOIN teachers t ON rl.teacher_id = t.id
       WHERE rl.school_id = ?
       ORDER BY rl.created_at DESC`,
      [schoolId]
    );

    console.log('✅ Found registration links:', links.length);

    const formattedLinks = links.map(link => {
      let fieldConfig = [];
      try {
        if (link.field_config) {
          fieldConfig = typeof link.field_config === 'string' ? JSON.parse(link.field_config) : link.field_config;
        }
      } catch (parseError) {
        console.error('❌ Error parsing field_config for link:', link.id, parseError);
      }

      return {
        id: link.id,
        linkCode: link.link_code,
        name: link.name || null,
        linkType: link.link_type || 'class',
        classId: link.class_id,
        className: link.class_name || null,
        classSection: link.class_section || '',
        teacherId: link.teacher_id || null,
        teacherName: link.teacher_name || null,
        fieldConfig: fieldConfig,
        expiresAt: link.expires_at,
        isActive: link.is_active,
        createdAt: link.created_at,
        link: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/register?code=${link.link_code}`
      };
    });

    console.log('✅ Returning formatted links:', formattedLinks.length);
    res.json(formattedLinks);
  } catch (error) {
    console.error('❌ Get registration links error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      message: error.message
    });
    res.status(500).json({ 
      error: 'Failed to fetch registration links',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get specific registration link by ID
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const [links] = await db.query(
      `SELECT rl.*, c.name as class_name, c.section as class_section, t.name as teacher_name
       FROM registration_links rl
       LEFT JOIN classes c ON rl.class_id = c.id
       LEFT JOIN teachers t ON rl.teacher_id = t.id
       WHERE rl.id = ? AND rl.school_id = ?`,
      [id, schoolId]
    );

    if (links.length === 0) {
      return res.status(404).json({ error: 'Registration link not found' });
    }

    const link = links[0];
    let fieldConfig = [];
    try {
      if (link.field_config) fieldConfig = typeof link.field_config === 'string' ? JSON.parse(link.field_config) : link.field_config;
    } catch (_) {}
    res.json({
      id: link.id,
      linkCode: link.link_code,
      name: link.name || null,
      linkType: link.link_type || 'class',
      classId: link.class_id,
      className: link.class_name || null,
      classSection: link.class_section || '',
      teacherId: link.teacher_id || null,
      teacherName: link.teacher_name || null,
      fieldConfig,
      expiresAt: link.expires_at,
      isActive: link.is_active,
      createdAt: link.created_at,
      link: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/register?code=${link.link_code}`
    });
  } catch (error) {
    console.error('Get registration link error:', error);
    res.status(500).json({ error: 'Failed to fetch registration link' });
  }
});

// Get registration link by code (public endpoint for registration form)
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;

    console.log('🔍 Fetching registration link by code:', code);

    // First get the registration link
    const [links] = await db.query(
      `SELECT * FROM registration_links 
       WHERE link_code = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [code]
    );

    if (links.length === 0) {
      console.log('❌ Registration link not found or expired:', code);
      return res.status(404).json({ error: 'Registration link not found or expired' });
    }

    const link = links[0];
    const linkType = link.link_type || 'class';

    let className = null;
    let classSection = null;
    let teacherName = null;

    if (link.class_id) {
      const [classes] = await db.query(
        'SELECT id, name, section FROM classes WHERE id = ?',
        [link.class_id]
      );
      if (classes.length > 0) {
        className = classes[0].name;
        classSection = classes[0].section || '';
      }
    }
    if (link.teacher_id) {
      const [teachers] = await db.query(
        'SELECT id, name FROM teachers WHERE id = ?',
        [link.teacher_id]
      );
      if (teachers.length > 0) teacherName = teachers[0].name;
    }

    let fieldConfig = [];
    try {
      if (link.field_config) {
        fieldConfig = typeof link.field_config === 'string' ? JSON.parse(link.field_config) : link.field_config;
      }
    } catch (parseError) {
      console.error('❌ Error parsing field_config:', parseError);
    }

    // For all_classes links, return list of classes so students can select class and section
    let classesList = [];
    if ((linkType === 'all_classes' || !link.class_id) && link.school_id) {
      const [classesRows] = await db.query(
        'SELECT id, name, section FROM classes WHERE school_id = ? ORDER BY name, section',
        [link.school_id]
      );
      classesList = classesRows || [];
    }

    console.log('✅ Registration link found:', { linkId: link.id, linkType, classId: link.class_id, teacherId: link.teacher_id, fieldCount: fieldConfig.length });

    res.json({
      id: link.id,
      linkCode: link.link_code,
      name: link.name || null,
      linkType,
      classId: link.class_id || null,
      className,
      classSection: classSection || '',
      teacherId: link.teacher_id || null,
      teacherName,
      fieldConfig,
      expiresAt: link.expires_at,
      classes: classesList
    });
  } catch (error) {
    console.error('❌ Get registration link by code error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      message: error.message
    });
    res.status(500).json({ 
      error: 'Failed to fetch registration link',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Deactivate registration link
router.patch('/:id/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const [result] = await db.query(
      'UPDATE registration_links SET is_active = 0 WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registration link not found' });
    }

    res.json({ success: true, message: 'Registration link deactivated' });
  } catch (error) {
    console.error('Deactivate registration link error:', error);
    res.status(500).json({ error: 'Failed to deactivate registration link' });
  }
});

// Delete registration link
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    console.log('🗑️ Deleting registration link:', { id, schoolId });

    // Verify the link belongs to the school before deleting
    const [links] = await db.query(
      'SELECT id FROM registration_links WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (links.length === 0) {
      console.log('❌ Registration link not found or does not belong to school');
      return res.status(404).json({ error: 'Registration link not found' });
    }

    // Delete the registration link
    const [result] = await db.query(
      'DELETE FROM registration_links WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registration link not found' });
    }

    console.log('✅ Registration link deleted:', { id, schoolId });
    res.json({ success: true, message: 'Registration link deleted successfully' });
  } catch (error) {
    console.error('❌ Delete registration link error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      message: error.message
    });
    res.status(500).json({ 
      error: 'Failed to delete registration link',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

