-- Subjects table for timetable
-- Run this after the main schema.sql

USE allpulse;

-- ============ SUBJECTS TABLE ============
CREATE TABLE IF NOT EXISTS subjects (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(100) NOT NULL DEFAULT 'bg-gray-100 text-gray-700 border-gray-200',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_subject_school (code, school_id),
    INDEX idx_school_id (school_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);







