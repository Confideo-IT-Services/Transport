# ID Card System Migration Guide

## For Existing Databases

If you already have the `students` table and need to add the new columns, run these SQL commands:

```sql
-- Add missing columns to students table
ALTER TABLE students 
ADD COLUMN admission_number VARCHAR(50) COMMENT 'Auto-generated on approval' AFTER extra_fields,
ADD COLUMN registration_code VARCHAR(50) COMMENT 'Link code used for registration' AFTER admission_number,
ADD COLUMN submitted_data JSON COMMENT 'Raw form data from registration' AFTER registration_code;

-- Add index for performance
CREATE INDEX idx_admission_number ON students(admission_number);
```

## For Fresh Installations

Simply run the complete schema file:

```bash
mysql -u your_user -p your_database < backend/sql/schema.sql
```

## Verification

Check if all columns exist:

```sql
DESCRIBE students;
DESCRIBE id_card_templates;
```

Expected columns in `students`:
- `extra_fields` (JSON)
- `admission_number` (VARCHAR)
- `registration_code` (VARCHAR)
- `submitted_data` (JSON)

Expected columns in `id_card_templates`:
- `template_data` (JSON)
- `layout_json_url` (VARCHAR)
- `background_image_url` (VARCHAR)
- `card_width`, `card_height`, `orientation`, `sheet_size`

## Notes

- The backend code includes fallback logic for missing columns, so the system won't crash if columns are missing
- However, adding them explicitly prevents auto-migration overhead on every request
- All new columns are nullable/have defaults, so existing data won't be affected


