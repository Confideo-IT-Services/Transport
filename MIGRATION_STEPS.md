# Migration Steps for Student Promotion Feature

This document provides step-by-step instructions to run the database migration for the new student promotion feature.

## What This Migration Does

This migration adds a new column `tc_status` to the `students` table to track Transfer Certificate (TC) status. This allows the system to:
- Track which students have applied for or received TC
- Exclude TC students from automatic promotion to next class
- Maintain historical data for students who left the school

## Prerequisites

- Access to your MySQL database
- Database credentials (from your `.env` file)
- MySQL client installed or access to a database management tool

## Migration Steps

### Option 1: Using MySQL Command Line

1. **Open your terminal/command prompt**

2. **Navigate to your project directory**
   ```bash
   cd C:\Users\Admin\ConventPulse
   ```

3. **Connect to your MySQL database**
   ```bash
   mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME>
   ```
   
   Replace:
   - `<DB_HOST>` with your database host (from `.env` file, e.g., `localhost` or AWS RDS endpoint)
   - `<DB_USER>` with your database username (from `.env` file)
   - `<DB_NAME>` with your database name (from `.env` file, likely `allpulse`)

   Example:
   ```bash
   mysql -h localhost -u root -p allpulse
   ```

4. **Enter your database password when prompted**

5. **Run the migration SQL file**
   ```sql
   source backend/migrations/add_tc_status_migration.sql
   ```
   
   Or copy and paste the SQL commands directly:
   ```sql
   ALTER TABLE students 
   ADD COLUMN tc_status ENUM('none', 'applied', 'issued') DEFAULT 'none' 
   COMMENT 'Transfer Certificate status: none, applied, or issued';
   
   ALTER TABLE students 
   ADD INDEX idx_tc_status (tc_status);
   ```

6. **Verify the migration**
   ```sql
   DESCRIBE students;
   ```
   
   You should see the `tc_status` column in the output.

7. **Exit MySQL**
   ```sql
   exit;
   ```

### Option 2: Using MySQL Workbench / phpMyAdmin / Other GUI Tools

1. **Open your database management tool** (MySQL Workbench, phpMyAdmin, DBeaver, etc.)

2. **Connect to your database** using your credentials

3. **Select your database** (e.g., `allpulse`)

4. **Open the SQL file** `backend/migrations/add_tc_status_migration.sql`

5. **Execute the SQL commands** (usually by clicking "Execute" or pressing F5)

6. **Verify the migration** by checking the `students` table structure - you should see the new `tc_status` column

### Option 3: Using Node.js Script (Alternative)

If you prefer to run the migration programmatically, you can use the test connection script:

1. **Create a temporary migration script** (or modify `test-db-connection.js`):

   ```javascript
   require('dotenv').config();
   const mysql = require('mysql2/promise');
   const fs = require('fs');
   const path = require('path');

   async function runMigration() {
     const connection = await mysql.createConnection({
       host: process.env.DB_HOST || 'localhost',
       port: process.env.DB_PORT || 3306,
       user: process.env.DB_USER || 'root',
       password: process.env.DB_PASSWORD || '',
       database: process.env.DB_NAME || 'allpulse',
     });

     try {
       console.log('Running migration: Add TC Status Column...');
       
       // Read migration file
       const migrationSQL = fs.readFileSync(
         path.join(__dirname, 'migrations', 'add_tc_status_migration.sql'),
         'utf8'
       );
       
       // Split by semicolons and execute each statement
       const statements = migrationSQL
         .split(';')
         .map(s => s.trim())
         .filter(s => s && !s.startsWith('--') && !s.startsWith('='));
       
       for (const statement of statements) {
         if (statement) {
           await connection.query(statement);
           console.log('✅ Executed:', statement.substring(0, 50) + '...');
         }
       }
       
       console.log('✅ Migration completed successfully!');
     } catch (error) {
       if (error.message.includes('Duplicate column name')) {
         console.log('⚠️  Column tc_status already exists. Migration may have already been run.');
       } else {
         console.error('❌ Migration failed:', error.message);
         throw error;
      }
     } finally {
       await connection.end();
     }
   }

   runMigration();
   ```

2. **Run the script**:
   ```bash
   node backend/migrations/run-migration.js
   ```

## Verification

After running the migration, verify it was successful:

```sql
-- Check if column exists
SHOW COLUMNS FROM students LIKE 'tc_status';

-- Check if index exists
SHOW INDEX FROM students WHERE Key_name = 'idx_tc_status';

-- Check current values (should all be 'none' for existing students)
SELECT tc_status, COUNT(*) as count FROM students GROUP BY tc_status;
```

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove the index first
ALTER TABLE students DROP INDEX idx_tc_status;

-- Remove the column
ALTER TABLE students DROP COLUMN tc_status;
```

## Troubleshooting

### Error: "Duplicate column name 'tc_status'"
- **Solution**: The migration has already been run. You can safely ignore this error or skip the migration.

### Error: "Access denied"
- **Solution**: Check your database credentials in the `.env` file and ensure your user has ALTER TABLE permissions.

### Error: "Table 'students' doesn't exist"
- **Solution**: Make sure you're connected to the correct database and that the students table exists.

### Error: "Unknown database"
- **Solution**: Verify your `DB_NAME` in the `.env` file matches your actual database name.

## Next Steps

After successful migration:

1. ✅ Restart your backend server (if running)
2. ✅ Test the TC status feature in the Student Management UI
3. ✅ Test the student promotion feature when creating a new academic year
4. ✅ Update TC status for any students who have applied for or received TC

## Support

If you encounter any issues during migration, check:
- Database connection settings in `.env`
- MySQL user permissions
- Database logs for detailed error messages

