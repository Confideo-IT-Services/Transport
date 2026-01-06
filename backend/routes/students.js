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
      admissionNumber, // Admission number from registration form
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

    // Validate admission number if provided (should be mandatory)
    if (!admissionNumber || admissionNumber.trim() === '') {
      return res.status(400).json({ error: 'Admission number is required' });
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

    // Ensure admission_number column exists
    try {
      await db.query('SELECT admission_number FROM students LIMIT 1');
    } catch (err) {
      if (err.message && err.message.includes("Unknown column 'admission_number'")) {
        console.log('Creating admission_number column...');
        try {
          await db.query('ALTER TABLE students ADD COLUMN admission_number VARCHAR(50)');
          console.log('✅ admission_number column created');
        } catch (alterErr) {
          if (!alterErr.message || !alterErr.message.includes('Duplicate column name')) {
            throw alterErr;
          }
        }
        try {
          await db.query('CREATE INDEX idx_admission_number ON students(admission_number)');
          console.log('✅ admission_number index created');
        } catch (indexErr) {
          if (!indexErr.message || !indexErr.message.includes('Duplicate key name')) {
            console.log('Note: Could not create index, may already exist');
          }
        }
      } else {
        throw err;
      }
    }

    // Check if admission number already exists in this school
    const trimmedAdmissionNumber = admissionNumber.trim();
    const [existingAdmission] = await db.query(
      'SELECT id FROM students WHERE admission_number = ? AND school_id = ?',
      [trimmedAdmissionNumber, finalSchoolId]
    );
    if (existingAdmission.length > 0) {
      return res.status(400).json({ error: 'Admission number already exists in this school' });
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

    // Add admissionNumber to submittedData for reference
    submittedData.admissionNumber = trimmedAdmissionNumber;

    const [result] = await db.query(
      `INSERT INTO students (id, name, roll_no, class_id, school_id, parent_phone, parent_email, 
       parent_name, address, date_of_birth, gender, blood_group, photo_url, registration_code, submitted_data, admission_number, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [studentId, finalName, rollNo || null, finalClassId, finalSchoolId, finalParentPhone, 
       finalParentEmail, finalParentName, address || null, dateOfBirth || null,
       gender || null, bloodGroup || null, photoUrl || null, registrationCode || null, JSON.stringify(submittedData), trimmedAdmissionNumber]
    );

    console.log('✅ Student created:', { 
      studentId, 
      name: finalName, 
      classId: finalClassId, 
      schoolId: finalSchoolId, 
      admissionNumber: trimmedAdmissionNumber,
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

    // Get admission number - it should already exist from registration
    // Only generate if missing (for backward compatibility with old records)
    let admissionNumber = students[0].admission_number;
    if (!admissionNumber) {
      console.log('⚠️ Admission number missing for student, generating one...');
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
            'SELECT id FROM students WHERE admission_number = ? AND school_id = ?',
            [uniqueAdmissionNumber, schoolId]
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
      console.log('✅ Generated admission number:', admissionNumber);
    } else {
      console.log('✅ Using existing admission number from registration:', admissionNumber);
    }

    // Get student's class_id before updating
    const [studentInfo] = await db.query(
      'SELECT class_id FROM students WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (studentInfo.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentClassId = studentInfo[0].class_id;

    // Now update with admission number
    const [result] = await db.query(
      "UPDATE students SET status = 'approved', admission_number = ? WHERE id = ?", 
      [admissionNumber, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found or already approved' });
    }

    console.log('✅ Student approved:', { id, admissionNumber, affectedRows: result.affectedRows });

    // If fee structure exists for this class, create fee record for the student
    try {
      const [feeStructures] = await db.query(
        'SELECT * FROM fee_structure WHERE class_id = ? AND school_id = ?',
        [studentClassId, schoolId]
      );

      if (feeStructures.length > 0) {
        const structure = feeStructures[0];
        const finalTotalFee = parseFloat(structure.total_fee) || 0;

        // Check if fee record already exists
        const [existingFee] = await db.query(
          'SELECT id FROM student_fees WHERE student_id = ? AND class_id = ? LIMIT 1',
          [id, studentClassId]
        );

        if (existingFee.length === 0 && finalTotalFee > 0) {
          // Build component breakdown from fee structure
          const componentBreakdown = {
            tuition_fee: { total: parseFloat(structure.tuition_fee) || 0, paid: 0, pending: parseFloat(structure.tuition_fee) || 0 },
            transport_fee: { total: parseFloat(structure.transport_fee) || 0, paid: 0, pending: parseFloat(structure.transport_fee) || 0 },
            lab_fee: { total: parseFloat(structure.lab_fee) || 0, paid: 0, pending: parseFloat(structure.lab_fee) || 0 }
          };

          // Add other components if they exist
          if (structure.other_fees) {
            try {
              const otherFees = typeof structure.other_fees === 'string' 
                ? JSON.parse(structure.other_fees) 
                : structure.other_fees;
              
              if (otherFees && otherFees.components && Array.isArray(otherFees.components)) {
                otherFees.components.forEach(comp => {
                  const compKey = comp.name.toLowerCase().replace(/\s+/g, '_');
                  componentBreakdown[compKey] = { total: comp.amount || 0, paid: 0, pending: comp.amount || 0 };
                });
              }
            } catch (parseError) {
              console.error('Error parsing other_fees:', parseError);
            }
          }

          // Create fee record
          const studentFeeId = uuidv4();
          
          try {
            await db.query(
              `INSERT INTO student_fees (id, student_id, class_id, school_id, academic_year_id, total_fee, paid_amount, pending_amount, status, due_date, component_breakdown, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', NULL, ?, NOW())`,
              [
                studentFeeId,
                id,
                studentClassId,
                schoolId,
                structure.academic_year_id || null,
                finalTotalFee,
                finalTotalFee,
                JSON.stringify(componentBreakdown)
              ]
            );
            console.log(`✅ Auto-created fee record for approved student ${id} in class ${studentClassId}`);
          } catch (feeError) {
            // If duplicate or other error, log but don't fail student approval
            if (feeError.code === 'ER_DUP_ENTRY' || feeError.message?.includes('Duplicate')) {
              console.log(`⚠️ Fee record already exists for student ${id}, skipping creation`);
            } else {
              console.error('Error creating fee record for approved student:', feeError);
            }
          }
        }
      }
    } catch (feeStructureError) {
      // Don't fail student approval if fee structure check fails
      console.error('Error checking fee structure for approved student:', feeStructureError);
    }

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

// Update student (Teacher can update their class students)
router.put('/:id', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const teacherId = req.user.id;

    // Get student and verify teacher has access (student must be in teacher's assigned class)
    const [students] = await db.query(`
      SELECT s.*, c.class_teacher_id 
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND s.school_id = ?
    `, [id, schoolId]);

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = students[0];
    
    // Verify teacher is the class teacher for this student's class
    if (student.class_teacher_id !== teacherId) {
      return res.status(403).json({ error: 'Access denied. You can only update students in your assigned class' });
    }

    const {
      name, rollNo, address, dateOfBirth, gender, bloodGroup,
      fatherName, fatherPhone, fatherEmail, fatherOccupation,
      motherName, motherPhone, motherOccupation,
      emergencyContact, previousSchool, medicalConditions,
      parentPhone, parentEmail, parentName
    } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (rollNo !== undefined) { updates.push('roll_no = ?'); values.push(rollNo); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address || null); }
    if (dateOfBirth !== undefined) { updates.push('date_of_birth = ?'); values.push(dateOfBirth || null); }
    if (gender !== undefined) { updates.push('gender = ?'); values.push(gender || null); }
    if (bloodGroup !== undefined) { updates.push('blood_group = ?'); values.push(bloodGroup || null); }
    if (parentPhone !== undefined) { updates.push('parent_phone = ?'); values.push(parentPhone || null); }
    if (parentEmail !== undefined) { updates.push('parent_email = ?'); values.push(parentEmail || null); }
    if (parentName !== undefined) { updates.push('parent_name = ?'); values.push(parentName || null); }

    // Update submitted_data JSON if any fields are provided
    let submittedData = null;
    try {
      if (student.submitted_data) {
        submittedData = typeof student.submitted_data === 'string' 
          ? JSON.parse(student.submitted_data) 
          : student.submitted_data;
      } else {
        submittedData = {};
      }
    } catch (e) {
      submittedData = {};
    }

    // Update submitted_data fields
    if (fatherName !== undefined) submittedData.fatherName = fatherName || null;
    if (fatherPhone !== undefined) submittedData.fatherPhone = fatherPhone || null;
    if (fatherEmail !== undefined) submittedData.fatherEmail = fatherEmail || null;
    if (fatherOccupation !== undefined) submittedData.fatherOccupation = fatherOccupation || null;
    if (motherName !== undefined) submittedData.motherName = motherName || null;
    if (motherPhone !== undefined) submittedData.motherPhone = motherPhone || null;
    if (motherOccupation !== undefined) submittedData.motherOccupation = motherOccupation || null;
    if (emergencyContact !== undefined) submittedData.emergencyContact = emergencyContact || null;
    if (previousSchool !== undefined) submittedData.previousSchool = previousSchool || null;
    if (medicalConditions !== undefined) submittedData.medicalConditions = medicalConditions || null;

    if (Object.keys(submittedData).length > 0) {
      updates.push('submitted_data = ?');
      values.push(JSON.stringify(submittedData));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE students SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    console.log('✅ Student updated:', { id, updatedFields: updates.length });

    res.json({ success: true });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

module.exports = router;
