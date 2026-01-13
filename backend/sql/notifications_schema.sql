-- ============ NOTIFICATIONS TABLE ============
-- Stores notifications sent by admins to teachers and parents
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    sender_id VARCHAR(36) NOT NULL,
    sender_role ENUM('admin', 'teacher') NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    target_type ENUM('all_classes', 'selected_classes', 'all_teachers', 'all_parents', 'specific_students') NOT NULL,
    target_classes JSON COMMENT 'Array of class IDs if target_type is selected_classes',
    target_students JSON COMMENT 'Array of student IDs if target_type is specific_students',
    priority ENUM('normal', 'urgent') DEFAULT 'normal',
    status ENUM('draft', 'sent', 'failed') DEFAULT 'sent',
    sent_count INT DEFAULT 0 COMMENT 'Number of recipients who received the notification',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_id (school_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_target_type (target_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============ NOTIFICATION RECIPIENTS TABLE ============
-- Tracks which users received which notifications
CREATE TABLE IF NOT EXISTS notification_recipients (
    id VARCHAR(36) PRIMARY KEY,
    notification_id VARCHAR(36) NOT NULL,
    recipient_type ENUM('teacher', 'parent') NOT NULL,
    recipient_id VARCHAR(36) NOT NULL COMMENT 'teacher_id or student_id (for parent)',
    student_id VARCHAR(36) NULL COMMENT 'If recipient_type is parent, this is the student_id',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notification_id (notification_id),
    INDEX idx_recipient (recipient_type, recipient_id),
    INDEX idx_is_read (is_read),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

