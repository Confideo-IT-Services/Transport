-- Add status column to teacher_leaves table if it doesn't exist
-- This script adds the status column for leave approval workflow

-- Check if status column exists, if not add it
ALTER TABLE teacher_leaves 
ADD COLUMN IF NOT EXISTS status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER reason;

-- Add index for status for better query performance
CREATE INDEX IF NOT EXISTS idx_leave_status ON teacher_leaves(status);
