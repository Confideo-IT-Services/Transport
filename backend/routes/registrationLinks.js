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
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { classId, section, fieldConfig, expiresAt } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !section) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Class ID and section are required' });
    }

    if (!schoolId) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'School ID is required' });
    }

    // Verify class belongs to school
    const [classes] = await connection.query(
      'SELECT id, name FROM classes WHERE id = ? AND school_id = ?',
      [classId, schoolId]
    );

    if (classes.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Class not found' });
    }

    // Generate unique link code
    let linkCode = generateLinkCode();
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      const [existing] = await connection.query(
        'SELECT id FROM registration_links WHERE link_code = ?',
        [linkCode]
      );
      
      if (existing.length === 0) {
        isUnique = true;
      } else {
        linkCode = generateLinkCode();
        attempts++;
      }
    }

    if (!isUnique) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({ error: 'Failed to generate unique link code' });
    }

    // Insert registration link
    const linkId = uuidv4();
    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;

    await connection.query(
      `INSERT INTO registration_links 
       (id, school_id, class_id, link_code, field_config, expires_at, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [
        linkId,
        schoolId,
        classId,
        linkCode,
        JSON.stringify(fieldConfig || []),
        expiresAtDate
      ]
    );

    await connection.commit();
    connection.release();

    // Generate the registration URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const registrationUrl = `${baseUrl}/register?code=${linkCode}`;

    console.log('✅ Registration link created:', { linkId, linkCode, classId, section, schoolId });

    res.status(201).json({
      success: true,
      id: linkId,
      linkCode,
      link: registrationUrl,
      fieldConfig: fieldConfig || [],
      expiresAt: expiresAtDate,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('❌ Create registration link error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
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

    // Use LEFT JOIN to handle cases where class might be deleted
    const [links] = await db.query(
      `SELECT rl.*, c.name as class_name, c.section as class_section
       FROM registration_links rl
       LEFT JOIN classes c ON rl.class_id = c.id
       WHERE rl.school_id = ?
       ORDER BY rl.created_at DESC`,
      [schoolId]
    );

    console.log('✅ Found registration links:', links.length);

    const formattedLinks = links.map(link => {
      // Safely parse field_config
      let fieldConfig = [];
      try {
        if (link.field_config) {
          if (typeof link.field_config === 'string') {
            fieldConfig = JSON.parse(link.field_config);
          } else {
            fieldConfig = link.field_config;
          }
        }
      } catch (parseError) {
        console.error('❌ Error parsing field_config for link:', link.id, parseError);
        fieldConfig = [];
      }

      return {
        id: link.id,
        linkCode: link.link_code,
        classId: link.class_id,
        className: link.class_name || 'Unknown Class',
        classSection: link.class_section || '',
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
      `SELECT rl.*, c.name as class_name, c.section as class_section
       FROM registration_links rl
       JOIN classes c ON rl.class_id = c.id
       WHERE rl.id = ? AND rl.school_id = ?`,
      [id, schoolId]
    );

    if (links.length === 0) {
      return res.status(404).json({ error: 'Registration link not found' });
    }

    const link = links[0];
    res.json({
      id: link.id,
      linkCode: link.link_code,
      classId: link.class_id,
      className: link.class_name,
      classSection: link.class_section,
      fieldConfig: link.field_config ? JSON.parse(link.field_config) : [],
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
       WHERE link_code = ? AND is_active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [code]
    );

    if (links.length === 0) {
      console.log('❌ Registration link not found or expired:', code);
      return res.status(404).json({ error: 'Registration link not found or expired' });
    }

    const link = links[0];

    // Then get the class details separately
    const [classes] = await db.query(
      'SELECT id, name, section FROM classes WHERE id = ?',
      [link.class_id]
    );

    if (classes.length === 0) {
      console.error('❌ Class not found for registration link:', { linkId: link.id, classId: link.class_id });
      return res.status(404).json({ error: 'Class associated with this link not found' });
    }

    const classData = classes[0];

    // Parse field_config safely
    let fieldConfig = [];
    try {
      if (link.field_config) {
        if (typeof link.field_config === 'string') {
          fieldConfig = JSON.parse(link.field_config);
        } else {
          fieldConfig = link.field_config;
        }
      }
    } catch (parseError) {
      console.error('❌ Error parsing field_config:', parseError);
      fieldConfig = [];
    }

    console.log('✅ Registration link found:', { 
      linkId: link.id, 
      classId: link.class_id, 
      className: classData.name,
      classSection: classData.section,
      fieldCount: fieldConfig.length 
    });

    res.json({
      id: link.id,
      linkCode: link.link_code,
      classId: link.class_id,
      className: classData.name,
      classSection: classData.section,
      fieldConfig: fieldConfig,
      expiresAt: link.expires_at
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
      'UPDATE registration_links SET is_active = FALSE WHERE id = ? AND school_id = ?',
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

