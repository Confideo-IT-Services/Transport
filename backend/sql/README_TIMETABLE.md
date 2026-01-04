# Timetable Database Schema

## Setup Instructions

To enable timetable functionality, you need to run the timetable schema SQL file:

```bash
mysql -h your-rds-endpoint.amazonaws.com -u admin -p allpulse < sql/timetable_schema.sql
```

Or run it directly in MySQL:

```sql
source /path/to/backend/sql/timetable_schema.sql;
```

## Tables Created

1. **time_slots** - Stores time slot configurations (start time, end time, type)
2. **timetable_entries** - Stores timetable entries (class, day, time slot, subject, teacher)
3. **holidays** - Stores school holidays
4. **teacher_leaves** - Stores teacher leave records

All tables are linked to `school_id` for multi-tenant support.


