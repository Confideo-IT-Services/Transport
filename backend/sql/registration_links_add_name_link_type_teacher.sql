-- ============================================================================
-- Migration: Add name, link_type, teacher_id to registration_links
-- Run this on your database before using the updated Generate Registration Link flow.
-- ============================================================================
-- Usage: mysql -u YOUR_USER -p YOUR_DATABASE < registration_links_add_name_link_type_teacher.sql
-- Or in MySQL client: source /path/to/registration_links_add_name_link_type_teacher.sql;
-- ============================================================================

-- 1) Add name (optional label for the link)
ALTER TABLE registration_links
  ADD COLUMN name VARCHAR(255) NULL AFTER school_id;

-- 2) Add link_type: 'class' | 'all_classes' | 'teacher' | 'others'
ALTER TABLE registration_links
  ADD COLUMN link_type VARCHAR(20) NOT NULL DEFAULT 'class' AFTER name;

-- 3) Add teacher_id (nullable, for link_type = 'teacher')
ALTER TABLE registration_links
  ADD COLUMN teacher_id VARCHAR(36) NULL AFTER link_type;

ALTER TABLE registration_links
  ADD CONSTRAINT fk_registration_links_teacher
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

-- 4) Allow class_id to be NULL (for link_type = 'teacher' or 'others')
ALTER TABLE registration_links
  MODIFY COLUMN class_id VARCHAR(36) NULL;
