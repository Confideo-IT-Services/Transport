# Security Implementation Checklist

Use this checklist to ensure all security measures are properly implemented.

## ✅ Database Setup

- [ ] Run complete schema: `mysql -h host -u user -p allpulse < backend/sql/complete_schema.sql`
- [ ] Apply security constraints: `mysql -h host -u user -p allpulse < backend/sql/add-security-constraints.sql`
- [ ] Verify audit_logs table exists: `SHOW TABLES LIKE 'audit_logs';`
- [ ] Verify constraints exist: `SELECT * FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME LIKE 'chk_%';`

## ✅ Code Review

- [ ] All routes use `authenticateToken` middleware
- [ ] All queries include `school_id` filter
- [ ] No direct `school_id` updates allowed
- [ ] Client-provided `school_id` is never trusted (use `req.user.schoolId`)

## ✅ New Routes

- [ ] Use `SecureQueryBuilder` for new routes (recommended)
- [ ] Or manually ensure `school_id` is always in WHERE clause
- [ ] Add audit logging for critical operations
- [ ] Test with different school contexts

## ✅ Testing

- [ ] Run security audit: `node backend/scripts/audit-data-isolation.js`
- [ ] Verify no orphaned records (school_id = NULL)
- [ ] Verify no invalid school_id references
- [ ] Test cross-school access (should fail)
- [ ] Verify audit logs are being created

## ✅ Monitoring

- [ ] Set up regular security audits (cron job recommended)
- [ ] Review audit logs weekly
- [ ] Monitor for suspicious patterns
- [ ] Check for high query volumes per user

## ✅ Documentation

- [ ] Team members have read `SECURITY_GUIDE.md`
- [ ] Example routes reviewed: `backend/routes/example-secure-route.js`
- [ ] Security best practices documented

## Quick Commands

```bash
# Run security audit
node backend/scripts/audit-data-isolation.js

# Check audit logs
mysql -h host -u user -p allpulse -e "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;"

# Check for orphaned records
mysql -h host -u user -p allpulse -e "SELECT COUNT(*) FROM students WHERE school_id IS NULL;"

# Verify constraints
mysql -h host -u user -p allpulse -e "SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME LIKE 'chk_%';"
```

## Notes

- Security is an ongoing process, not a one-time setup
- Regular audits are essential
- When in doubt, use SecureQueryBuilder
- Always log critical operations










