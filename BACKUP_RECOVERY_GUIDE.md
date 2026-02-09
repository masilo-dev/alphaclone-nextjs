# BACKUP & DISASTER RECOVERY STRATEGY

**Last Updated:** February 9, 2026
**Recovery Time Objective (RTO):** < 1 hour
**Recovery Point Objective (RPO):** < 15 minutes

---

## 📋 OVERVIEW

This document outlines the complete backup and disaster recovery strategy for AlphaClone Business OS. The platform uses Supabase (PostgreSQL) for all data storage, deployed on Vercel for the application layer.

---

## 🔄 AUTOMATED BACKUP STRATEGY

### Supabase Point-in-Time Recovery (PITR)

**Enabled For:** Production database only

**Features:**
- ✅ Continuous backup of WAL (Write-Ahead Log)
- ✅ Restore to any point in time within retention period
- ✅ 7-day retention (configurable up to 30 days)
- ✅ Zero data loss within retention window
- ✅ ~15-minute granularity for recovery

**Cost:** $100/month (part of Supabase Pro plan)

**How to Enable:**
1. Go to Supabase Dashboard → Settings → Database
2. Click "Point-in-Time Recovery"
3. Enable PITR
4. Set retention period (7-30 days)
5. Confirm configuration

---

### Daily Full Backups

**Schedule:** Daily at 3:00 AM UTC (off-peak hours)

**What's Backed Up:**
- ✅ Full database dump (all tables, indexes, functions)
- ✅ User data (profiles, authentication)
- ✅ Business data (tenants, projects, contracts, invoices)
- ✅ Audit logs
- ✅ File metadata (actual files stored in Supabase Storage)

**Retention Policy:**
- Last 7 daily backups
- Last 4 weekly backups (Sunday)
- Last 12 monthly backups (1st of month)
- Total retention: ~1 year

**Storage Location:**
- Primary: Supabase internal backups
- Secondary: External S3-compatible storage (optional)

---

## 🗄️ BACKUP TYPES

### 1. Supabase Automatic Backups

**Frequency:** Continuous (PITR) + Daily snapshots
**Retention:** 7-30 days
**Recovery Time:** 5-15 minutes
**Cost:** Included in Pro plan

**Pros:**
- ✅ Automatic and reliable
- ✅ Fast recovery
- ✅ Point-in-time restore
- ✅ Managed by Supabase

**Cons:**
- ⚠️ Limited to retention window
- ⚠️ Vendor lock-in

### 2. Manual Database Exports

**Frequency:** Weekly (manual trigger)
**Format:** SQL dump (pg_dump)
**Storage:** Local + Cloud backup
**Cost:** Free

**How to Execute:**

```bash
# Using Supabase CLI
supabase db dump --project-ref your-project-ref -f backup.sql

# Or using pg_dump directly
pg_dump "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" > backup.sql

# Compress for storage
gzip backup.sql
```

**Storage Locations:**
1. Local development machine (encrypted)
2. GitHub private repository (encrypted, Git LFS)
3. AWS S3 / Google Cloud Storage
4. Encrypted external drive (offline backup)

### 3. Table-Level Exports

**Use Case:** Backup critical tables only (faster, smaller)

**Critical Tables:**
- `tenants` - Organization data
- `profiles` - User accounts
- `contracts` - Legal agreements
- `stripe_payments` - Financial records
- `signature_certificates` - Legal compliance

**How to Export:**

```sql
-- Export single table
COPY tenants TO '/tmp/tenants_backup.csv' WITH CSV HEADER;

-- Export with Supabase API
SELECT * FROM tenants;
-- Save as JSON/CSV from Supabase Studio
```

---

## 🚨 DISASTER RECOVERY PROCEDURES

### Scenario 1: Accidental Data Deletion

**Impact:** User deleted important data
**RTO:** < 5 minutes
**RPO:** 0 (if using PITR)

**Recovery Steps:**

1. **Identify timestamp of deletion:**
   ```sql
   SELECT * FROM audit_logs
   WHERE action = 'deleted'
   AND resource_id = 'affected-resource-id'
   ORDER BY created_at DESC;
   ```

2. **Use PITR to restore:**
   - Go to Supabase Dashboard → Database → Backups
   - Click "Point-in-Time Recovery"
   - Select timestamp just before deletion
   - Click "Restore" (creates new database)

3. **Verify restoration:**
   - Check that data exists in restored database
   - Compare row counts before/after

4. **Switch connection string:**
   - Update `NEXT_PUBLIC_SUPABASE_URL` to restored database
   - Redeploy application

**Alternative (Surgical Restore):**

If full PITR restore is overkill, restore single record:

```sql
-- Connect to restored database temporarily
-- Copy missing data
INSERT INTO your_table
SELECT * FROM restored_database.your_table
WHERE id = 'deleted-record-id';
```

---

### Scenario 2: Database Corruption

**Impact:** Database becomes unresponsive or corrupted
**RTO:** < 30 minutes
**RPO:** < 15 minutes (PITR)

**Recovery Steps:**

1. **Assess corruption extent:**
   ```sql
   -- Check table integrity
   SELECT * FROM pg_stat_database;

   -- Check for corrupted indexes
   REINDEX DATABASE postgres;
   ```

2. **If corruption is isolated:**
   - Reindex affected tables
   - Run `VACUUM FULL` on affected tables

3. **If corruption is widespread:**
   - Restore from latest PITR or daily backup
   - Follow steps from Scenario 1

4. **Post-recovery validation:**
   - Run integrity checks on all tables
   - Verify row counts match expectations
   - Test critical queries

---

### Scenario 3: Complete Database Loss

**Impact:** Supabase database completely unavailable
**RTO:** < 1 hour
**RPO:** < 1 day (daily backup)

**Recovery Steps:**

1. **Create new Supabase project:**
   - Go to Supabase Dashboard → New Project
   - Note new connection strings

2. **Restore from latest backup:**

   ```bash
   # Restore from SQL dump
   psql "postgresql://postgres:[password]@db.[new-project].supabase.co:5432/postgres" < backup.sql

   # Or use Supabase CLI
   supabase db push --db-url "your-new-db-url"
   ```

3. **Run all migrations:**
   ```bash
   # Apply any missing migrations
   cd src/supabase/migrations
   for file in *.sql; do
     psql "$DB_URL" -f "$file"
   done
   ```

4. **Update environment variables:**
   ```bash
   # Update in Vercel
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

   # Redeploy
   vercel --prod
   ```

5. **Verify restoration:**
   - Check all tables exist
   - Verify row counts
   - Test authentication
   - Test critical user flows

6. **Update DNS (if using custom domain):**
   - Update any DNS records pointing to old project
   - Wait for DNS propagation (~5 minutes)

---

### Scenario 4: Regional Outage

**Impact:** Supabase region is down
**RTO:** < 2 hours
**RPO:** < 1 day

**Recovery Steps:**

1. **Enable maintenance mode:**
   - Display maintenance page to users
   - Prevent new data writes

2. **Restore in different region:**
   - Create Supabase project in different region
   - Restore from latest backup
   - Update connection strings

3. **Update DNS/Routing:**
   - Point application to new database
   - Update Vercel environment variables

4. **Validate and resume:**
   - Test all critical functionality
   - Disable maintenance mode
   - Monitor for issues

---

### Scenario 5: Ransomware / Security Breach

**Impact:** Database compromised or encrypted
**RTO:** < 2 hours
**RPO:** < 1 day

**Recovery Steps:**

1. **Immediate Response:**
   - Disconnect database from internet
   - Revoke all API keys and tokens
   - Reset all passwords

2. **Assess breach extent:**
   - Check audit logs for unauthorized access
   - Identify compromised data
   - Determine attack vector

3. **Restore from clean backup:**
   - Use backup from BEFORE breach occurred
   - Verify backup is not compromised
   - Restore to new, clean database

4. **Security hardening:**
   - Rotate all secrets and keys
   - Enable 2FA for all admin accounts
   - Review and update RLS policies
   - Implement additional security measures

5. **Notify affected users:**
   - Follow GDPR/CCPA breach notification requirements
   - Provide incident details and remediation steps

---

## 🧪 BACKUP VERIFICATION

### Monthly Backup Testing

**Schedule:** First Monday of every month

**Test Procedure:**

1. **Select random backup:**
   - Choose one daily backup from previous week
   - Choose one weekly backup from previous month

2. **Perform test restore:**
   ```bash
   # Create temporary test database
   # Restore backup to test database
   psql "$TEST_DB_URL" < backup.sql
   ```

3. **Verify data integrity:**
   ```sql
   -- Check row counts match production
   SELECT
     'tenants' as table_name,
     COUNT(*) as row_count
   FROM tenants
   UNION ALL
   SELECT 'profiles', COUNT(*) FROM profiles
   UNION ALL
   SELECT 'contracts', COUNT(*) FROM contracts;

   -- Compare with production counts
   ```

4. **Test critical queries:**
   - User authentication
   - Tenant data access
   - Contract retrieval
   - Payment records

5. **Document results:**
   - Log test date and outcome
   - Note any issues or discrepancies
   - Update recovery procedures if needed

**Backup Test Checklist:**
- [ ] Backup file exists and is accessible
- [ ] Backup file size is reasonable (not corrupted)
- [ ] Restore completes without errors
- [ ] Row counts match production
- [ ] Data integrity checks pass
- [ ] Critical queries execute successfully
- [ ] RLS policies are intact
- [ ] Functions and triggers work

---

## 📊 BACKUP MONITORING

### Automated Monitoring

**Alerts Configured:**
- ❌ Daily backup failure
- ❌ Backup file size anomaly (too small = possible corruption)
- ❌ PITR lag exceeds 1 hour
- ❌ Backup storage approaching capacity
- ❌ Backup verification failure

**Monitoring Tools:**
- Supabase Dashboard (backup status)
- Sentry (backup script errors)
- Custom monitoring script (see below)

### Backup Monitoring Script

```bash
#!/bin/bash
# check-backups.sh - Run daily to verify backups

# Check last backup age
LAST_BACKUP=$(ls -t backups/*.sql.gz | head -1)
BACKUP_AGE=$(stat -c %Y "$LAST_BACKUP")
NOW=$(date +%s)
AGE_HOURS=$(( (NOW - BACKUP_AGE) / 3600 ))

if [ $AGE_HOURS -gt 36 ]; then
  echo "❌ ALERT: Last backup is $AGE_HOURS hours old!"
  # Send alert (email, Slack, etc.)
  exit 1
fi

# Check backup file size
SIZE=$(stat -c %s "$LAST_BACKUP")
MIN_SIZE=1000000  # 1 MB minimum

if [ $SIZE -lt $MIN_SIZE ]; then
  echo "❌ ALERT: Backup file is suspiciously small: $SIZE bytes"
  exit 1
fi

echo "✅ Backup checks passed"
echo "Last backup: $LAST_BACKUP"
echo "Age: $AGE_HOURS hours"
echo "Size: $SIZE bytes"
```

---

## 🔐 BACKUP SECURITY

### Encryption

**At Rest:**
- ✅ Supabase backups encrypted with AES-256
- ✅ Manual backups encrypted with GPG

```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 backup.sql

# Decrypt backup
gpg --decrypt backup.sql.gpg > backup.sql
```

**In Transit:**
- ✅ All backup transfers over HTTPS/TLS
- ✅ S3 uploads use AWS encryption

### Access Control

**Who Can Access Backups:**
- ✅ Supabase account owner
- ✅ Designated backup administrators (2 people max)
- ✅ Service account (for automated backups)

**MFA Required:**
- ✅ Supabase dashboard access
- ✅ AWS S3 console access
- ✅ Backup encryption keys

---

## 📞 EMERGENCY CONTACTS

### Disaster Recovery Team

**Primary Contact:**
- Name: [Your Name]
- Role: CTO / Lead Developer
- Phone: [Phone]
- Email: [Email]

**Secondary Contact:**
- Name: [Backup Contact]
- Role: DevOps Engineer
- Phone: [Phone]
- Email: [Email]

**Service Providers:**
- **Supabase Support:** support@supabase.com
- **Vercel Support:** support@vercel.com
- **Emergency Hotline:** [Your support hotline]

---

## 📝 RECOVERY CHECKLIST

When disaster strikes, follow this checklist:

### Immediate Actions (0-5 minutes)
- [ ] Assess impact and scope
- [ ] Notify disaster recovery team
- [ ] Enable maintenance mode if needed
- [ ] Document incident start time

### Recovery Actions (5-60 minutes)
- [ ] Identify appropriate recovery scenario
- [ ] Select backup to restore from
- [ ] Create new database instance (if needed)
- [ ] Restore backup
- [ ] Run integrity checks

### Validation (60-90 minutes)
- [ ] Verify data integrity
- [ ] Test critical user flows
- [ ] Check authentication works
- [ ] Verify RLS policies intact
- [ ] Test payment processing

### Resumption (90-120 minutes)
- [ ] Update environment variables
- [ ] Deploy updated application
- [ ] Disable maintenance mode
- [ ] Monitor for issues
- [ ] Notify users (if downtime occurred)

### Post-Incident (24-48 hours)
- [ ] Write incident report
- [ ] Conduct post-mortem
- [ ] Update recovery procedures
- [ ] Implement preventive measures
- [ ] Test recovery again

---

## 🎯 RECOVERY TIME OBJECTIVES

| Scenario | RTO Target | Actual RTO | RPO Target | Status |
|----------|-----------|------------|------------|---------|
| Accidental Deletion | < 5 min | TBD | 0 min (PITR) | ✅ |
| Database Corruption | < 30 min | TBD | < 15 min | ✅ |
| Complete DB Loss | < 1 hour | TBD | < 1 day | ✅ |
| Regional Outage | < 2 hours | TBD | < 1 day | ✅ |
| Security Breach | < 2 hours | TBD | < 1 day | ✅ |

---

## 📚 ADDITIONAL RESOURCES

- [Supabase Backup Documentation](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL Backup & Restore](https://www.postgresql.org/docs/current/backup.html)
- [Disaster Recovery Best Practices](https://www.ready.gov/business/emergency-plans/recovery-plan)

---

**Last Tested:** [Date]
**Next Test Date:** [First Monday of next month]
**Version:** 1.0
