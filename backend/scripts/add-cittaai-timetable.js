// backend/scripts/add-cittaai-timetable.js
require('dotenv').config();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function addCittaAITimetable() {
  console.log('🔌 Connecting to database...');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
  console.log(`   Database: ${process.env.DB_NAME || 'allpulse'}`);
  console.log(`   User: ${process.env.DB_USER || 'postgres'}\n`);

  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('🌱 Adding timetable data for CittaAI school...\n');
    
    // 1. Find CittaAI school
    const [schools] = await connection.query(
      `SELECT id, name, code FROM schools WHERE code = ? OR name = ?`,
      ['CITTA001', 'CittaAI']
    );
    
    if (schools.length === 0) {
      await connection.rollback();
      connection.end();
      console.log('❌ CittaAI school not found!');
      console.log('   Please run the main seed script first: node scripts/seed-cittaai-school.js\n');
      process.exit(1);
    }
    
    const school = schools[0];
    const schoolId = school.id;
    console.log(`✅ Found school: ${school.name} (Code: ${school.code}, ID: ${schoolId.substring(0, 8)}...)\n`);
    
    // 2. Get all classes for this school
    const [classesRows] = await connection.query(
      `SELECT id, name, section FROM classes WHERE school_id = ? ORDER BY name, section`,
      [schoolId]
    );
    
    if (classesRows.length === 0) {
      await connection.rollback();
      connection.end();
      console.log('❌ No classes found for CittaAI school!');
      console.log('   Please run the main seed script first: node scripts/seed-cittaai-school.js\n');
      process.exit(1);
    }
    
    const classes = classesRows.map(c => ({
      id: c.id,
      name: c.name,
      section: c.section || '',
      classNum: parseInt(c.name.replace(/[^0-9]/g, '')) || 0
    }));
    console.log(`✅ Found ${classes.length} classes`);
    
    // 3. Get all teachers for this school
    const [teachersRows] = await connection.query(
      `SELECT id, name, class_id, subjects FROM teachers WHERE school_id = ? AND is_active = true`,
      [schoolId]
    );
    
    const teachers = teachersRows.map(t => ({
      id: t.id,
      name: t.name,
      classId: t.class_id,
      subjects: t.subjects ? (typeof t.subjects === 'string' ? JSON.parse(t.subjects) : t.subjects) : []
    }));
    console.log(`✅ Found ${teachers.length} teachers`);
    
    // 4. Get all subjects for this school
    const [subjectsRows] = await connection.query(
      `SELECT code, name FROM subjects WHERE school_id = ?`,
      [schoolId]
    );
    
    const subjects = subjectsRows.map(s => [s.code, s.name]);
    console.log(`✅ Found ${subjects.length} subjects\n`);
    
    // 5. Check if time slots exist, create if not
    const [existingSlots] = await connection.query(
      `SELECT id FROM time_slots WHERE school_id = ?`,
      [schoolId]
    );
    
    let timeSlotIds = [];
    
    if (existingSlots.length === 0) {
      console.log('📅 Creating time slots...');
      const timeSlots = [
        { start: '08:00:00', end: '08:45:00', type: 'class', order: 1 },
        { start: '08:45:00', end: '09:30:00', type: 'class', order: 2 },
        { start: '09:30:00', end: '09:45:00', type: 'break', order: 3 },
        { start: '09:45:00', end: '10:30:00', type: 'class', order: 4 },
        { start: '10:30:00', end: '11:15:00', type: 'class', order: 5 },
        { start: '11:15:00', end: '12:00:00', type: 'lunch', order: 6 },
        { start: '12:00:00', end: '12:45:00', type: 'class', order: 7 },
        { start: '12:45:00', end: '13:30:00', type: 'class', order: 8 }
      ];
      
      for (const slot of timeSlots) {
        const slotId = uuidv4();
        await connection.query(
          `INSERT INTO time_slots (id, school_id, start_time, end_time, type, display_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [slotId, schoolId, slot.start, slot.end, slot.type, slot.order]
        );
        timeSlotIds.push({ id: slotId, ...slot });
      }
      console.log(`✅ Created ${timeSlots.length} time slots\n`);
    } else {
      console.log('📅 Time slots already exist, using existing slots...');
      const [slots] = await connection.query(
        `SELECT id, start_time, end_time, type, display_order FROM time_slots WHERE school_id = ? ORDER BY display_order`,
        [schoolId]
      );
      timeSlotIds = slots.map(s => ({
        id: s.id,
        start: s.start_time,
        end: s.end_time,
        type: s.type,
        order: s.display_order
      }));
      console.log(`✅ Using ${timeSlotIds.length} existing time slots\n`);
    }
    
    // 6. Check for existing timetable entries
    const [existingEntries] = await connection.query(
      `SELECT COUNT(*) as count FROM timetable_entries WHERE school_id = ?`,
      [schoolId]
    );
    
    if (existingEntries[0].count > 0) {
      console.log(`⚠️  Found ${existingEntries[0].count} existing timetable entries.`);
      console.log('   Deleting existing entries to recreate...\n');
      await connection.query(
        `DELETE FROM timetable_entries WHERE school_id = ?`,
        [schoolId]
      );
    }
    
    // 7. Create Weekly Timetables for all classes
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const classTimeSlots = timeSlotIds.filter(s => s.type === 'class'); // Only class periods
    
    // Subject distribution for different class levels
    const getSubjectsForClass = (classNum) => {
      if (classNum <= 5) {
        // Lower classes: Core subjects
        return ['ENG', 'MATH', 'SCI', 'HIN', 'SOC', 'PE', 'COMP'];
      } else {
        // Upper classes: More specialized subjects
        return ['ENG', 'MATH', 'PHY', 'CHEM', 'BIO', 'HIN', 'SOC', 'COMP', 'PE'];
      }
    };
    
    let timetableEntriesCount = 0;
    let skippedCount = 0;
    
    console.log('📚 Creating weekly timetables...\n');
    
    for (const classInfo of classes) {
      const classSubjects = getSubjectsForClass(classInfo.classNum);
      const classTeacher = teachers.find(t => t.classId === classInfo.id);
      
      // Create timetable for each day
      for (const day of daysOfWeek) {
        // Create a varied schedule by rotating subjects
        const dayIndex = daysOfWeek.indexOf(day);
        const rotatedSubjects = [...classSubjects];
        // Rotate subjects for variety across days
        for (let i = 0; i < dayIndex; i++) {
          rotatedSubjects.push(rotatedSubjects.shift());
        }
        
        // Assign subjects to each class period
        for (let i = 0; i < classTimeSlots.length; i++) {
          const slot = classTimeSlots[i];
          const subjectCode = rotatedSubjects[i % rotatedSubjects.length];
          const subjectName = subjects.find(s => s[0] === subjectCode)?.[1] || subjectCode;
          
          // Find a teacher who teaches this subject
          let assignedTeacher = null;
          let assignedTeacherName = 'TBD';
          
          // First try class teacher if they teach this subject
          if (classTeacher && classTeacher.subjects.includes(subjectCode)) {
            assignedTeacher = classTeacher.id;
            assignedTeacherName = classTeacher.name;
          } else {
            // Find any teacher who teaches this subject
            const subjectTeacher = teachers.find(t => 
              t.subjects && Array.isArray(t.subjects) && t.subjects.includes(subjectCode)
            );
            if (subjectTeacher) {
              assignedTeacher = subjectTeacher.id;
              assignedTeacherName = subjectTeacher.name;
            }
          }
          
          // Check if entry already exists (shouldn't happen after delete, but just in case)
          const [existing] = await connection.query(
            `SELECT id FROM timetable_entries 
             WHERE class_id = ? AND time_slot_id = ? AND day_of_week = ?`,
            [classInfo.id, slot.id, day]
          );
          
          if (existing.length === 0) {
            const entryId = uuidv4();
            await connection.query(
              `INSERT INTO timetable_entries (id, school_id, class_id, time_slot_id, day_of_week, subject_code, subject_name, teacher_id, teacher_name, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [
                entryId,
                schoolId,
                classInfo.id,
                slot.id,
                day,
                subjectCode,
                subjectName,
                assignedTeacher,
                assignedTeacherName
              ]
            );
            timetableEntriesCount++;
          } else {
            skippedCount++;
          }
        }
      }
    }
    
    await connection.commit();
    
    console.log('\n🎉 Timetable data added successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`   ✅ School: ${school.name} (${school.code})`);
    console.log(`   ✅ Classes: ${classes.length}`);
    console.log(`   ✅ Teachers: ${teachers.length}`);
    console.log(`   ✅ Subjects: ${subjects.length}`);
    console.log(`   ✅ Time Slots: ${timeSlotIds.length} (${classTimeSlots.length} class periods)`);
    console.log(`   ✅ Timetable Entries Created: ${timetableEntriesCount}`);
    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped (duplicates): ${skippedCount}`);
    }
    console.log(`   ✅ Total: ${classes.length} classes × 5 days × ${classTimeSlots.length} periods = ${classes.length * 5 * classTimeSlots.length} entries\n`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✨ Timetable is ready to use!\n');
    
  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Error adding timetable data:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection Error:');
      console.error('   - Check if MySQL server is running');
      console.error('   - Verify DB_HOST and DB_PORT in your .env file');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === '28P01') {
      console.error('\n💡 Authentication Error:');
      console.error('   - Check DB_USER and DB_PASSWORD in your .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR' || error.code === '3D000') {
      console.error('\n💡 Database Error:');
      console.error('   - Check DB_NAME in your .env file');
      console.error('   - Make sure the database exists');
    }
    
    throw error;
  } finally {
    connection.release();
  }
}

// Run the script
if (require.main === module) {
  addCittaAITimetable()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { addCittaAITimetable };

















