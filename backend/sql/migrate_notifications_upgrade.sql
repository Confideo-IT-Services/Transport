-- ============================================================================
-- Migration: Upgrade Notifications System
-- ============================================================================
-- Adds: event_date, scheduled_at, whatsapp_enabled, created_by
-- Creates: notification_classes mapping table
-- 
-- IMPORTANT: Run this migration BEFORE deploying the new code
-- ============================================================================

-- ============================================================================
-- OPTION 1: Safe Migration (Recommended for Production)
-- ============================================================================
-- This approach checks if columns exist before adding them
-- Works with MySQL 8.0+ or MariaDB 10.2+

-- Step 1: Add new columns to notifications table (with existence check)
-- Note: MySQL doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we'll use a stored procedure approach or manual check

-- For MySQL 8.0+ or MariaDB 10.2+, you can use:
ALTER TABLE notifications 
ADD COLUMN event_date DATE NULL COMMENT 'Event date for future reminders',
ADD COLUMN scheduled_at DATETIME NULL COMMENT 'Scheduled sending time',
ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT FALSE COMMENT 'Flag for WhatsApp integration',
ADD COLUMN created_by VARCHAR(36) NULL COMMENT 'Admin user who created the notification';

-- Add foreign key for created_by
ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Step 2: Create notification_classes mapping table
CREATE TABLE IF NOT EXISTS notification_classes (
    id VARCHAR(36) PRIMARY KEY,
    notification_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notification_id (notification_id),
    INDEX idx_class_id (class_id),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_notification_class (notification_id, class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- OPTION 2: Manual Check Approach (For older MySQL versions)
-- ============================================================================
-- If your MySQL version doesn't support the above, use this approach:

-- 1. First, check if columns exist manually:
--    SELECT COLUMN_NAME 
--    FROM INFORMATION_SCHEMA.COLUMNS 
--    WHERE TABLE_SCHEMA = 'your_database_name' 
--    AND TABLE_NAME = 'notifications' 
--    AND COLUMN_NAME IN ('event_date', 'scheduled_at', 'whatsapp_enabled', 'created_by');

-- 2. If columns don't exist, run:
--    ALTER TABLE notifications ADD COLUMN event_date DATE NULL;
--    ALTER TABLE notifications ADD COLUMN scheduled_at DATETIME NULL;
--    ALTER TABLE notifications ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT FALSE;
--    ALTER TABLE notifications ADD COLUMN created_by VARCHAR(36) NULL;
--    ALTER TABLE notifications ADD CONSTRAINT fk_notifications_created_by 
--        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Check if notification_classes table exists:
--    SHOW TABLES LIKE 'notification_classes';

-- 4. If table doesn't exist, run the CREATE TABLE statement from Option 1

-- ============================================================================
-- OPTION 3: Using a Migration Script (Node.js)
-- ============================================================================
-- Create a file: backend/scripts/migrate-notifications-upgrade.js
-- See below for the script content

-- ============================================================================
-- OPTION 4: PhpMyAdmin / MySQL Workbench
-- ============================================================================
-- 1. Open your database in PhpMyAdmin or MySQL Workbench
-- 2. Run the SQL statements from Option 1 one by one
-- 3. Verify each step before proceeding

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- After running the migration, verify with these queries:

-- Check if new columns exist:
-- DESCRIBE notifications;

-- Check if notification_classes table exists:
-- SHOW TABLES LIKE 'notification_classes';

-- Check table structure:
-- DESCRIBE notification_classes;

-- ============================================================================
-- ROLLBACK (If needed)
-- ============================================================================
-- If you need to rollback, run these in reverse order:

-- DROP TABLE IF EXISTS notification_classes;
-- ALTER TABLE notifications DROP FOREIGN KEY fk_notifications_created_by;
-- ALTER TABLE notifications DROP COLUMN created_by;
-- ALTER TABLE notifications DROP COLUMN whatsapp_enabled;
-- ALTER TABLE notifications DROP COLUMN scheduled_at;
-- ALTER TABLE notifications DROP COLUMN event_date;


