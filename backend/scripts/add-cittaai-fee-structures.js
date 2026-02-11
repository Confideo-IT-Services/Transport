// backend/scripts/add-cittaai-fee-structures.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// Use same database config as backend
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'allpulse',
};

async function addCittaAIFeeStructures() {
  console.log('🔌 Connecting to database...');
  console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log(`   User: ${dbConfig.user}\n`);
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    await connection.beginTransaction();
    
    console.log('🌱 Adding fee structures for CittaAI school...\n');
    
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
    
    // 2. Get active academic year
    const [activeYear] = await connection.query(
      `SELECT id, name FROM academic_years WHERE school_id = ? AND status = 'active' LIMIT 1`,
      [schoolId]
    );
    
    if (activeYear.length === 0) {
      await connection.rollback();
      connection.end();
      console.log('❌ No active academic year found!');
      console.log('   Please ensure an active academic year exists for CittaAI school.\n');
      process.exit(1);
    }
    
    const academicYearId = activeYear[0].id;
    const academicYearName = activeYear[0].name;
    console.log(`✅ Found active academic year: ${academicYearName} (ID: ${academicYearId.substring(0, 8)}...)\n`);
    
    // 3. Get all classes for this school
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
    console.log(`✅ Found ${classes.length} classes\n`);
    
    // 4. Fee structure based on class level (same for all sections of the same class)
    const getFeeStructureForClass = (classNum) => {
      const baseTuition = 2000 + (classNum * 500); // Class 1: 2500, Class 10: 7000
      const baseTransport = 1000; // Same for all classes
      const baseLab = classNum >= 6 ? 500 : 0; // Lab fee only for upper classes (6-10)
      const baseLibrary = 200; // Library fee for all
      const baseSports = 300; // Sports fee for all
      const baseComputer = classNum >= 3 ? 400 : 0; // Computer fee from Class 3 onwards
      
      const tuitionFee = baseTuition;
      const transportFee = baseTransport;
      const labFee = baseLab;
      
      const otherFees = {
        components: [
          { name: 'Library Fee', amount: baseLibrary },
          { name: 'Sports Fee', amount: baseSports }
        ],
        _metadata: {
          frequency: 'yearly'
        }
      };
      
      if (baseComputer > 0) {
        otherFees.components.push({ name: 'Computer Fee', amount: baseComputer });
      }
      
      const otherFeesTotal = baseLibrary + baseSports + baseComputer;
      const totalFee = tuitionFee + transportFee + labFee + otherFeesTotal;
      
      return {
        tuitionFee,
        transportFee,
        labFee,
        otherFees,
        totalFee
      };
    };
    
    // 5. Group classes by class number (ignoring section)
    const classesByNumber = {};
    for (const classInfo of classes) {
      if (!classesByNumber[classInfo.classNum]) {
        classesByNumber[classInfo.classNum] = [];
      }
      classesByNumber[classInfo.classNum].push(classInfo);
    }
    
    console.log(`📊 Fee Structure Plan:\n`);
    for (const classNum in classesByNumber) {
      const fees = getFeeStructureForClass(parseInt(classNum));
      const sections = classesByNumber[classNum];
      console.log(`   Class ${classNum}: ₹${fees.totalFee.toLocaleString('en-IN')} (${sections.length} section${sections.length > 1 ? 's' : ''})`);
      console.log(`      - Tuition: ₹${fees.tuitionFee.toLocaleString('en-IN')}`);
      console.log(`      - Transport: ₹${fees.transportFee.toLocaleString('en-IN')}`);
      if (fees.labFee > 0) {
        console.log(`      - Lab: ₹${fees.labFee.toLocaleString('en-IN')}`);
      }
      console.log(`      - Other Fees: ₹${(fees.totalFee - fees.tuitionFee - fees.transportFee - fees.labFee).toLocaleString('en-IN')}`);
      console.log('');
    }
    
    // 6. Check for existing fee structures
    const [existingFeeStructures] = await connection.query(
      `SELECT COUNT(*) as count FROM fee_structure WHERE school_id = ?`,
      [schoolId]
    );
    
    if (existingFeeStructures[0].count > 0) {
      console.log(`⚠️  Found ${existingFeeStructures[0].count} existing fee structures.`);
      console.log('   Deleting existing structures to recreate...\n');
      await connection.query(
        `DELETE FROM fee_structure WHERE school_id = ?`,
        [schoolId]
      );
    }
    
    // 7. Create fee structure for each class (applies to all sections)
    console.log('💰 Creating fee structures...\n');
    let feeStructuresCount = 0;
    let updatedCount = 0;
    
    for (const classNum in classesByNumber) {
      const classSections = classesByNumber[classNum];
      const fees = getFeeStructureForClass(parseInt(classNum));
      
      // Create fee structure for each section of this class (same fees for all sections)
      for (const classInfo of classSections) {
        // Check if fee structure already exists for this class section and academic year
        const [existing] = await connection.query(
          `SELECT id FROM fee_structure WHERE class_id = ? AND academic_year_id = ? AND school_id = ?`,
          [classInfo.id, academicYearId, schoolId]
        );
        
        if (existing.length === 0) {
          const structureId = uuidv4();
          await connection.query(
            `INSERT INTO fee_structure (id, school_id, class_id, academic_year_id, total_fee, tuition_fee, transport_fee, lab_fee, other_fees, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              structureId,
              schoolId,
              classInfo.id,
              academicYearId,
              fees.totalFee,
              fees.tuitionFee,
              fees.transportFee,
              fees.labFee,
              JSON.stringify(fees.otherFees)
            ]
          );
          feeStructuresCount++;
        } else {
          // Update existing structure
          await connection.query(
            `UPDATE fee_structure SET total_fee = ?, tuition_fee = ?, transport_fee = ?, lab_fee = ?, other_fees = ?, updated_at = NOW() WHERE id = ?`,
            [
              fees.totalFee,
              fees.tuitionFee,
              fees.transportFee,
              fees.labFee,
              JSON.stringify(fees.otherFees),
              existing[0].id
            ]
          );
          updatedCount++;
        }
      }
      
      console.log(`   ✅ Class ${classNum} (${classSections.length} section${classSections.length > 1 ? 's' : ''}): ₹${fees.totalFee.toLocaleString('en-IN')}`);
    }
    
    await connection.commit();
    
    console.log('\n🎉 Fee structures added successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`   ✅ School: ${school.name} (${school.code})`);
    console.log(`   ✅ Academic Year: ${academicYearName}`);
    console.log(`   ✅ Total Classes: ${Object.keys(classesByNumber).length} (${classes.length} sections)`);
    console.log(`   ✅ Fee Structures Created: ${feeStructuresCount}`);
    if (updatedCount > 0) {
      console.log(`   ✅ Fee Structures Updated: ${updatedCount}`);
    }
    console.log(`   ✅ Total Entries: ${feeStructuresCount + updatedCount}\n`);
    console.log('📋 Fee Breakdown by Class:\n');
    
    for (const classNum in classesByNumber) {
      const fees = getFeeStructureForClass(parseInt(classNum));
      const sections = classesByNumber[classNum];
      console.log(`   Class ${classNum}:`);
      console.log(`      Total: ₹${fees.totalFee.toLocaleString('en-IN')} per student`);
      console.log(`      - Tuition Fee: ₹${fees.tuitionFee.toLocaleString('en-IN')}`);
      console.log(`      - Transport Fee: ₹${fees.transportFee.toLocaleString('en-IN')}`);
      if (fees.labFee > 0) {
        console.log(`      - Lab Fee: ₹${fees.labFee.toLocaleString('en-IN')}`);
      }
      const otherFeesTotal = fees.totalFee - fees.tuitionFee - fees.transportFee - fees.labFee;
      if (otherFeesTotal > 0) {
        console.log(`      - Other Fees: ₹${otherFeesTotal.toLocaleString('en-IN')} (Library, Sports${fees.otherFees.components.length > 2 ? ', Computer' : ''})`);
      }
      console.log(`      Applied to: ${sections.length} section${sections.length > 1 ? 's' : ''} (${sections.map(s => s.section || 'No Section').join(', ')})`);
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✨ Fee structures are ready to use!\n');
    
  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Error adding fee structures:', error);
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
    }
    
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
if (require.main === module) {
  addCittaAIFeeStructures()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { addCittaAIFeeStructures };



