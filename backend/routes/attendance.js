const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');
const { sendWhatsAppMessage, formatPhoneNumber } = require('../services/whatsappService');
const { toPgAttendanceStatus, attendanceStatusForApi } = require('../utils/attendanceStatus');

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
       WHERE a.class_id = ? AND a."date" = ?
       ORDER BY (NULLIF(regexp_replace(TRIM(COALESCE(s.roll_no::text, '')), '[^0-9]', '', 'g'), '')::bigint) NULLS LAST`,
      [classId, date]
    );

    // Get all students in the class
    const [students] = await db.query(
      `SELECT id, name, roll_no FROM students 
       WHERE class_id = ? AND status = 'approved' 
       ORDER BY (NULLIF(regexp_replace(TRIM(COALESCE(roll_no::text, '')), '[^0-9]', '', 'g'), '')::bigint) NULLS LAST`,
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
        status: attendanceStatusForApi(attendanceMap[s.id])
      }))
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// Save student attendance (teachers only)
router.post('/students', authenticateToken, async (req, res) => {
  try {
    // Restrict to teachers only - admins cannot mark attendance
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot mark attendance. Only teachers can mark attendance.' });
    }

    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can mark attendance.' });
    }

    const { classId, date, students } = req.body;

    if (!classId || !date || !students || !Array.isArray(students)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify access (only teachers can reach here)
    let accessQuery = 'SELECT id FROM classes WHERE id = ?';
    const accessParams = [classId];

    if (req.user.role === 'teacher') {
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
          `SELECT id FROM teachers WHERE school_id = ? AND is_active = TRUE LIMIT 1`,
          [req.user.schoolId]
        );
        if (teachers.length > 0) {
          markedByTeacherId = teachers[0].id;
        }
      }
    } else if (req.user.role === 'teacher') {
      // Verify the teacher exists in the teachers table
        const [teacherCheck] = await db.query(
        `SELECT id FROM teachers WHERE id = ? AND school_id = ? AND is_active = TRUE`,
        [req.user.id, req.user.schoolId]
      );
      
      if (teacherCheck.length > 0) {
        markedByTeacherId = req.user.id;
      } else {
        // Teacher doesn't exist in teachers table - try to get class teacher or any teacher
        const [classData] = await db.query(
          `SELECT class_teacher_id FROM classes WHERE id = ? AND school_id = ?`,
          [classId, req.user.schoolId]
        );
        
        if (classData.length > 0 && classData[0].class_teacher_id) {
          markedByTeacherId = classData[0].class_teacher_id;
        } else {
          // Fallback: get any active teacher from the school
          const [teachers] = await db.query(
            `SELECT id FROM teachers WHERE school_id = ? AND is_active = TRUE LIMIT 1`,
            [req.user.schoolId]
          );
          if (teachers.length > 0) {
            markedByTeacherId = teachers[0].id;
          }
        }
      }
    }

    if (!markedByTeacherId) {
      return res.status(400).json({ 
        error: 'No teacher available to mark attendance. Please ensure the teacher exists in the system or assign a class teacher first.',
        details: 'The teacher account may not be properly linked to the teachers table.'
      });
    }

    // Single connection for BEGIN → DELETE → INSERTs → COMMIT (db.query uses a new client each call)
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `DELETE FROM attendance WHERE class_id = ? AND "date" = ?`,
        [classId, date]
      );

      for (const student of students) {
        const apiStatus = student.status && String(student.status).trim().toLowerCase();
        if (apiStatus && ['present', 'absent', 'late', 'leave'].includes(apiStatus)) {
          const pgStatus = toPgAttendanceStatus(apiStatus);
          if (!pgStatus) continue;
          const studentId = String(student.id);
          await conn.query(
            `INSERT INTO attendance (id, student_id, class_id, "date", status, marked_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              studentId,
              classId,
              date,
              pgStatus,
              markedByTeacherId
            ]
          );
        }
      }

      await conn.commit();
      res.json({ success: true });
    } catch (error) {
      try {
        await conn.rollback();
      } catch (rbErr) {
        console.error('Attendance save rollback error:', rbErr.message);
      }
      console.error('Transaction error:', error);
      throw error;
    } finally {
      conn.release();
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

    // PostgreSQL: json_agg/json_build_object (MySQL used JSON_ARRAYAGG/JSON_OBJECT)
    let query = `
      SELECT a."date" AS date, a.class_id,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', s.id,
                   'name', s.name,
                   'rollNo', s.roll_no,
                   'status', a.status
                 ) ORDER BY s.name
               ) FILTER (WHERE s.id IS NOT NULL),
               '[]'::json
             ) AS students,
             MAX(a.created_at) AS "markedAt"
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.class_id = ?
    `;
    const params = [classId];

    if (startDate) {
      query += ' AND a."date" >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a."date" <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY a."date", a.class_id ORDER BY a."date" DESC';

    const [records] = await db.query(query, params);

    res.json(records.map(r => {
      // pg may return json_agg as array/object; keys may be lowercased unless quoted in SQL
      let students = [];
      const rawStudents = r.students;
      if (rawStudents != null) {
        try {
          if (typeof rawStudents === 'string') {
            students = JSON.parse(rawStudents);
          } else if (Array.isArray(rawStudents)) {
            students = rawStudents;
          }
        } catch (e) {
          console.error('Error parsing students JSON:', e);
          students = [];
        }
      }

      const studentsNorm = students.map((st) => ({
        ...st,
        status:
          st && st.status != null && st.status !== ''
            ? attendanceStatusForApi(st.status)
            : null,
      }));

      return {
        date: r.date,
        classId: r.class_id ?? r.classId,
        students: studentsNorm,
        markedAt: r.markedAt ?? r.markedat
      };
    }));
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
       WHERE t.school_id = ? AND t.is_active = TRUE
       ORDER BY t.name`,
      [req.user.schoolId]
    );

    // Get attendance records for the date
    const [attendance] = await db.query(
      `SELECT * FROM teacher_attendance 
       WHERE school_id = ? AND attendance_date = ?`,
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
        status:
          att != null && att.status != null && att.status !== ''
            ? attendanceStatusForApi(att.status)
            : 'not-marked',
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
      'SELECT * FROM teacher_attendance WHERE teacher_id = ? AND attendance_date = ?',
      [teacherId, today]
    );

    const presentPg = toPgAttendanceStatus('present');
    if (existing.length > 0) {
      // Update existing record
      console.log('Updating existing attendance record');
      await db.query(
        `UPDATE teacher_attendance 
         SET check_in_time = ?, status = ?, updated_at = NOW()
         WHERE teacher_id = ? AND attendance_date = ?`,
        [timeStr, presentPg, teacherId, today]
      );
    } else {
      // Create new record
      console.log('Creating new attendance record');
      const attendanceId = uuidv4();
      await db.query(
        `INSERT INTO teacher_attendance 
         (id, teacher_id, school_id, attendance_date, check_in_time, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [attendanceId, teacherId, schoolId, today, timeStr, presentPg]
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
       WHERE teacher_id = ? AND attendance_date = ?`,
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
         (id, teacher_id, school_id, attendance_date, check_out_time, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [uuidv4(), teacherId, teachers[0].school_id, today, timeStr, toPgAttendanceStatus('present')]
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

    const pgStatus = toPgAttendanceStatus(status);
    if (!pgStatus) {
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
      'SELECT * FROM teacher_attendance WHERE teacher_id = ? AND attendance_date = ?',
      [teacherId, date]
    );

    if (existing.length > 0) {
      // Update existing record
      await db.query(
        `UPDATE teacher_attendance 
         SET status = ?, remarks = ?, marked_by = ?, updated_at = NOW()
         WHERE teacher_id = ? AND attendance_date = ?`,
        [pgStatus, remarks || null, req.user.id, teacherId, date]
      );
    } else {
      // Create new record
      await db.query(
        `INSERT INTO teacher_attendance 
         (id, teacher_id, school_id, attendance_date, status, remarks, marked_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [uuidv4(), teacherId, req.user.schoolId, date, pgStatus, remarks || null, req.user.id]
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
      query += ' AND ta.attendance_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND ta.attendance_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY ta.attendance_date DESC, t.name';

    const [records] = await db.query(query, params);

    res.json(records.map(r => ({
      id: r.id,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      date: r.attendance_date ?? r.date,
      status: attendanceStatusForApi(r.status),
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

    // PostgreSQL: "date" is reserved — quote column; status may be enum with non-lowercase labels
    let query = `
      SELECT 
        to_char("date"::date, 'YYYY-MM') as month,
        to_char("date"::date, 'FMMonth YYYY') as monthName,
        COUNT(CASE WHEN LOWER(status::text) = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN LOWER(status::text) = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN LOWER(status::text) = 'leave' THEN 1 END) as leave
      FROM attendance
      WHERE EXTRACT(YEAR FROM "date"::date) = ?
    `;
    const params = [targetYear];

    if (classId) {
      query += ' AND class_id = ?';
      params.push(classId);
    }

    if (month) {
      query += ' AND EXTRACT(MONTH FROM "date"::date) = ?';
      params.push(month);
    }

    if (req.user.role === 'admin') {
      // Filter by school classes
      if (!req.user.schoolId) {
        console.error('Get monthly stats error: School ID not found for admin user');
        return res.status(400).json({ error: 'School ID not found for admin user' });
      }
      query += ` AND class_id IN (
        SELECT id FROM classes WHERE school_id = ?
      )`;
      params.push(req.user.schoolId);
    } else if (req.user.role === 'teacher') {
      // Filter by teacher's classes
      if (!req.user.schoolId || !req.user.id) {
        console.error('Get monthly stats error: School ID or user ID not found for teacher user');
        return res.status(400).json({ error: 'School ID or user ID not found for teacher user' });
      }
      query += ` AND class_id IN (
        SELECT id FROM classes WHERE school_id = ? AND class_teacher_id = ?
      )`;
      params.push(req.user.schoolId, req.user.id);
    }

    query += ' GROUP BY to_char("date"::date, \'YYYY-MM\'), to_char("date"::date, \'FMMonth YYYY\') ORDER BY month DESC';

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

// Send monthly attendance reports to all parents via WhatsApp
router.post('/send-to-all', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { month, year, classId } = req.body; // month: 1-12, year: 2026

    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const schoolId = req.user.schoolId;

    // Get school name
    const [schools] = await db.query(
      'SELECT name FROM schools WHERE id = ?',
      [schoolId]
    );
    const schoolName = schools.length > 0 ? schools[0].name : 'School';

    // Format month name (e.g., "January 2026")
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthText = `${monthNames[parseInt(month) - 1]} ${year}`;

    // Build query to get students with attendance percentage
    let studentsQuery = `
      SELECT 
        s.id,
        s.name as student_name,
        s.parent_phone,
        s.parent_name,
        c.name as class_name,
        COUNT(CASE WHEN LOWER(a.status::text) = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN LOWER(a.status::text) IN ('present', 'absent', 'leave') THEN 1 END) as total_days,
        CASE 
          WHEN COUNT(CASE WHEN LOWER(a.status::text) IN ('present', 'absent', 'leave') THEN 1 END) > 0
          THEN ROUND(
            (COUNT(CASE WHEN LOWER(a.status::text) = 'present' THEN 1 END) * 100.0) / 
            COUNT(CASE WHEN LOWER(a.status::text) IN ('present', 'absent', 'leave') THEN 1 END),
            1
          )
          ELSE 0
        END as attendance_percentage
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN attendance a ON a.student_id = s.id 
        AND EXTRACT(YEAR FROM a."date"::date) = ? 
        AND EXTRACT(MONTH FROM a."date"::date) = ?
      WHERE s.status = 'approved'
        AND s.parent_phone IS NOT NULL 
        AND s.parent_phone != ''
    `;

    const queryParams = [year, month];

    // Add class filter if provided
    if (classId) {
      studentsQuery += ' AND s.class_id = ?';
      queryParams.push(classId);
    }

    // Add school filter
    studentsQuery += ' AND s.school_id = ?';
    queryParams.push(schoolId);

    // Add teacher filter if teacher
    if (req.user.role === 'teacher') {
      studentsQuery += ` AND s.class_id IN (
        SELECT id FROM classes WHERE school_id = ? AND class_teacher_id = ?
      )`;
      queryParams.push(schoolId, req.user.id);
    }

    studentsQuery += ' GROUP BY s.id, s.name, s.parent_phone, s.parent_name, c.name';
    studentsQuery += ' HAVING total_days > 0'; // Only students with attendance records

    const [students] = await db.query(studentsQuery, queryParams);

    if (students.length === 0) {
      return res.status(404).json({ 
        error: 'No students with attendance records found for this month' 
      });
    }

    // Send messages to all parents
    const results = {
      total: students.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const student of students) {
      const formattedPhone = formatPhoneNumber(student.parent_phone);
      
      if (!formattedPhone) {
        results.failed++;
        results.errors.push({
          student: student.student_name,
          phone: student.parent_phone,
          error: 'Invalid phone number format'
        });
        continue;
      }

      // Build template parameters for attendance template
      // Template: Hello {{1}}, 📊 This month "{{2}}" Attendance Report of your child *{{3}}* is {{4}}%. Thank you, {{5}} Management.
      // Parameters: [parent_name, month, student_name, attendance_percentage, school_name]
      const templateParams = [
        student.parent_name || 'Parent',           // {{1}} - Parent name
        monthText,                                 // {{2}} - Month (e.g., "January 2026")
        student.student_name,                      // {{3}} - Student name
        student.attendance_percentage.toString(),   // {{4}} - Attendance percentage (e.g., "80")
        schoolName                                 // {{5}} - School name
      ];

      // Send template message using the new multi-template system
      const result = await sendWhatsAppMessage(
        formattedPhone,
        'attendance',  // Message type from config
        templateParams
      );

      if (result.success && (result.queueId || result.messageId)) {
        const queueId = result.queueId || result.messageId;
        
        // Log successful message to database
        try {
          await db.query(
            `INSERT INTO whatsapp_messages 
             (id, queue_id, message_id, recipient_phone, recipient_name, template_name, 
              message_type, status, related_type, related_id, school_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              queueId,
              result.messageId || null,
              formattedPhone,
              student.student_name,
              'convent_pulse_attendance',
              'template',
              result.messageStatus || 'queued',
              'attendance',
              `${year}-${month}`, // Store year-month as related_id
              schoolId
            ]
          );
        } catch (logError) {
          console.error('Failed to log WhatsApp message:', logError);
        }

        results.successful++;
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Successfully sent attendance to ${student.student_name} (${formattedPhone}) - Message ID: ${queueId}`);
        }
      } else {
        results.failed++;
        results.errors.push({
          student: student.student_name,
          phone: formattedPhone,
          error: result.error || 'Failed to send message'
        });
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ Failed to send to ${student.student_name}:`, result.error);
        }
      }
    }

    res.json({
      success: true,
      message: `Attendance reports sent: ${results.successful} successful, ${results.failed} failed`,
      results: {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('Send attendance reports error:', error);
    res.status(500).json({ error: 'Failed to send attendance reports' });
  }
});

module.exports = router;

