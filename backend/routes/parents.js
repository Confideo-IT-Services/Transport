const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

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
      SELECT a.*, DATE_FORMAT(a.date, '%Y-%m-%d') as date
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
      query += ' AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    query += ' ORDER BY a.date DESC';

    const [attendance] = await db.query(query, params);

    console.log('📊 Attendance found:', attendance.length, 'records for student', studentId, 'in school', studentSchoolId);

    res.json(attendance.map(a => ({
      id: a.id,
      date: a.date,
      status: a.status,
      remarks: a.remarks,
      createdAt: a.created_at
    })));
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// Get child's homework
router.get('/children/:studentId/homework', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId } = req.params;

    // Verify parent owns student and get student's class_id
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
    const studentSchoolId = students[0].school_id;

    console.log('🔍 Fetching homework:', {
      studentId,
      classId,
      schoolId: studentSchoolId
    });

    // Query homework by class_id only (not school_id)
    // This ensures homework for the student's class shows up regardless of teacher's school_id
    const [homework] = await db.query(
      `SELECT h.*, 
              (SELECT COUNT(*) FROM homework_submissions hs 
               WHERE hs.homework_id = h.id 
                 AND hs.student_id = ? 
                 AND hs.is_completed = TRUE) > 0 as is_completed
       FROM homework h
       WHERE h.class_id = ?
       ORDER BY h.due_date DESC, h.created_at DESC`,
      [studentId, classId]
    );

    console.log('📚 Homework found:', homework.length, 'assignments for class', classId);

    res.json(homework.map(h => ({
      id: h.id,
      title: h.title,
      description: h.description,
      subject: h.subject,
      dueDate: h.due_date,
      attachmentUrl: h.attachment_url,
      isCompleted: h.is_completed === 1,
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
      `SELECT n.*, nr.is_read, nr.read_at, u.name as sender_name, u.role as sender_role
       FROM notifications n
       JOIN notification_recipients nr ON n.id = nr.notification_id
       LEFT JOIN users u ON n.sender_id = u.id
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

    // Update read status for all notifications linked to parent's children across all schools
    await db.query(
      `UPDATE notification_recipients nr
       JOIN students s ON nr.student_id = s.id
       SET nr.is_read = TRUE, nr.read_at = NOW() 
       WHERE nr.notification_id = ? 
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
      `SELECT sf.*, 
              COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_fee_id = sf.id), 0) as paid_amount_calculated
       FROM student_fees sf
       WHERE sf.student_id = ? AND sf.school_id = ?
       ORDER BY sf.created_at DESC`,
      [studentId, studentSchoolId]
    );

    console.log('💰 Fees found:', fees.length, 'records for student', studentId, 'in school', studentSchoolId);

    res.json(fees.map(f => ({
      id: f.id,
      totalFee: parseFloat(f.total_fee) || 0,
      paidAmount: parseFloat(f.paid_amount) || 0,
      pendingAmount: parseFloat(f.pending_amount) || 0,
      status: f.status,
      dueDate: f.due_date,
      componentBreakdown: f.component_breakdown ? 
        (typeof f.component_breakdown === 'string' ? JSON.parse(f.component_breakdown) : f.component_breakdown) 
        : null,
      createdAt: f.created_at
    })));
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

module.exports = router;

