-- ============ ADD ADMISSION NUMBER COLUMN TO STUDENTS TABLE ============
-- This migration adds an admission_number column to store unique admission numbers
-- for approved students

ALTER TABLE students 
ADD COLUMN admission_number VARCHAR(50) UNIQUE NULL;

-- Add index for faster lookups
CREATE INDEX idx_admission_number ON students(admission_number);


