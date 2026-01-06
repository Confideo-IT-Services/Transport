-- Create teacher_attendance table if it doesn't exist
CREATE TABLE IF NOT EXISTS teacher_attendance (
    id VARCHAR(36) PRIMARY KEY,
    teacher_id VARCHAR(36) NOT NULL,
    school_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'late', 'leave', 'not-marked') DEFAULT 'not-marked',
    check_in_time TIME,
    check_out_time TIME,
    remarks TEXT,
    marked_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_teacher_attendance (teacher_id, date),
    INDEX idx_date (date),
    INDEX idx_teacher_date (teacher_id, date),
    INDEX idx_school_date (school_id, date),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
);




