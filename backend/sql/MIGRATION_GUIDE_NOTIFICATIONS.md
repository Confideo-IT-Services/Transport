# Notifications System Upgrade - Migration Guide

This guide explains how to migrate your database to support the new notifications features:
- `event_date` - Event date for future reminders
- `scheduled_at` - Scheduled sending time
- `whatsapp_enabled` - Flag for WhatsApp integration
- `created_by` - Admin user who created the notification
- `notification_classes` - Relational mapping table for selected classes

## ⚠️ Important Notes

1. **Backward Compatible**: The code is designed to work even if columns don't exist yet
2. **Run Migration First**: For best results, run the migration before deploying new code
3. **Backup First**: Always backup your database before running migrations

## 📋 Migration Options

### Option 1: Automated Script (Recommended)

**Easiest and safest method:**

```bash
cd backend
node scripts/migrate-notifications-upgrade.js
```

This script:
- ✅ Checks if columns/tables exist before creating
- ✅ Handles errors gracefully
- ✅ Provides clear progress feedback
- ✅ Safe to run multiple times

### Option 2: Direct SQL (Manual)

**For direct database access:**

1. Open your MySQL client (phpMyAdmin, MySQL Workbench, or command line)
2. Select your database
3. Run the SQL from `backend/sql/migrate_notifications_upgrade.sql`

**Quick SQL (copy-paste):**

```sql
-- Add new columns
ALTER TABLE notifications 
ADD COLUMN event_date DATE NULL,
ADD COLUMN scheduled_at DATETIME NULL,
ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN created_by VARCHAR(36) NULL;

-- Add foreign key
ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create mapping table
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
```

### Option 3: PhpMyAdmin / MySQL Workbench

1. Open your database management tool
2. Navigate to SQL tab
3. Copy and paste the SQL from Option 2
4. Execute the statements one by one
5. Verify each step

## ✅ Verification

After running the migration, verify with these queries:

```sql
-- Check if new columns exist
DESCRIBE notifications;

-- Check if notification_classes table exists
SHOW TABLES LIKE 'notification_classes';

-- Check table structure
DESCRIBE notification_classes;
```

Expected output:
- `notifications` table should have: `event_date`, `scheduled_at`, `whatsapp_enabled`, `created_by`
- `notification_classes` table should exist with proper structure

## 🔄 Rollback (If Needed)

If you need to rollback, run these in reverse order:

```sql
DROP TABLE IF EXISTS notification_classes;
ALTER TABLE notifications DROP FOREIGN KEY fk_notifications_created_by;
ALTER TABLE notifications DROP COLUMN created_by;
ALTER TABLE notifications DROP COLUMN whatsapp_enabled;
ALTER TABLE notifications DROP COLUMN scheduled_at;
ALTER TABLE notifications DROP COLUMN event_date;
```

## 🚀 Deployment Steps

1. **Backup Database** (Always!)
   ```bash
   mysqldump -u username -p database_name > backup_before_migration.sql
   ```

2. **Run Migration**
   - Option 1: `node backend/scripts/migrate-notifications-upgrade.js`
   - Option 2: Run SQL manually

3. **Deploy Code**
   - Deploy backend changes
   - Deploy frontend changes

4. **Test**
   - Send a notification with new fields
   - Verify data is stored correctly
   - Check notification_classes table is populated

## 📝 Troubleshooting

### Error: Column already exists
- **Solution**: This is fine! The column was already added. Continue with next steps.

### Error: Table already exists
- **Solution**: This is fine! The table was already created. Migration is complete.

### Error: Foreign key constraint fails
- **Solution**: Check that `users` table exists and has `id` column. Verify database connection.

### Error: Cannot add foreign key
- **Solution**: Ensure `users.id` column exists and is the correct type (VARCHAR(36))

## 🎯 What Gets Migrated

### New Columns in `notifications` table:
- `event_date` - DATE, NULL, for event reminders
- `scheduled_at` - DATETIME, NULL, for scheduled sending
- `whatsapp_enabled` - BOOLEAN, DEFAULT FALSE
- `created_by` - VARCHAR(36), NULL, FK to users.id

### New Table: `notification_classes`
- Maps notifications to classes (replaces JSON storage)
- Relational integrity with CASCADE delete
- Unique constraint prevents duplicates

## 📞 Support

If you encounter issues:
1. Check the error message carefully
2. Verify database credentials in `.env`
3. Ensure you have ALTER TABLE permissions
4. Check MySQL version (8.0+ recommended)

---

**Migration Status**: ✅ Ready to deploy
**Backward Compatible**: ✅ Yes
**Requires Downtime**: ❌ No


