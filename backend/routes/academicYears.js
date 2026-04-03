const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');

// Get all academic years (filtered by school for admin and teacher)
router.get('/', authenticateToken, requireTeacher, async (req, res) => {
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

// Get active academic year (accessible to admin and teacher)
router.get('/active', authenticateToken, requireTeacher, async (req, res) => {
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

    // Verify academic year belongs to school and get status
    const [years] = await db.query(
      'SELECT id, status FROM academic_years WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (years.length === 0) {
      return res.status(404).json({ error: 'Academic year not found or access denied' });
    }

    if (years[0].status === 'completed') {
      return res.status(400).json({ error: 'Cannot edit a completed academic year. Only the active year can be edited.' });
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
       ORDER BY c.name, c.section, (NULLIF(regexp_replace(TRIM(COALESCE(s.roll_no::text, '')), '[^0-9]', '', 'g'), '')::bigint) NULLS LAST`,
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
        try {
          await db.query(
            `INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
               class_id = EXCLUDED.class_id,
               roll_no = EXCLUDED.roll_no`,
            [uuidv4(), student.id, newAcademicYearId, nextClass.id, student.roll_no || null, schoolId]
          );
        } catch (enrollErr) {
          if (enrollErr.code !== 'ER_NO_SUCH_TABLE') console.error('Enrollment on promote:', enrollErr);
        }

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

// Get yearly percentage summary for all students in a class
// Optimized for bulk operations (promotion use case)
// WEIGHTING RULE: Uses "marks-weighted" aggregation
// Formula: SUM(all marks obtained) / SUM(all max marks) × 100
router.get('/:id/class/:classId/yearly-summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id: academicYearId, classId } = req.params;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Verify academic year exists and belongs to school
    const [academicYears] = await db.query(
      'SELECT id, name FROM academic_years WHERE id = ? AND school_id = ?',
      [academicYearId, schoolId]
    );

    if (academicYears.length === 0) {
      return res.status(404).json({ error: 'Academic year not found' });
    }

    // Verify class exists and belongs to school
    const [classes] = await db.query(
      'SELECT id, name, section FROM classes WHERE id = ? AND school_id = ?',
      [classId, schoolId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get all students enrolled in this class for this academic year
    // Calculate yearly percentage in a single optimized query using GROUP BY
    // Include TC status for promotion eligibility
    const [yearlySummary] = await db.query(
      `SELECT 
        s.id as studentId,
        s.name as studentName,
        s.roll_no as rollNo,
        s.tc_status as tcStatus,
        se.class_id,
        COALESCE(SUM(tr.marks_obtained), 0) as totalMarks,
        COALESCE(SUM(tr.max_marks), 0) as totalMaxMarks,
        COUNT(DISTINCT tr.test_id) as testCount,
        CASE 
          WHEN COALESCE(SUM(tr.max_marks), 0) > 0 
          THEN ROUND((SUM(tr.marks_obtained) / SUM(tr.max_marks)) * 100, 2)
          ELSE 0 
        END as yearlyPercentage
       FROM student_enrollments se
       JOIN students s ON se.student_id = s.id
       LEFT JOIN test_results tr ON tr.student_id = s.id
       LEFT JOIN tests t ON tr.test_id = t.id 
         AND t.academic_year_id = se.academic_year_id
         AND t.academic_year_id = ?
       WHERE se.academic_year_id = ?
         AND se.class_id = ?
         AND se.school_id = ?
         AND s.status = 'approved'
       GROUP BY s.id, s.name, s.roll_no, s.tc_status, se.class_id
       ORDER BY (NULLIF(regexp_replace(TRIM(COALESCE(s.roll_no::text, '')), '[^0-9]', '', 'g'), '')::bigint) NULLS LAST, s.name`,
      [academicYearId, academicYearId, classId, schoolId]
    );

    res.json({
      academicYearId,
      academicYearName: academicYears[0].name,
      classId,
      className: `${classes[0].name}${classes[0].section ? ` ${classes[0].section}` : ''}`,
      studentCount: yearlySummary.length,
      students: yearlySummary.map(row => ({
        studentId: row.studentId,
        name: row.studentName,
        rollNo: row.rollNo,
        totalMarks: parseFloat(row.totalMarks),
        totalMaxMarks: parseFloat(row.totalMaxMarks),
        testCount: parseInt(row.testCount),
        yearlyPercentage: parseFloat(row.yearlyPercentage),
        hasResults: parseInt(row.testCount) > 0,
        tcIssued: row.tcStatus === 'issued'
      }))
    });

  } catch (error) {
    console.error('Get yearly summary error:', error);
    res.status(500).json({ error: 'Failed to fetch yearly summary' });
  }
});

// Promote students to next class or graduate final class students
// Transaction-safe, class-based promotion with manual selection
router.post('/:fromYearId/promote', authenticateToken, requireAdmin, async (req, res) => {
  // Start transaction
  await db.query('START TRANSACTION');
  
  try {
    const { fromYearId } = req.params;
    const { toAcademicYearId, classPromotions } = req.body;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'School ID not found' });
    }

    if (!toAcademicYearId || !classPromotions || !Array.isArray(classPromotions) || classPromotions.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'toAcademicYearId and classPromotions array are required' });
    }

    // Validate academic years exist and belong to school
    const [fromYear] = await db.query(
      'SELECT id, name FROM academic_years WHERE id = ? AND school_id = ?',
      [fromYearId, schoolId]
    );

    if (fromYear.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Source academic year not found' });
    }

    const [toYear] = await db.query(
      'SELECT id, name FROM academic_years WHERE id = ? AND school_id = ?',
      [toAcademicYearId, schoolId]
    );

    if (toYear.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Target academic year not found' });
    }

    // Get all classes for the school to detect final class
    const [allClasses] = await db.query(
      'SELECT id, name, section FROM classes WHERE school_id = ? ORDER BY name, section',
      [schoolId]
    );

    // Extract unique class numbers and find highest
    const classNumbers = new Set();
    allClasses.forEach(c => {
      const match = c.name.match(/\d+/);
      if (match) classNumbers.add(parseInt(match[0]));
    });
    const highestClassNumber = classNumbers.size > 0 ? Math.max(...Array.from(classNumbers)) : 0;

    let promotedCount = 0;
    let graduatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process each class promotion
    for (const promotion of classPromotions) {
      const { fromClassId, toClassId, studentIds } = promotion;

      if (!fromClassId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        skippedCount += studentIds?.length || 0;
        continue;
      }

      // Validate fromClass exists and belongs to school
      const [fromClass] = await db.query(
        'SELECT id, name, section FROM classes WHERE id = ? AND school_id = ?',
        [fromClassId, schoolId]
      );

      if (fromClass.length === 0) {
        skippedCount += studentIds.length;
        errors.push({
          classId: fromClassId,
          reason: 'Source class not found',
          studentCount: studentIds.length
        });
        continue;
      }

      // Check if this is final class
      const classMatch = fromClass[0].name.match(/\d+/);
      const isFinalClass = classMatch && parseInt(classMatch[0]) === highestClassNumber;

      // Validate students belong to fromYearId and fromClassId
      const placeholders = studentIds.map(() => '?').join(',');
      const [enrolledStudents] = await db.query(
        `SELECT s.id, s.name, s.tc_status 
         FROM student_enrollments se
         JOIN students s ON se.student_id = s.id
         WHERE se.academic_year_id = ? 
           AND se.class_id = ? 
           AND se.school_id = ?
           AND s.id IN (${placeholders})
           AND s.status = 'approved'`,
        [fromYearId, fromClassId, schoolId, ...studentIds]
      );

      const validStudentIds = enrolledStudents.map(s => s.id);
      const invalidCount = studentIds.length - validStudentIds.length;

      if (invalidCount > 0) {
        skippedCount += invalidCount;
        errors.push({
          classId: fromClassId,
          reason: `${invalidCount} student(s) not found or not enrolled in this class/year`,
          studentCount: invalidCount
        });
      }

      if (validStudentIds.length === 0) {
        continue;
      }

      // Check for duplicate enrollments in target year
      const validPlaceholders = validStudentIds.map(() => '?').join(',');
      const [existingEnrollments] = await db.query(
        `SELECT student_id FROM student_enrollments 
         WHERE academic_year_id = ? 
           AND student_id IN (${validPlaceholders})
           AND school_id = ?`,
        [toAcademicYearId, ...validStudentIds, schoolId]
      );

      const existingStudentIds = new Set(existingEnrollments.map(e => e.student_id));
      const newStudentIds = validStudentIds.filter(id => !existingStudentIds.has(id));

      if (newStudentIds.length < validStudentIds.length) {
        const duplicateCount = validStudentIds.length - newStudentIds.length;
        skippedCount += duplicateCount;
        errors.push({
          classId: fromClassId,
          reason: `${duplicateCount} student(s) already enrolled in target academic year`,
          studentCount: duplicateCount
        });
      }

      if (newStudentIds.length === 0) {
        continue;
      }

      // Process promotion or graduation
      if (isFinalClass && !toClassId) {
        // Graduation: Mark students as graduated
        // Note: Since students.status is ENUM('pending', 'approved', 'rejected'),
        // we keep status as 'approved' but don't create new enrollment
        // The absence of enrollment in next year indicates graduation
        // In future, we can add a 'graduated_at' timestamp field if needed
        graduatedCount += newStudentIds.length;
      } else if (toClassId) {
        // Promotion: Validate toClass exists
        const [toClass] = await db.query(
          'SELECT id, name, section FROM classes WHERE id = ? AND school_id = ?',
          [toClassId, schoolId]
        );

        if (toClass.length === 0) {
          skippedCount += newStudentIds.length;
          errors.push({
            classId: fromClassId,
            reason: 'Target class not found',
            studentCount: newStudentIds.length
          });
          continue;
        }

        // Bulk insert student_enrollments for next year
        // Get roll numbers from current enrollment
        const rollPlaceholders = newStudentIds.map(() => '?').join(',');
        const [currentEnrollments] = await db.query(
          `SELECT student_id, roll_no 
           FROM student_enrollments 
           WHERE academic_year_id = ? 
             AND student_id IN (${rollPlaceholders})
             AND school_id = ?`,
          [fromYearId, ...newStudentIds, schoolId]
        );

        const rollMap = new Map(currentEnrollments.map(e => [e.student_id, e.roll_no]));

        // Insert new enrollments
        for (const studentId of newStudentIds) {
          const rollNo = rollMap.get(studentId) || null;
          await db.query(
            `INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), studentId, toAcademicYearId, toClassId, rollNo, schoolId]
          );
        }

        promotedCount += newStudentIds.length;
      } else {
        skippedCount += newStudentIds.length;
        errors.push({
          classId: fromClassId,
          reason: 'toClassId required for non-final classes',
          studentCount: newStudentIds.length
        });
      }
    }

    await db.query('COMMIT');
    
    console.log(`✅ Student promotion completed: ${promotedCount} promoted, ${graduatedCount} graduated, ${skippedCount} skipped`);

    res.json({
      success: true,
      promotedCount,
      graduatedCount,
      skippedCount,
      total: promotedCount + graduatedCount + skippedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Promote students error:', error);
    res.status(500).json({ error: 'Failed to promote students', details: error.message });
  }
});

module.exports = router;







