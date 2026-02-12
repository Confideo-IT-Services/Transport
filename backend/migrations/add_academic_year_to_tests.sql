-- Migration: Add academic_year_id to tests table
-- Date: 2024
-- Description: Adds academic year linkage to tests for yearly percentage calculation
-- This migration is safe for production as it adds a nullable column first

-- Step 1: Add academic_year_id column (nullable first for safe migration)
ALTER TABLE tests 
ADD COLUMN academic_year_id VARCHAR(36) NULL 
AFTER school_id;

-- Step 2: Add foreign key constraint
ALTER TABLE tests 
ADD CONSTRAINT fk_tests_academic_year 
FOREIGN KEY (academic_year_id) 
REFERENCES academic_years(id) 
ON DELETE SET NULL;

-- Step 3: Add index for performance
CREATE INDEX idx_tests_academic_year_id ON tests(academic_year_id);

-- Note: After running backfill script, make column NOT NULL:
-- ALTER TABLE tests MODIFY COLUMN academic_year_id VARCHAR(36) NOT NULL;




