const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { attendanceStatusForApi } = require('../utils/attendanceStatus');

/** Aligns with fees.js list logic — ignore stale student_fees.status for parent API. */
function deriveStudentFeeStatus(totalFee, paidAmount) {
  const total = Number(totalFee) || 0;
  const paid = Number(paidAmount) || 0;
  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

// Helper: Verify parent owns student
async function verifyParentStudent(req, studentId) {
  const parentPhone = req.user.phone || req.user.id.replace('parent-', '');
  const cleanedPhone = parentPhone.replace(/\D/g, '');
  
  console.log('🔍 Verifying parent-student relationship:', {
    studentId,
    parentPhone: cleanedPhone
  });
  
  // Only verify parent_phone match - don't check school_id to allow multi-school access
  const [students] = await db.query(
    'SELECT id, school_id FROM students WHERE id = ? AND parent_phone = ? AND status = ?',
    [studentId, cleanedPhone, 'approved']
  );
  
  // Return student data if found, null otherwise
  return students.length > 0 ? students[0] : null;
}

// Get parent's children (students)
router.get('/children', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const parentPhone = req.user.phone || req.user.id.replace('parent-', '');
    const cleanedPhone = parentPhone.replace(/\D/g, '');
    
    console.log('🔍 Parent fetching children:', {
      userId: req.user.id,
      phone: req.user.phone,
      extractedPhone: cleanedPhone
    });
    
    // Get ALL children across ALL schools - no school_id filter
    const [students] = await db.query(
      `SELECT s.*, c.name as class_name, c.section as class_section, sch.name as school_name, sch.id as school_id
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN schools sch ON s.school_id = sch.id
       WHERE s.parent_phone = ? AND s.status = 'approved'
       ORDER BY sch.name, c.name, c.section, s.name`,
      [cleanedPhone]
    );

    console.log('📊 Found students:', students.length, students.map(s => ({ 
      id: s.id, 
      name: s.name, 
      school: s.school_name,
      class: s.class_name 
    })));

    res.json(students.map(s => ({
      id: s.id,
      name: s.name,
      rollNo: s.roll_no,
      classId: s.class_id,
      className: s.class_name ? `${s.class_name} ${s.class_section || ''}`.trim() : null,
      admissionNumber: s.admission_number,
      photoUrl: s.photo_url,
      schoolId: s.school_id,
      schoolName: s.school_name
    })));
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

// Get child's attendance
router.get('/children/:studentId/attendance', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify parent owns this student and get student's school_id
    const student = await verifyParentStudent(req, studentId);
    if (!student) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const studentSchoolId = student.school_id;

    let query = `
      SELECT a.id, a.student_id, a.class_id, to_char(a.date::date, 'YYYY-MM-DD') as date,
             a.status, a.marked_by, a.remarks, a.created_at
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.student_id = ? AND s.school_id = ?
    `;
    const params = [studentId, studentSchoolId];

    if (startDate && endDate) {
      query += ' AND a.date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else {
      // Default: last 30 days
      query += " AND a.date >= (CURRENT_DATE - INTERVAL '30 days')";
    }

    query += ' ORDER BY a.date DESC';

    const [attendance] = await db.query(query, params);

    console.log('📊 Attendance found:', attendance.length, 'records for student', studentId, 'in school', studentSchoolId);

    res.json(attendance.map(a => ({
      id: a.id,
      date: a.date,
      status: attendanceStatusForApi(a.status),
      remarks: a.remarks,
      createdAt: a.created_at
    })));
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

/** Class IDs for homework: students.class_id plus active student_enrollments (when table exists). */
async function getClassIdsForStudentHomework(studentId) {
  const ids = new Set();
  const [stuRows] = await db.query(
    'SELECT class_id, school_id FROM students WHERE id = ?',
    [studentId]
  );
  if (stuRows.length === 0) return { classIds: [], schoolId: null };
  if (stuRows[0].class_id) ids.add(stuRows[0].class_id);
  const schoolId = stuRows[0].school_id;
  try {
    const [enRows] = await db.query(
      `SELECT DISTINCT class_id FROM student_enrollments
       WHERE student_id = ? AND left_at IS NULL`,
      [studentId]
    );
    for (const r of enRows) {
      if (r.class_id) ids.add(r.class_id);
    }
  } catch (e) {
    const msg = String(e.message || '');
    if (e.code !== '42P01' && e.code !== 'ER_NO_SUCH_TABLE' && !msg.includes('student_enrollments')) {
      throw e;
    }
  }
  return { classIds: [...ids], schoolId };
}

// Get child's homework
router.get('/children/:studentId/homework', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId } = req.params;

    const student = await verifyParentStudent(req, studentId);
    if (!student) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { classIds, schoolId: studentSchoolId } = await getClassIdsForStudentHomework(studentId);
    if (classIds.length === 0) {
      console.log('📚 No class_id for student — no homework scope', { studentId, studentSchoolId });
      return res.json([]);
    }

    console.log('🔍 Fetching homework:', {
      studentId,
      classIds,
      schoolId: studentSchoolId
    });

    const placeholders = classIds.map(() => '?').join(', ');
    const [homework] = await db.query(
      `SELECT h.*,
              EXISTS (
                SELECT 1 FROM homework_submissions hs
                WHERE hs.homework_id = h.id
                  AND hs.student_id = ?
                  AND hs.is_completed IS TRUE
              ) AS is_completed
       FROM homework h
       WHERE h.class_id IN (${placeholders})
         AND (h.status IS NULL OR LOWER(h.status::text) = 'active')
       ORDER BY h.due_date DESC NULLS LAST, h.created_at DESC`,
      [studentId, ...classIds]
    );

    console.log('📚 Homework found:', homework.length, 'for classes', classIds);

    res.json(homework.map(h => ({
      id: h.id,
      title: h.title,
      description: h.description,
      subject: h.subject,
      dueDate: h.due_date,
      attachmentUrl: h.attachment_url,
      isCompleted: h.is_completed === true || h.is_completed === 1,
      createdAt: h.created_at
    })));
  } catch (error) {
    console.error('Get homework error:', error);
    res.status(500).json({ error: 'Failed to fetch homework' });
  }
});

// Get child's notifications
router.get('/children/:studentId/notifications', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId } = req.params;

    // Verify parent owns student
    const student = await verifyParentStudent(req, studentId);
    if (!student) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [notifications] = await db.query(
      `SELECT n.*, nr.is_read, nr.read_at, 
              COALESCE(u.name, t.name) as sender_name,
              COALESCE(u.role::text, n.sender_role::text) as sender_role
       FROM notifications n
       JOIN notification_recipients nr ON n.id = nr.notification_id
       LEFT JOIN users u ON n.sender_id = u.id AND n.sender_role = 'admin'
       LEFT JOIN teachers t ON n.sender_id = t.id AND n.sender_role = 'teacher'
       WHERE nr.recipient_type = 'parent' 
         AND nr.student_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [studentId]
    );

    console.log('📬 Notifications found:', notifications.length, 'for student', studentId);

    res.json(notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      senderName: n.sender_name,
      senderRole: n.sender_role,
      priority: n.priority,
      isRead: n.is_read === 1 || n.is_read === true,
      readAt: n.read_at,
      attachmentUrl: n.attachment_url,
      attachmentName: n.attachment_name,
      createdAt: n.created_at
    })));
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.post('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const parentPhone = req.user.phone || req.user.id.replace('parent-', '');
    const cleanedPhone = parentPhone.replace(/\D/g, '');

    // PostgreSQL: UPDATE ... FROM (not MySQL UPDATE ... JOIN)
    await db.query(
      `UPDATE notification_recipients nr
       SET is_read = TRUE, read_at = NOW()
       FROM students s
       WHERE nr.student_id = s.id
         AND nr.notification_id = ?
         AND nr.recipient_type = 'parent'
         AND s.parent_phone = ?`,
      [id, cleanedPhone]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Get child's fees
router.get('/children/:studentId/fees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId } = req.params;

    // Verify parent owns student and get student's school_id
    const student = await verifyParentStudent(req, studentId);
    if (!student) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const studentSchoolId = student.school_id;

    const [fees] = await db.query(
      `SELECT sf.*
       FROM student_fees sf
       WHERE sf.student_id = ? AND sf.school_id = ?
       ORDER BY sf.created_at DESC`,
      [studentId, studentSchoolId]
    );

    console.log('💰 Fees found:', fees.length, 'records for student', studentId, 'in school', studentSchoolId);

    res.json(
      fees.map((f) => {
        const totalFee = parseFloat(f.total_fee) || 0;
        const paidAmount = parseFloat(f.paid_amount) || 0;
        const pendingAmount = parseFloat(f.pending_amount) || 0;
        return {
          id: f.id,
          totalFee,
          paidAmount,
          pendingAmount,
          status: deriveStudentFeeStatus(totalFee, paidAmount),
          dueDate: f.due_date,
          componentBreakdown: f.component_breakdown
            ? typeof f.component_breakdown === 'string'
              ? JSON.parse(f.component_breakdown)
              : f.component_breakdown
            : null,
          createdAt: f.created_at,
        };
      })
    );
  } catch (error) {
    console.error('Get fees error:', error);
    res.status(500).json({ error: 'Failed to fetch fees' });
  }
});

// Get child's test results
router.get('/children/:studentId/test-results', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId } = req.params;

    // Verify parent owns student
    const student = await verifyParentStudent(req, studentId);
    if (!student) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [results] = await db.query(
      `SELECT tr.*, t.name as test_name, t.test_date, 
              sub.name as subject_name, sub.code as subject_code
       FROM test_results tr
       JOIN tests t ON tr.test_id = t.id
       JOIN subjects sub ON tr.subject_id = sub.id
       WHERE tr.student_id = ?
       ORDER BY t.test_date DESC, sub.name ASC`,
      [studentId]
    );

    console.log('📝 Test results found:', results.length, 'for student', studentId);

    res.json(results.map(r => ({
      id: r.id,
      testId: r.test_id,
      testName: r.test_name,
      testDate: r.test_date,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      subjectCode: r.subject_code,
      marksObtained: parseFloat(r.marks_obtained) || 0,
      maxMarks: r.max_marks || 100,
      percentage: r.max_marks > 0 ? ((parseFloat(r.marks_obtained) / r.max_marks) * 100).toFixed(2) : 0
    })));
  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({ error: 'Failed to fetch test results' });
  }
});

// Get tests for child's class
router.get('/children/:studentId/tests', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId } = req.params;

    // Verify parent owns student
    const student = await verifyParentStudent(req, studentId);
    if (!student) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get student's class_id
    const [students] = await db.query(
      'SELECT class_id, school_id FROM students WHERE id = ?',
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const classId = students[0].class_id;
    const schoolId = students[0].school_id;

    // Get all tests for this class
    const [tests] = await db.query(
      `SELECT t.*, c.name as class_name, c.section as class_section,
              (SELECT COUNT(*) FROM test_subjects WHERE test_id = t.id) as subject_count
       FROM tests t
       LEFT JOIN classes c ON t.class_id = c.id
       WHERE t.class_id = ? AND t.school_id = ?
       ORDER BY t.test_date DESC, t.created_at DESC`,
      [classId, schoolId]
    );

    res.json(tests.map(t => ({
      id: t.id,
      name: t.name,
      testTime: t.test_time,
      testDate: t.test_date,
      classId: t.class_id,
      className: t.class_name ? `${t.class_name} ${t.class_section || ''}`.trim() : null,
      subjectCount: t.subject_count,
      createdAt: t.created_at
    })));
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

// Get test details with subjects and syllabus for parent
router.get('/children/:studentId/tests/:testId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId, testId } = req.params;

    // Verify parent owns student
    const student = await verifyParentStudent(req, studentId);
    if (!student) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get student's class_id
    const [students] = await db.query(
      'SELECT class_id FROM students WHERE id = ?',
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const classId = students[0].class_id;

    // Get test details
    const [tests] = await db.query(
      `SELECT t.*, c.name as class_name, c.section as class_section
       FROM tests t
       LEFT JOIN classes c ON t.class_id = c.id
       WHERE t.id = ? AND t.class_id = ?`,
      [testId, classId]
    );

    if (tests.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const test = tests[0];

    // Get test subjects with syllabus
    const [testSubjects] = await db.query(
      `SELECT ts.*, s.name as subject_name, s.code as subject_code
       FROM test_subjects ts
       JOIN subjects s ON ts.subject_id = s.id
       WHERE ts.test_id = ?
       ORDER BY s.name`,
      [testId]
    );

    // Get test results for this student
    const [testResults] = await db.query(
      `SELECT tr.*, sub.name as subject_name, sub.code as subject_code
       FROM test_results tr
       JOIN subjects sub ON tr.subject_id = sub.id
       WHERE tr.test_id = ? AND tr.student_id = ?
       ORDER BY sub.name`,
      [testId, studentId]
    );

    res.json({
      id: test.id,
      name: test.name,
      testTime: test.test_time,
      testDate: test.test_date,
      classId: test.class_id,
      className: test.class_name ? `${test.class_name} ${test.class_section || ''}`.trim() : null,
      createdAt: test.created_at,
      subjects: testSubjects.map(ts => ({
        id: ts.id,
        subjectId: ts.subject_id,
        subjectName: ts.subject_name,
        subjectCode: ts.subject_code,
        maxMarks: ts.max_marks,
        syllabus: ts.syllabus
      })),
      results: testResults.map(tr => ({
        id: tr.id,
        subjectId: tr.subject_id,
        subjectName: tr.subject_name,
        subjectCode: tr.subject_code,
        marksObtained: parseFloat(tr.marks_obtained) || 0,
        maxMarks: tr.max_marks || 100,
        percentage: tr.max_marks > 0 ? ((parseFloat(tr.marks_obtained) / tr.max_marks) * 100).toFixed(2) : 0
      }))
    });
  } catch (error) {
    console.error('Get test details error:', error);
    res.status(500).json({ error: 'Failed to fetch test details' });
  }
});

module.exports = router;

