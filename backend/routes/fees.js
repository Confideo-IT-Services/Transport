const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ============ FEE CATEGORIES ============

// Get all fee categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM fee_categories WHERE 1=1';
    const params = [];

    if (req.user.role === 'admin') {
      query += ' AND school_id = ?';
      params.push(req.user.schoolId);
    }

    query += ' ORDER BY created_at DESC';

    const [categories] = await db.query(query, params);

    res.json(categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      amount: parseFloat(cat.amount),
      frequency: cat.frequency,
      description: cat.description,
      isActive: !!cat.is_active,
      createdAt: cat.created_at
    })));
  } catch (error) {
    console.error('Get fee categories error:', error);
    res.status(500).json({ error: 'Failed to fetch fee categories' });
  }
});

// Create fee category (Admin only)
router.post('/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, amount, frequency, description } = req.body;

    if (!name || !amount || !frequency) {
      return res.status(400).json({ error: 'Name, amount, and frequency are required' });
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Check if table exists, if not create it
    try {
      await db.query('SELECT 1 FROM fee_categories LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.log('⚠️ fee_categories table does not exist. Creating it...');
        // Try to create the table
        try {
          await db.query(`
            CREATE TABLE IF NOT EXISTS fee_categories (
              id VARCHAR(36) PRIMARY KEY,
              school_id VARCHAR(36) NOT NULL,
              name VARCHAR(100) NOT NULL,
              amount DECIMAL(10, 2) NOT NULL,
              frequency ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
              description TEXT,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
              INDEX idx_school_id (school_id),
              INDEX idx_is_active (is_active)
            )
          `);
          console.log('✅ fee_categories table created successfully');
        } catch (createError) {
          console.error('❌ Failed to create fee_categories table:', createError);
          return res.status(500).json({ 
            error: 'Database table does not exist',
            details: 'Please run the fees_schema.sql file to create the required tables. Error: ' + createError.message
          });
        }
      } else {
        throw tableError;
      }
    }

    const categoryId = uuidv4();
    await db.query(
      `INSERT INTO fee_categories (id, school_id, name, amount, frequency, description, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, true, NOW())`,
      [categoryId, schoolId, name, amount, frequency, description || null]
    );

    console.log('✅ Fee category created:', { categoryId, name, amount, frequency, schoolId });
    res.status(201).json({ success: true, categoryId });
  } catch (error) {
    console.error('❌ Create fee category error:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create fee category';
    if (error.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = 'Database table does not exist. Please run fees_schema.sql to create the required tables.';
    } else if (error.code === 'ER_DUP_ENTRY') {
      errorMessage = 'A category with this name already exists for your school.';
    } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      errorMessage = 'Invalid school ID. Please contact support.';
    } else if (error.sqlMessage) {
      errorMessage = error.sqlMessage;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message
    });
  }
});

// Update fee category (Admin only)
router.put('/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, frequency, description, isActive } = req.body;

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Check if category exists and belongs to school
    const [existing] = await db.query(
      'SELECT id FROM fee_categories WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Fee category not found' });
    }

    await db.query(
      `UPDATE fee_categories 
       SET name = ?, amount = ?, frequency = ?, description = ?, is_active = ?, updated_at = NOW()
       WHERE id = ? AND school_id = ?`,
      [name, amount, frequency, description || null, isActive !== false, id, schoolId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update fee category error:', error);
    res.status(500).json({ error: 'Failed to update fee category' });
  }
});

// Delete fee category (Admin only)
router.delete('/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    const [result] = await db.query(
      'DELETE FROM fee_categories WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fee category not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete fee category error:', error);
    res.status(500).json({ error: 'Failed to delete fee category' });
  }
});

// ============ FEE STRUCTURE ============

// Get fee structure
router.get('/structure', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT fs.*, c.name as class_name, c.section as class_section, ay.name as academic_year_name
      FROM fee_structure fs
      LEFT JOIN classes c ON fs.class_id = c.id
      LEFT JOIN academic_years ay ON fs.academic_year_id = ay.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'admin') {
      query += ' AND fs.school_id = ?';
      params.push(req.user.schoolId);
    }

    query += ' ORDER BY c.name, c.section';

    const [structures] = await db.query(query, params);

      res.json(structures.map(s => {
      let parsedOtherFees = null;
      let frequency = null;
      
      if (s.other_fees) {
        try {
          parsedOtherFees = typeof s.other_fees === 'string' ? JSON.parse(s.other_fees) : s.other_fees;
          // Extract frequency from metadata if it exists
          if (parsedOtherFees && parsedOtherFees._metadata && parsedOtherFees._metadata.frequency) {
            frequency = parsedOtherFees._metadata.frequency;
          }
        } catch (e) {
          console.error('Error parsing other_fees:', e);
        }
      }
      
      return {
        id: s.id,
        classId: s.class_id,
        className: s.class_name,
        classSection: s.class_section,
        academicYearId: s.academic_year_id,
        academicYearName: s.academic_year_name,
        totalFee: parseFloat(s.total_fee),
        tuitionFee: parseFloat(s.tuition_fee),
        transportFee: parseFloat(s.transport_fee),
        labFee: parseFloat(s.lab_fee),
        otherFees: parsedOtherFees,
        frequency: frequency,
        createdAt: s.created_at
      };
    }));
  } catch (error) {
    console.error('Get fee structure error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structure' });
  }
});

// Create/Update fee structure (Admin only) - applies to all sections of the class
router.post('/structure', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { classId, className, academicYearId, totalFee, tuitionFee, transportFee, labFee, otherFees, frequency } = req.body;

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Resolve all class_ids for this class (by class name - all sections get same fee)
    let classIds = [];
    if (className && typeof className === 'string' && className.trim()) {
      const [rows] = await db.query('SELECT id FROM classes WHERE school_id = ? AND name = ? ORDER BY section', [schoolId, className.trim()]);
      classIds = (rows || []).map(r => r.id);
    } else if (classId) {
      const [nameRow] = await db.query('SELECT name FROM classes WHERE id = ? AND school_id = ?', [classId, schoolId]);
      if (!nameRow || nameRow.length === 0) {
        return res.status(400).json({ error: 'Class not found' });
      }
      const [rows] = await db.query('SELECT id FROM classes WHERE school_id = ? AND name = ? ORDER BY section', [schoolId, nameRow[0].name]);
      classIds = (rows || []).map(r => r.id);
    }
    if (!classIds.length) {
      return res.status(400).json({ error: className ? 'No sections found for this class name' : 'Class is required' });
    }

    let otherFeesSum = 0;
    if (otherFees) {
      if (Array.isArray(otherFees)) {
        otherFeesSum = otherFees.reduce((sum, item) => sum + (item.amount || 0), 0);
      } else if (otherFees.components && Array.isArray(otherFees.components)) {
        otherFeesSum = otherFees.components.reduce((sum, item) => sum + (item.amount || 0), 0);
      }
    }
    const calculatedTotal = (tuitionFee || 0) + (transportFee || 0) + (labFee || 0) + otherFeesSum;
    const finalTotalFee = totalFee && Math.abs(parseFloat(totalFee) - calculatedTotal) < 0.01 
      ? parseFloat(totalFee) 
      : calculatedTotal;
    if (finalTotalFee <= 0) {
      return res.status(400).json({ error: 'Total fee must be greater than 0. Please enter at least one fee component.' });
    }

    let firstStructureId = null;

    for (const singleClassId of classIds) {
      let existingQuery;
      let existingParams;
      if (academicYearId) {
        existingQuery = 'SELECT id FROM fee_structure WHERE class_id = ? AND academic_year_id = ? AND school_id = ?';
        existingParams = [singleClassId, academicYearId, schoolId];
      } else {
        existingQuery = 'SELECT id FROM fee_structure WHERE class_id = ? AND school_id = ? AND academic_year_id IS NULL ORDER BY created_at DESC LIMIT 1';
        existingParams = [singleClassId, schoolId];
      }
      const [existing] = await db.query(existingQuery, existingParams);

      if (existing.length > 0) {
        await db.query(
          `UPDATE fee_structure SET total_fee = ?, tuition_fee = ?, transport_fee = ?, lab_fee = ?, other_fees = ?, updated_at = NOW() WHERE id = ?`,
          [finalTotalFee, tuitionFee || 0, transportFee || 0, labFee || 0, otherFees ? JSON.stringify(otherFees) : null, existing[0].id]
        );
        if (!firstStructureId) firstStructureId = existing[0].id;
      } else {
        const structureId = uuidv4();
        await db.query(
          `INSERT INTO fee_structure (id, school_id, class_id, academic_year_id, total_fee, tuition_fee, transport_fee, lab_fee, other_fees, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [structureId, schoolId, singleClassId, academicYearId || null, finalTotalFee, tuitionFee || 0, transportFee || 0, labFee || 0, otherFees ? JSON.stringify(otherFees) : null]
        );
        if (!firstStructureId) firstStructureId = structureId;
      }

      try {
        const [duplicates] = await db.query(
          `SELECT student_id, COUNT(*) as count FROM student_fees WHERE class_id = ? GROUP BY student_id HAVING count > 1`,
          [singleClassId]
        );
        for (const dup of duplicates) {
          await db.query(`
            DELETE FROM student_fees WHERE student_id = ? AND class_id = ?
            AND id NOT IN (SELECT id FROM (SELECT id FROM student_fees WHERE student_id = ? AND class_id = ? ORDER BY created_at DESC, id DESC LIMIT 1) AS keep)
          `, [dup.student_id, singleClassId, dup.student_id, singleClassId]);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up duplicate fees:', cleanupError);
      }

      try {
        const [students] = await db.query(
          'SELECT id FROM students WHERE class_id = ? AND school_id = ? AND status = ?',
          [singleClassId, schoolId, 'approved']
        );

      let created = 0;
      let updated = 0;
      let skipped = 0;

      // Build component breakdown
      const componentBreakdown = {
        tuition_fee: { total: tuitionFee || 0, paid: 0, pending: tuitionFee || 0 },
        transport_fee: { total: transportFee || 0, paid: 0, pending: transportFee || 0 },
        lab_fee: { total: labFee || 0, paid: 0, pending: labFee || 0 }
      };

      // Add other components if they exist
      if (otherFees && otherFees.components && Array.isArray(otherFees.components)) {
        otherFees.components.forEach(comp => {
          const compKey = comp.name.toLowerCase().replace(/\s+/g, '_');
          componentBreakdown[compKey] = { total: comp.amount || 0, paid: 0, pending: comp.amount || 0 };
        });
      }

      for (const student of students) {
        // Check if fee already exists for this student in this class
        // Use a single query with proper error handling
        const [existing] = await db.query(
          'SELECT id, paid_amount, component_breakdown FROM student_fees WHERE student_id = ? AND class_id = ? LIMIT 1',
          [student.id, singleClassId]
        );

        if (existing.length === 0) {
          const studentFeeId = uuidv4();
          try {
            await db.query(
              `INSERT INTO student_fees (id, student_id, class_id, school_id, academic_year_id, total_fee, paid_amount, pending_amount, status, due_date, component_breakdown, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', NULL, ?, NOW())`,
              [
                studentFeeId,
                student.id,
                singleClassId,
                schoolId,
                academicYearId || null,
                finalTotalFee,
                finalTotalFee,
                JSON.stringify(componentBreakdown)
              ]
            );
            created++;
            console.log(`✅ Created fee record for student ${student.id} in class ${singleClassId}`);
          } catch (insertError) {
            if (insertError.code === 'ER_DUP_ENTRY' || insertError.message?.includes('Duplicate') || insertError.message?.includes('UNIQUE')) {
              console.log(`⚠️ Duplicate detected for student ${student.id}, fetching and updating instead`);
              const [existingRecord] = await db.query(
                'SELECT id, paid_amount, component_breakdown FROM student_fees WHERE student_id = ? AND class_id = ? LIMIT 1',
                [student.id, singleClassId]
              );
              if (existingRecord.length > 0) {
                const currentPaid = parseFloat(existingRecord[0].paid_amount) || 0;
                const newPending = Math.max(0, finalTotalFee - currentPaid);
                
                let newStatus = 'unpaid';
                if (newPending <= 0 && finalTotalFee > 0) {
                  newStatus = 'paid';
                } else if (currentPaid > 0) {
                  newStatus = 'partial';
                }
                
                // Preserve existing component_breakdown paid amounts if they exist
                let finalBreakdown = componentBreakdown;
                try {
                  const existingBreakdown = existingRecord[0].component_breakdown 
                    ? (typeof existingRecord[0].component_breakdown === 'string' 
                        ? JSON.parse(existingRecord[0].component_breakdown) 
                        : existingRecord[0].component_breakdown)
                    : {};
                  
                  // Merge: keep paid amounts from existing, update totals from structure
                  if (existingBreakdown && Object.keys(existingBreakdown).length > 0) {
                    Object.keys(componentBreakdown).forEach(key => {
                      if (existingBreakdown[key]) {
                        finalBreakdown[key] = {
                          total: componentBreakdown[key].total,
                          paid: existingBreakdown[key].paid || 0,
                          pending: Math.max(0, componentBreakdown[key].total - (existingBreakdown[key].paid || 0))
                        };
                      }
                    });
                  }
                } catch (e) {
                  console.error('Error merging breakdown:', e);
                }
                
                await db.query(
                  `UPDATE student_fees 
                   SET total_fee = ?, pending_amount = ?, status = ?, component_breakdown = ?, academic_year_id = ?, updated_at = NOW()
                   WHERE id = ?`,
                  [
                    finalTotalFee,
                    newPending,
                    newStatus,
                    JSON.stringify(finalBreakdown),
                    academicYearId || null,
                    existingRecord[0].id
                  ]
                );
                updated++;
                console.log(`✅ Updated fee record for student ${student.id} after duplicate detection`);
              }
            } else {
              // Some other error, log and continue
              console.error(`Error creating fee for student ${student.id}:`, insertError);
              skipped++;
            }
          }
        } else {
          // Update existing fee record with new structure data
          const currentPaid = parseFloat(existing[0].paid_amount) || 0;
          const newPending = Math.max(0, finalTotalFee - currentPaid);
          
          // Determine new status
          let newStatus = 'unpaid';
          if (newPending <= 0 && finalTotalFee > 0) {
            newStatus = 'paid';
          } else if (currentPaid > 0) {
            newStatus = 'partial';
          }
          
          // Preserve existing component_breakdown paid amounts
          let finalBreakdown = componentBreakdown;
          try {
            const existingBreakdown = existing[0].component_breakdown 
              ? (typeof existing[0].component_breakdown === 'string' 
                  ? JSON.parse(existing[0].component_breakdown) 
                  : existing[0].component_breakdown)
              : {};
            
            // Merge: keep paid amounts from existing, update totals from structure
            if (existingBreakdown && Object.keys(existingBreakdown).length > 0) {
              Object.keys(componentBreakdown).forEach(key => {
                if (existingBreakdown[key]) {
                  finalBreakdown[key] = {
                    total: componentBreakdown[key].total,
                    paid: existingBreakdown[key].paid || 0,
                    pending: Math.max(0, componentBreakdown[key].total - (existingBreakdown[key].paid || 0))
                  };
                }
              });
            }
          } catch (e) {
            console.error('Error merging breakdown:', e);
          }
          
          await db.query(
            `UPDATE student_fees 
             SET total_fee = ?, pending_amount = ?, status = ?, component_breakdown = ?, academic_year_id = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              finalTotalFee,
              newPending,
              newStatus,
              JSON.stringify(finalBreakdown),
              academicYearId || null,
              existing[0].id
            ]
          );
          updated++;
        }
      }

      console.log(`✅ Fee structure applied: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (autoCreateError) {
      console.error('Error auto-creating student fees:', autoCreateError);
    }
    }

    if (firstStructureId) {
      res.json({ success: true, structureId: firstStructureId });
    } else {
      res.status(201).json({ success: true, structureId: firstStructureId || '' });
    }
  } catch (error) {
    console.error('Create/Update fee structure error:', error);
    res.status(500).json({ error: 'Failed to create/update fee structure' });
  }
});

// Delete fee structure (Admin only) - deletes all sections of that class
router.delete('/structure/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const [structures] = await db.query(
      'SELECT id, class_id FROM fee_structure WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (structures.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found or access denied' });
    }

    // Get class name so we can delete fee structure for all sections of this class
    const [classRows] = await db.query(
      'SELECT name FROM classes WHERE id = ? AND school_id = ?',
      [structures[0].class_id, schoolId]
    );
    if (classRows.length > 0) {
      const className = classRows[0].name;
      const [classIds] = await db.query(
        'SELECT id FROM classes WHERE school_id = ? AND name = ?',
        [schoolId, className]
      );
      const ids = (classIds || []).map(r => r.id);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        await db.query(`DELETE FROM fee_structure WHERE school_id = ? AND class_id IN (${placeholders})`, [schoolId, ...ids]);
      } else {
        await db.query('DELETE FROM fee_structure WHERE id = ?', [id]);
      }
    } else {
      await db.query('DELETE FROM fee_structure WHERE id = ?', [id]);
    }

    res.json({ success: true, message: 'Fee structure deleted successfully' });
  } catch (error) {
    console.error('Delete fee structure error:', error);
    res.status(500).json({ error: 'Failed to delete fee structure' });
  }
});

// ============ STUDENT FEES ============

// Get student fees - Modified to show all approved students, based on fee structure
router.get('/students', authenticateToken, async (req, res) => {
  try {
    const { classId, searchTerm } = req.query;

    let query = `
      SELECT 
        s.id as student_id,
        s.name as student_name,
        s.roll_no,
        s.class_id,
        c.name as class_name,
        c.section as class_section,
        sf.id as fee_id,
        fs.total_fee as structure_total_fee,
        fs.tuition_fee as structure_tuition_fee,
        fs.transport_fee as structure_transport_fee,
        fs.lab_fee as structure_lab_fee,
        fs.other_fees as structure_other_fees,
        sf.total_fee as student_fee_total,
        sf.paid_amount,
        sf.pending_amount,
        sf.status as student_fee_status,
        sf.due_date,
        sf.academic_year_id,
        fs.academic_year_id as structure_academic_year_id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN (
        SELECT fs1.*
        FROM fee_structure fs1
        WHERE fs1.id = (
          SELECT fs2.id
          FROM fee_structure fs2
          WHERE fs2.class_id = fs1.class_id
          AND fs2.school_id = fs1.school_id
          ORDER BY fs2.created_at DESC, fs2.id DESC
          LIMIT 1
        )
      ) fs ON fs.class_id = s.class_id AND fs.school_id = s.school_id
      LEFT JOIN (
        SELECT sf1.*
        FROM student_fees sf1
        WHERE sf1.id = (
          SELECT sf2.id
          FROM student_fees sf2
          WHERE sf2.student_id = sf1.student_id
          AND sf2.class_id = sf1.class_id
          ORDER BY sf2.created_at DESC, sf2.id DESC
          LIMIT 1
        )
      ) sf ON sf.student_id = s.id AND sf.class_id = s.class_id
      WHERE s.status = 'approved'
    `;
    const params = [];
    const schoolId = req.user.schoolId;

    if (req.user.role === 'admin') {
      query += ' AND s.school_id = ?';
      params.push(schoolId);
    } else if (req.user.role === 'teacher') {
      // Teachers can only see their class students
      query += ' AND s.class_id IN (SELECT class_id FROM teachers WHERE id = ?)';
      params.push(req.user.id);
    }

    if (classId) {
      query += ' AND s.class_id = ?';
      params.push(classId);
    }

    if (searchTerm) {
      query += ' AND (s.name LIKE ? OR s.roll_no LIKE ?)';
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern);
    }

    query += ' ORDER BY s.roll_no, s.name';

    const [results] = await db.query(query, params);

    // Deduplicate by student_id to ensure only one record per student
    const seen = new Set();
    const uniqueResults = results.filter(r => {
      const key = r.student_id;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    res.json(uniqueResults.map(r => {
      // Check if fee structure exists for the class
      const structureTotal = r.structure_total_fee ? parseFloat(r.structure_total_fee) : null;
      
      // If no fee structure exists, show no-fee
      if (!structureTotal) {
        return {
          id: `student-${r.student_id}`,
          studentId: r.student_id,
          studentName: r.student_name,
          rollNo: r.roll_no,
          classId: r.class_id,
          className: r.class_name,
          classSection: r.class_section,
          hasFeeRecord: false,
          hasFeeStructure: false,
          totalFee: 0,
          paidAmount: 0,
          pendingAmount: 0,
          status: 'no-fee',
          dueDate: null,
          academicYearId: null
        };
      }
      
      // If student fee record exists, use its total_fee (customized for this student)
      // Otherwise, use fee structure total (class default)
      const studentFeeTotal = r.student_fee_total ? parseFloat(r.student_fee_total) : null;
      const totalFee = studentFeeTotal !== null ? studentFeeTotal : structureTotal;
      const paidAmount = r.paid_amount ? parseFloat(r.paid_amount) : 0;
      const pendingAmount = Math.max(0, totalFee - paidAmount);
      
      // Determine status based on fee and payments
      let status = 'unpaid';
      if (pendingAmount <= 0 && totalFee > 0) {
        status = 'paid';
      } else if (paidAmount > 0) {
        status = 'partial';
      }

      return {
        id: r.fee_id || `student-${r.student_id}`,
        studentId: r.student_id,
        studentName: r.student_name,
        rollNo: r.roll_no,
        classId: r.class_id,
        className: r.class_name,
        classSection: r.class_section,
        hasFeeRecord: !!r.fee_id,
        hasFeeStructure: true,
        totalFee: totalFee,
        paidAmount: paidAmount,
        pendingAmount: pendingAmount,
        status: status,
        dueDate: r.due_date,
        academicYearId: r.academic_year_id || r.structure_academic_year_id
      };
    }));
  } catch (error) {
    console.error('Get student fees error:', error);
    res.status(500).json({ error: 'Failed to fetch student fees' });
  }
});

// Get student fee by student ID
router.get('/students/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;

    let query = `
      SELECT 
        sf.*,
        s.name as student_name,
        s.roll_no,
        c.name as class_name,
        c.section as class_section
      FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      JOIN classes c ON sf.class_id = c.id
      WHERE sf.student_id = ?
    `;
    const params = [studentId];

    if (req.user.role === 'admin') {
      query += ' AND sf.school_id = ?';
      params.push(req.user.schoolId);
    }

    const [studentFee] = await db.query(query, params);

    if (studentFee.length === 0) {
      return res.status(404).json({ error: 'Student fee not found' });
    }

    const sf = studentFee[0];

    // Get payment history
    const [payments] = await db.query(
      'SELECT * FROM fee_payments WHERE student_fee_id = ? ORDER BY payment_date DESC',
      [sf.id]
    );

    // Parse other_fees JSON if it exists
    let otherFees = null;
    if (sf.other_fees) {
      try {
        otherFees = typeof sf.other_fees === 'string' ? JSON.parse(sf.other_fees) : sf.other_fees;
      } catch (e) {
        console.error('Error parsing other_fees:', e);
        otherFees = null;
      }
    }

    res.json({
      id: sf.id,
      studentId: sf.student_id,
      studentName: sf.student_name,
      rollNo: sf.roll_no,
      classId: sf.class_id,
      className: sf.class_name,
      classSection: sf.class_section,
      totalFee: parseFloat(sf.total_fee),
      tuitionFee: sf.tuition_fee ? parseFloat(sf.tuition_fee) : null,
      transportFee: sf.transport_fee ? parseFloat(sf.transport_fee) : null,
      labFee: sf.lab_fee ? parseFloat(sf.lab_fee) : null,
      otherFees: otherFees,
      paidAmount: parseFloat(sf.paid_amount),
      pendingAmount: parseFloat(sf.pending_amount),
      status: sf.status,
      dueDate: sf.due_date,
      academicYearId: sf.academic_year_id,
      payments: payments.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount),
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        transactionId: p.transaction_id,
        receiptNumber: p.receipt_number,
        remarks: p.remarks,
        createdAt: p.created_at
      })),
      createdAt: sf.created_at
    });
  } catch (error) {
    console.error('Get student fee error:', error);
    res.status(500).json({ error: 'Failed to fetch student fee' });
  }
});

// Get component breakdown for student
router.get('/students/:studentId/breakdown', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student fee record with student and class info
    const [studentFees] = await db.query(`
      SELECT sf.*, s.class_id, s.school_id
      FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      WHERE sf.student_id = ?
      ORDER BY sf.created_at DESC
      LIMIT 1
    `, [studentId]);

    if (studentFees.length === 0) {
      return res.status(404).json({ error: 'Student fee not found' });
    }

    const studentFee = studentFees[0];
    
    // Get all payment records for this student fee
    const [payments] = await db.query(
      'SELECT component, amount, payment_date, payment_method FROM fee_payments WHERE student_fee_id = ? ORDER BY payment_date DESC',
      [studentFee.id]
    );

    // Build breakdown from component_breakdown if it exists
    let breakdown = {};
    if (studentFee.component_breakdown) {
      try {
        breakdown = typeof studentFee.component_breakdown === 'string' 
          ? JSON.parse(studentFee.component_breakdown) 
          : studentFee.component_breakdown;
      } catch (parseError) {
        console.error('Error parsing component_breakdown:', parseError);
        breakdown = {};
      }
    }

    // If breakdown is empty, build it from fee structure
    if (!breakdown || Object.keys(breakdown).length === 0) {
      // Fetch fee structure for this class
      const [feeStructures] = await db.query(
        'SELECT * FROM fee_structure WHERE class_id = ? AND school_id = ?',
        [studentFee.class_id, studentFee.school_id]
      );

      if (feeStructures.length > 0) {
        const structure = feeStructures[0];
        
        // Build breakdown from fee structure
        breakdown = {
          tuition_fee: { 
            total: parseFloat(structure.tuition_fee) || 0, 
            paid: 0, 
            pending: parseFloat(structure.tuition_fee) || 0 
          },
          transport_fee: { 
            total: parseFloat(structure.transport_fee) || 0, 
            paid: 0, 
            pending: parseFloat(structure.transport_fee) || 0 
          },
          lab_fee: { 
            total: parseFloat(structure.lab_fee) || 0, 
            paid: 0, 
            pending: parseFloat(structure.lab_fee) || 0 
          }
        };

        // Add other components from fee structure
        if (structure.other_fees) {
          try {
            const otherFees = typeof structure.other_fees === 'string' 
              ? JSON.parse(structure.other_fees) 
              : structure.other_fees;
            
            if (otherFees && otherFees.components && Array.isArray(otherFees.components)) {
              otherFees.components.forEach((comp) => {
                const compKey = comp.name.toLowerCase().replace(/\s+/g, '_');
                breakdown[compKey] = { 
                  total: comp.amount || 0, 
                  paid: 0, 
                  pending: comp.amount || 0 
                };
              });
            }
          } catch (parseError) {
            console.error('Error parsing other_fees:', parseError);
          }
        }
      }
    }

    // Update breakdown with actual payment records
    // Calculate paid amounts per component from payment records
    const paidByComponent = {};
    payments.forEach((payment) => {
      const comp = payment.component || 'tuition_fee';
      if (!paidByComponent[comp]) {
        paidByComponent[comp] = 0;
      }
      paidByComponent[comp] += parseFloat(payment.amount) || 0;
    });

    // Update breakdown with actual paid amounts
    Object.keys(breakdown).forEach((key) => {
      const paid = paidByComponent[key] || 0;
      breakdown[key].paid = paid;
      breakdown[key].pending = Math.max(0, breakdown[key].total - paid);
    });

    res.json({
      totalFee: parseFloat(studentFee.total_fee) || 0,
      paidAmount: parseFloat(studentFee.paid_amount) || 0,
      pendingAmount: parseFloat(studentFee.pending_amount) || 0,
      breakdown,
      payments: payments.map(p => ({
        component: p.component || 'tuition_fee',
        amount: parseFloat(p.amount) || 0,
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method
      }))
    });
  } catch (error) {
    console.error('Get breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch breakdown' });
  }
});

// Create student fee (Admin only)
router.post('/students', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { studentId, classId, academicYearId, totalFee, tuitionFee, transportFee, labFee, otherFees, frequency, dueDate } = req.body;

    if (!studentId || !classId || !totalFee) {
      return res.status(400).json({ error: 'Student ID, class ID, and total fee are required' });
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Check if student fee already exists - if it does, update it instead of creating new
    const [existing] = await db.query(
      'SELECT id FROM student_fees WHERE student_id = ? AND academic_year_id = ?',
      [studentId, academicYearId || null]
    );

    if (existing.length > 0) {
      // Update existing fee instead of creating new one
      const existingFeeId = existing[0].id;
      
      // Build component breakdown
      let componentBreakdown = {};
      if (tuitionFee !== undefined) componentBreakdown.tuition_fee = { total: parseFloat(tuitionFee) || 0, paid: 0, pending: parseFloat(tuitionFee) || 0 };
      if (transportFee !== undefined) componentBreakdown.transport_fee = { total: parseFloat(transportFee) || 0, paid: 0, pending: parseFloat(transportFee) || 0 };
      if (labFee !== undefined) componentBreakdown.lab_fee = { total: parseFloat(labFee) || 0, paid: 0, pending: parseFloat(labFee) || 0 };
      
      if (otherFees && otherFees.components) {
        otherFees.components.forEach((comp) => {
          const compName = comp.name.toLowerCase().replace(/\s+/g, '_');
          componentBreakdown[compName] = { total: parseFloat(comp.amount) || 0, paid: 0, pending: parseFloat(comp.amount) || 0 };
        });
      }

      // Get current paid amount to preserve it
      const [currentFee] = await db.query(
        'SELECT paid_amount FROM student_fees WHERE id = ?',
        [existingFeeId]
      );
      const currentPaidAmount = currentFee[0]?.paid_amount || 0;
      const newPendingAmount = totalFee - currentPaidAmount;
      const newStatus = currentPaidAmount === 0 ? 'unpaid' : (currentPaidAmount >= totalFee ? 'paid' : 'partial');

      await db.query(
        `UPDATE student_fees SET
          total_fee = ?,
          tuition_fee = ?,
          transport_fee = ?,
          lab_fee = ?,
          other_fees = ?,
          pending_amount = ?,
          status = ?,
          due_date = ?,
          component_breakdown = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          totalFee,
          tuitionFee || null,
          transportFee || null,
          labFee || null,
          otherFees ? JSON.stringify(otherFees) : null,
          newPendingAmount,
          newStatus,
          dueDate || null,
          Object.keys(componentBreakdown).length > 0 ? JSON.stringify(componentBreakdown) : null,
          existingFeeId
        ]
      );

      console.log('✅ Student fee updated:', { existingFeeId, studentId, classId, totalFee });
      return res.json({ success: true, studentFeeId: existingFeeId, updated: true });
    }

    // Auto-create columns if they don't exist (MySQL doesn't support IF NOT EXISTS for ALTER TABLE)
    try {
      // Check if columns exist by querying information_schema
      const [columns] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'student_fees' 
        AND COLUMN_NAME IN ('tuition_fee', 'transport_fee', 'lab_fee', 'other_fees')
      `);
      
      const existingColumns = columns.map(col => col.COLUMN_NAME);
      
      if (!existingColumns.includes('tuition_fee')) {
        await db.query('ALTER TABLE student_fees ADD COLUMN tuition_fee DECIMAL(10,2) NULL');
      }
      if (!existingColumns.includes('transport_fee')) {
        await db.query('ALTER TABLE student_fees ADD COLUMN transport_fee DECIMAL(10,2) NULL');
      }
      if (!existingColumns.includes('lab_fee')) {
        await db.query('ALTER TABLE student_fees ADD COLUMN lab_fee DECIMAL(10,2) NULL');
      }
      if (!existingColumns.includes('other_fees')) {
        await db.query('ALTER TABLE student_fees ADD COLUMN other_fees JSON NULL');
      }
    } catch (alterError) {
      // Columns might already exist, ignore error
      console.log('Note: Error checking/creating columns:', alterError.message);
    }

    // Build component breakdown
    let componentBreakdown = {};
    if (tuitionFee !== undefined) componentBreakdown.tuition_fee = { total: parseFloat(tuitionFee) || 0, paid: 0, pending: parseFloat(tuitionFee) || 0 };
    if (transportFee !== undefined) componentBreakdown.transport_fee = { total: parseFloat(transportFee) || 0, paid: 0, pending: parseFloat(transportFee) || 0 };
    if (labFee !== undefined) componentBreakdown.lab_fee = { total: parseFloat(labFee) || 0, paid: 0, pending: parseFloat(labFee) || 0 };
    
    if (otherFees && otherFees.components) {
      otherFees.components.forEach((comp) => {
        const compName = comp.name.toLowerCase().replace(/\s+/g, '_');
        componentBreakdown[compName] = { total: parseFloat(comp.amount) || 0, paid: 0, pending: parseFloat(comp.amount) || 0 };
      });
    }

    const studentFeeId = uuidv4();
    await db.query(
      `INSERT INTO student_fees (
        id, student_id, class_id, school_id, academic_year_id, 
        total_fee, tuition_fee, transport_fee, lab_fee, other_fees,
        paid_amount, pending_amount, status, due_date, component_breakdown, created_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?, ?, NOW())`,
      [
        studentFeeId, studentId, classId, schoolId, academicYearId || null,
        totalFee, 
        tuitionFee || null, 
        transportFee || null, 
        labFee || null,
        otherFees ? JSON.stringify(otherFees) : null,
        totalFee, 
        dueDate || null,
        Object.keys(componentBreakdown).length > 0 ? JSON.stringify(componentBreakdown) : null
      ]
    );

    console.log('✅ Student fee created:', { studentFeeId, studentId, classId, totalFee, hasComponents: !!tuitionFee });
    res.status(201).json({ success: true, studentFeeId });
  } catch (error) {
    console.error('Create student fee error:', error);
    res.status(500).json({ error: 'Failed to create student fee' });
  }
});

// Create fees for all students in a class (Admin only)
router.post('/students/bulk', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { classId, academicYearId, totalFee, dueDate } = req.body;

    if (!classId || !totalFee) {
      return res.status(400).json({ error: 'Class ID and total fee are required' });
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Get all approved students in the class
    const [students] = await db.query(
      'SELECT id FROM students WHERE class_id = ? AND school_id = ? AND status = ?',
      [classId, schoolId, 'approved']
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'No approved students found in this class' });
    }

    const createdFees = [];
    const skippedFees = [];

    // Create fee for each student
    for (const student of students) {
      // Check if fee already exists
      const [existing] = await db.query(
        'SELECT id FROM student_fees WHERE student_id = ? AND academic_year_id = ?',
        [student.id, academicYearId || null]
      );

      if (existing.length > 0) {
        skippedFees.push({ studentId: student.id, reason: 'Fee already exists' });
        continue;
      }

      const studentFeeId = uuidv4();
      await db.query(
        `INSERT INTO student_fees (id, student_id, class_id, school_id, academic_year_id, total_fee, paid_amount, pending_amount, status, due_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?, NOW())`,
        [studentFeeId, student.id, classId, schoolId, academicYearId || null, totalFee, totalFee, dueDate || null]
      );

      createdFees.push({ studentId: student.id, feeId: studentFeeId });
    }

    console.log('✅ Bulk fees created:', { classId, created: createdFees.length, skipped: skippedFees.length });

    res.status(201).json({ 
      success: true, 
      created: createdFees.length,
      skipped: skippedFees.length,
      total: students.length,
      details: {
        created: createdFees,
        skipped: skippedFees
      }
    });
  } catch (error) {
    console.error('Bulk create student fees error:', error);
    res.status(500).json({ error: 'Failed to create student fees' });
  }
});

// Update student fee (Admin only)
router.put('/students/:studentFeeId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { studentFeeId } = req.params;
    const { totalFee, tuitionFee, transportFee, labFee, otherFees, frequency, dueDate } = req.body;

    if (!totalFee) {
      return res.status(400).json({ error: 'Total fee is required' });
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Auto-create columns if they don't exist (MySQL doesn't support IF NOT EXISTS for ALTER TABLE)
    try {
      // Check if columns exist by querying information_schema
      const [columns] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'student_fees' 
        AND COLUMN_NAME IN ('tuition_fee', 'transport_fee', 'lab_fee', 'other_fees')
      `);
      
      const existingColumns = columns.map(col => col.COLUMN_NAME);
      
      if (!existingColumns.includes('tuition_fee')) {
        await db.query('ALTER TABLE student_fees ADD COLUMN tuition_fee DECIMAL(10,2) NULL');
      }
      if (!existingColumns.includes('transport_fee')) {
        await db.query('ALTER TABLE student_fees ADD COLUMN transport_fee DECIMAL(10,2) NULL');
      }
      if (!existingColumns.includes('lab_fee')) {
        await db.query('ALTER TABLE student_fees ADD COLUMN lab_fee DECIMAL(10,2) NULL');
      }
      if (!existingColumns.includes('other_fees')) {
        await db.query('ALTER TABLE student_fees ADD COLUMN other_fees JSON NULL');
      }
    } catch (alterError) {
      // Columns might already exist, ignore error
      console.log('Note: Error checking/creating columns:', alterError.message);
    }

    // Check if student fee exists and belongs to this school
    const [existing] = await db.query(
      'SELECT id, paid_amount FROM student_fees WHERE id = ? AND school_id = ?',
      [studentFeeId, schoolId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Student fee not found' });
    }

    // Build component breakdown
    let componentBreakdown = {};
    if (tuitionFee !== undefined) componentBreakdown.tuition_fee = { total: parseFloat(tuitionFee) || 0, paid: 0, pending: parseFloat(tuitionFee) || 0 };
    if (transportFee !== undefined) componentBreakdown.transport_fee = { total: parseFloat(transportFee) || 0, paid: 0, pending: parseFloat(transportFee) || 0 };
    if (labFee !== undefined) componentBreakdown.lab_fee = { total: parseFloat(labFee) || 0, paid: 0, pending: parseFloat(labFee) || 0 };
    
    if (otherFees && otherFees.components) {
      otherFees.components.forEach((comp) => {
        const compName = comp.name.toLowerCase().replace(/\s+/g, '_');
        componentBreakdown[compName] = { total: parseFloat(comp.amount) || 0, paid: 0, pending: parseFloat(comp.amount) || 0 };
      });
    }

    // Get current paid amount to preserve it
    const currentPaidAmount = existing[0].paid_amount || 0;
    const newPendingAmount = totalFee - currentPaidAmount;
    const newStatus = currentPaidAmount === 0 ? 'unpaid' : (currentPaidAmount >= totalFee ? 'paid' : 'partial');

    await db.query(
      `UPDATE student_fees SET
        total_fee = ?,
        tuition_fee = ?,
        transport_fee = ?,
        lab_fee = ?,
        other_fees = ?,
        pending_amount = ?,
        status = ?,
        due_date = ?,
        component_breakdown = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        totalFee,
        tuitionFee || null,
        transportFee || null,
        labFee || null,
        otherFees ? JSON.stringify(otherFees) : null,
        newPendingAmount,
        newStatus,
        dueDate || null,
        Object.keys(componentBreakdown).length > 0 ? JSON.stringify(componentBreakdown) : null,
        studentFeeId
      ]
    );

    console.log('✅ Student fee updated:', { studentFeeId, totalFee });
    res.json({ success: true });
  } catch (error) {
    console.error('Update student fee error:', error);
    res.status(500).json({ error: 'Failed to update student fee' });
  }
});

// ============ FEE PAYMENTS ============

// Record payment (Admin only)
router.post('/payments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { studentFeeId, amount, paymentDate, paymentMethod, transactionId, receiptNumber, remarks, component } = req.body;

    if (!studentFeeId || !amount || !paymentDate) {
      return res.status(400).json({ error: 'Student fee ID, amount, and payment date are required' });
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Auto-create component column in fee_payments if it doesn't exist
    try {
      await db.query(`
        ALTER TABLE fee_payments 
        ADD COLUMN component VARCHAR(50) NULL COMMENT 'Component name: tuition_fee, transport_fee, lab_fee, or other component name'
      `);
      console.log('✅ Added component column to fee_payments');
    } catch (alterError) {
      // Column already exists, ignore error
      if (!alterError.message.includes('Duplicate column name')) {
        console.warn('Could not add component column:', alterError.message);
      }
    }

    // Auto-create component_breakdown column in student_fees if it doesn't exist
    try {
      await db.query(`
        ALTER TABLE student_fees 
        ADD COLUMN component_breakdown JSON NULL COMMENT 'JSON object tracking component-wise payments and pending amounts'
      `);
      console.log('✅ Added component_breakdown column to student_fees');
    } catch (alterError) {
      // Column already exists, ignore error
      if (!alterError.message.includes('Duplicate column name')) {
        console.warn('Could not add component_breakdown column:', alterError.message);
      }
    }

    // Get current student fee with component breakdown
    const [studentFee] = await db.query(
      'SELECT * FROM student_fees WHERE id = ? AND school_id = ?',
      [studentFeeId, schoolId]
    );

    if (studentFee.length === 0) {
      return res.status(404).json({ error: 'Student fee not found' });
    }

    const feeRecord = studentFee[0];
    const paymentAmount = parseFloat(amount);
    const currentPaid = parseFloat(feeRecord.paid_amount) || 0;
    const currentPending = parseFloat(feeRecord.pending_amount) || 0;
    const newPaid = currentPaid + paymentAmount;
    const newPending = Math.max(0, currentPending - paymentAmount);

    // Update component breakdown if component is specified
    let componentBreakdown = {};
    try {
      if (feeRecord.component_breakdown) {
        componentBreakdown = typeof feeRecord.component_breakdown === 'string' 
          ? JSON.parse(feeRecord.component_breakdown) 
          : feeRecord.component_breakdown;
      }
    } catch (parseError) {
      console.error('Error parsing component_breakdown:', parseError);
      componentBreakdown = {};
    }

    if (component && componentBreakdown[component]) {
      const compData = componentBreakdown[component];
      compData.paid = (compData.paid || 0) + paymentAmount;
      compData.pending = Math.max(0, (compData.pending || 0) - paymentAmount);
    } else if (component) {
      // If component is provided but not in breakdown, log warning but continue
      console.warn(`Component ${component} not found in breakdown for student fee ${studentFeeId}`);
    }

    // Determine new status
    let newStatus = 'unpaid';
    if (newPending === 0) {
      newStatus = 'paid';
    } else if (newPaid > 0) {
      newStatus = 'partial';
    }

    // Create payment record
    const paymentId = uuidv4();
    await db.query(
      `INSERT INTO fee_payments (id, student_fee_id, amount, payment_date, payment_method, transaction_id, receipt_number, remarks, component, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [paymentId, studentFeeId, paymentAmount, paymentDate, paymentMethod || 'cash', transactionId || null, receiptNumber || null, remarks || null, component || null, req.user.id]
    );

    // Update student fee
    await db.query(
      `UPDATE student_fees 
       SET paid_amount = ?, pending_amount = ?, status = ?, component_breakdown = ?, updated_at = NOW()
       WHERE id = ?`,
      [newPaid, newPending, newStatus, JSON.stringify(componentBreakdown), studentFeeId]
    );

    res.status(201).json({ success: true, paymentId });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ============ FEE SUMMARY ============

// Get fee summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user.role === 'admin' ? req.user.schoolId : null;
    
    // Calculate summary based on fee structure (only students with fee structures)
    let query = `
      SELECT 
        s.id as student_id,
        s.class_id,
        fs.total_fee as structure_total_fee,
        COALESCE(sf.paid_amount, 0) as paid_amount,
        CASE 
          WHEN fs.total_fee IS NULL THEN 0
          ELSE GREATEST(0, fs.total_fee - COALESCE(sf.paid_amount, 0))
        END as pending_amount,
        CASE 
          WHEN fs.total_fee IS NULL THEN 'no-fee'
          WHEN GREATEST(0, fs.total_fee - COALESCE(sf.paid_amount, 0)) <= 0 AND fs.total_fee > 0 THEN 'paid'
          WHEN COALESCE(sf.paid_amount, 0) > 0 THEN 'partial'
          ELSE 'unpaid'
        END as fee_status
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN fee_structure fs ON fs.class_id = s.class_id AND fs.school_id = s.school_id
      LEFT JOIN student_fees sf ON sf.student_id = s.id AND sf.class_id = s.class_id
      WHERE s.status = 'approved'
    `;
    const params = [];

    if (schoolId) {
      query += ' AND s.school_id = ?';
      params.push(schoolId);
    } else if (req.user.role === 'teacher') {
      query += ' AND s.class_id IN (SELECT class_id FROM teachers WHERE id = ?)';
      params.push(req.user.id);
    }

    const [results] = await db.query(query, params);

    // Calculate summary from results
    let totalCollected = 0;
    let totalPending = 0;
    let fullyPaidCount = 0;
    let unpaidCount = 0;

    results.forEach((r) => {
      // Only count students with fee structures
      if (r.structure_total_fee) {
        const paid = parseFloat(r.paid_amount) || 0;
        const pending = parseFloat(r.pending_amount) || 0;
        
        totalCollected += paid;
        totalPending += pending;
        
        if (r.fee_status === 'paid') {
          fullyPaidCount++;
        } else if (r.fee_status === 'unpaid') {
          unpaidCount++;
        }
      }
    });

    res.json({
      totalCollected: totalCollected,
      totalPending: totalPending,
      fullyPaidCount: fullyPaidCount,
      unpaidCount: unpaidCount
    });
  } catch (error) {
    console.error('Get fee summary error:', error);
    res.status(500).json({ error: 'Failed to fetch fee summary' });
  }
});

// ============ FEE REMINDERS ============

// Send fee reminder (Admin only)
router.post('/reminders/:studentId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Get student fee details with school name
    const [studentFee] = await db.query(
      `SELECT sf.*, s.name as student_name, s.parent_phone, s.parent_email, 
              c.name as class_name, c.section as class_section,
              sch.name as school_name
       FROM student_fees sf
       JOIN students s ON sf.student_id = s.id
       JOIN classes c ON s.class_id = c.id
       JOIN schools sch ON s.school_id = sch.id
       WHERE sf.student_id = ? AND sf.school_id = ?`,
      [studentId, schoolId]
    );

    if (studentFee.length === 0) {
      return res.status(404).json({ error: 'Student fee not found' });
    }

    const feeData = studentFee[0];
    const pendingAmount = parseFloat(feeData.pending_amount) || 0;

    if (pendingAmount <= 0) {
      return res.status(400).json({ error: 'No pending amount. Fee is already paid.' });
    }

    if (!feeData.parent_phone) {
      return res.status(400).json({ error: 'Parent phone number is not available for this student.' });
    }

    res.json({ 
      success: true, 
      message: 'Reminder data retrieved successfully',
      studentName: feeData.student_name,
      parentPhone: feeData.parent_phone,
      pendingAmount: pendingAmount,
      className: `${feeData.class_name}${feeData.class_section ? ' - ' + feeData.class_section : ''}`,
      schoolName: feeData.school_name || 'School'
    });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

module.exports = router;

