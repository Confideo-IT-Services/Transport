const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all academic years (filtered by school for admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    const [years] = await db.query(
      `SELECT * FROM academic_years 
       WHERE school_id = ? 
       ORDER BY start_date DESC`,
      [schoolId]
    );

    res.json(years.map(y => ({
      id: y.id,
      name: y.name,
      startDate: y.start_date,
      endDate: y.end_date,
      status: y.status,
      schoolId: y.school_id,
      createdAt: y.created_at
    })));
  } catch (error) {
    console.error('Get academic years error:', error);
    res.status(500).json({ error: 'Failed to fetch academic years' });
  }
});

// Get active academic year
router.get('/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    const [years] = await db.query(
      `SELECT * FROM academic_years 
       WHERE school_id = ? AND status = 'active'
       LIMIT 1`,
      [schoolId]
    );

    if (years.length === 0) {
      return res.status(404).json({ error: 'No active academic year found' });
    }

    const y = years[0];
    res.json({
      id: y.id,
      name: y.name,
      startDate: y.start_date,
      endDate: y.end_date,
      status: y.status,
      schoolId: y.school_id,
      createdAt: y.created_at
    });
  } catch (error) {
    console.error('Get active academic year error:', error);
    res.status(500).json({ error: 'Failed to fetch active academic year' });
  }
});

// Create academic year (School Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Name, start date, and end date are required' });
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (end <= start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Check if academic year with same name already exists for this school
    const [existingYears] = await db.query(
      'SELECT id FROM academic_years WHERE name = ? AND school_id = ?',
      [name, schoolId]
    );

    if (existingYears.length > 0) {
      return res.status(400).json({ error: 'Academic year with this name already exists' });
    }

    // Set all other years to completed when creating a new active year
    await db.query(
      'UPDATE academic_years SET status = "completed" WHERE school_id = ? AND status = "active"',
      [schoolId]
    );

    // Create new academic year
    const yearId = uuidv4();
    await db.query(
      `INSERT INTO academic_years (id, name, start_date, end_date, status, school_id, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, NOW())`,
      [yearId, name, startDate, endDate, schoolId]
    );

    console.log('✅ Academic year created:', { yearId, name, startDate, endDate, schoolId });

    res.status(201).json({ success: true, yearId });
  } catch (error) {
    console.error('Create academic year error:', error);
    res.status(500).json({ error: 'Failed to create academic year' });
  }
});

// Update academic year (School Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, status } = req.body;

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Verify academic year belongs to school
    const [years] = await db.query(
      'SELECT id FROM academic_years WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (years.length === 0) {
      return res.status(404).json({ error: 'Academic year not found or access denied' });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (startDate !== undefined) {
      updates.push('start_date = ?');
      params.push(startDate);
    }

    if (endDate !== undefined) {
      updates.push('end_date = ?');
      params.push(endDate);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);

      // If setting to active, set all others to completed
      if (status === 'active') {
        await db.query(
          'UPDATE academic_years SET status = "completed" WHERE school_id = ? AND id != ? AND status = "active"',
          [schoolId, id]
        );
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id, schoolId);

    await db.query(
      `UPDATE academic_years SET ${updates.join(', ')} WHERE id = ? AND school_id = ?`,
      params
    );

    console.log('✅ Academic year updated:', { id, updates });

    res.json({ success: true });
  } catch (error) {
    console.error('Update academic year error:', error);
    res.status(500).json({ error: 'Failed to update academic year' });
  }
});

// Delete academic year (School Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Verify academic year belongs to school
    const [years] = await db.query(
      'SELECT id FROM academic_years WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (years.length === 0) {
      return res.status(404).json({ error: 'Academic year not found or access denied' });
    }

    await db.query('DELETE FROM academic_years WHERE id = ?', [id]);

    console.log('✅ Academic year deleted:', { id });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete academic year error:', error);
    res.status(500).json({ error: 'Failed to delete academic year' });
  }
});

module.exports = router;




