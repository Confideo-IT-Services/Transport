const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');

// Get all students (filtered by school)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const [students] = await db.query(`
      SELECT s.*, c.name as class_name, c.section as class_section
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.school_id = ?
      ORDER BY s.created_at DESC
    `, [schoolId]);
    
    // Parse submitted_data JSON if it exists
    students.forEach(s => {
      if (s.submitted_data && typeof s.submitted_data === 'string') {
        try {
          s.submitted_data = JSON.parse(s.submitted_data);
        } catch (e) {
          console.error('Error parsing submitted_data:', e);
          s.submitted_data = null;
        }
      }
    });

    res.json(students.map(s => ({
      id: s.id,
      name: s.name,
      rollNo: s.roll_no,
      classId: s.class_id,
      className: s.class_name ? `${s.class_name} ${s.class_section || ''}`.trim() : null,
      class: s.class_name || '',
      section: s.class_section || '',
      parentPhone: s.parent_phone,
      parentEmail: s.parent_email,
      parentName: s.parent_name,
      address: s.address,
      dateOfBirth: s.date_of_birth,
      gender: s.gender,
      bloodGroup: s.blood_group,
      photoUrl: s.photo_url,
      avatar: s.photo_url || '',
      status: s.status,
      admissionNumber: s.admission_number || null,
      createdAt: s.created_at,
      submittedAt: s.created_at,
      registrationCode: s.registration_code || null,
      submittedData: s.submitted_data ? (typeof s.submitted_data === 'string' ? JSON.parse(s.submitted_data) : s.submitted_data) : null,
      // Map to old interface for compatibility
      fatherName: s.submitted_data ? (typeof s.submitted_data === 'string' ? JSON.parse(s.submitted_data) : s.submitted_data).fatherName : null,
      motherName: s.submitted_data ? (typeof s.submitted_data === 'string' ? JSON.parse(s.submitted_data) : s.submitted_data).motherName : null,
    })));
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get pending student registrations
router.get('/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const [students] = await db.query(`
      SELECT s.*, c.name as class_name, c.section as class_section
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.school_id = ? AND s.status = 'pending'
      ORDER BY s.created_at DESC
    `, [schoolId]);

    res.json(students.map(s => ({
      id: s.id,
      name: s.name,
      rollNo: s.roll_no,
      classId: s.class_id,
      className: s.class_name ? `${s.class_name} ${s.class_section || ''}`.trim() : null,
      parentPhone: s.parent_phone,
      parentEmail: s.parent_email,
      parentName: s.parent_name,
      status: s.status,
      admissionNumber: s.admission_number || null,
      createdAt: s.created_at
    })));
  } catch (error) {
    console.error('Get pending students error:', error);
    res.status(500).json({ error: 'Failed to fetch pending students' });
  }
});

// Create student (from registration form - no auth required)
router.post('/', async (req, res) => {
  try {
    const { 
      registrationCode, // Get schoolId from registration link
      name, rollNo, classId, schoolId,
      parentPhone, parentEmail, parentName,
      address, dateOfBirth, gender, bloodGroup, photoUrl,
      // Dynamic fields from form
      fatherName, fatherPhone, fatherEmail, fatherOccupation,
      motherName, motherPhone, motherOccupation,
      emergencyContact, previousSchool, medicalConditions,
      studentName, // Some forms might use studentName instead of name
      ...otherFields // Any other custom fields
    } = req.body;

    let finalSchoolId = schoolId;
    let finalClassId = classId;
    let finalName = name || studentName;

    // If registrationCode is provided, get schoolId and classId from registration link
    if (registrationCode) {
      const [links] = await db.query(
        'SELECT school_id, class_id FROM registration_links WHERE link_code = ? AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())',
        [registrationCode]
      );
      if (links.length > 0) {
        finalSchoolId = links[0].school_id;
        finalClassId = links[0].class_id;
        console.log('✅ Registration link found:', { registrationCode, schoolId: finalSchoolId, classId: finalClassId });
      } else {
        return res.status(404).json({ error: 'Invalid or expired registration link' });
      }
    }

    if (!finalName || !finalClassId || !finalSchoolId) {
      return res.status(400).json({ error: 'Name, class, and school are required' });
    }

    // Verify school and class exist
    const [schools] = await db.query('SELECT id FROM schools WHERE id = ?', [finalSchoolId]);
    if (schools.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const [classes] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [finalClassId, finalSchoolId]);
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Map form fields to database columns
    // Use father/mother fields as primary, fallback to parent fields
    const finalParentName = fatherName || parentName || null;
    const finalParentPhone = fatherPhone || parentPhone || emergencyContact || null;
    const finalParentEmail = fatherEmail || parentEmail || null;

    // Store all submitted data in JSON format for custom fields
    const submittedData = {
      name: finalName,
      rollNo: rollNo || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      bloodGroup: bloodGroup || null,
      address: address || null,
      photoUrl: photoUrl || null,
      fatherName: fatherName || null,
      fatherPhone: fatherPhone || null,
      fatherEmail: fatherEmail || null,
      fatherOccupation: fatherOccupation || null,
      motherName: motherName || null,
      motherPhone: motherPhone || null,
      motherOccupation: motherOccupation || null,
      emergencyContact: emergencyContact || null,
      previousSchool: previousSchool || null,
      medicalConditions: medicalConditions || null,
      ...otherFields // Include any custom fields
    };

    // Create student with pending status
    const studentId = uuidv4();
    
    // First, try to add registration_code column if it doesn't exist (for existing databases)
    try {
      await db.query('ALTER TABLE students ADD COLUMN registration_code VARCHAR(50)');
    } catch (err) {
      // Column might already exist, ignore error
      if (err.message && !err.message.includes('Duplicate column name')) {
        console.log('Note: registration_code column may already exist');
      }
    }
    
    // Try to add submitted_data JSON column if it doesn't exist
    try {
      await db.query('ALTER TABLE students ADD COLUMN submitted_data JSON');
    } catch (err) {
      // Column might already exist, ignore error
      if (err.message && !err.message.includes('Duplicate column name')) {
        console.log('Note: submitted_data column may already exist');
      }
    }

    const [result] = await db.query(
      `INSERT INTO students (id, name, roll_no, class_id, school_id, parent_phone, parent_email, 
       parent_name, address, date_of_birth, gender, blood_group, photo_url, registration_code, submitted_data, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [studentId, finalName, rollNo || null, finalClassId, finalSchoolId, finalParentPhone, 
       finalParentEmail, finalParentName, address || null, dateOfBirth || null,
       gender || null, bloodGroup || null, photoUrl || null, registrationCode || null, JSON.stringify(submittedData)]
    );

    console.log('✅ Student created:', { 
      studentId, 
      name: finalName, 
      classId: finalClassId, 
      schoolId: finalSchoolId, 
      status: 'pending',
      registrationCode: registrationCode || 'none'
    });

    res.status(201).json({ success: true, studentId });
  } catch (error) {
    console.error('❌ Create student error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Approve student registration
router.post('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // First, ensure the admission_number column exists BEFORE trying to query it
    try {
      // Check if column exists by trying to select it
      await db.query('SELECT admission_number FROM students LIMIT 1');
    } catch (err) {
      // Column doesn't exist, create it
      if (err.message && err.message.includes("Unknown column 'admission_number'")) {
        console.log('Creating admission_number column...');
        try {
          await db.query('ALTER TABLE students ADD COLUMN admission_number VARCHAR(50)');
          console.log('✅ admission_number column created');
        } catch (alterErr) {
          console.error('Error creating admission_number column:', alterErr);
          // If it still fails, throw the error
          if (!alterErr.message || !alterErr.message.includes('Duplicate column name')) {
            throw alterErr;
          }
        }
        
        // Try to add index
        try {
          await db.query('CREATE INDEX idx_admission_number ON students(admission_number)');
          console.log('✅ admission_number index created');
        } catch (indexErr) {
          // Index might already exist, ignore
          if (!indexErr.message || !indexErr.message.includes('Duplicate key name')) {
            console.log('Note: Could not create index, may already exist');
          }
        }
      } else {
        // Some other error, rethrow it
        throw err;
      }
    }

    // Now verify student belongs to admin's school (column exists now)
    const [students] = await db.query(
      'SELECT id, admission_number FROM students WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Generate admission number if not already exists
    let admissionNumber = students[0].admission_number;
    if (!admissionNumber) {
      const currentYear = new Date().getFullYear();
      // Use last 4 characters of UUID or generate sequential number
      const studentIdSuffix = id.slice(-4).toUpperCase();
      admissionNumber = `ADM${currentYear}${studentIdSuffix}`;
      
      // Ensure uniqueness - if exists, append number
      let counter = 1;
      let uniqueAdmissionNumber = admissionNumber;
      while (true) {
        try {
          const [existing] = await db.query(
            'SELECT id FROM students WHERE admission_number = ?',
            [uniqueAdmissionNumber]
          );
          if (existing.length === 0) {
            break;
          }
          uniqueAdmissionNumber = `${admissionNumber}${counter}`;
          counter++;
        } catch (err) {
          // If column doesn't exist in query, break (shouldn't happen now)
          if (err.message && err.message.includes("Unknown column 'admission_number'")) {
            break;
          }
          throw err;
        }
      }
      admissionNumber = uniqueAdmissionNumber;
    }

    // Now update with admission number
    const [result] = await db.query(
      "UPDATE students SET status = 'approved', admission_number = ? WHERE id = ?", 
      [admissionNumber, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found or already approved' });
    }

    console.log('✅ Student approved:', { id, admissionNumber, affectedRows: result.affectedRows });

    res.json({ success: true, admissionNumber });
  } catch (error) {
    console.error('Approve student error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Failed to approve student',
      details: error.message 
    });
  }
});

// Reject student registration
router.post('/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const schoolId = req.user.schoolId;

    // Verify student belongs to admin's school
    const [students] = await db.query(
      'SELECT id FROM students WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const [result] = await db.query(
      "UPDATE students SET status = 'rejected', rejection_reason = ? WHERE id = ?",
      [reason || null, id]
    );

    console.log('✅ Student rejected:', { id, affectedRows: result.affectedRows });

    res.json({ success: true });
  } catch (error) {
    console.error('Reject student error:', error);
    res.status(500).json({ error: 'Failed to reject student' });
  }
});

module.exports = router;
