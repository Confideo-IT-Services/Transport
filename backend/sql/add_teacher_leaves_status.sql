-- Add status column to teacher_leaves table if it doesn't exist
-- This migration adds approval workflow support

-- Check and add status column
ALTER TABLE teacher_leaves 
ADD COLUMN IF NOT EXISTS status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending';

-- Add index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_teacher_leaves_status ON teacher_leaves(status);

-- Update existing leaves without status to 'approved' (assuming they were manually added before)
UPDATE teacher_leaves SET status = 'approved' WHERE status IS NULL OR status = '';

