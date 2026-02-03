-- ============================================================================
-- Migration: Add school_settings table for WhatsApp integration configuration
-- ============================================================================
-- This table stores per-school WhatsApp integration settings
-- Allows schools to enable/disable WhatsApp for specific features
-- ============================================================================

CREATE TABLE IF NOT EXISTS school_settings (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL UNIQUE,
    whatsapp_enabled BOOLEAN DEFAULT FALSE COMMENT 'Master toggle for WhatsApp integration',
    whatsapp_features JSON DEFAULT NULL COMMENT 'Per-feature WhatsApp enable/disable: {"homework": true, "attendance": false, "fees": true, "notifications": true, "reports": false, "timetable": false}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_id (school_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Insert default settings for existing schools (all disabled by default)
INSERT INTO school_settings (id, school_id, whatsapp_enabled, whatsapp_features)
SELECT 
    UUID() as id,
    id as school_id,
    FALSE as whatsapp_enabled,
    JSON_OBJECT(
        'homework', FALSE,
        'attendance', FALSE,
        'fees', FALSE,
        'notifications', FALSE,
        'reports', FALSE,
        'timetable', FALSE
    ) as whatsapp_features
FROM schools
WHERE id NOT IN (SELECT school_id FROM school_settings)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

