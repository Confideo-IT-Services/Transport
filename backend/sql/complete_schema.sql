-- ============================================================================
-- AllPulse School Management System - Complete Database Schema
-- ============================================================================
-- This file contains ALL database tables for the AllPulse system.
-- All separate schema files and migrations have been consolidated here.
--
-- IMPORTANT: This schema matches EXACTLY what exists in your current database
-- including all migrations. Safe to use for migrating to other databases.
--
-- Usage:
--   mysql -h your-host -u your-user -p your-database < complete_schema.sql
--   OR
--   source /path/to/complete_schema.sql;
-- ============================================================================

-- Create database (if needed)
CREATE DATABASE IF NOT EXISTS allpulse;
USE allpulse;

-- ============================================================================
-- SECTION 1: CORE TABLES
-- Foundation tables that other tables depend on
-- ============================================================================

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

-- ============ USERS TABLE ============
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
    INDEX idx_school_id (school_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
);

-- ============================================================================
-- SECTION 2: ACADEMIC SETUP
-- ============================================================================

-- ============ ACADEMIC YEARS TABLE ============
CREATE TABLE IF NOT EXISTS academic_years (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('active', 'completed', 'upcoming') DEFAULT 'upcoming',
    school_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_academic_year_school (name, school_id),
    INDEX idx_school_id (school_id),
    INDEX idx_status (status),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

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

-- ============================================================================
-- SECTION 3: TEACHERS AND CLASSES
-- ============================================================================

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

-- Add foreign key for teachers.class_id (circular dependency handled)
ALTER TABLE teachers ADD FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 4: STUDENTS
-- ============================================================================

-- ============ STUDENTS TABLE ============
-- NOTE: admission_number has UNIQUE constraint from migration add_admission_number_column.sql
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
    extra_fields JSON DEFAULT '{}' COMMENT 'Additional fields for ID cards (blood_group, house, id_valid_upto, etc.)',
    admission_number VARCHAR(50) UNIQUE NULL COMMENT 'Auto-generated on approval',
    registration_code VARCHAR(50) COMMENT 'Link code used for registration',
    submitted_data JSON COMMENT 'Raw form data from registration',
    tc_status ENUM('none', 'applied', 'issued') DEFAULT 'none' COMMENT 'Transfer Certificate status: none, applied, or issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_class_id (class_id),
    INDEX idx_school_id (school_id),
    INDEX idx_status (status),
    INDEX idx_admission_number (admission_number),
    INDEX idx_tc_status (tc_status),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============ REGISTRATION LINKS TABLE ============
CREATE TABLE IF NOT EXISTS registration_links (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NULL COMMENT 'Optional label for the link',
    link_type VARCHAR(20) NOT NULL DEFAULT 'class' COMMENT 'Type: class, all_classes, teacher, others',
    teacher_id VARCHAR(36) NULL COMMENT 'For link_type = teacher',
    class_id VARCHAR(36) NULL COMMENT 'Nullable for link_type = teacher or others',
    link_code VARCHAR(50) NOT NULL UNIQUE,
    field_config JSON,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
);

-- ============ STUDENT ENROLLMENTS TABLE ============
CREATE TABLE IF NOT EXISTS student_enrollments (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    roll_no VARCHAR(20),
    school_id VARCHAR(36) NOT NULL,
    left_at TIMESTAMP NULL COMMENT 'When student left the school',
    tc_issued_at TIMESTAMP NULL COMMENT 'When TC was issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_student_year (student_id, academic_year_id),
    INDEX idx_student_id (student_id),
    INDEX idx_academic_year_id (academic_year_id),
    INDEX idx_class_id (class_id),
    INDEX idx_school_id (school_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);


-- ============================================================================
-- SECTION 5: TIMETABLE
-- ============================================================================

-- ============ TIME SLOTS TABLE ============
CREATE TABLE IF NOT EXISTS time_slots (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    type ENUM('class', 'break', 'lunch') NOT NULL DEFAULT 'class',
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_id (school_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============ TIMETABLE ENTRIES TABLE ============
CREATE TABLE IF NOT EXISTS timetable_entries (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    time_slot_id VARCHAR(36) NOT NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    subject_code VARCHAR(20) NOT NULL,
    subject_name VARCHAR(100) NOT NULL,
    teacher_id VARCHAR(36),
    teacher_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_entry (class_id, time_slot_id, day_of_week),
    INDEX idx_class_id (class_id),
    INDEX idx_school_id (school_id),
    INDEX idx_time_slot_id (time_slot_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
);

-- ============ HOLIDAYS TABLE ============
CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    name VARCHAR(200) NOT NULL,
    type ENUM('public', 'school', 'exam') NOT NULL DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_holiday (school_id, date, name),
    INDEX idx_school_id (school_id),
    INDEX idx_date (date),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============ TEACHER LEAVES TABLE ============
-- NOTE: status column added by migrations add_leave_status_column.sql and add_teacher_leaves_status.sql
-- Using idx_teacher_leaves_status index name from add_teacher_leaves_status.sql
CREATE TABLE IF NOT EXISTS teacher_leaves (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    teacher_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Leave approval status',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_id (school_id),
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_teacher_leaves_status (status),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 6: ATTENDANCE
-- ============================================================================

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

-- ============================================================================
-- SECTION 7: HOMEWORK
-- ============================================================================

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

-- ============ HOMEWORK SUBMISSIONS TABLE ============
CREATE TABLE IF NOT EXISTS homework_submissions (
    id VARCHAR(36) PRIMARY KEY,
    homework_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_homework_student (homework_id, student_id),
    INDEX idx_homework_id (homework_id),
    INDEX idx_student_id (student_id),
    FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 8: TESTS AND RESULTS
-- ============================================================================

-- ============ TESTS TABLE ============
CREATE TABLE IF NOT EXISTS tests (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    test_time VARCHAR(50),
    test_date DATE NULL,
    class_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    school_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36) NULL COMMENT 'Academic year for yearly percentage calculation',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_class_id (class_id),
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_school_id (school_id),
    INDEX idx_test_date (test_date),
    INDEX idx_academic_year_id (academic_year_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL
);

-- ============ TEST SUBJECTS TABLE ============
CREATE TABLE IF NOT EXISTS test_subjects (
    id VARCHAR(36) PRIMARY KEY,
    test_id VARCHAR(36) NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NULL COMMENT 'Teacher who submitted syllabus for test coordination',
    max_marks INT NOT NULL DEFAULT 100,
    syllabus TEXT,
    submitted_at TIMESTAMP NULL COMMENT 'When syllabus was submitted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_test_subject (test_id, subject_id),
    INDEX idx_test_id (test_id),
    INDEX idx_subject_id (subject_id),
    INDEX idx_teacher_id (teacher_id),
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
);

-- ============ TEST RESULTS TABLE ============
CREATE TABLE IF NOT EXISTS test_results (
    id VARCHAR(36) PRIMARY KEY,
    test_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    subject_id VARCHAR(36) NOT NULL,
    marks_obtained DECIMAL(5,2) NOT NULL DEFAULT 0,
    max_marks INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_test_student_subject (test_id, student_id, subject_id),
    INDEX idx_test_id (test_id),
    INDEX idx_student_id (student_id),
    INDEX idx_subject_id (subject_id),
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 9: FEES
-- NOTE: component and component_breakdown added by migration add_component_to_payments.sql
-- ============================================================================

-- ============ FEE CATEGORIES TABLE ============
CREATE TABLE IF NOT EXISTS fee_categories (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    frequency ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_school_id (school_id),
    INDEX idx_is_active (is_active)
);

-- ============ FEE STRUCTURE TABLE ============
CREATE TABLE IF NOT EXISTS fee_structure (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36),
    total_fee DECIMAL(10, 2) NOT NULL,
    tuition_fee DECIMAL(10, 2) DEFAULT 0,
    transport_fee DECIMAL(10, 2) DEFAULT 0,
    lab_fee DECIMAL(10, 2) DEFAULT 0,
    other_fees JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    UNIQUE KEY unique_class_year (class_id, academic_year_id),
    INDEX idx_school_id (school_id),
    INDEX idx_class_id (class_id),
    INDEX idx_academic_year_id (academic_year_id)
);

-- ============ STUDENT FEES TABLE ============
-- NOTE: component_breakdown added by migration add_component_to_payments.sql
CREATE TABLE IF NOT EXISTS student_fees (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    school_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36),
    total_fee DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    pending_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('paid', 'partial', 'unpaid') DEFAULT 'unpaid',
    due_date DATE,
    component_breakdown JSON NULL COMMENT 'JSON object tracking component-wise payments and pending amounts',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    INDEX idx_student_id (student_id),
    INDEX idx_class_id (class_id),
    INDEX idx_status (status),
    INDEX idx_school_id (school_id)
);

-- ============ FEE PAYMENTS TABLE ============
-- NOTE: component field added by migration add_component_to_payments.sql
CREATE TABLE IF NOT EXISTS fee_payments (
    id VARCHAR(36) PRIMARY KEY,
    student_fee_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash', 'cheque', 'online', 'bank_transfer') DEFAULT 'cash',
    transaction_id VARCHAR(100),
    receipt_number VARCHAR(50),
    component VARCHAR(50) NULL COMMENT 'Component name: tuition_fee, transport_fee, lab_fee, or other component name',
    remarks TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_student_fee_id (student_fee_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_receipt_number (receipt_number)
);

-- ============================================================================
-- SECTION 10: NOTIFICATIONS
-- ============================================================================

-- ============ NOTIFICATIONS TABLE ============
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    sender_id VARCHAR(36) NOT NULL,
    sender_role ENUM('admin', 'teacher') NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    attachment_url VARCHAR(500) NULL,
    attachment_name VARCHAR(255) NULL,
    attachment_type VARCHAR(50) NULL,
    target_type ENUM('all_classes', 'selected_classes', 'all_teachers', 'all_parents', 'specific_students') NOT NULL,
    target_classes JSON COMMENT 'Array of class IDs if target_type is selected_classes',
    target_students JSON COMMENT 'Array of student IDs if target_type is specific_students',
    priority ENUM('normal', 'urgent') DEFAULT 'normal',
    status ENUM('draft', 'sent', 'failed') DEFAULT 'sent',
    sent_count INT DEFAULT 0 COMMENT 'Number of recipients who received the notification',
    event_date DATE NULL COMMENT 'Event date for future reminders',
    scheduled_at DATETIME NULL COMMENT 'Scheduled sending time',
    whatsapp_enabled BOOLEAN DEFAULT FALSE COMMENT 'Flag for WhatsApp integration',
    created_by VARCHAR(36) NULL COMMENT 'Admin user who created the notification',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_id (school_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_target_type (target_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============ NOTIFICATION RECIPIENTS TABLE ============
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

-- ============ NOTIFICATION CLASSES TABLE ============
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
);

-- ============================================================================
-- SECTION 11: ID CARDS
-- ============================================================================

-- ============ ID CARD TEMPLATES TABLE ============
CREATE TABLE IF NOT EXISTS id_card_templates (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36),
    name VARCHAR(100) NOT NULL,
    template_data JSON NOT NULL,
    layout_json_url VARCHAR(500) COMMENT 'Optional S3 URL to the layout JSON (source of truth for generation)',
    background_image_url VARCHAR(500),
    card_width INT DEFAULT 54 COMMENT 'Card width in mm',
    card_height INT DEFAULT 86 COMMENT 'Card height in mm',
    orientation ENUM('portrait', 'landscape') DEFAULT 'portrait',
    sheet_size VARCHAR(50) DEFAULT 'A4' COMMENT 'Sheet size for printing (A4, 13x19, custom)',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 11: VISITOR MANAGEMENT
-- ============================================================================

-- ============ VISITOR REQUESTS TABLE ============
CREATE TABLE IF NOT EXISTS visitor_requests (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    visitor_name VARCHAR(100) NOT NULL,
    visitor_relation VARCHAR(100),
    visit_reason ENUM('enquiry', 'pickup', 'other') NOT NULL,
    other_reason TEXT,
    status ENUM('pending', 'teacher_accepted', 'admin_accepted', 'rejected', 'completed') DEFAULT 'pending',
    teacher_approval_status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    teacher_approval_at TIMESTAMP NULL,
    admin_approval_status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    admin_approval_at TIMESTAMP NULL,
    visit_date DATE,
    visit_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_id (school_id),
    INDEX idx_student_id (student_id),
    INDEX idx_class_id (class_id),
    INDEX idx_status (status),
    INDEX idx_parent_phone (parent_phone),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 12: INITIAL DATA
-- ============================================================================

-- ============ INSERT SUPER ADMIN ============
-- NOTE: Using UUID() as in original schema.sql, not a fixed UUID
INSERT INTO users (id, email, password, name, role, is_active, created_at) VALUES
(UUID(), 'saianushayerrajennugari@gmail.com', 'Super1@user', 'Platform Admin', 'superadmin', TRUE, NOW())
ON DUPLICATE KEY UPDATE name = 'Platform Admin';

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================