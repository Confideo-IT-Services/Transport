const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireTeacher } = require('../middleware/auth');
const { sendWhatsAppMessage, formatPhoneNumber } = require('../services/whatsappService');
const templates = require('../config/whatsappTemplates');

// Get all tests (filtered by teacher/school)
router.get('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    let query = `
      SELECT t.*, c.name as class_name, c.section as class_section,
             (SELECT COUNT(*) FROM test_subjects WHERE test_id = t.id) as subject_count
      FROM tests t
      LEFT JOIN classes c ON t.class_id = c.id
    `;
    const params = [];

    if (req.user.role === 'teacher') {
      // For teachers: show tests they created OR tests for classes where they are class teacher
      query += ` WHERE (t.teacher_id = ? OR c.class_teacher_id = ?)`;
      params.push(req.user.id, req.user.id);
    } else if (req.user.role === 'admin') {
      query += ' WHERE t.school_id = ?';
      params.push(req.user.schoolId);
    }

    query += ' ORDER BY t.created_at DESC';

    const [tests] = await db.query(query, params);

    res.json(tests.map(t => ({
      id: t.id,
      name: t.name,
      testTime: t.test_time,
      testDate: t.test_date,
      classId: t.class_id,
      className: t.class_name ? `${t.class_name} ${t.class_section || ''}`.trim() : null,
      teacherId: t.teacher_id,
      schoolId: t.school_id,
      subjectCount: t.subject_count,
      createdAt: t.created_at
    })));
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

// Get test by ID with subjects and syllabus
router.get('/:id', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    // Get test details
    const [tests] = await db.query(
      `SELECT t.*, c.name as class_name, c.section as class_section
       FROM tests t
       LEFT JOIN classes c ON t.class_id = c.id
       WHERE t.id = ?`,
      [id]
    );

    if (tests.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const test = tests[0];

    // Verify access
    if (req.user.role === 'teacher' && test.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'admin' && test.school_id !== req.user.schoolId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get test subjects with syllabus
    const [testSubjects] = await db.query(
      `SELECT ts.*, s.name as subject_name, s.code as subject_code
       FROM test_subjects ts
       JOIN subjects s ON ts.subject_id = s.id
       WHERE ts.test_id = ?
       ORDER BY s.name`,
      [id]
    );

    res.json({
      id: test.id,
      name: test.name,
      testTime: test.test_time,
      testDate: test.test_date,
      classId: test.class_id,
      className: test.class_name ? `${test.class_name} ${test.class_section || ''}`.trim() : null,
      teacherId: test.teacher_id,
      schoolId: test.school_id,
      createdAt: test.created_at,
      subjects: testSubjects.map(ts => ({
        id: ts.id,
        subjectId: ts.subject_id,
        subjectName: ts.subject_name,
        subjectCode: ts.subject_code,
        maxMarks: ts.max_marks,
        syllabus: ts.syllabus
      }))
    });
  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ error: 'Failed to fetch test' });
  }
});

// Create test
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { name, testTime, testDate, classId, subjects } = req.body; // subjects: [{subjectId, maxMarks, syllabus}]

    if (!name || !testTime || !testDate || !classId || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'Name, test time, test date, class, and at least one subject are required' });
    }

    const teacherId = req.user.id;
    const schoolId = req.user.schoolId;

    // Verify teacher has access to this class
    if (req.user.role === 'teacher') {
      const [classes] = await db.query(
        'SELECT id FROM classes WHERE id = ? AND class_teacher_id = ?',
        [classId, teacherId]
      );
      if (classes.length === 0) {
        return res.status(403).json({ error: 'You do not have access to this class' });
      }
    } else if (req.user.role === 'admin') {
      const [classes] = await db.query(
        'SELECT id FROM classes WHERE id = ? AND school_id = ?',
        [classId, schoolId]
      );
      if (classes.length === 0) {
        return res.status(403).json({ error: 'Class not found or access denied' });
      }
    }

    // Fetch active academic year (required for test creation)
    const [activeYear] = await db.query(
      'SELECT id FROM academic_years WHERE school_id = ? AND status = ? LIMIT 1',
      [schoolId, 'active']
    );

    if (activeYear.length === 0) {
      return res.status(400).json({ 
        error: 'No active academic year found. Please create an active academic year before creating tests.' 
      });
    }

    const academicYearId = activeYear[0].id;

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Create test (with academic_year_id)
      const testId = uuidv4();
      await db.query(
        `INSERT INTO tests (id, name, test_time, test_date, class_id, teacher_id, school_id, academic_year_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [testId, name, testTime, testDate, classId, teacherId, schoolId, academicYearId]
      );

      // Add test subjects
      for (const subject of subjects) {
        if (!subject.subjectId || !subject.maxMarks) {
          continue;
        }
        const testSubjectId = uuidv4();
        await db.query(
          `INSERT INTO test_subjects (id, test_id, subject_id, max_marks, syllabus, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [testSubjectId, testId, subject.subjectId, subject.maxMarks, subject.syllabus || null]
        );
      }

      await db.query('COMMIT');
      res.status(201).json({ success: true, testId });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

// Update test
router.put('/:id', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, testTime, testDate, subjects } = req.body;

    // Verify test exists and user has access
    const [tests] = await db.query('SELECT id, teacher_id, school_id FROM tests WHERE id = ?', [id]);
    if (tests.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const test = tests[0];
    if (req.user.role === 'teacher' && test.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'admin' && test.school_id !== req.user.schoolId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!name || !testTime || !testDate) {
      return res.status(400).json({ error: 'Name, test time, and test date are required' });
    }

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Update test
      await db.query(
        `UPDATE tests 
         SET name = ?, test_time = ?, test_date = ?, updated_at = NOW()
         WHERE id = ?`,
        [name, testTime, testDate, id]
      );

      // Update subjects if provided
      if (subjects && Array.isArray(subjects) && subjects.length > 0) {
        // Delete existing test subjects
        await db.query('DELETE FROM test_subjects WHERE test_id = ?', [id]);

        // Add new test subjects
        for (const subject of subjects) {
          if (!subject.subjectId || !subject.maxMarks) {
            continue;
          }
          const testSubjectId = uuidv4();
          await db.query(
            `INSERT INTO test_subjects (id, test_id, subject_id, max_marks, syllabus, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [testSubjectId, id, subject.subjectId, subject.maxMarks, subject.syllabus || null]
          );
        }
      }

      await db.query('COMMIT');
      res.json({ success: true, message: 'Test updated successfully' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ error: 'Failed to update test' });
  }
});

// Save test results (marks)
router.post('/:id/results', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { results } = req.body; // [{studentId, subjectId, marksObtained}]

    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'Results must be an array' });
    }

    // Verify test exists and user has access
    const [tests] = await db.query('SELECT id, teacher_id, school_id FROM tests WHERE id = ?', [id]);
    if (tests.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const test = tests[0];
    if (req.user.role === 'teacher' && test.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'admin' && test.school_id !== req.user.schoolId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get test subjects to get max marks
    const [testSubjects] = await db.query(
      'SELECT subject_id, max_marks FROM test_subjects WHERE test_id = ?',
      [id]
    );
    const maxMarksMap = {};
    testSubjects.forEach(ts => {
      maxMarksMap[ts.subject_id] = ts.max_marks;
    });

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      for (const result of results) {
        if (!result.studentId || !result.subjectId || result.marksObtained === undefined) {
          continue;
        }

        const maxMarks = maxMarksMap[result.subjectId] || 100;
        const marksObtained = Math.min(Math.max(0, parseFloat(result.marksObtained)), maxMarks);

        await db.query(
          `INSERT INTO test_results (id, test_id, student_id, subject_id, marks_obtained, max_marks, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE 
             marks_obtained = VALUES(marks_obtained),
             updated_at = NOW()`,
          [uuidv4(), id, result.studentId, result.subjectId, marksObtained, maxMarks]
        );
      }

      await db.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Save test results error:', error);
    res.status(500).json({ error: 'Failed to save test results' });
  }
});

// Get test results for a test
router.get('/:id/results', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify test exists and user has access
    const [tests] = await db.query('SELECT id, teacher_id, school_id FROM tests WHERE id = ?', [id]);
    if (tests.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const test = tests[0];
    if (req.user.role === 'teacher' && test.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'admin' && test.school_id !== req.user.schoolId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all results grouped by student
    const [results] = await db.query(
      `SELECT tr.*, s.name as student_name, s.roll_no, s.parent_phone,
              sub.name as subject_name, sub.code as subject_code
       FROM test_results tr
       JOIN students s ON tr.student_id = s.id
       JOIN subjects sub ON tr.subject_id = sub.id
       WHERE tr.test_id = ?
       ORDER BY s.roll_no, sub.name`,
      [id]
    );

    // Group by student
    const studentResults = {};
    results.forEach(r => {
      if (!studentResults[r.student_id]) {
        studentResults[r.student_id] = {
          studentId: r.student_id,
          studentName: r.student_name,
          rollNo: r.roll_no,
          parentPhone: r.parent_phone,
          subjects: []
        };
      }
      studentResults[r.student_id].subjects.push({
        subjectId: r.subject_id,
        subjectName: r.subject_name,
        subjectCode: r.subject_code,
        marksObtained: parseFloat(r.marks_obtained),
        maxMarks: r.max_marks
      });
    });

    res.json(Object.values(studentResults));
  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({ error: 'Failed to fetch test results' });
  }
});

// Send test details to all parents
router.post('/:id/send-to-all', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify test exists and user has access
    const [tests] = await db.query(
      `SELECT t.*, c.name as class_name, c.section as class_section
       FROM tests t
       LEFT JOIN classes c ON t.class_id = c.id
       WHERE t.id = ?`,
      [id]
    );

    if (tests.length === 0) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const test = tests[0];

    // Verify access
    if (req.user.role === 'teacher' && test.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'admin' && test.school_id !== req.user.schoolId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get school name
    const [schools] = await db.query(
      'SELECT name FROM schools WHERE id = ?',
      [test.school_id]
    );
    const schoolName = schools.length > 0 ? schools[0].name : 'School';

    // Get test subjects with syllabus
    const [testSubjects] = await db.query(
      `SELECT ts.*, s.name as subject_name
       FROM test_subjects ts
       JOIN subjects s ON ts.subject_id = s.id
       WHERE ts.test_id = ?
       ORDER BY s.name`,
      [id]
    );

    if (testSubjects.length === 0) {
      return res.status(400).json({ error: 'Test has no subjects' });
    }

    // Format syllabus list
    const syllabusList = testSubjects
      .map(ts => `${ts.subject_name} (${ts.max_marks} marks)${ts.syllabus ? ` - ${ts.syllabus}` : ''}`)
      .join(', ');

    // Format test date
    const testDateFormatted = test.test_date
      ? new Date(test.test_date).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : 'Not specified';

    // Format class name
    const className = test.class_name
      ? `${test.class_name}${test.class_section ? ` ${test.class_section}` : ''}`.trim()
      : 'Class';

    // Get all students in the class with parent information
    const [students] = await db.query(
      `SELECT s.id, s.name, s.parent_phone, s.parent_name
       FROM students s
       WHERE s.class_id = ?
       AND s.status = 'approved'
       AND s.parent_phone IS NOT NULL
       AND s.parent_phone != ''`,
      [test.class_id]
    );

    if (students.length === 0) {
      return res.status(404).json({
        error: 'No students with valid parent phone numbers found for this class'
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
          student: student.name,
          phone: student.parent_phone,
          error: 'Invalid phone number format'
        });
        continue;
      }

      // Build template parameters
      const templateParams = [
        student.parent_name || student.name, // {{1}} Parent name
        test.name,                           // {{2}} Test name
        testDateFormatted,                   // {{3}} Test date
        className,                           // {{4}} Class name
        test.test_time || 'Not specified',   // {{5}} Duration
        syllabusList,                        // {{6}} Syllabus
        student.name,                        // {{7}} Student name
        schoolName                           // {{8}} School name
      ];

      // Send template message
      const result = await sendWhatsAppMessage(
        formattedPhone,
        'test', // Message type from config
        templateParams
      );

      if (result.success && (result.queueId || result.messageId)) {
        const queueId = result.queueId || result.messageId;
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
              student.name,
              templates.test.templateName,
              'test',
              result.messageStatus || 'queued',
              'test_details',
              id,
              test.school_id
            ]
          );
        } catch (logError) {
          console.error('Failed to log WhatsApp message for test:', logError);
        }
        results.successful++;
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Successfully sent test details to ${student.name} (${formattedPhone}) - Message ID: ${queueId}`);
        }
      } else {
        results.failed++;
        results.errors.push({
          student: student.name,
          phone: formattedPhone,
          error: result.error || 'Unknown error'
        });
        console.error(`❌ Failed to send test details to ${student.name} (${formattedPhone}): ${result.error}`);
      }
    }

    res.json({
      success: true,
      message: `Test details sent: ${results.successful} successful, ${results.failed} failed`,
      results
    });

  } catch (error) {
    console.error('Send test details to all parents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;







