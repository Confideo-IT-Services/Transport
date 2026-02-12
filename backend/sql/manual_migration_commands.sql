-- ============================================================================
-- Manual Migration Commands for Notifications Upgrade
-- ============================================================================
-- Run these commands manually in your MySQL client (phpMyAdmin, MySQL Workbench, or command line)
-- 
-- IMPORTANT: 
-- 1. Backup your database first!
-- 2. Run these commands one by one
-- 3. Check for errors after each command
-- ============================================================================

-- Step 1: Add event_date column
ALTER TABLE notifications 
ADD COLUMN event_date DATE NULL COMMENT 'Event date for future reminders';

-- Step 2: Add scheduled_at column
ALTER TABLE notifications 
ADD COLUMN scheduled_at DATETIME NULL COMMENT 'Scheduled sending time';

-- Step 3: Add whatsapp_enabled column
ALTER TABLE notifications 
ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT FALSE COMMENT 'Flag for WhatsApp integration';

-- Step 4: Add created_by column
ALTER TABLE notifications 
ADD COLUMN created_by VARCHAR(36) NULL COMMENT 'Admin user who created the notification';

-- Step 5: Add foreign key constraint for created_by
ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Step 6: Create notification_classes mapping table
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
-- Verification Queries (Run after migration)
-- ============================================================================

-- Check if new columns exist
DESCRIBE notifications;

-- Check if notification_classes table exists
SHOW TABLES LIKE 'notification_classes';

-- Check notification_classes table structure
DESCRIBE notification_classes;

-- ============================================================================
-- Rollback Commands (If needed - run in reverse order)
-- ============================================================================

-- DROP TABLE IF EXISTS notification_classes;
-- ALTER TABLE notifications DROP FOREIGN KEY fk_notifications_created_by;
-- ALTER TABLE notifications DROP COLUMN created_by;
-- ALTER TABLE notifications DROP COLUMN whatsapp_enabled;
-- ALTER TABLE notifications DROP COLUMN scheduled_at;
-- ALTER TABLE notifications DROP COLUMN event_date;


