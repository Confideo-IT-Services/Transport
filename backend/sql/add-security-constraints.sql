-- ============================================================================
-- Security Constraints for Multi-Tenant Data Isolation
-- ============================================================================
-- This script adds security constraints to ensure data isolation between schools
-- Run this after the main schema is created
-- ============================================================================

USE allpulse;

-- ============================================================================
-- 1. ADD CHECK CONSTRAINTS (MySQL 8.0.16+)
-- ============================================================================

-- Ensure school_id is never NULL for critical tables
ALTER TABLE students 
ADD CONSTRAINT chk_students_school_id 
CHECK (school_id IS NOT NULL);

ALTER TABLE teachers 
ADD CONSTRAINT chk_teachers_school_id 
CHECK (school_id IS NOT NULL);

ALTER TABLE classes 
ADD CONSTRAINT chk_classes_school_id 
CHECK (school_id IS NOT NULL);

ALTER TABLE academic_years 
ADD CONSTRAINT chk_academic_years_school_id 
CHECK (school_id IS NOT NULL);

ALTER TABLE subjects 
ADD CONSTRAINT chk_subjects_school_id 
CHECK (school_id IS NOT NULL);

-- ============================================================================
-- 2. ADD COMPOSITE INDEXES FOR PERFORMANCE + SECURITY
-- ============================================================================

-- These indexes ensure fast lookups with school_id filtering
CREATE INDEX IF NOT EXISTS idx_students_school_status 
ON students(school_id, status);

CREATE INDEX IF NOT EXISTS idx_students_school_class 
ON students(school_id, class_id);

CREATE INDEX IF NOT EXISTS idx_teachers_school_active 
ON teachers(school_id, is_active);

CREATE INDEX IF NOT EXISTS idx_classes_school_active 
ON classes(school_id, is_active);

CREATE INDEX IF NOT EXISTS idx_attendance_school_date 
ON attendance(school_id, date);

CREATE INDEX IF NOT EXISTS idx_student_fees_school_status 
ON student_fees(school_id, status);

-- ============================================================================
-- 3. ADD TRIGGERS FOR AUDIT LOGGING (Optional - if you want automatic logging)
-- ============================================================================

-- Note: Triggers can impact performance. Consider using application-level logging instead.

-- Example trigger for students table (commented out - use audit-logger.js instead)
/*
DELIMITER $$

CREATE TRIGGER audit_students_insert
AFTER INSERT ON students
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (
    id, school_id, action, table_name, record_id, new_values, created_at
  ) VALUES (
    UUID(),
    NEW.school_id,
    'INSERT',
    'students',
    NEW.id,
    JSON_OBJECT(
      'name', NEW.name,
      'status', NEW.status,
      'class_id', NEW.class_id
    ),
    NOW()
  );
END$$

CREATE TRIGGER audit_students_update
AFTER UPDATE ON students
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (
    id, school_id, action, table_name, record_id, old_values, new_values, created_at
  ) VALUES (
    UUID(),
    NEW.school_id,
    'UPDATE',
    'students',
    NEW.id,
    JSON_OBJECT(
      'name', OLD.name,
      'status', OLD.status,
      'class_id', OLD.class_id
    ),
    JSON_OBJECT(
      'name', NEW.name,
      'status', NEW.status,
      'class_id', NEW.class_id
    ),
    NOW()
  );
END$$

DELIMITER ;
*/

-- ============================================================================
-- 4. CREATE VIEWS FOR SECURE DATA ACCESS (Optional)
-- ============================================================================

-- Views can provide an additional layer of security
-- Example: Create a view that automatically filters by school_id
-- (This would require dynamic views per school, which is complex)

-- ============================================================================
-- 5. VERIFY CONSTRAINTS
-- ============================================================================

-- Check that constraints were created
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'allpulse'
  AND CONSTRAINT_NAME LIKE 'chk_%'
ORDER BY TABLE_NAME;

-- Check indexes
SHOW INDEXES FROM students WHERE Column_name = 'school_id';
SHOW INDEXES FROM teachers WHERE Column_name = 'school_id';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT '✅ Security constraints added successfully!' as status;





