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

// Normalize date to YYYY-MM-DD for MySQL DATE column
function normalizeDate(value) {
  if (value == null || value === '') return undefined;
  const str = String(value).trim();
  if (str.length >= 10) return str.slice(0, 10);
  return str;
}

// Update academic year (School Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { name, startDate, endDate, status } = req.body;

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

    // Normalize dates to YYYY-MM-DD for MySQL
    if (startDate !== undefined) startDate = normalizeDate(startDate);
    if (endDate !== undefined) endDate = normalizeDate(endDate);

    // Validate dates if both provided
    if (startDate !== undefined && endDate !== undefined) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      if (end <= start) {
        return res.status(400).json({ error: 'End date must be after start date.' });
      }
    }

    // Validate name length (DB column is VARCHAR(20))
    if (name !== undefined && typeof name === 'string' && name.trim().length > 20) {
      return res.status(400).json({ error: 'Academic year name must be 20 characters or less.' });
    }

    // If changing name, check for duplicate (same name, same school, different id)
    if (name !== undefined && name !== '') {
      const [existing] = await db.query(
        'SELECT id FROM academic_years WHERE name = ? AND school_id = ? AND id != ?',
        [name.trim(), schoolId, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Academic year with this name already exists for your school.' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(typeof name === 'string' ? name.trim() : name);
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
    console.error('Update academic year error:', error.message, error.code);
    // Handle MySQL duplicate key
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Academic year with this name already exists for your school.' });
    }
    // Handle invalid date or other DB errors
    if (error.code === 'ER_TRUNCATED_WRONG_VALUE' || error.code === 'ER_WRONG_VALUE_COUNT') {
      return res.status(400).json({ error: 'Invalid data format. Check dates (YYYY-MM-DD) and try again.' });
    }
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

// Promote students to next class for new academic year
router.post('/:id/promote-students', authenticateToken, requireAdmin, async (req, res) => {
  // Start transaction
  await db.query('START TRANSACTION');
  
  try {
    const { id: newAcademicYearId } = req.params;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Get the new academic year
    const [newYear] = await db.query(
      'SELECT * FROM academic_years WHERE id = ? AND school_id = ?',
      [newAcademicYearId, schoolId]
    );

    if (newYear.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Academic year not found' });
    }

    // Get the previous completed academic year
    const [previousYear] = await db.query(
      `SELECT * FROM academic_years 
       WHERE school_id = ? AND status = 'completed' 
       ORDER BY end_date DESC LIMIT 1`,
      [schoolId]
    );

    if (previousYear.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'No previous academic year found. Cannot promote students.' 
      });
    }

    // Get all approved students from previous year (excluding TC students)
    const [students] = await db.query(
      `SELECT s.*, c.name as current_class_name, c.section as current_section
       FROM students s
       JOIN classes c ON s.class_id = c.id
       WHERE s.school_id = ? 
       AND s.status = 'approved'
       AND (s.tc_status IS NULL OR s.tc_status = 'none')
       ORDER BY c.name, c.section, s.roll_no`,
      [schoolId]
    );

    if (students.length === 0) {
      await db.query('COMMIT');
      return res.json({ 
        success: true, 
        message: 'No students to promote',
        promoted: 0,
        skipped: 0,
        total: 0
      });
    }

    // Get all classes for the school to build mapping
    const [allClasses] = await db.query(
      'SELECT * FROM classes WHERE school_id = ? ORDER BY name, section',
      [schoolId]
    );

    // Helper function to find next class
    const findNextClass = (currentClassName, currentSection) => {
      // Extract class number (e.g., "Class 1" -> 1, "1" -> 1, "Grade 5" -> 5)
      const classMatch = currentClassName.match(/\d+/);
      if (!classMatch) return null;
      
      const currentClassNum = parseInt(classMatch[0]);
      const nextClassNum = currentClassNum + 1;
      
      // Build next class name patterns to search
      const patterns = [
        `Class ${nextClassNum}`,
        `${nextClassNum}`,
        `Grade ${nextClassNum}`,
        `Std ${nextClassNum}`,
        `Standard ${nextClassNum}`
      ];

      // Try to find matching class with same section first
      for (const pattern of patterns) {
        const matchingClass = allClasses.find(c => {
          const nameMatch = c.name.toLowerCase().includes(pattern.toLowerCase());
          const sectionMatch = (c.section === currentSection) || 
                              (!c.section && !currentSection);
          return nameMatch && sectionMatch;
        });
        if (matchingClass) return matchingClass;
      }

      // If no section match, try without section
      for (const pattern of patterns) {
        const matchingClass = allClasses.find(c => 
          c.name.toLowerCase().includes(pattern.toLowerCase())
        );
        if (matchingClass) return matchingClass;
      }

      return null;
    };

    let promoted = 0;
    let skipped = 0;
    const errors = [];

    // Process each student
    for (const student of students) {
      try {
        const nextClass = findNextClass(
          student.current_class_name, 
          student.current_section
        );

        if (!nextClass) {
          skipped++;
          errors.push({
            studentId: student.id,
            studentName: student.name,
            currentClass: `${student.current_class_name} ${student.current_section || ''}`.trim(),
            reason: 'Next class not found'
          });
          continue;
        }

        // Verify next class exists in database
        const [classCheck] = await db.query(
          'SELECT id FROM classes WHERE id = ? AND school_id = ?',
          [nextClass.id, schoolId]
        );

        if (classCheck.length === 0) {
          skipped++;
          errors.push({
            studentId: student.id,
            studentName: student.name,
            currentClass: `${student.current_class_name} ${student.current_section || ''}`.trim(),
            reason: 'Next class not found in database'
          });
          continue;
        }

        // Update student's class
        await db.query(
          'UPDATE students SET class_id = ?, updated_at = NOW() WHERE id = ?',
          [nextClass.id, student.id]
        );

        promoted++;
      } catch (error) {
        skipped++;
        errors.push({
          studentId: student.id,
          studentName: student.name,
          error: error.message
        });
      }
    }

    await db.query('COMMIT');
    
    console.log(`✅ Student promotion completed: ${promoted} promoted, ${skipped} skipped`);

    res.json({
      success: true,
      promoted,
      skipped,
      total: students.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Promote students error:', error);
    res.status(500).json({ error: 'Failed to promote students' });
  }
});

module.exports = router;







