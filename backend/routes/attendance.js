const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');

// ============ STUDENT ATTENDANCE ============

// Get student attendance for a class on a specific date
router.get('/students/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    // Verify access
    let accessQuery = 'SELECT id FROM classes WHERE id = ?';
    const accessParams = [classId];

    if (req.user.role === 'admin') {
      accessQuery += ' AND school_id = ?';
      accessParams.push(req.user.schoolId);
    } else if (req.user.role === 'teacher') {
      accessQuery += ' AND school_id = ? AND class_teacher_id = ?';
      accessParams.push(req.user.schoolId, req.user.id);
    }

    const [classes] = await db.query(accessQuery, accessParams);
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    // Get attendance records
    const [attendance] = await db.query(
      `SELECT a.*, s.name as student_name, s.roll_no 
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.class_id = ? AND a.date = ?
       ORDER BY s.roll_no`,
      [classId, date]
    );

    // Get all students in the class
    const [students] = await db.query(
      `SELECT id, name, roll_no FROM students 
       WHERE class_id = ? AND status = 'approved' 
       ORDER BY roll_no`,
      [classId]
    );

    // Map attendance status to students
    const attendanceMap = {};
    attendance.forEach(a => {
      attendanceMap[a.student_id] = a.status;
    });

    res.json({
      classId,
      date,
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        rollNo: s.roll_no,
        status: attendanceMap[s.id] || null
      }))
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// Save student attendance
router.post('/students', authenticateToken, async (req, res) => {
  try {
    const { classId, date, students } = req.body;

    if (!classId || !date || !students || !Array.isArray(students)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify access
    let accessQuery = 'SELECT id FROM classes WHERE id = ?';
    const accessParams = [classId];

    if (req.user.role === 'admin') {
      accessQuery += ' AND school_id = ?';
      accessParams.push(req.user.schoolId);
    } else if (req.user.role === 'teacher') {
      accessQuery += ' AND school_id = ? AND class_teacher_id = ?';
      accessParams.push(req.user.schoolId, req.user.id);
    }

    const [classes] = await db.query(accessQuery, accessParams);
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    // Get a teacher ID for marked_by field (if admin, use class teacher or first teacher)
    let markedByTeacherId = null;
    if (req.user.role === 'admin') {
      // For admin, get the class teacher first, or any active teacher from the school
      const [classData] = await db.query(
        `SELECT class_teacher_id FROM classes WHERE id = ? AND school_id = ?`,
        [classId, req.user.schoolId]
      );
      
      if (classData.length > 0 && classData[0].class_teacher_id) {
        markedByTeacherId = classData[0].class_teacher_id;
      } else {
        // Fallback: get any active teacher from the school
        const [teachers] = await db.query(
          `SELECT id FROM teachers WHERE school_id = ? AND is_active = 1 LIMIT 1`,
          [req.user.schoolId]
        );
        if (teachers.length > 0) {
          markedByTeacherId = teachers[0].id;
        }
      }
    } else {
      markedByTeacherId = req.user.id;
    }

    if (!markedByTeacherId) {
      return res.status(400).json({ error: 'No teacher available to mark attendance. Please assign a class teacher first.' });
    }

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Delete existing attendance for this date and class
      await db.query(
        `DELETE FROM attendance WHERE class_id = ? AND date = ?`,
        [classId, date]
      );

      // Insert new attendance records
      for (const student of students) {
        if (student.status && ['present', 'absent', 'late', 'leave'].includes(student.status)) {
          // Ensure student.id is a string (UUID)
          const studentId = String(student.id);
          
          await db.query(
            `INSERT INTO attendance (id, student_id, class_id, date, status, marked_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = ?, marked_by = ?`,
            [
              uuidv4(),
              studentId,
              classId,
              date,
              student.status,
              markedByTeacherId,
              student.status,
              markedByTeacherId
            ]
          );
        }
      }

      await db.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Transaction error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Save student attendance error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save attendance';
    res.status(500).json({ error: errorMessage });
  }
});

// Get student attendance history
router.get('/students/:classId/history', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify access
    let accessQuery = 'SELECT id FROM classes WHERE id = ?';
    const accessParams = [classId];

    if (req.user.role === 'admin') {
      accessQuery += ' AND school_id = ?';
      accessParams.push(req.user.schoolId);
    } else if (req.user.role === 'teacher') {
      accessQuery += ' AND school_id = ? AND class_teacher_id = ?';
      accessParams.push(req.user.schoolId, req.user.id);
    }

    const [classes] = await db.query(accessQuery, accessParams);
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    let query = `
      SELECT a.date, a.class_id, 
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'id', s.id,
                 'name', s.name,
                 'rollNo', s.roll_no,
                 'status', a.status
               )
             ) as students,
             MAX(a.created_at) as markedAt
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.class_id = ?
    `;
    const params = [classId];

    if (startDate) {
      query += ' AND a.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a.date <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY a.date, a.class_id ORDER BY a.date DESC';

    const [records] = await db.query(query, params);

    res.json(records.map(r => ({
      date: r.date,
      classId: r.class_id,
      students: JSON.parse(r.students),
      markedAt: r.markedAt
    })));
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

// ============ TEACHER ATTENDANCE ============

// Get teacher attendance for a date
router.get('/teachers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get all teachers for the school
    const [teachers] = await db.query(
      `SELECT t.id, t.name, t.username, t.email
       FROM teachers t
       WHERE t.school_id = ? AND t.is_active = 1
       ORDER BY t.name`,
      [req.user.schoolId]
    );

    // Get attendance records for the date
    const [attendance] = await db.query(
      `SELECT * FROM teacher_attendance 
       WHERE school_id = ? AND date = ?`,
      [req.user.schoolId, targetDate]
    );

    // Map attendance to teachers
    const attendanceMap = {};
    attendance.forEach(a => {
      attendanceMap[a.teacher_id] = a;
    });

    res.json(teachers.map(t => {
      const att = attendanceMap[t.id];
      return {
        id: t.id,
        name: t.name,
        teacherName: t.name,
        status: att?.status || 'not-marked',
        checkIn: att?.check_in_time ? att.check_in_time.substring(0, 5) : null,
        checkOut: att?.check_out_time ? att.check_out_time.substring(0, 5) : null,
        checkInTime: att?.check_in_time || null,
        checkOutTime: att?.check_out_time || null,
        remarks: att?.remarks || null
      };
    }));
  } catch (error) {
    console.error('Get teacher attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher attendance' });
  }
});

// Teacher check-in
router.post('/teachers/checkin', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    console.log('Check-in attempt for teacher:', teacherId);

    const checkInTime = new Date();
    const today = new Date().toISOString().split('T')[0];
    const timeStr = checkInTime.toTimeString().substring(0, 5);

    // Get teacher's school_id
    const [teachers] = await db.query(
      'SELECT school_id FROM teachers WHERE id = ?',
      [teacherId]
    );

    if (teachers.length === 0) {
      console.error('Teacher not found in database:', teacherId);
      return res.status(404).json({ error: 'Teacher not found in database' });
    }

    const schoolId = teachers[0].school_id;

    if (!schoolId) {
      console.error('School ID not found for teacher:', teacherId);
      return res.status(400).json({ error: 'School ID not found for teacher' });
    }

    console.log('Teacher check-in:', { teacherId, schoolId, today, timeStr });

    // Check if attendance record exists
    const [existing] = await db.query(
      'SELECT * FROM teacher_attendance WHERE teacher_id = ? AND date = ?',
      [teacherId, today]
    );

    if (existing.length > 0) {
      // Update existing record
      console.log('Updating existing attendance record');
      await db.query(
        `UPDATE teacher_attendance 
         SET check_in_time = ?, status = 'present', updated_at = NOW()
         WHERE teacher_id = ? AND date = ?`,
        [timeStr, teacherId, today]
      );
    } else {
      // Create new record
      console.log('Creating new attendance record');
      const attendanceId = uuidv4();
      await db.query(
        `INSERT INTO teacher_attendance 
         (id, teacher_id, school_id, date, check_in_time, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'present', NOW(), NOW())`,
        [attendanceId, teacherId, schoolId, today, timeStr]
      );
    }

    console.log('✅ Check-in successful');
    res.json({ 
      success: true, 
      checkInTime: checkInTime.toISOString(),
      time: timeStr
    });
  } catch (error) {
    console.error('Teacher check-in error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to check in', 
      details: error.message,
      code: error.code
    });
  }
});

// Teacher check-out
router.post('/teachers/checkout', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const checkOutTime = new Date();
    const today = new Date().toISOString().split('T')[0];
    const timeStr = checkOutTime.toTimeString().substring(0, 5);

    // Update attendance record
    const [result] = await db.query(
      `UPDATE teacher_attendance 
       SET check_out_time = ?, updated_at = NOW()
       WHERE teacher_id = ? AND date = ?`,
      [timeStr, teacherId, today]
    );

    if (result.affectedRows === 0) {
      // If no record exists, create one
      const [teachers] = await db.query(
        'SELECT school_id FROM teachers WHERE id = ?',
        [teacherId]
      );

      if (teachers.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      await db.query(
        `INSERT INTO teacher_attendance 
         (id, teacher_id, school_id, date, check_out_time, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'present', NOW(), NOW())`,
        [uuidv4(), teacherId, teachers[0].school_id, today, timeStr]
      );
    }

    res.json({ 
      success: true, 
      checkOutTime: checkOutTime.toISOString(),
      time: timeStr
    });
  } catch (error) {
    console.error('Teacher check-out error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// Update teacher attendance status (Admin only)
router.post('/teachers/mark', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { teacherId, date, status, remarks } = req.body;

    if (!teacherId || !date || !status) {
      return res.status(400).json({ error: 'Missing required fields: teacherId, date, status' });
    }

    if (!['present', 'absent', 'late', 'leave', 'not-marked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify teacher belongs to admin's school
    const [teachers] = await db.query(
      'SELECT id, school_id FROM teachers WHERE id = ? AND school_id = ?',
      [teacherId, req.user.schoolId]
    );

    if (teachers.length === 0) {
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Check if record exists
    const [existing] = await db.query(
      'SELECT * FROM teacher_attendance WHERE teacher_id = ? AND date = ?',
      [teacherId, date]
    );

    if (existing.length > 0) {
      // Update existing record
      await db.query(
        `UPDATE teacher_attendance 
         SET status = ?, remarks = ?, marked_by = ?, updated_at = NOW()
         WHERE teacher_id = ? AND date = ?`,
        [status, remarks || null, req.user.id, teacherId, date]
      );
    } else {
      // Create new record
      await db.query(
        `INSERT INTO teacher_attendance 
         (id, teacher_id, school_id, date, status, remarks, marked_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [uuidv4(), teacherId, req.user.schoolId, date, status, remarks || null, req.user.id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark teacher attendance error:', error);
    res.status(500).json({ error: 'Failed to mark teacher attendance' });
  }
});

// Get teacher attendance history
router.get('/teachers/history', authenticateToken, async (req, res) => {
  try {
    const { teacherId, startDate, endDate } = req.query;

    let query = `
      SELECT ta.*, t.name as teacher_name
      FROM teacher_attendance ta
      JOIN teachers t ON ta.teacher_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'admin') {
      query += ' AND ta.school_id = ?';
      params.push(req.user.schoolId);
    } else if (req.user.role === 'teacher') {
      query += ' AND ta.teacher_id = ?';
      params.push(req.user.id);
    }

    if (teacherId) {
      query += ' AND ta.teacher_id = ?';
      params.push(teacherId);
    }

    if (startDate) {
      query += ' AND ta.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND ta.date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY ta.date DESC, t.name';

    const [records] = await db.query(query, params);

    res.json(records.map(r => ({
      id: r.id,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      date: r.date,
      status: r.status,
      checkIn: r.check_in_time,
      checkOut: r.check_out_time,
      remarks: r.remarks,
      markedBy: r.marked_by,
      createdAt: r.created_at
    })));
  } catch (error) {
    console.error('Get teacher attendance history error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher attendance history' });
  }
});

// ============ STATISTICS ============

// Get monthly attendance statistics
router.get('/stats/monthly', authenticateToken, async (req, res) => {
  try {
    const { classId, month, year } = req.query;
    const targetYear = year || new Date().getFullYear().toString();

    let query = `
      SELECT 
        DATE_FORMAT(date, '%Y-%m') as month,
        DATE_FORMAT(date, '%M %Y') as monthName,
        COUNT(DISTINCT CASE WHEN status = 'present' THEN student_id END) as present,
        COUNT(DISTINCT CASE WHEN status = 'absent' THEN student_id END) as absent,
        COUNT(DISTINCT CASE WHEN status = 'leave' THEN student_id END) as leave
      FROM attendance
      WHERE YEAR(date) = ?
    `;
    const params = [targetYear];

    if (classId) {
      query += ' AND class_id = ?';
      params.push(classId);
    }

    if (month) {
      query += ' AND MONTH(date) = ?';
      params.push(month);
    }

    if (req.user.role === 'admin') {
      // Filter by school classes
      query += ` AND class_id IN (
        SELECT id FROM classes WHERE school_id = ?
      )`;
      params.push(req.user.schoolId);
    } else if (req.user.role === 'teacher') {
      // Filter by teacher's classes
      query += ` AND class_id IN (
        SELECT id FROM classes WHERE school_id = ? AND class_teacher_id = ?
      )`;
      params.push(req.user.schoolId, req.user.id);
    }

    query += ' GROUP BY DATE_FORMAT(date, "%Y-%m"), DATE_FORMAT(date, "%M %Y") ORDER BY month DESC';

    const [stats] = await db.query(query, params);

    res.json(stats.map(s => ({
      month: s.month,
      monthName: s.monthName,
      present: parseInt(s.present) || 0,
      absent: parseInt(s.absent) || 0,
      leave: parseInt(s.leave) || 0
    })));
  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly statistics' });
  }
});

module.exports = router;

