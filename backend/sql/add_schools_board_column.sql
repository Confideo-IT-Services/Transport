-- Adds `schools.board` column if it doesn't exist yet.
-- Run this against your existing MySQL database.
--
-- Example:
--   mysql -h <host> -u <user> -p allpulse < backend/sql/add_schools_board_column.sql

USE schoolpulse;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = 'schoolpulse'
    AND table_name = 'schools'
    AND column_name = 'board'
);

SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE schools ADD COLUMN board VARCHAR(200) DEFAULT ''state_board'';',
  'SELECT ''board column already exists'' AS info;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

