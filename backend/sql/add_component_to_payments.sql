-- Add component field to fee_payments table
ALTER TABLE fee_payments 
ADD COLUMN component VARCHAR(50) NULL COMMENT 'Component name: tuition_fee, transport_fee, lab_fee, or other component name';

-- Add component_breakdown to student_fees table
ALTER TABLE student_fees 
ADD COLUMN component_breakdown JSON NULL COMMENT 'JSON object tracking component-wise payments and pending amounts';

