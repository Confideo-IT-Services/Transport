const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');

// ============ TIME SLOTS ============

// Get time slots for school
router.get('/time-slots', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const [slots] = await db.query(
      `SELECT * FROM time_slots 
       WHERE school_id = ? 
       ORDER BY display_order, start_time`,
      [schoolId]
    );

    res.json(slots.map(s => {
      // Convert TIME format (HH:MM:SS) to HTML time input format (HH:MM)
      const formatTime = (time) => {
        if (!time) return '';
        // If it's already in HH:MM format, return as is
        if (typeof time === 'string' && time.length === 5) return time;
        // If it's in HH:MM:SS format, remove seconds
        if (typeof time === 'string' && time.includes(':')) {
          return time.substring(0, 5);
        }
        return time;
      };

      return {
        id: s.id,
        startTime: formatTime(s.start_time),
        endTime: formatTime(s.end_time),
        type: s.type,
        displayOrder: s.display_order
      };
    }));
  } catch (error) {
    console.error('Get time slots error:', error);
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
});

// Create time slot
router.post('/time-slots', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startTime, endTime, type, displayOrder } = req.body;
    const schoolId = req.user.schoolId;

    if (!startTime || !endTime || !type) {
      return res.status(400).json({ error: 'Start time, end time, and type are required' });
    }

    const slotId = uuidv4();
    await db.query(
      `INSERT INTO time_slots (id, school_id, start_time, end_time, type, display_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [slotId, schoolId, startTime, endTime, type, displayOrder || 0]
    );

    console.log('✅ Time slot created:', { slotId, startTime, endTime, type, schoolId });

    res.status(201).json({ success: true, id: slotId });
  } catch (error) {
    console.error('❌ Create time slot error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      message: error.message
    });
    
    // Check if table doesn't exist
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes("doesn't exist") || error.message.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Database tables not found. Please run the timetable schema SQL file first.',
        details: 'Apply timetable schema to PostgreSQL (e.g. psql or your migration tool) using backend/sql/timetable_schema.sql if applicable.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create time slot',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update time slot
router.put('/time-slots/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, type, displayOrder } = req.body;
    const schoolId = req.user.schoolId;

    // Verify slot belongs to school
    const [slots] = await db.query(
      'SELECT id FROM time_slots WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (slots.length === 0) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    const updates = [];
    const values = [];

    if (startTime) { updates.push('start_time = ?'); values.push(startTime); }
    if (endTime) { updates.push('end_time = ?'); values.push(endTime); }
    if (type) { updates.push('type = ?'); values.push(type); }
    if (displayOrder !== undefined) { updates.push('display_order = ?'); values.push(displayOrder); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await db.query(
      `UPDATE time_slots SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update time slot error:', error);
    res.status(500).json({ error: 'Failed to update time slot' });
  }
});

// Delete time slot
router.delete('/time-slots/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Verify slot belongs to school
    const [slots] = await db.query(
      'SELECT id FROM time_slots WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (slots.length === 0) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    await db.query('DELETE FROM time_slots WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete time slot error:', error);
    res.status(500).json({ error: 'Failed to delete time slot' });
  }
});

// ============ TIMETABLE ENTRIES ============

// Get timetable for a class
router.get('/class/:classId', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = req.user.schoolId;

    // Verify class belongs to school
    const [classes] = await db.query(
      'SELECT id FROM classes WHERE id = ? AND school_id = ?',
      [classId, schoolId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const [entries] = await db.query(
      `SELECT * FROM timetable_entries 
       WHERE class_id = ? 
       ORDER BY day_of_week, time_slot_id`,
      [classId]
    );

    res.json(entries.map(e => ({
      id: e.id,
      slotId: e.time_slot_id,
      day: e.day_of_week,
      subjectCode: e.subject_code,
      subjectName: e.subject_name,
      teacherId: e.teacher_id,
      teacherName: e.teacher_name
    })));
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

// Create or update timetable entry
router.post('/entries', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { classId, slotId, day, subjectCode, subjectName, teacherId, teacherName } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !slotId || !day || !subjectCode || !subjectName || !teacherName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify class belongs to school
    const [classes] = await db.query(
      'SELECT id FROM classes WHERE id = ? AND school_id = ?',
      [classId, schoolId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if entry already exists
    const [existing] = await db.query(
      'SELECT id FROM timetable_entries WHERE class_id = ? AND time_slot_id = ? AND day_of_week = ?',
      [classId, slotId, day]
    );

    if (existing.length > 0) {
      // Update existing entry
      await db.query(
        `UPDATE timetable_entries 
         SET subject_code = ?, subject_name = ?, teacher_id = ?, teacher_name = ?, updated_at = NOW()
         WHERE id = ?`,
        [subjectCode, subjectName, teacherId || null, teacherName, existing[0].id]
      );

      console.log('✅ Timetable entry updated:', { id: existing[0].id, classId, day, subjectCode, teacherName });
      res.json({ success: true, id: existing[0].id });
    } else {
      // Create new entry
      const entryId = uuidv4();
      await db.query(
        `INSERT INTO timetable_entries 
         (id, school_id, class_id, time_slot_id, day_of_week, subject_code, subject_name, teacher_id, teacher_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [entryId, schoolId, classId, slotId, day, subjectCode, subjectName, teacherId || null, teacherName]
      );

      console.log('✅ Timetable entry created:', { entryId, classId, day, subjectCode, teacherName });
      res.status(201).json({ success: true, id: entryId });
    }
  } catch (error) {
    console.error('❌ Create/Update timetable entry error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      message: error.message
    });
    res.status(500).json({ 
      error: 'Failed to create/update timetable entry',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete timetable entry
router.delete('/entries/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Verify entry belongs to school
    const [entries] = await db.query(
      'SELECT id FROM timetable_entries WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (entries.length === 0) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }

    await db.query('DELETE FROM timetable_entries WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete timetable entry error:', error);
    res.status(500).json({ error: 'Failed to delete timetable entry' });
  }
});

// ============ HOLIDAYS ============

// Get holidays for school
router.get('/holidays', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const [holidays] = await db.query(
      `SELECT * FROM holidays 
       WHERE school_id = ? 
       ORDER BY date`,
      [schoolId]
    );

    res.json(holidays.map(h => ({
      id: h.id,
      date: h.date,
      name: h.name,
      type: h.type
    })));
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// Create holiday
router.post('/holidays', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date, name, type } = req.body;
    const schoolId = req.user.schoolId;

    if (!date || !name || !type) {
      return res.status(400).json({ error: 'Date, name, and type are required' });
    }

    const holidayId = uuidv4();
    await db.query(
      `INSERT INTO holidays (id, school_id, date, name, type, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [holidayId, schoolId, date, name, type]
    );

    console.log('✅ Holiday created:', { holidayId, date, name, type, schoolId });

    res.status(201).json({ success: true, id: holidayId });
  } catch (error) {
    console.error('Create holiday error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Holiday already exists for this date' });
    }
    res.status(500).json({ error: 'Failed to create holiday' });
  }
});

// Delete holiday
router.delete('/holidays/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Verify holiday belongs to school
    const [holidays] = await db.query(
      'SELECT id FROM holidays WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (holidays.length === 0) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    await db.query('DELETE FROM holidays WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

// ============ TEACHER LEAVES ============

// Get teacher leaves for school
router.get('/leaves', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const schoolId = req.user.schoolId || req.user.school_id;

    const [leaves] = await db.query(
      `SELECT * FROM teacher_leaves 
       WHERE school_id = ? 
       ORDER BY created_at DESC, start_date DESC`,
      [schoolId]
    );

    res.json(leaves.map(l => ({
      id: l.id,
      teacherId: l.teacher_id,
      teacherName: l.teacher_name,
      startDate: l.start_date,
      endDate: l.end_date,
      reason: l.reason,
      status: l.status || 'pending'
    })));
  } catch (error) {
    console.error('Get teacher leaves error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher leaves' });
  }
});

// Create teacher leave (Only teachers can apply - admins cannot create leaves directly)
router.post('/leaves', authenticateToken, requireTeacher, async (req, res) => {
  try {
    // Only teachers can apply for leave - admins cannot create leaves directly
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can apply for leave. Admins can approve/reject leave requests.' });
    }

    const { teacherId, teacherName, startDate, endDate, reason } = req.body;
    
    // Teacher can only apply for their own leave
    const finalTeacherId = req.user.id;
    const schoolId = req.user.school_id || req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found for teacher' });
    }

    // Get teacher name if not provided
    let finalTeacherName = teacherName;
    if (!finalTeacherName) {
      const [teachers] = await db.query('SELECT name FROM teachers WHERE id = ?', [finalTeacherId]);
      if (teachers.length > 0) {
        finalTeacherName = teachers[0].name;
      } else {
        return res.status(404).json({ error: 'Teacher not found' });
      }
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Verify dates are valid
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const leaveId = uuidv4();
    // Insert with status as 'pending' by default
    await db.query(
      `INSERT INTO teacher_leaves (id, school_id, teacher_id, teacher_name, start_date, end_date, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [leaveId, schoolId, finalTeacherId, finalTeacherName, startDate, endDate, reason || null]
    );

    console.log('✅ Teacher leave application created (pending):', { leaveId, teacherId: finalTeacherId, teacherName: finalTeacherName, startDate, endDate, schoolId });

    res.status(201).json({ success: true, id: leaveId, status: 'pending' });
  } catch (error) {
    console.error('Create teacher leave error:', error);
    res.status(500).json({ error: 'Failed to create teacher leave' });
  }
});

// Approve teacher leave (Admin only)
router.put('/leaves/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Verify leave belongs to school
    const [leaves] = await db.query(
      'SELECT id, status FROM teacher_leaves WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (leaves.length === 0) {
      return res.status(404).json({ error: 'Teacher leave not found' });
    }

    // Update status to approved
    await db.query(
      'UPDATE teacher_leaves SET status = ?, updated_at = NOW() WHERE id = ?',
      ['approved', id]
    );

    console.log('✅ Teacher leave approved:', { id, schoolId });

    res.json({ success: true, status: 'approved' });
  } catch (error) {
    console.error('Approve teacher leave error:', error);
    res.status(500).json({ error: 'Failed to approve teacher leave' });
  }
});

// Reject teacher leave (Admin only)
router.put('/leaves/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Verify leave belongs to school
    const [leaves] = await db.query(
      'SELECT id, status FROM teacher_leaves WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (leaves.length === 0) {
      return res.status(404).json({ error: 'Teacher leave not found' });
    }

    // Update status to rejected
    await db.query(
      'UPDATE teacher_leaves SET status = ?, updated_at = NOW() WHERE id = ?',
      ['rejected', id]
    );

    console.log('✅ Teacher leave rejected:', { id, schoolId });

    res.json({ success: true, status: 'rejected' });
  } catch (error) {
    console.error('Reject teacher leave error:', error);
    res.status(500).json({ error: 'Failed to reject teacher leave' });
  }
});

// Delete teacher leave
router.delete('/leaves/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Verify leave belongs to school
    const [leaves] = await db.query(
      'SELECT id FROM teacher_leaves WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (leaves.length === 0) {
      return res.status(404).json({ error: 'Teacher leave not found' });
    }

    await db.query('DELETE FROM teacher_leaves WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete teacher leave error:', error);
    res.status(500).json({ error: 'Failed to delete teacher leave' });
  }
});

// ============ SUBJECTS ============

// Get subjects for school
router.get('/subjects', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const [subjects] = await db.query(
      'SELECT * FROM subjects WHERE school_id = ? ORDER BY name',
      [schoolId]
    );

    res.json(subjects.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      color: s.color
    })));
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create subject
router.post('/subjects', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { code, name, color } = req.body;
    const schoolId = req.user.schoolId;

    if (!code || !name) {
      return res.status(400).json({ error: 'Subject code and name are required' });
    }

    // Check if subject code already exists for this school
    const [existing] = await db.query(
      'SELECT id FROM subjects WHERE code = ? AND school_id = ?',
      [code, schoolId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Subject code already exists for this school' });
    }

    const subjectId = uuidv4();
    const defaultColor = color || 'bg-gray-100 text-gray-700 border-gray-200';
    
    await db.query(
      `INSERT INTO subjects (id, school_id, code, name, color, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [subjectId, schoolId, code.toUpperCase(), name, defaultColor]
    );

    console.log('✅ Subject created:', { subjectId, code, name, schoolId });

    res.status(201).json({ success: true, id: subjectId });
  } catch (error) {
    console.error('Create subject error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Failed to create subject',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete subject
router.delete('/subjects/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Verify subject belongs to school
    const [subjects] = await db.query(
      'SELECT id FROM subjects WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (subjects.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    await db.query('DELETE FROM subjects WHERE id = ? AND school_id = ?', [id, schoolId]);

    console.log('✅ Subject deleted:', { id, schoolId });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

module.exports = router;

