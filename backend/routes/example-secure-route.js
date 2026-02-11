/**
 * Example Secure Route - Demonstrates SecureQueryBuilder usage
 * This is a reference implementation showing best practices
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const SecureQueryBuilder = require('../utils/query-builder');
const { logSelect, logInsert, logUpdate, logDelete } = require('../utils/audit-logger');

/**
 * Example 1: Using SecureQueryBuilder for SELECT
 * GET /api/example/students
 */
router.get('/students', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const builder = new SecureQueryBuilder(schoolId, userId);

    // Build secure query
    const { query, params } = builder.select(
      'students',
      ['id', 'name', 'status', 'admission_number'],
      'status = ?',
      ['approved'],
      'name ASC',
      50 // limit
    );

    // Execute query
    const [students] = await db.query(query, params);

    // Log the access
    await logSelect(schoolId, userId, 'students', { status: 'approved' }, req);

    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

/**
 * Example 2: Using SecureQueryBuilder for JOIN queries
 * GET /api/example/students-with-classes
 */
router.get('/students-with-classes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const builder = new SecureQueryBuilder(schoolId, userId);

    // Build secure JOIN query
    const { query, params } = builder.join(
      'students',
      [
        { type: 'LEFT', table: 'classes', on: 'classes.id = students.class_id' },
        { type: 'LEFT', table: 'student_enrollments', on: 'student_enrollments.student_id = students.id' }
      ],
      [
        'students.id',
        'students.name',
        'students.status',
        'classes.name as class_name',
        'classes.section as class_section',
        'student_enrollments.roll_no'
      ],
      'students.status = ?',
      ['approved'],
      'students.name ASC'
    );

    const [results] = await db.query(query, params);

    await logSelect(schoolId, userId, 'students', { join: 'classes, student_enrollments' }, req);

    res.json(results);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

/**
 * Example 3: Using SecureQueryBuilder for INSERT
 * POST /api/example/students
 */
router.post('/students', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const builder = new SecureQueryBuilder(schoolId, userId);

    const { name, parentPhone, parentName } = req.body;

    // Build secure INSERT query (school_id automatically added)
    const { query, params } = builder.insert('students', {
      name,
      parent_phone: parentPhone,
      parent_name: parentName,
      status: 'pending',
      created_at: new Date()
    });

    const [result] = await db.query(query, params);
    const studentId = result.insertId || params.find(p => typeof p === 'string' && p.length === 36);

    // Log the insert
    await logInsert(
      schoolId,
      userId,
      'students',
      studentId,
      { name, parentPhone, parentName, status: 'pending' },
      req
    );

    res.status(201).json({ success: true, id: studentId });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

/**
 * Example 4: Using SecureQueryBuilder for UPDATE
 * PUT /api/example/students/:id
 */
router.put('/students/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const { id } = req.params;
    const builder = new SecureQueryBuilder(schoolId, userId);

    // First, get old values for audit log
    const { query: selectQuery, params: selectParams } = builder.select(
      'students',
      '*',
      'id = ?',
      [id]
    );
    const [oldRecords] = await db.query(selectQuery, selectParams);

    if (oldRecords.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const oldValues = oldRecords[0];

    // Build secure UPDATE query
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.status) updates.status = req.body.status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { query, params } = builder.update(
      'students',
      updates,
      'id = ?',
      [id]
    );

    await db.query(query, params);

    // Log the update
    await logUpdate(
      schoolId,
      userId,
      'students',
      id,
      oldValues,
      updates,
      req
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

/**
 * Example 5: Using SecureQueryBuilder for DELETE
 * DELETE /api/example/students/:id
 */
router.delete('/students/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const { id } = req.params;
    const builder = new SecureQueryBuilder(schoolId, userId);

    // First, get old values for audit log
    const { query: selectQuery, params: selectParams } = builder.select(
      'students',
      '*',
      'id = ?',
      [id]
    );
    const [oldRecords] = await db.query(selectQuery, selectParams);

    if (oldRecords.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const oldValues = oldRecords[0];

    // Build secure DELETE query
    const { query, params } = builder.delete('students', 'id = ?', [id]);

    await db.query(query, params);

    // Log the delete
    await logDelete(
      schoolId,
      userId,
      'students',
      id,
      oldValues,
      req
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

/**
 * Example 6: Traditional approach (still secure, but manual)
 * This shows how current routes work - they manually include school_id
 */
router.get('/students-traditional', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Manual approach - still secure if school_id is always included
    const [students] = await db.query(
      'SELECT * FROM students WHERE school_id = ? AND status = ?',
      [schoolId, 'approved']
    );

    res.json(students);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

module.exports = router;

