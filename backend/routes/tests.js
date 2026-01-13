const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireTeacher } = require('../middleware/auth');

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
      query += ' WHERE t.teacher_id = ?';
      params.push(req.user.id);
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
    const { name, testTime, classId, subjects } = req.body; // subjects: [{subjectId, maxMarks, syllabus}]

    if (!name || !testTime || !classId || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'Name, test time, class, and at least one subject are required' });
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

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Create test
      const testId = uuidv4();
      await db.query(
        `INSERT INTO tests (id, name, test_time, class_id, teacher_id, school_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [testId, name, testTime, classId, teacherId, schoolId]
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

module.exports = router;







