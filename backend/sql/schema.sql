-- AllPulse Database Schema
-- Run this in your MySQL database to create all required tables

-- Create database
CREATE DATABASE IF NOT EXISTS allpulse;
USE allpulse;

-- ============ USERS TABLE ============
-- Stores super admins and school admins
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('superadmin', 'admin') NOT NULL,
    school_id VARCHAR(36) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_school_id (school_id)
);

-- ============ SCHOOLS TABLE ============
CREATE TABLE IF NOT EXISTS schools (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    type VARCHAR(50) DEFAULT 'K-12',
    location VARCHAR(100),
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    status ENUM('active', 'pending', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_status (status)
);

-- Add foreign key for users.school_id
ALTER TABLE users ADD FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

-- ============ TEACHERS TABLE ============
CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    subjects JSON,
    school_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_username_school (username, school_id),
    INDEX idx_school_id (school_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============ CLASSES TABLE ============
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    section VARCHAR(10),
    class_teacher_id VARCHAR(36),
    school_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_class_school (name, section, school_id),
    INDEX idx_school_id (school_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
);

-- Add foreign key for teachers.class_id
ALTER TABLE teachers ADD FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- ============ STUDENTS TABLE ============
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    roll_no VARCHAR(20),
    class_id VARCHAR(36) NOT NULL,
    school_id VARCHAR(36) NOT NULL,
    parent_name VARCHAR(100),
    parent_phone VARCHAR(20),
    parent_email VARCHAR(255),
    address TEXT,
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    blood_group VARCHAR(5),
    photo_url VARCHAR(500),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_class_id (class_id),
    INDEX idx_school_id (school_id),
    INDEX idx_status (status),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============ HOMEWORK TABLE ============
CREATE TABLE IF NOT EXISTS homework (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    subject VARCHAR(50),
    class_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    school_id VARCHAR(36) NOT NULL,
    due_date DATE,
    attachment_url VARCHAR(500),
    status ENUM('active', 'completed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_class_id (class_id),
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_due_date (due_date),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============ ATTENDANCE TABLE ============
CREATE TABLE IF NOT EXISTS attendance (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'late', 'leave') NOT NULL,
    marked_by VARCHAR(36) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (student_id, date),
    INDEX idx_date (date),
    INDEX idx_class_date (class_id, date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES teachers(id) ON DELETE CASCADE
);

-- ============ TEACHER ATTENDANCE TABLE ============
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

-- ============ ID CARD TEMPLATES TABLE ============
CREATE TABLE IF NOT EXISTS id_card_templates (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36),
    name VARCHAR(100) NOT NULL,
    template_data JSON NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============ REGISTRATION LINKS TABLE ============
CREATE TABLE IF NOT EXISTS registration_links (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    link_code VARCHAR(50) NOT NULL UNIQUE,
    field_config JSON,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- ============ INSERT SUPER ADMIN ============
-- Password: SuperAdmin@123 (hashed with bcrypt)
INSERT INTO users (id, email, password, name, role, is_active, created_at) VALUES
(UUID(), 'saianushayerrajennugari@gmail.com', 'Super1@user', 'Platform Admin', 'superadmin', TRUE, NOW())
ON DUPLICATE KEY UPDATE name = 'Platform Admin';

-- ============ SAMPLE DATA (OPTIONAL) ============
-- Uncomment below to add sample school and admin

-- INSERT INTO schools (id, name, code, type, location, email, status) VALUES
-- ('school-1', 'Delhi Public School', 'SCH-DPS001', 'K-12', 'New Delhi', 'admin@dps.edu', 'active');

-- INSERT INTO users (id, email, password, name, role, school_id, is_active) VALUES
-- (UUID(), 'admin@dps.edu', '$2a$10$rQvVJrPEODuGF.OHxqnlhO6Xs.Y8B1G6jqK7Xv/bYs5P0QbZXWrHi', 'DPS Admin', 'admin', 'school-1', TRUE);
