const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');

// Helper: Get school code from school ID
async function getSchoolCode(schoolId) {
  try {
    const [schools] = await db.query('SELECT code FROM schools WHERE id = ?', [schoolId]);
    if (schools.length > 0) {
      // Extract prefix from school code (e.g., "CITTA001" -> "CITTA")
      const code = schools[0].code || '';
      // Remove numbers and special chars, keep only letters
      return code.replace(/[^A-Za-z]/g, '').toUpperCase() || 'SCH';
    }
    return 'SCH';
  } catch (error) {
    console.error('Error getting school code:', error);
    return 'SCH';
  }
}

// Helper: Generate admission number
async function generateAdmissionNumber(schoolCode, year, schoolId, startNumber = null) {
  // Format: SCHOOLCODE-YEAR-XXXX (e.g., CITTA-2025-0501)
  const prefix = `${schoolCode}-${year}-`;
  
  let nextNumber = startNumber;
  
  if (nextNumber === null) {
    // Find the last admission number with this prefix
    const [lastAdmission] = await db.query(
      `SELECT admission_number FROM students 
       WHERE school_id = ? AND admission_number LIKE ? 
       ORDER BY admission_number DESC LIMIT 1`,
      [schoolId, `${prefix}%`]
    );
    
    nextNumber = 1;
    if (lastAdmission.length > 0) {
      const lastNum = lastAdmission[0].admission_number;
      const match = lastNum.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
  }
  
  // Ensure 4-digit padding
  const admissionNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
  
  // Double-check uniqueness
  const [existing] = await db.query(
    'SELECT id FROM students WHERE admission_number = ? AND school_id = ?',
    [admissionNumber, schoolId]
  );
  
  if (existing.length > 0) {
    // If exists, increment and try again
    return generateAdmissionNumber(schoolCode, year, schoolId, nextNumber + 1);
  }
  
  return admissionNumber;
}

// Helper: map DB student row (with class_name, class_section) to API response
function mapStudentToResponse(s) {
  const submittedData = s.submitted_data != null && typeof s.submitted_data === 'string'
    ? (() => { try { return JSON.parse(s.submitted_data); } catch (e) { return null; } })()
    : s.submitted_data;
  
  // Parse extra_fields JSON if it exists
  let extraFields = {};
  if (s.extra_fields) {
    try {
      extraFields = typeof s.extra_fields === 'string' 
        ? JSON.parse(s.extra_fields) 
        : s.extra_fields;
    } catch (e) {
      console.error('Error parsing extra_fields:', e);
      extraFields = {};
    }
  }
  
  return {
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
    tcStatus: s.tc_status || 'none',
    admissionNumber: s.admission_number || null,
    createdAt: s.created_at,
    submittedAt: s.created_at,
    registrationCode: s.registration_code || null,
    submittedData: submittedData,
    fatherName: submittedData?.fatherName ?? null,
    motherName: submittedData?.motherName ?? null,
    extra_fields: extraFields,
  };
}

// Get all students (filtered by school); optional academicYearId for year filter
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const academicYearId = req.query.academicYearId || null;

    if (academicYearId) {
      try {
        const [enrollments] = await db.query(
          `SELECT e.id as enrollment_id, e.student_id, e.academic_year_id, e.class_id, e.roll_no,
                  s.id, s.name, s.parent_phone, s.parent_email, s.parent_name, s.address, s.date_of_birth,
                  s.gender, s.blood_group, s.photo_url, s.status, s.tc_status, s.admission_number,
                  s.registration_code, s.submitted_data, s.extra_fields, s.created_at,
                  c.name as class_name, c.section as class_section
           FROM student_enrollments e
           JOIN students s ON s.id = e.student_id AND s.school_id = ?
           LEFT JOIN classes c ON c.id = e.class_id
           WHERE e.school_id = ? AND e.academic_year_id = ?
           ORDER BY c.name, c.section, (NULLIF(regexp_replace(TRIM(COALESCE(e.roll_no::text, '')), '[^0-9]', '', 'g'), '')::bigint) NULLS LAST, s.name`,
          [schoolId, schoolId, academicYearId]
        );
        if (enrollments.length === 0) {
          const [activeYear] = await db.query(
            'SELECT id FROM academic_years WHERE school_id = ? AND status = ? LIMIT 1',
            [schoolId, 'active']
          );
          if (activeYear.length > 0 && activeYear[0].id === academicYearId) {
            const [allStudents] = await db.query(
              `SELECT s.*, c.name as class_name, c.section as class_section
               FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.school_id = ?`,
              [schoolId]
            );
            for (const st of allStudents) {
              try {
                await db.query(
                  `INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
                     class_id = EXCLUDED.class_id,
                     roll_no = EXCLUDED.roll_no`,
                  [uuidv4(), st.id, academicYearId, st.class_id, st.roll_no, schoolId]
                );
              } catch (e) { /* ignore duplicate */ }
            }
            const [after] = await db.query(
              `SELECT e.student_id, e.class_id, e.roll_no, s.id, s.name, s.parent_phone, s.parent_email, s.parent_name,
                      s.address, s.date_of_birth, s.gender, s.blood_group, s.photo_url, s.status, s.tc_status,
                      s.admission_number, s.registration_code, s.submitted_data, s.extra_fields, s.created_at,
                      c.name as class_name, c.section as class_section
               FROM student_enrollments e
               JOIN students s ON s.id = e.student_id
               LEFT JOIN classes c ON c.id = e.class_id
               WHERE e.school_id = ? AND e.academic_year_id = ?`,
              [schoolId, academicYearId]
            );
            const [pendingRows] = await db.query(
              `SELECT s.*, c.name as class_name, c.section as class_section
               FROM students s LEFT JOIN classes c ON s.class_id = c.id
               WHERE s.school_id = ? AND s.status = 'pending'
               ORDER BY s.created_at DESC`,
              [schoolId]
            );
            const enrolledIds = new Set(after.map((r) => r.id || r.student_id));
            const pendingOnly = pendingRows.filter((r) => !enrolledIds.has(r.id));
            const combined = [...pendingOnly, ...after];
            return res.json(combined.map(s => mapStudentToResponse(s)));
          }
          const [pendingRows] = await db.query(
            `SELECT s.*, c.name as class_name, c.section as class_section
             FROM students s LEFT JOIN classes c ON s.class_id = c.id
             WHERE s.school_id = ? AND s.status = 'pending'
             ORDER BY s.created_at DESC`,
            [schoolId]
          );
          return res.json(pendingRows.map(s => mapStudentToResponse(s)));
        }
        const [pendingRows] = await db.query(
          `SELECT s.*, c.name as class_name, c.section as class_section
           FROM students s LEFT JOIN classes c ON s.class_id = c.id
           WHERE s.school_id = ? AND s.status = 'pending'
           ORDER BY s.created_at DESC`,
          [schoolId]
        );
        const enrolledIds = new Set(enrollments.map((r) => r.id || r.student_id));
        const pendingOnly = pendingRows.filter((r) => !enrolledIds.has(r.id));
        const combined = [...pendingOnly, ...enrollments];
        return res.json(combined.map(s => mapStudentToResponse(s)));
      } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE' && err.message && err.message.includes('student_enrollments')) {
          // Table not created yet; fall back to all students
        } else {
          throw err;
        }
      }
    }

    const [students] = await db.query(`
      SELECT s.*, c.name as class_name, c.section as class_section
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.school_id = ?
      ORDER BY s.created_at DESC
    `, [schoolId]);
    res.json(students.map(s => mapStudentToResponse(s)));
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
      tcStatus: s.tc_status || 'none',
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
      otp_verified, // OTP verification status
      verified_mobile_number, // Verified mobile number
      ...otherFields // Any other custom fields
    } = req.body;

    let finalSchoolId = schoolId;
    let finalClassId = classId;
    let finalName = name || studentName;
    let linkType = null; // Store link type for validation
    let fieldConfig = []; // From registration link for dynamic validation

    // If registrationCode is provided, get schoolId and classId from registration link
    if (registrationCode) {
      const [links] = await db.query(
        'SELECT school_id, class_id, link_type, field_config FROM registration_links WHERE link_code = ? AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())',
        [registrationCode]
      );
      if (links.length > 0) {
        finalSchoolId = links[0].school_id;
        linkType = links[0].link_type || 'class'; // Store link type
        // For all_classes links, use classId from request body (student selected in form)
        if (linkType === 'all_classes' && classId) {
          finalClassId = classId;
        } else if (linkType === 'all_classes') {
          // For all_classes, classId is required - throw error if not provided
          return res.status(400).json({ error: 'Class selection is required for this registration' });
        } else {
          finalClassId = links[0].class_id;
        }
        console.log('✅ Registration link found:', { registrationCode, schoolId: finalSchoolId, classId: finalClassId, linkType });

        try {
          fieldConfig = JSON.parse(links[0].field_config || '[]');
        } catch (e) {
          console.error('Error parsing field_config:', e);
        }

        // Try to extract name from custom fields if not already set
        if (!finalName || finalName.trim() === '') {
          // Check common name field names
          const nameField = fieldConfig.find(f => 
            f.fieldName === 'name' || 
            f.fieldName === 'studentName' || 
            f.label?.toLowerCase().includes('name') ||
            f.fieldName?.toLowerCase().includes('name')
          );
          if (nameField && req.body[nameField.fieldName]) {
            finalName = req.body[nameField.fieldName];
          }
        }
        
        // Find the primary phone field that requires OTP
        const primaryPhoneField = fieldConfig.find(
          (f) => f.fieldType === 'tel' && f.requires_otp === true && f.is_primary_identity === true
        );
        
        if (primaryPhoneField) {
          const phoneFieldName = primaryPhoneField.fieldName || primaryPhoneField.field_id || primaryPhoneField.id;
          const mobileNumber = req.body[phoneFieldName] || req.body.studentPhone || req.body.parentPhone;
          const cleanedMobile = mobileNumber ? mobileNumber.replace(/\D/g, '') : '';
          
          if (!cleanedMobile || cleanedMobile.length !== 10) {
            return res.status(400).json({ 
              error: `${primaryPhoneField.label || 'Mobile number'} is required and must be valid` 
            });
          }
          
          // Verify OTP was completed
          if (!otp_verified || otp_verified !== true) {
            return res.status(400).json({ 
              error: 'Mobile number verification is required. Please verify your mobile number before submitting the form.' 
            });
          }
          
          // Verify the mobile number matches
          const verifiedMobile = verified_mobile_number ? verified_mobile_number.replace(/\D/g, '') : '';
          if (!verifiedMobile || verifiedMobile !== cleanedMobile) {
            return res.status(400).json({ 
              error: 'Mobile number verification failed. Please verify the correct mobile number.' 
            });
          }
        }
      } else {
        return res.status(404).json({ error: 'Invalid or expired registration link' });
      }
    }

    // School and class are always required (structural)
    if (!finalSchoolId) {
      return res.status(400).json({ success: false, message: 'School is required', error: 'School is required' });
    }
    if (!finalClassId) {
      return res.status(400).json({ success: false, message: 'Class is required', error: 'Class is required' });
    }

    // Dynamic validation from registration link field_config (only when we have a link)
    if (registrationCode && Array.isArray(fieldConfig) && fieldConfig.length > 0) {
      for (const field of fieldConfig) {
        const isMandatory = field.mandatory === true || field.is_mandatory === true;
        if (!isMandatory) continue;

        const fieldName = field.fieldName || field.field_id || field.id;
        if (!fieldName) continue;

        let value = req.body[fieldName];
        if (field.fieldType === 'file' && (fieldName === 'photo' || field.fieldName === 'photo')) {
          value = req.body.photoUrl || value;
        }

        const isEmpty = value === undefined || value === null ||
          (typeof value === 'string' && value.trim() === '') ||
          (field.fieldType === 'checkbox' && !value);

        if (isEmpty) {
          const label = field.label || fieldName;
          return res.status(400).json({
            success: false,
            message: `${label} is required`,
            error: `${label} is required`
          });
        }
      }
    } else if (!registrationCode) {
      // No link: minimal validation for direct API calls
      if (!finalName || finalName.trim() === '') {
        return res.status(400).json({ success: false, message: 'Name is required', error: 'Name is required' });
      }
    }

    // Verify school exists
    const [schools] = await db.query('SELECT id FROM schools WHERE id = ?', [finalSchoolId]);
    if (schools.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Always verify class exists
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

    // Admission number: optional; when provided, must be unique per school
    const trimmedAdmissionNumber = (admissionNumber != null && typeof admissionNumber === 'string') ? admissionNumber.trim() : '';
    const admissionNumberToStore = trimmedAdmissionNumber === '' ? null : trimmedAdmissionNumber;

    if (admissionNumberToStore !== null) {
      const [existingAdmission] = await db.query(
        'SELECT id FROM students WHERE admission_number = ? AND school_id = ?',
        [admissionNumberToStore, finalSchoolId]
      );
      if (existingAdmission.length > 0) {
        return res.status(400).json({ success: false, message: 'Admission number already exists in this school', error: 'Admission number already exists in this school' });
      }
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

    // Add admissionNumber to submittedData for reference (may be null if optional and not provided)
    submittedData.admissionNumber = admissionNumberToStore;

    const [result] = await db.query(
      `INSERT INTO students (id, name, roll_no, class_id, school_id, parent_phone, parent_email, 
       parent_name, address, date_of_birth, gender, blood_group, photo_url, registration_code, submitted_data, admission_number, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [studentId, finalName, rollNo || null, finalClassId, finalSchoolId, finalParentPhone, 
       finalParentEmail, finalParentName, address || null, dateOfBirth || null,
       gender || null, bloodGroup || null, photoUrl || null, registrationCode || null, JSON.stringify(submittedData), admissionNumberToStore]
    );

    console.log('✅ Student created:', { 
      studentId, 
      name: finalName, 
      classId: finalClassId, 
      schoolId: finalSchoolId, 
      admissionNumber: admissionNumberToStore,
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

// Bulk import students (admin only)
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'School ID not found' });

    const { importType, selectedClassId, rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to import' });
    }

    const validImportTypes = ['all_classes', 'particular_class', 'teacher'];
    const type = validImportTypes.includes(importType) ? importType : 'all_classes';

    let fixedClassId = null;
    if (type === 'particular_class' && selectedClassId) {
      const [cls] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [selectedClassId, schoolId]);
      if (cls.length === 0) return res.status(400).json({ error: 'Selected class not found' });
      fixedClassId = selectedClassId;
    }

    const [classesList] = await db.query('SELECT id, name, section FROM classes WHERE school_id = ?', [schoolId]);
    const classMap = {};
    classesList.forEach(c => {
      const key = `${(c.name || '').toString().trim()}|${(c.section || '').toString().trim()}`.toLowerCase();
      if (!classMap[key]) classMap[key] = c.id;
    });

    const normalizeClass = (v) => (v != null ? String(v).trim() : '');
    // Build list of possible class name variants so "1" and "Class 1" (and "Grade 1") all match
    const classNamesToTry = (name) => {
      const n = (name || '').trim();
      if (!n) return [];
      const set = new Set([n]);
      if (!/^Class\s+/i.test(n)) set.add('Class ' + n);
      if (!/^Grade\s+/i.test(n)) set.add('Grade ' + n);
      if (/^Class\s+/i.test(n)) set.add(n.replace(/^Class\s+/i, '').trim());
      if (/^Grade\s+/i.test(n)) set.add(n.replace(/^Grade\s+/i, '').trim());
      return [...set];
    };
    const created = [];
    const errors = [];
    let admissionCounter = 1;
    const admissionPrefix = `BULK-${new Date().getFullYear()}-`;
    let activeYearId = null;
    try {
      const [ay] = await db.query('SELECT id FROM academic_years WHERE school_id = ? AND status = ? LIMIT 1', [schoolId, 'active']);
      if (ay.length > 0) activeYearId = ay[0].id;
    } catch (e) { /* ignore */ }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const name = row.name != null ? String(row.name).trim() : (row.studentName != null ? String(row.studentName).trim() : '');
      if (!name) {
        errors.push({ row: rowNum, message: 'Name is required' });
        continue;
      }

      let classId = fixedClassId;
      if (!classId) {
        const className = normalizeClass(row.class);
        const section = normalizeClass(row.section);
        if (!className) {
          errors.push({ row: rowNum, message: 'Class is required for All Classes import' });
          continue;
        }
        const candidates = classNamesToTry(className);
        for (const candidate of candidates) {
          const key = `${candidate}|${section}`.toLowerCase();
          if (classMap[key]) {
            classId = classMap[key];
            break;
          }
        }
        if (!classId) {
          errors.push({ row: rowNum, message: `Class/Section not found: ${className}${section ? ' - ' + section : ''}` });
          continue;
        }
      }

      let admissionNumber = row.admissionNumber != null ? String(row.admissionNumber).trim() : '';
      if (!admissionNumber) {
        do {
          admissionNumber = admissionPrefix + String(admissionCounter).padStart(3, '0');
          admissionCounter++;
        } while (await db.query('SELECT id FROM students WHERE admission_number = ? AND school_id = ?', [admissionNumber, schoolId]).then(([r]) => r.length > 0));
      } else {
        const [existing] = await db.query('SELECT id FROM students WHERE admission_number = ? AND school_id = ?', [admissionNumber, schoolId]);
        if (existing.length > 0) {
          errors.push({ row: rowNum, message: 'Admission number already exists' });
          continue;
        }
      }

      const studentId = uuidv4();
      const finalParentName = row.fatherName || row.parentName || null;
      const finalParentPhone = row.fatherPhone || row.parentPhone || null;
      const finalParentEmail = row.fatherEmail || row.parentEmail || null;
      const submittedData = {
        name,
        rollNo: row.rollNo != null ? String(row.rollNo) : null,
        dateOfBirth: row.dateOfBirth != null ? String(row.dateOfBirth) : null,
        gender: row.gender != null ? String(row.gender) : null,
        bloodGroup: row.bloodGroup != null ? String(row.bloodGroup) : null,
        address: row.address != null ? String(row.address) : null,
        fatherName: row.fatherName != null ? String(row.fatherName) : null,
        motherName: row.motherName != null ? String(row.motherName) : null,
        admissionNumber,
        ...row,
      };

      try {
        await db.query(
          `INSERT INTO students (id, name, roll_no, class_id, school_id, parent_phone, parent_email, parent_name, address, date_of_birth, gender, blood_group, registration_code, submitted_data, admission_number, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BULK', ?, ?, 'approved', NOW())`,
          [studentId, name, row.rollNo != null ? String(row.rollNo) : null, classId, schoolId, finalParentPhone, finalParentEmail, finalParentName,
            row.address != null ? String(row.address) : null, row.dateOfBirth != null ? String(row.dateOfBirth) : null, row.gender != null ? String(row.gender) : null, row.bloodGroup != null ? String(row.bloodGroup) : null,
            JSON.stringify(submittedData), admissionNumber]
        );
        if (activeYearId) {
          try {
            await db.query(
              `INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
                 class_id = EXCLUDED.class_id,
                 roll_no = EXCLUDED.roll_no`,
              [uuidv4(), studentId, activeYearId, classId, row.rollNo != null ? String(row.rollNo) : null, schoolId]
            );
          } catch (e) { /* ignore */ }
        }
        created.push({ row: rowNum, studentId, name });
      } catch (err) {
        errors.push({ row: rowNum, message: err.message || 'Failed to create student' });
      }
    }

    res.json({ created: created.length, failed: errors.length, errors, createdIds: created.map(c => c.studentId) });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: error.message || 'Bulk import failed' });
  }
});

// Quick entry endpoint (minimal data, always pending)
router.post('/quick-entry', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { students } = req.body; // Array of student objects
    const schoolId = req.user.schoolId;
    
    // Validate: students must be array
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Students array is required' });
    }
    
    // Validate each student has minimum required fields
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      if (!student.name || !student.parentPhone) {
        return res.status(400).json({ 
          error: `Student #${i + 1}: Name and parent phone are required` 
        });
      }
    }
    
    const createdStudents = [];
    const errors = [];
    
    // Process each student
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];
      
      try {
        // Generate temporary admission number (will be finalized on approval)
        const tempAdmissionNumber = `TEMP-${Date.now()}-${i}`;
        
        // Create student with minimal data
        const studentId = uuidv4();
        await db.query(
          `INSERT INTO students (
            id, school_id, name, parent_phone, parent_name,
            date_of_birth, gender, status, registration_code,
            admission_number, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'QUICK-ENTRY', ?, NOW())`,
          [
            studentId,
            schoolId,
            studentData.name.trim(),
            studentData.parentPhone.trim(),
            studentData.parentName ? studentData.parentName.trim() : null,
            studentData.dateOfBirth || null,
            studentData.gender || null,
            tempAdmissionNumber
          ]
        );
        
        createdStudents.push({
          id: studentId,
          name: studentData.name,
          tempAdmissionNumber
        });
      } catch (error) {
        errors.push({
          index: i,
          name: studentData.name,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      created: createdStudents.length,
      failed: errors.length,
      students: createdStudents,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Quick entry error:', error);
    res.status(500).json({ error: 'Failed to create students' });
  }
});

// Approve student registration (enhanced with class assignment)
router.post('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { classId, rollNo } = req.body; // NEW: Class assignment during approval
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

    // Get admission number - generate if missing or if it's temporary
    let admissionNumber = students[0].admission_number;
    
    // If missing or temporary (from quick entry), generate proper one
    if (!admissionNumber || admissionNumber.startsWith('TEMP-')) {
      console.log('⚠️ Admission number missing or temporary, generating one...');
      const schoolCode = await getSchoolCode(schoolId);
      const currentYear = new Date().getFullYear();
      admissionNumber = await generateAdmissionNumber(schoolCode, currentYear, schoolId);
      console.log('✅ Generated admission number:', admissionNumber);
    } else {
      console.log('✅ Using existing admission number from registration:', admissionNumber);
    }

    // Get student's class_id (use provided classId or existing)
    let studentClassId = classId;
    
    if (!studentClassId) {
      // If no classId provided, try to get from student record
      const [studentInfo] = await db.query(
        'SELECT class_id FROM students WHERE id = ? AND school_id = ?',
        [id, schoolId]
      );

      if (studentInfo.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      studentClassId = studentInfo[0].class_id;
    }
    
    // If still no classId, require it
    if (!studentClassId) {
      return res.status(400).json({ error: 'Class assignment is required for approval' });
    }
    
    // Verify class exists and belongs to school
    const [classes] = await db.query(
      'SELECT id FROM classes WHERE id = ? AND school_id = ?',
      [studentClassId, schoolId]
    );
    
    if (classes.length === 0) {
      return res.status(400).json({ error: 'Invalid class' });
    }

    // Now update with admission number, class, and roll number
    const [result] = await db.query(
      `UPDATE students 
       SET status = 'approved', 
           admission_number = ?,
           class_id = ?,
           roll_no = ?
       WHERE id = ?`, 
      [admissionNumber, studentClassId, rollNo || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found or already approved' });
    }

    console.log('✅ Student approved:', { id, admissionNumber, affectedRows: result.affectedRows });

    // Get active academic year for enrollment
    const [activeYear] = await db.query(
      'SELECT id FROM academic_years WHERE school_id = ? AND status = ? LIMIT 1',
      [schoolId, 'active']
    );
    
    if (activeYear.length === 0) {
      return res.status(400).json({ error: 'No active academic year found. Cannot enroll student.' });
    }
    
    try {
      const finalRollNo = rollNo || null;
      await db.query(
        `INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
           class_id = EXCLUDED.class_id,
           roll_no = EXCLUDED.roll_no`,
        [uuidv4(), id, activeYear[0].id, studentClassId, finalRollNo, schoolId]
      );
    } catch (enrollErr) {
      if (enrollErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Enrollment insert on approve:', enrollErr);
        throw enrollErr;
      }
    }

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

    res.json({ 
      success: true, 
      admissionNumber,
      message: 'Student approved and enrolled successfully'
    });
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

// Bulk approve students (with class assignments)
router.post('/bulk-approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { approvals } = req.body; // Array of { studentId, classId, rollNo }
    const schoolId = req.user.schoolId;
    
    if (!Array.isArray(approvals) || approvals.length === 0) {
      return res.status(400).json({ error: 'Approvals array is required' });
    }
    
    // Get active academic year once
    const [activeYear] = await db.query(
      'SELECT id FROM academic_years WHERE school_id = ? AND status = ? LIMIT 1',
      [schoolId, 'active']
    );
    
    if (activeYear.length === 0) {
      return res.status(400).json({ error: 'No active academic year found. Cannot enroll students.' });
    }
    
    const academicYearId = activeYear[0].id;
    const schoolCode = await getSchoolCode(schoolId);
    const currentYear = new Date().getFullYear();
    
    const results = [];
    const errors = [];
    
    // Start transaction for bulk operations
    await db.query('START TRANSACTION');
    
    try {
      for (const approval of approvals) {
        try {
          const { studentId, classId, rollNo } = approval;
          
          if (!studentId || !classId) {
            errors.push({ studentId, error: 'Student ID and Class ID are required' });
            continue;
          }
          
          // Verify student belongs to school
          const [students] = await db.query(
            'SELECT id, admission_number FROM students WHERE id = ? AND school_id = ?',
            [studentId, schoolId]
          );
          
          if (students.length === 0) {
            errors.push({ studentId, error: 'Student not found' });
            continue;
          }
          
          // Verify class exists
          const [classes] = await db.query(
            'SELECT id FROM classes WHERE id = ? AND school_id = ?',
            [classId, schoolId]
          );
          
          if (classes.length === 0) {
            errors.push({ studentId, error: 'Invalid class' });
            continue;
          }
          
          // Generate admission number if needed
          let admissionNumber = students[0].admission_number;
          if (!admissionNumber || admissionNumber.startsWith('TEMP-')) {
            admissionNumber = await generateAdmissionNumber(schoolCode, currentYear, schoolId);
          }
          
          // Update student
          await db.query(
            `UPDATE students 
             SET status = 'approved', 
                 admission_number = ?,
                 class_id = ?,
                 roll_no = ?
             WHERE id = ?`,
            [admissionNumber, classId, rollNo || null, studentId]
          );
          
          // Create enrollment
          await db.query(
            `INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
               class_id = EXCLUDED.class_id,
               roll_no = EXCLUDED.roll_no`,
            [uuidv4(), studentId, academicYearId, classId, rollNo || null, schoolId]
          );
          
          // Create fee record if fee structure exists
          try {
            const [feeStructures] = await db.query(
              'SELECT * FROM fee_structure WHERE class_id = ? AND school_id = ?',
              [classId, schoolId]
            );
            
            if (feeStructures.length > 0) {
              const structure = feeStructures[0];
              const finalTotalFee = parseFloat(structure.total_fee) || 0;
              
              const [existingFee] = await db.query(
                'SELECT id FROM student_fees WHERE student_id = ? AND class_id = ? LIMIT 1',
                [studentId, classId]
              );
              
              if (existingFee.length === 0 && finalTotalFee > 0) {
                const componentBreakdown = {
                  tuition_fee: { total: parseFloat(structure.tuition_fee) || 0, paid: 0, pending: parseFloat(structure.tuition_fee) || 0 },
                  transport_fee: { total: parseFloat(structure.transport_fee) || 0, paid: 0, pending: parseFloat(structure.transport_fee) || 0 },
                  lab_fee: { total: parseFloat(structure.lab_fee) || 0, paid: 0, pending: parseFloat(structure.lab_fee) || 0 }
                };
                
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
                
                await db.query(
                  `INSERT INTO student_fees (id, student_id, class_id, school_id, academic_year_id, total_fee, paid_amount, pending_amount, status, due_date, component_breakdown, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', NULL, ?, NOW())`,
                  [
                    uuidv4(),
                    studentId,
                    classId,
                    schoolId,
                    structure.academic_year_id || null,
                    finalTotalFee,
                    finalTotalFee,
                    JSON.stringify(componentBreakdown)
                  ]
                );
              }
            }
          } catch (feeError) {
            // Don't fail approval if fee creation fails
            console.error('Error creating fee record:', feeError);
          }
          
          results.push({ studentId, success: true, admissionNumber });
        } catch (error) {
          errors.push({ studentId: approval.studentId, error: error.message });
        }
      }
      
      await db.query('COMMIT');
      
      res.json({
        success: true,
        approved: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ error: 'Failed to bulk approve students' });
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

// Update TC status for student
router.patch('/:id/tc-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tcStatus } = req.body; // 'none', 'applied', or 'issued'
    const schoolId = req.user.schoolId;

    if (!['none', 'applied', 'issued'].includes(tcStatus)) {
      return res.status(400).json({ error: 'Invalid TC status. Must be: none, applied, or issued' });
    }

    // Verify student belongs to school
    const [students] = await db.query(
      'SELECT id FROM students WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await db.query(
      'UPDATE students SET tc_status = ? WHERE id = ?',
      [tcStatus, id]
    );
    if (tcStatus === 'issued') {
      try {
        const [ay] = await db.query('SELECT id FROM academic_years WHERE school_id = ? AND status = ? LIMIT 1', [schoolId, 'active']);
        if (ay.length > 0) {
          await db.query(
            'UPDATE student_enrollments SET left_at = NOW(), tc_issued_at = NOW() WHERE student_id = ? AND academic_year_id = ?',
            [id, ay[0].id]
          );
        }
      } catch (e) { if (e.code !== 'ER_NO_SUCH_TABLE') console.error('Enrollment TC update:', e); }
    }

    console.log('✅ TC status updated:', { studentId: id, tcStatus });

    res.json({ success: true });
  } catch (error) {
    console.error('Update TC status error:', error);
    res.status(500).json({ error: 'Failed to update TC status' });
  }
});

// Update student (Admin can update any student, Teacher can update their class students)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify user is admin or teacher
    if (userRole !== 'admin' && userRole !== 'teacher') {
      return res.status(403).json({ error: 'Access denied. Admin or Teacher role required' });
    }

    // Get student and verify access
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
    
    // If teacher, verify they are the class teacher for this student's class
    if (userRole === 'teacher') {
      if (student.class_teacher_id !== userId) {
        return res.status(403).json({ error: 'Access denied. You can only update students in your assigned class' });
      }
    }

    const {
      name, rollNo, classId, address, dateOfBirth, gender, bloodGroup,
      fatherName, fatherPhone, fatherEmail, fatherOccupation,
      motherName, motherPhone, motherOccupation,
      emergencyContact, previousSchool, medicalConditions,
      parentPhone, parentEmail, parentName,
      photoUrl,
      extra_fields // NEW: Handle extra_fields for ID cards
    } = req.body;

    // Block teachers from editing extra_fields
    if (userRole === 'teacher' && extra_fields !== undefined) {
      return res.status(403).json({ error: 'Access denied. Only School Admins can edit ID card fields' });
    }

    // Handle extra_fields merging (only for admins)
    let finalExtraFields = {};
    if (userRole === 'admin' && extra_fields !== undefined) {
      // Get existing extra_fields
      try {
        if (student.extra_fields) {
          finalExtraFields = typeof student.extra_fields === 'string' 
            ? JSON.parse(student.extra_fields) 
            : student.extra_fields;
        }
      } catch (e) {
        finalExtraFields = {};
      }
      
      // Merge with new extra_fields (don't overwrite existing keys unless provided)
      if (typeof extra_fields === 'object' && extra_fields !== null) {
        finalExtraFields = { ...finalExtraFields, ...extra_fields };
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    // classId (change section) - validate class belongs to school
    if (classId !== undefined) {
      const [classRows] = await db.query(
        'SELECT id FROM classes WHERE id = ? AND school_id = ?',
        [classId, schoolId]
      );
      if (classRows.length === 0) {
        return res.status(400).json({ error: 'Invalid class or class does not belong to your school' });
      }
      updates.push('class_id = ?');
      values.push(classId);
    }

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (rollNo !== undefined) { updates.push('roll_no = ?'); values.push(rollNo); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address || null); }
    if (dateOfBirth !== undefined) { updates.push('date_of_birth = ?'); values.push(dateOfBirth || null); }
    if (gender !== undefined) { updates.push('gender = ?'); values.push(gender || null); }
    if (bloodGroup !== undefined) { updates.push('blood_group = ?'); values.push(bloodGroup || null); }
    if (parentPhone !== undefined) { updates.push('parent_phone = ?'); values.push(parentPhone || null); }
    if (parentEmail !== undefined) { updates.push('parent_email = ?'); values.push(parentEmail || null); }
    if (parentName !== undefined) { updates.push('parent_name = ?'); values.push(parentName || null); }
    if (photoUrl !== undefined) { updates.push('photo_url = ?'); values.push(photoUrl || null); }

    // Add extra_fields update (only if admin and provided)
    if (userRole === 'admin' && extra_fields !== undefined) {
      updates.push('extra_fields = ?');
      values.push(JSON.stringify(finalExtraFields));
    }

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

    // Also update student_enrollments for active academic year
    // This ensures changes show up when academic year is selected
    const [activeYear] = await db.query(
      'SELECT id FROM academic_years WHERE school_id = ? AND status = ? LIMIT 1',
      [schoolId, 'active']
    );

    if (activeYear.length > 0) {
      const enrollmentUpdates = [];
      const enrollmentValues = [];
      
      // Update roll_no in student_enrollments if it was updated
      if (rollNo !== undefined) {
        enrollmentUpdates.push('roll_no = ?');
        enrollmentValues.push(rollNo);
      }
      
      // Update class_id in student_enrollments if it was changed
      if (classId !== undefined) {
        enrollmentUpdates.push('class_id = ?');
        enrollmentValues.push(classId);
      }
      
      // If there are enrollment updates, apply them
      if (enrollmentUpdates.length > 0) {
        enrollmentValues.push(id, activeYear[0].id);
        await db.query(
          `UPDATE student_enrollments 
           SET ${enrollmentUpdates.join(', ')} 
           WHERE student_id = ? AND academic_year_id = ?`,
          enrollmentValues
        );
        console.log('✅ Student enrollment updated:', { studentId: id, academicYearId: activeYear[0].id });
      }
    }

    console.log('✅ Student updated:', { id, updatedFields: updates.length });

    res.json({ success: true });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Get student yearly academic percentage
// WEIGHTING RULE: Uses "marks-weighted" aggregation
// Formula: SUM(all marks obtained) / SUM(all max marks) × 100
// This means tests with more marks contribute proportionally more
// Example: Unit Test (20/20) + Midterm (80/100) + Final (150/200) = 250/320 = 78.125%
router.get('/:id/yearly-percentage', authenticateToken, async (req, res) => {
  try {
    const { id: studentId } = req.params;
    const { academicYearId } = req.query;

    if (!academicYearId) {
      return res.status(400).json({ 
        error: 'academicYearId query parameter is required' 
      });
    }

    // Verify student exists and user has access
    const schoolId = req.user.schoolId;
    
    // For parents: verify they own this student
    if (req.user.role === 'parent') {
      const [students] = await db.query(
        'SELECT id, parent_phone, parent_email FROM students WHERE id = ? AND school_id = ?',
        [studentId, schoolId]
      );
      
      if (students.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const student = students[0];
      // Verify parent owns this student
      if (req.user.phone !== student.parent_phone && req.user.email !== student.parent_email) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else {
      // For admin/teacher: verify student belongs to their school
      const [students] = await db.query(
        'SELECT id FROM students WHERE id = ? AND school_id = ?',
        [studentId, schoolId]
      );
      
      if (students.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }
    }

    // Verify academic year exists and belongs to school
    const [academicYears] = await db.query(
      'SELECT id, name FROM academic_years WHERE id = ? AND school_id = ?',
      [academicYearId, schoolId]
    );

    if (academicYears.length === 0) {
      return res.status(404).json({ error: 'Academic year not found' });
    }

    // Verify student was enrolled in this academic year
    const [enrollments] = await db.query(
      `SELECT se.id, se.class_id, c.name as class_name, c.section as class_section
       FROM student_enrollments se
       JOIN classes c ON se.class_id = c.id
       WHERE se.student_id = ?
         AND se.academic_year_id = ?
         AND se.school_id = ?`,
      [studentId, academicYearId, schoolId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({ 
        error: 'Student was not enrolled in this academic year',
        studentId,
        academicYearId
      });
    }

    const enrollment = enrollments[0];

    // Calculate yearly percentage with enrollment verification
    // Only count tests from the academic year where student was enrolled
    const [results] = await db.query(
      `SELECT 
        SUM(tr.marks_obtained) as total_marks,
        SUM(tr.max_marks) as total_max_marks,
        COUNT(DISTINCT tr.test_id) as test_count
       FROM test_results tr
       JOIN tests t ON tr.test_id = t.id
       JOIN student_enrollments se ON se.student_id = tr.student_id
         AND se.academic_year_id = t.academic_year_id
         AND se.academic_year_id = ?
       WHERE tr.student_id = ?
         AND t.academic_year_id = ?`,
      [academicYearId, studentId, academicYearId]
    );

    const result = results[0];
    const totalMarks = parseFloat(result.total_marks) || 0;
    const totalMaxMarks = parseFloat(result.total_max_marks) || 0;
    const testCount = parseInt(result.test_count) || 0;

    // Calculate percentage (handle division by zero)
    let yearlyPercentage = 0;
    if (totalMaxMarks > 0) {
      yearlyPercentage = (totalMarks / totalMaxMarks) * 100;
      yearlyPercentage = Math.round(yearlyPercentage * 100) / 100; // Round to 2 decimal places
    }

    res.json({
      studentId,
      academicYearId,
      academicYearName: academicYears[0].name,
      enrollmentClass: `${enrollment.class_name}${enrollment.class_section ? ` ${enrollment.class_section}` : ''}`,
      totalMarks,
      totalMaxMarks,
      testCount,
      yearlyPercentage,
      hasResults: testCount > 0
    });

  } catch (error) {
    console.error('Get yearly percentage error:', error);
    res.status(500).json({ error: 'Failed to fetch yearly percentage' });
  }
});

module.exports = router;
