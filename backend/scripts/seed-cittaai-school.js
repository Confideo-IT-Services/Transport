// backend/scripts/seed-cittaai-school.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Use same database config as backend
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'allpulse',
};

// Indian names for realistic data
const firstNames = [
  'Arjun', 'Priya', 'Vikram', 'Ananya', 'Rohan', 'Kavya', 'Aditya', 'Isha', 'Rahul', 'Sneha',
  'Karan', 'Neha', 'Aarav', 'Diya', 'Arnav', 'Riya', 'Vivaan', 'Anika', 'Reyansh', 'Aadhya',
  'Vihaan', 'Myra', 'Advik', 'Ishita', 'Rudra', 'Saanvi', 'Ayaan', 'Kiara', 'Aarush', 'Avni',
  'Kabir', 'Zara', 'Aryan', 'Pari', 'Ishaan', 'Anvi', 'Tanya', 'Kartik', 'Nisha', 'Pooja',
  'Nikhil', 'Shreya', 'Aarav', 'Anaya', 'Ishani', 'Dev', 'Meera', 'Rohan', 'Sara', 'Ved',
  'Aanya', 'Reyansh', 'Ishaan', 'Anvi', 'Arjun', 'Saanvi', 'Vihaan', 'Ishani', 'Aarav', 'Anaya'
];

const lastNames = [
  'Kumar', 'Sharma', 'Singh', 'Reddy', 'Mehta', 'Nair', 'Patel', 'Gupta', 'Verma', 'Joshi',
  'Malhotra', 'Kapoor', 'Iyer', 'Menon', 'Desai', 'Rao', 'Bhat', 'Krishnan', 'Pillai', 'Nambiar',
  'Choudhury', 'Banerjee', 'Ghosh', 'Mukherjee', 'Chatterjee', 'Das', 'Roy', 'Sengupta', 'Basu', 'Bose',
  'Dutta', 'Sinha', 'Tiwari', 'Dubey', 'Mishra', 'Trivedi', 'Shukla', 'Pandey', 'Saxena', 'Agarwal',
  'Garg', 'Bansal', 'Goel', 'Mittal', 'Shah', 'Jain', 'Agarwal', 'Sharma', 'Patel', 'Kumar'
];

const teacherFirstNames = [
  'Priya', 'Rajesh', 'Anita', 'Vikram', 'Sunita', 'Amit', 'Deepa', 'Suresh', 'Kavita', 'Manoj',
  'Rekha', 'Naveen', 'Pooja', 'Ravi', 'Meera', 'Sandeep', 'Anjali', 'Vikash', 'Swati', 'Rahul',
  'Neha', 'Ashok', 'Shilpa', 'Gaurav', 'Divya', 'Kiran', 'Suman', 'Raj', 'Preeti', 'Nitin'
];

function generateName() {
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function generateTeacherName() {
  return `${teacherFirstNames[Math.floor(Math.random() * teacherFirstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function generateParentName() {
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function generatePhone() {
  return `9${String(Math.floor(Math.random() * 900000000) + 100000000)}`;
}

function generateEmail(name) {
  const clean = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  return `${clean}@cittaai.edu`;
}

function generateDOB(classNum) {
  // Class 1 = ~7 years old (born 2018), Class 10 = ~16 years old (born 2009)
  const year = 2025 - (classNum + 6);
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function generatePhotoUrl(gender, index) {
  // Using placeholder service for photos
  const imgIndex = (index % 70) + 1;
  if (gender === 'female') {
    return `https://i.pravatar.cc/300?img=${imgIndex + 20}`;
  }
  return `https://i.pravatar.cc/300?img=${imgIndex}`;
}

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const genders = ['male', 'female'];

async function seedCittaAISchool() {
  console.log('🔌 Connecting to database...');
  console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log(`   User: ${dbConfig.user}\n`);
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    await connection.beginTransaction();
    
    console.log('🌱 Starting CittaAI school seed...\n');
    
    const schoolCode = 'CITTA001';
    const hashedPassword = await bcrypt.hash('password', 10);
    
    // Check if CittaAI school already exists
    const [existingSchools] = await connection.query(
      'SELECT id FROM schools WHERE code = ?',
      [schoolCode]
    );
    
    if (existingSchools.length > 0) {
      const oldSchoolId = existingSchools[0].id;
      console.log('⚠️  CittaAI school already exists. Cleaning up existing data...');
      
      // Delete all related data (CASCADE will handle most, but we need to delete users manually)
      // Delete admin user first (users table has ON DELETE SET NULL, so we delete manually)
      await connection.query(
        'DELETE FROM users WHERE school_id = ? AND role = ?',
        [oldSchoolId, 'admin']
      );
      
      // Delete the school (CASCADE will delete: academic_years, subjects, teachers, classes, students, etc.)
      await connection.query(
        'DELETE FROM schools WHERE id = ?',
        [oldSchoolId]
      );
      
      console.log('✅ Cleaned up existing CittaAI school data');
    }
    
    // 1. Create School
    const schoolId = uuidv4();
    
    await connection.query(
      `INSERT INTO schools (id, name, code, type, location, address, phone, email, status, logo_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
      [
        schoolId,
        'CittaAI',
        schoolCode,
        'K-12',
        'Bangalore',
        '123 AI Innovation Street, Tech Park, Bangalore - 560001',
        '9876543210',
        'admin@cittaai.edu',
        'https://via.placeholder.com/200x200/4F46E5/FFFFFF?text=CittaAI'
      ]
    );
    console.log('✅ School created: CittaAI (ID: ' + schoolId.substring(0, 8) + '...)');
    
    // 2. Create Admin
    const adminId = uuidv4();
    await connection.query(
      `INSERT INTO users (id, email, password, name, role, school_id, is_active, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?, true, NOW())`,
      [adminId, 'admin@cittaai.edu', hashedPassword, 'CittaAI Admin', schoolId]
    );
    console.log('✅ Admin created: admin@cittaai.edu / password');
    
    // 3. Create Academic Years
    const ay2024 = uuidv4();
    const ay2025 = uuidv4();
    await connection.query(
      `INSERT INTO academic_years (id, name, start_date, end_date, status, school_id, created_at)
       VALUES (?, '2024-25', '2024-04-01', '2025-03-31', 'completed', ?, NOW()),
              (?, '2025-26', '2025-04-01', '2026-03-31', 'active', ?, NOW())`,
      [ay2024, schoolId, ay2025, schoolId]
    );
    console.log('✅ Academic years created: 2024-25 (completed), 2025-26 (active)');
    
    // 4. Create Subjects
    const subjects = [
      ['ENG', 'English', 'bg-blue-100 text-blue-800'],
      ['MATH', 'Mathematics', 'bg-green-100 text-green-800'],
      ['SCI', 'Science', 'bg-purple-100 text-purple-800'],
      ['PHY', 'Physics', 'bg-red-100 text-red-800'],
      ['CHEM', 'Chemistry', 'bg-yellow-100 text-yellow-800'],
      ['BIO', 'Biology', 'bg-pink-100 text-pink-800'],
      ['HIN', 'Hindi', 'bg-orange-100 text-orange-800'],
      ['SOC', 'Social Studies', 'bg-teal-100 text-teal-800'],
      ['COMP', 'Computer Science', 'bg-gray-100 text-gray-800'],
      ['PE', 'Physical Education', 'bg-indigo-100 text-indigo-800']
    ];
    
    const subjectIds = {};
    for (const [code, name, color] of subjects) {
      const subjectId = uuidv4();
      await connection.query(
        `INSERT INTO subjects (id, school_id, code, name, color, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [subjectId, schoolId, code, name, color]
      );
      subjectIds[code] = subjectId;
    }
    console.log(`✅ Created ${subjects.length} subjects`);
    
    // 5. Create Classes (Class 1-10, Sections A & B = 20 classes)
    const classes = [];
    const sections = ['A', 'B'];
    
    for (let classNum = 1; classNum <= 10; classNum++) {
      for (const section of sections) {
        const classId = uuidv4();
        await connection.query(
          `INSERT INTO classes (id, name, section, school_id, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [classId, `Class ${classNum}`, section, schoolId]
        );
        classes.push({ id: classId, name: `Class ${classNum}`, section, classNum });
      }
    }
    console.log(`✅ Created ${classes.length} classes (Class 1-10, Sections A & B)`);
    
    // 6. Create 30 Teachers
    const teachers = [];
    const teacherSubjects = [
      ['ENG', 'HIN'], ['MATH', 'COMP'], ['SCI', 'BIO'], ['PHY', 'CHEM'],
      ['SOC', 'ENG'], ['MATH', 'SCI'], ['ENG', 'COMP'], ['PE', 'SCI'],
      ['HIN', 'SOC'], ['MATH', 'PHY'], ['BIO', 'CHEM'], ['ENG', 'MATH'],
      ['SCI', 'COMP'], ['SOC', 'HIN'], ['MATH', 'ENG'], ['PHY', 'MATH'],
      ['BIO', 'SCI'], ['CHEM', 'PHY'], ['COMP', 'MATH'], ['PE', 'HIN'],
      ['ENG', 'SOC'], ['MATH', 'BIO'], ['SCI', 'PHY'], ['COMP', 'ENG'],
      ['HIN', 'MATH'], ['SOC', 'SCI'], ['ENG', 'PE'], ['MATH', 'CHEM'],
      ['BIO', 'PHY'], ['COMP', 'SCI']
    ];
    
    // Assign first 20 teachers as class teachers (one per class)
    for (let i = 0; i < 20; i++) {
      const classInfo = classes[i];
      const teacherId = uuidv4();
      const teacherName = generateTeacherName();
      const username = `cittaai_teacher_${classInfo.classNum}${classInfo.section.toLowerCase()}`;
      const subjects = teacherSubjects[i % teacherSubjects.length];
      
      await connection.query(
        `INSERT INTO teachers (id, username, password, name, email, phone, school_id, class_id, is_active, subjects, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, ?, NOW())`,
        [
          teacherId,
          username,
          hashedPassword,
          teacherName,
          generateEmail(teacherName),
          generatePhone(),
          schoolId,
          classInfo.id,
          JSON.stringify(subjects)
        ]
      );
      
      // Update class with teacher
      await connection.query(
        `UPDATE classes SET class_teacher_id = ? WHERE id = ?`,
        [teacherId, classInfo.id]
      );
      
      teachers.push({ id: teacherId, classId: classInfo.id, name: teacherName, username, subjects });
    }
    
    // Create 10 additional teachers (subject teachers, no class assignment)
    for (let i = 20; i < 30; i++) {
      const teacherId = uuidv4();
      const teacherName = generateTeacherName();
      const username = `cittaai_teacher_subj_${i - 19}`;
      const subjects = teacherSubjects[i % teacherSubjects.length];
      
      await connection.query(
        `INSERT INTO teachers (id, username, password, name, email, phone, school_id, class_id, is_active, subjects, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, true, ?, NOW())`,
        [
          teacherId,
          username,
          hashedPassword,
          teacherName,
          generateEmail(teacherName),
          generatePhone(),
          schoolId,
          JSON.stringify(subjects)
        ]
      );
      
      teachers.push({ id: teacherId, classId: null, name: teacherName, username, subjects });
    }
    
    console.log(`✅ Created ${teachers.length} teachers (20 class teachers + 10 subject teachers)`);
    
    // 7. Create Time Slots (8 periods per day with breaks and lunch)
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
    
    const timeSlotIds = [];
    for (const slot of timeSlots) {
      const slotId = uuidv4();
      await connection.query(
        `INSERT INTO time_slots (id, school_id, start_time, end_time, type, display_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [slotId, schoolId, slot.start, slot.end, slot.type, slot.order]
      );
      timeSlotIds.push({ id: slotId, ...slot });
    }
    console.log(`✅ Created ${timeSlots.length} time slots`);
    
    // 8. Create Weekly Timetables for all classes
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const classTimeSlots = timeSlotIds.filter(s => s.type === 'class'); // Only class periods (6 periods)
    
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
        }
      }
    }
    
    console.log(`✅ Created weekly timetables for all ${classes.length} classes (${timetableEntriesCount} entries)`);
    
    // 9. Create 500 Students (distributed across 20 classes = 25 per class)
    const studentsPerClass = 25;
    let studentCounter = 1;
    let admissionCounter = 1;
    
    for (let i = 0; i < classes.length; i++) {
      const classInfo = classes[i];
      
      for (let j = 0; j < studentsPerClass; j++) {
        const studentId = uuidv4();
        const studentName = generateName();
        const gender = genders[Math.floor(Math.random() * genders.length)];
        const parentName = generateParentName();
        const parentPhone = generatePhone();
        const admissionNumber = `CITTA-2025-${String(admissionCounter).padStart(4, '0')}`;
        const photoUrl = generatePhotoUrl(gender, studentCounter);
        const address = `${100 + studentCounter} AI Innovation Street, Bangalore - 560001`;
        const bloodGroup = bloodGroups[Math.floor(Math.random() * bloodGroups.length)];
        
        // Create submitted_data JSON
        const submittedData = {
          name: studentName,
          rollNo: String(j + 1),
          dateOfBirth: generateDOB(classInfo.classNum),
          gender: gender,
          bloodGroup: bloodGroup,
          address: address,
          photoUrl: photoUrl,
          fatherName: parentName,
          fatherPhone: parentPhone,
          fatherEmail: generateEmail(parentName),
          motherName: generateParentName(),
          motherPhone: generatePhone(),
          admissionNumber: admissionNumber
        };
        
        await connection.query(
          `INSERT INTO students (id, name, roll_no, class_id, school_id, parent_name, parent_phone, parent_email, address, date_of_birth, gender, blood_group, photo_url, status, admission_number, submitted_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, NOW())`,
          [
            studentId,
            studentName,
            String(j + 1),
            classInfo.id,
            schoolId,
            parentName,
            parentPhone,
            generateEmail(parentName),
            address,
            generateDOB(classInfo.classNum),
            gender,
            bloodGroup,
            photoUrl,
            admissionNumber,
            JSON.stringify(submittedData)
          ]
        );
        
        // Create enrollment for active academic year
        await connection.query(
          `INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [uuidv4(), studentId, ay2025, classInfo.id, String(j + 1), schoolId]
        );
        
        studentCounter++;
        admissionCounter++;
      }
    }
    
    console.log(`✅ Created ${studentCounter - 1} students (25 per class across 20 classes)`);
    
    await connection.commit();
    
    console.log('\n🎉 CittaAI school seeded successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🔐 ADMIN LOGIN:');
    console.log('   Email: admin@cittaai.edu');
    console.log('   Password: password\n');
    console.log('👨‍🏫 CLASS TEACHERS (20 teachers - one per class):');
    console.log('   Username: cittaai_teacher_1a, cittaai_teacher_1b, cittaai_teacher_2a, cittaai_teacher_2b, ... cittaai_teacher_10a, cittaai_teacher_10b');
    console.log('   Password: password\n');
    console.log('👨‍🏫 SUBJECT TEACHERS (10 teachers - no class assignment):');
    console.log('   Username: cittaai_teacher_subj_1, cittaai_teacher_subj_2, cittaai_teacher_subj_3, ... cittaai_teacher_subj_10');
    console.log('   Password: password\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 DATA SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`   ✅ Total Students: ${studentCounter - 1}`);
    console.log(`   ✅ Total Teachers: ${teachers.length} (20 class teachers + 10 subject teachers)`);
    console.log(`   ✅ Total Classes: ${classes.length} (Class 1-10, Sections A & B)`);
    console.log(`   ✅ Students per Class: ${studentsPerClass}`);
    console.log(`   ✅ Time Slots: ${timeSlots.length} (6 class periods + 1 break + 1 lunch)`);
    console.log(`   ✅ Timetable Entries: ${timetableEntriesCount} (${classes.length} classes × 5 days × ${classTimeSlots.length} periods)`);
    console.log(`   ✅ Academic Year: 2025-26 (active)`);
    console.log(`   ✅ School Code: ${schoolCode}\n`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✨ Ready to test the app!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Error seeding CittaAI school:', error);
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
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Authentication Error:');
      console.error('   - Check DB_USER and DB_PASSWORD in your .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Database Error:');
      console.error('   - Check DB_NAME in your .env file');
      console.error('   - Make sure the database exists');
    } else if (error.code === 'ER_DUP_ENTRY') {
      console.error('\n💡 Duplicate Entry Error:');
      console.error('   - CittaAI school may already exist');
      console.error('   - Check if school code CITTA001 is already in use');
    }
    
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
if (require.main === module) {
  seedCittaAISchool()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { seedCittaAISchool };

