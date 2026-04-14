-- ============================================================================
-- AllPulse School Management System - Complete Database Schema (PostgreSQL)
-- ============================================================================
-- Converted from backend/sql/complete_schema.sql (MySQL) to PostgreSQL.
--
-- Usage (psql):
--   psql "host=... port=5432 dbname=... user=... sslmode=require" -f complete_schema.postgres.sql
--
-- Notes:
-- - MySQL ENUM columns are implemented as TEXT + CHECK constraints for portability.
-- - MySQL "ON UPDATE CURRENT_TIMESTAMP" is implemented via updated_at triggers.
-- - MySQL inline INDEX / UNIQUE KEY are implemented via CREATE INDEX / UNIQUE constraints.
-- - Column COMMENT clauses are implemented via COMMENT ON COLUMN.
-- ============================================================================

BEGIN;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper trigger to emulate MySQL ON UPDATE CURRENT_TIMESTAMP
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 1: CORE TABLES
-- ============================================================================

-- ============ SCHOOLS TABLE ============
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  code varchar(20) NOT NULL UNIQUE,
  type varchar(50) DEFAULT 'K-12',
  board varchar(200) DEFAULT 'state_board',
  location varchar(100),
  address text,
  phone varchar(20),
  email varchar(255) NOT NULL,
  logo_url varchar(500),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT schools_status_chk CHECK (status IN ('active', 'pending', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);

CREATE TRIGGER trg_schools_set_updated_at
BEFORE UPDATE ON schools
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ USERS TABLE ============
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password varchar(255) NOT NULL,
  name varchar(100) NOT NULL,
  role text NOT NULL,
  school_id uuid NULL REFERENCES schools(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_chk CHECK (role IN ('superadmin', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECTION 2: ACADEMIC SETUP
-- ============================================================================

-- ============ ACADEMIC YEARS TABLE ============
CREATE TABLE IF NOT EXISTS academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(20) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT academic_years_status_chk CHECK (status IN ('active', 'completed', 'upcoming')),
  CONSTRAINT unique_academic_year_school UNIQUE (name, school_id)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_school_id ON academic_years(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_status ON academic_years(status);

CREATE TRIGGER trg_academic_years_set_updated_at
BEFORE UPDATE ON academic_years
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ SUBJECTS TABLE ============
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code varchar(20) NOT NULL,
  name varchar(100) NOT NULL,
  color varchar(100) NOT NULL DEFAULT 'bg-gray-100 text-gray-700 border-gray-200',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_subject_school UNIQUE (code, school_id)
);

CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);

CREATE TRIGGER trg_subjects_set_updated_at
BEFORE UPDATE ON subjects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECTION 3: TEACHERS AND CLASSES
-- ============================================================================

-- ============ TEACHERS TABLE ============
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(50) NOT NULL,
  password varchar(255) NOT NULL,
  name varchar(100) NOT NULL,
  email varchar(255),
  phone varchar(20),
  subjects jsonb,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_username_school UNIQUE (username, school_id)
);

CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);

CREATE TRIGGER trg_teachers_set_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ CLASSES TABLE ============
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  section varchar(10),
  class_teacher_id uuid NULL REFERENCES teachers(id) ON DELETE SET NULL,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_class_school UNIQUE (name, section, school_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);

CREATE TRIGGER trg_classes_set_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Add foreign key for teachers.class_id (circular dependency handled)
ALTER TABLE teachers
  ADD CONSTRAINT teachers_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 4: STUDENTS
-- ============================================================================

-- ============ STUDENTS TABLE ============
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  roll_no varchar(20),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_name varchar(100),
  parent_phone varchar(20),
  parent_email varchar(255),
  address text,
  date_of_birth date,
  gender text,
  blood_group varchar(5),
  photo_url varchar(500),
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  extra_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  admission_number varchar(50) UNIQUE NULL,
  registration_code varchar(50),
  submitted_data jsonb,
  tc_status text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT students_gender_chk CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
  CONSTRAINT students_status_chk CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT students_tc_status_chk CHECK (tc_status IN ('none', 'applied', 'issued'))
);

COMMENT ON COLUMN students.extra_fields IS 'Additional fields for ID cards (blood_group, house, id_valid_upto, etc.)';
COMMENT ON COLUMN students.admission_number IS 'Auto-generated on approval';
COMMENT ON COLUMN students.registration_code IS 'Link code used for registration';
COMMENT ON COLUMN students.submitted_data IS 'Raw form data from registration';
COMMENT ON COLUMN students.tc_status IS 'Transfer Certificate status: none, applied, or issued';

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_tc_status ON students(tc_status);

CREATE TRIGGER trg_students_set_updated_at
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ REGISTRATION LINKS TABLE ============
CREATE TABLE IF NOT EXISTS registration_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name varchar(255) NULL,
  link_type varchar(20) NOT NULL DEFAULT 'class',
  teacher_id uuid NULL REFERENCES teachers(id) ON DELETE SET NULL,
  class_id uuid NULL REFERENCES classes(id) ON DELETE CASCADE,
  link_code varchar(50) NOT NULL UNIQUE,
  field_config jsonb,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN registration_links.name IS 'Optional label for the link';
COMMENT ON COLUMN registration_links.link_type IS 'Type: class, all_classes, teacher, others';
COMMENT ON COLUMN registration_links.teacher_id IS 'For link_type = teacher';
COMMENT ON COLUMN registration_links.class_id IS 'Nullable for link_type = teacher or others';

-- ============ STUDENT ENROLLMENTS TABLE ============
CREATE TABLE IF NOT EXISTS student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  roll_no varchar(20),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  left_at timestamptz NULL,
  tc_issued_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_student_year UNIQUE (student_id, academic_year_id)
);

COMMENT ON COLUMN student_enrollments.left_at IS 'When student left the school';
COMMENT ON COLUMN student_enrollments.tc_issued_at IS 'When TC was issued';

CREATE INDEX IF NOT EXISTS idx_student_enrollments_student_id ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_academic_year_id ON student_enrollments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_class_id ON student_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_school_id ON student_enrollments(school_id);

-- ============================================================================
-- SECTION 5: TIMETABLE
-- ============================================================================

-- ============ TIME SLOTS TABLE ============
CREATE TABLE IF NOT EXISTS time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  type text NOT NULL DEFAULT 'class',
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT time_slots_type_chk CHECK (type IN ('class', 'break', 'lunch'))
);

CREATE INDEX IF NOT EXISTS idx_time_slots_school_id ON time_slots(school_id);

CREATE TRIGGER trg_time_slots_set_updated_at
BEFORE UPDATE ON time_slots
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ TIMETABLE ENTRIES TABLE ============
CREATE TABLE IF NOT EXISTS timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  time_slot_id uuid NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  day_of_week text NOT NULL,
  subject_code varchar(20) NOT NULL,
  subject_name varchar(100) NOT NULL,
  teacher_id uuid NULL REFERENCES teachers(id) ON DELETE SET NULL,
  teacher_name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT timetable_entries_day_chk CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  CONSTRAINT unique_entry UNIQUE (class_id, time_slot_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_timetable_entries_class_id ON timetable_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_school_id ON timetable_entries(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_time_slot_id ON timetable_entries(time_slot_id);

CREATE TRIGGER trg_timetable_entries_set_updated_at
BEFORE UPDATE ON timetable_entries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ HOLIDAYS TABLE ============
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date date NOT NULL,
  name varchar(200) NOT NULL,
  type text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT holidays_type_chk CHECK (type IN ('public','school','exam')),
  CONSTRAINT unique_holiday UNIQUE (school_id, date, name)
);

CREATE INDEX IF NOT EXISTS idx_holidays_school_id ON holidays(school_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

CREATE TRIGGER trg_holidays_set_updated_at
BEFORE UPDATE ON holidays
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ TEACHER LEAVES TABLE ============
CREATE TABLE IF NOT EXISTS teacher_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  teacher_name varchar(100) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_leaves_status_chk CHECK (status IN ('pending','approved','rejected'))
);

COMMENT ON COLUMN teacher_leaves.status IS 'Leave approval status';

CREATE INDEX IF NOT EXISTS idx_teacher_leaves_school_id ON teacher_leaves(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_leaves_teacher_id ON teacher_leaves(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_leaves_dates ON teacher_leaves(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_teacher_leaves_status ON teacher_leaves(status);

CREATE TRIGGER trg_teacher_leaves_set_updated_at
BEFORE UPDATE ON teacher_leaves
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECTION 6: ATTENDANCE
-- ============================================================================

-- ============ ATTENDANCE TABLE ============
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL,
  marked_by uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_status_chk CHECK (status IN ('present','absent','late','leave')),
  CONSTRAINT unique_attendance UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);

-- ============ TEACHER ATTENDANCE TABLE ============
CREATE TABLE IF NOT EXISTS teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'not-marked',
  check_in_time time,
  check_out_time time,
  remarks text,
  marked_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_attendance_status_chk CHECK (status IN ('present','absent','late','leave','not-marked')),
  CONSTRAINT unique_teacher_attendance UNIQUE (teacher_id, date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON teacher_attendance(date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher_date ON teacher_attendance(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school_date ON teacher_attendance(school_id, date);

CREATE TRIGGER trg_teacher_attendance_set_updated_at
BEFORE UPDATE ON teacher_attendance
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECTION 7: HOMEWORK
-- ============================================================================

-- ============ HOMEWORK TABLE ============
CREATE TABLE IF NOT EXISTS homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL,
  description text,
  subject varchar(50),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  due_date date,
  attachment_url varchar(500),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT homework_status_chk CHECK (status IN ('active','completed'))
);

CREATE INDEX IF NOT EXISTS idx_homework_class_id ON homework(class_id);
CREATE INDEX IF NOT EXISTS idx_homework_teacher_id ON homework(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON homework(due_date);

CREATE TRIGGER trg_homework_set_updated_at
BEFORE UPDATE ON homework
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ HOMEWORK SUBMISSIONS TABLE ============
CREATE TABLE IF NOT EXISTS homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT FALSE,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_homework_student UNIQUE (homework_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework_id ON homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student_id ON homework_submissions(student_id);

CREATE TRIGGER trg_homework_submissions_set_updated_at
BEFORE UPDATE ON homework_submissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECTION 8: TESTS AND RESULTS
-- ============================================================================

-- ============ TESTS TABLE ============
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  test_time varchar(50),
  test_date date NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NULL REFERENCES academic_years(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN tests.academic_year_id IS 'Academic year for yearly percentage calculation';

CREATE INDEX IF NOT EXISTS idx_tests_class_id ON tests(class_id);
CREATE INDEX IF NOT EXISTS idx_tests_teacher_id ON tests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tests_school_id ON tests(school_id);
CREATE INDEX IF NOT EXISTS idx_tests_test_date ON tests(test_date);
CREATE INDEX IF NOT EXISTS idx_tests_academic_year_id ON tests(academic_year_id);

CREATE TRIGGER trg_tests_set_updated_at
BEFORE UPDATE ON tests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ TEST SUBJECTS TABLE ============
CREATE TABLE IF NOT EXISTS test_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid NULL REFERENCES teachers(id) ON DELETE SET NULL,
  max_marks int NOT NULL DEFAULT 100,
  syllabus text,
  submitted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_test_subject UNIQUE (test_id, subject_id)
);

COMMENT ON COLUMN test_subjects.teacher_id IS 'Teacher who submitted syllabus for test coordination';
COMMENT ON COLUMN test_subjects.submitted_at IS 'When syllabus was submitted';

CREATE INDEX IF NOT EXISTS idx_test_subjects_test_id ON test_subjects(test_id);
CREATE INDEX IF NOT EXISTS idx_test_subjects_subject_id ON test_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_test_subjects_teacher_id ON test_subjects(teacher_id);

-- ============ TEST RESULTS TABLE ============
CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  marks_obtained numeric(5,2) NOT NULL DEFAULT 0,
  max_marks int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_test_student_subject UNIQUE (test_id, student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_test_results_subject_id ON test_results(subject_id);

CREATE TRIGGER trg_test_results_set_updated_at
BEFORE UPDATE ON test_results
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECTION 9: FEES
-- ============================================================================

-- ============ FEE CATEGORIES TABLE ============
CREATE TABLE IF NOT EXISTS fee_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  amount numeric(10,2) NOT NULL,
  frequency text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fee_categories_frequency_chk CHECK (frequency IN ('monthly','quarterly','yearly'))
);

CREATE INDEX IF NOT EXISTS idx_fee_categories_school_id ON fee_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_categories_is_active ON fee_categories(is_active);

CREATE TRIGGER trg_fee_categories_set_updated_at
BEFORE UPDATE ON fee_categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ FEE STRUCTURE TABLE ============
CREATE TABLE IF NOT EXISTS fee_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id uuid NULL REFERENCES academic_years(id) ON DELETE SET NULL,
  total_fee numeric(10,2) NOT NULL,
  tuition_fee numeric(10,2) NOT NULL DEFAULT 0,
  transport_fee numeric(10,2) NOT NULL DEFAULT 0,
  lab_fee numeric(10,2) NOT NULL DEFAULT 0,
  other_fees jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_class_year UNIQUE (class_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_fee_structure_school_id ON fee_structure(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_structure_class_id ON fee_structure(class_id);
CREATE INDEX IF NOT EXISTS idx_fee_structure_academic_year_id ON fee_structure(academic_year_id);

CREATE TRIGGER trg_fee_structure_set_updated_at
BEFORE UPDATE ON fee_structure
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ STUDENT FEES TABLE ============
CREATE TABLE IF NOT EXISTS student_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid NULL REFERENCES academic_years(id) ON DELETE SET NULL,
  total_fee numeric(10,2) NOT NULL,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  pending_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'unpaid',
  due_date date,
  component_breakdown jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT student_fees_status_chk CHECK (status IN ('paid','partial','unpaid'))
);

COMMENT ON COLUMN student_fees.component_breakdown IS 'JSON object tracking component-wise payments and pending amounts';

CREATE INDEX IF NOT EXISTS idx_student_fees_student_id ON student_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_class_id ON student_fees(class_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_status ON student_fees(status);
CREATE INDEX IF NOT EXISTS idx_student_fees_school_id ON student_fees(school_id);

CREATE TRIGGER trg_student_fees_set_updated_at
BEFORE UPDATE ON student_fees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ FEE PAYMENTS TABLE ============
CREATE TABLE IF NOT EXISTS fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id uuid NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_date date NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  transaction_id varchar(100),
  receipt_number varchar(50),
  component varchar(50) NULL,
  remarks text,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fee_payments_method_chk CHECK (payment_method IN ('cash','cheque','online','bank_transfer'))
);

COMMENT ON COLUMN fee_payments.component IS 'Component name: tuition_fee, transport_fee, lab_fee, or other component name';

CREATE INDEX IF NOT EXISTS idx_fee_payments_student_fee_id ON fee_payments(student_fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_payment_date ON fee_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_fee_payments_receipt_number ON fee_payments(receipt_number);

-- ============================================================================
-- SECTION 10: NOTIFICATIONS
-- ============================================================================

-- ============ NOTIFICATIONS TABLE ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  title varchar(200) NOT NULL,
  message text NOT NULL,
  attachment_url varchar(500) NULL,
  attachment_name varchar(255) NULL,
  attachment_type varchar(50) NULL,
  target_type text NOT NULL,
  target_classes jsonb,
  target_students jsonb,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'sent',
  sent_count int NOT NULL DEFAULT 0,
  event_date date NULL,
  scheduled_at timestamptz NULL,
  whatsapp_enabled boolean NOT NULL DEFAULT FALSE,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_sender_role_chk CHECK (sender_role IN ('admin','teacher')),
  CONSTRAINT notifications_target_type_chk CHECK (target_type IN ('all_classes','selected_classes','all_teachers','all_parents','specific_students')),
  CONSTRAINT notifications_priority_chk CHECK (priority IN ('normal','urgent')),
  CONSTRAINT notifications_status_chk CHECK (status IN ('draft','sent','failed'))
);

COMMENT ON COLUMN notifications.target_classes IS 'Array of class IDs if target_type is selected_classes';
COMMENT ON COLUMN notifications.target_students IS 'Array of student IDs if target_type is specific_students';
COMMENT ON COLUMN notifications.sent_count IS 'Number of recipients who received the notification';
COMMENT ON COLUMN notifications.event_date IS 'Event date for future reminders';
COMMENT ON COLUMN notifications.scheduled_at IS 'Scheduled sending time';
COMMENT ON COLUMN notifications.whatsapp_enabled IS 'Flag for WhatsApp integration';
COMMENT ON COLUMN notifications.created_by IS 'Admin user who created the notification';

CREATE INDEX IF NOT EXISTS idx_notifications_school_id ON notifications(school_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_type ON notifications(target_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE TRIGGER trg_notifications_set_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============ NOTIFICATION RECIPIENTS TABLE ============
CREATE TABLE IF NOT EXISTS notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_type text NOT NULL,
  recipient_id uuid NOT NULL,
  student_id uuid NULL,
  is_read boolean NOT NULL DEFAULT FALSE,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_recipients_type_chk CHECK (recipient_type IN ('teacher','parent'))
);

COMMENT ON COLUMN notification_recipients.recipient_id IS 'teacher_id or student_id (for parent)';
COMMENT ON COLUMN notification_recipients.student_id IS 'If recipient_type is parent, this is the student_id';

CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id ON notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_recipient ON notification_recipients(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_is_read ON notification_recipients(is_read);

-- ============ NOTIFICATION CLASSES TABLE ============
CREATE TABLE IF NOT EXISTS notification_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_notification_class UNIQUE (notification_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_classes_notification_id ON notification_classes(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_classes_class_id ON notification_classes(class_id);

-- ============================================================================
-- SECTION 11: ID CARDS
-- ============================================================================

-- ============ ID CARD TEMPLATES TABLE ============
CREATE TABLE IF NOT EXISTS id_card_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NULL REFERENCES schools(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  template_data jsonb NOT NULL,
  layout_json_url varchar(500),
  background_image_url varchar(500),
  card_width int NOT NULL DEFAULT 54,
  card_height int NOT NULL DEFAULT 86,
  orientation text NOT NULL DEFAULT 'portrait',
  sheet_size varchar(50) NOT NULL DEFAULT 'A4',
  is_default boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT id_card_templates_orientation_chk CHECK (orientation IN ('portrait','landscape'))
);

COMMENT ON COLUMN id_card_templates.layout_json_url IS 'Optional S3 URL to the layout JSON (source of truth for generation)';
COMMENT ON COLUMN id_card_templates.card_width IS 'Card width in mm';
COMMENT ON COLUMN id_card_templates.card_height IS 'Card height in mm';
COMMENT ON COLUMN id_card_templates.sheet_size IS 'Sheet size for printing (A4, 13x19, custom)';

CREATE TRIGGER trg_id_card_templates_set_updated_at
BEFORE UPDATE ON id_card_templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECTION 11: VISITOR MANAGEMENT
-- ============================================================================

-- ============ VISITOR REQUESTS TABLE ============
CREATE TABLE IF NOT EXISTS visitor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  parent_phone varchar(20) NOT NULL,
  visitor_name varchar(100) NOT NULL,
  visitor_relation varchar(100),
  visit_reason text NOT NULL,
  other_reason text,
  status text NOT NULL DEFAULT 'pending',
  teacher_approval_status text NOT NULL DEFAULT 'pending',
  teacher_approval_at timestamptz NULL,
  admin_approval_status text NOT NULL DEFAULT 'pending',
  admin_approval_at timestamptz NULL,
  visit_date date,
  visit_time time,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT visitor_requests_reason_chk CHECK (visit_reason IN ('enquiry','pickup','other')),
  CONSTRAINT visitor_requests_status_chk CHECK (status IN ('pending','teacher_accepted','admin_accepted','rejected','completed')),
  CONSTRAINT visitor_requests_teacher_approval_chk CHECK (teacher_approval_status IN ('pending','accepted','rejected')),
  CONSTRAINT visitor_requests_admin_approval_chk CHECK (admin_approval_status IN ('pending','accepted','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_visitor_requests_school_id ON visitor_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_student_id ON visitor_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_class_id ON visitor_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_status ON visitor_requests(status);
CREATE INDEX IF NOT EXISTS idx_visitor_requests_parent_phone ON visitor_requests(parent_phone);

CREATE TRIGGER trg_visitor_requests_set_updated_at
BEFORE UPDATE ON visitor_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECTION 12: INITIAL DATA
-- ============================================================================

-- Insert/update Super Admin (NOTE: password here is plaintext; replace with bcrypt hash in real deployments)
INSERT INTO users (email, password, name, role, is_active, created_at, updated_at)
VALUES ('saianushayerrajennugari@gmail.com', 'Super1@user', 'Platform Admin', 'superadmin', TRUE, NOW(), NOW())
ON CONFLICT (email)
DO UPDATE SET name = EXCLUDED.name;

COMMIT;

