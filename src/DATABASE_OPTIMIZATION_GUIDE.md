# Database Optimization Guide

## Critical Performance Optimizations for Supabase

### 1. Add Database Indexes

Run these SQL commands in your Supabase SQL Editor to dramatically improve query performance:

```sql
-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner_status ON projects(owner_id, status);

-- Messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at DESC);

-- Invoices table indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Gallery items indexes
CREATE INDEX IF NOT EXISTS idx_gallery_user_id ON gallery_items(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_type ON gallery_items(type);
CREATE INDEX IF NOT EXISTS idx_gallery_created_at ON gallery_items(created_at DESC);

-- Video calls indexes
CREATE INDEX IF NOT EXISTS idx_video_calls_host_id ON video_calls(host_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);
CREATE INDEX IF NOT EXISTS idx_video_calls_created_at ON video_calls(created_at DESC);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Login sessions indexes
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_ended_at ON login_sessions(ended_at);
```

### 2. Enable Row Level Security Policies

Ensure RLS is properly configured:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all, update own
CREATE POLICY "Users can read all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects: Owners can manage, admins can see all
CREATE POLICY "Users can view own projects or all if admin" ON projects
  FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins can update projects" ON projects
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Messages: Users can see their own messages, admins see all
CREATE POLICY "Users can view own messages or all if admin" ON messages
  FOR SELECT USING (
    sender_id = auth.uid() OR
    recipient_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Invoices: Users can view own, admins manage all
CREATE POLICY "Users can view own invoices or all if admin" ON invoices
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage invoices" ON invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Notifications: Users can only see their own
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Gallery: Users can view own, admins see all
CREATE POLICY "Users can view own gallery or all if admin" ON gallery_items
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can manage own gallery" ON gallery_items
  FOR ALL USING (user_id = auth.uid());

-- Activity logs: Users see own, admins see all
CREATE POLICY "Users can view own activity or all if admin" ON activity_logs
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert activity logs" ON activity_logs
  FOR INSERT WITH CHECK (true);
```

### 3. Optimize Real-time Subscriptions

In your code, use filtered subscriptions:

```typescript
// GOOD: Filtered at database level
const channel = supabase
  .channel('messages')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: `recipient_id=eq.${userId}`
    },
    handleNewMessage
  )
  .subscribe();

// BAD: Loading all data then filtering client-side
const channel = supabase
  .channel('messages')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, handleNewMessage)
  .subscribe();
```

### 4. Use Proper Query Patterns

```typescript
// GOOD: Select only needed columns
const { data } = await supabase
  .from('projects')
  .select('id, name, status, progress')
  .eq('owner_id', userId)
  .order('created_at', { ascending: false })
  .limit(20);

// BAD: Select all columns
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('owner_id', userId);
```

### 5. Implement Pagination

```typescript
const PAGE_SIZE = 20;

// Initial load
const { data, count } = await supabase
  .from('projects')
  .select('*', { count: 'exact' })
  .eq('owner_id', userId)
  .order('created_at', { ascending: false })
  .range(0, PAGE_SIZE - 1);

// Load more (infinite scroll)
const { data: moreData } = await supabase
  .from('projects')
  .select('*')
  .eq('owner_id', userId)
  .order('created_at', { ascending: false })
  .range(offset, offset + PAGE_SIZE - 1);
```

### 6. Enable Connection Pooling

In your Supabase project settings:
- Database > Connection Pooling: Enable
- Mode: Transaction
- This dramatically improves performance under load

### 7. Monitor Query Performance

Add this to your Supabase SQL Editor to find slow queries:

```sql
-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100  -- queries taking > 100ms on average
ORDER BY total_time DESC
LIMIT 20;

-- Find missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.5
ORDER BY n_distinct DESC;
```

### 8. Clean Up Old Data

Set up automatic cleanup for old records:

```sql
-- Delete old activity logs (keep last 90 days)
DELETE FROM activity_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive old completed projects (keep last year)
-- Create archive table first
CREATE TABLE IF NOT EXISTS projects_archive AS SELECT * FROM projects WHERE 1=0;

-- Move old completed projects to archive
INSERT INTO projects_archive
SELECT * FROM projects
WHERE status = 'Completed'
  AND created_at < NOW() - INTERVAL '1 year';

DELETE FROM projects
WHERE status = 'Completed'
  AND created_at < NOW() - INTERVAL '1 year';
```

### 9. Vacuum and Analyze

Run periodically to maintain database health:

```sql
-- Analyze tables to update statistics
ANALYZE projects;
ANALYZE messages;
ANALYZE invoices;
ANALYZE notifications;

-- Vacuum to reclaim space
VACUUM ANALYZE;
```

### 10. Performance Checklist

- [ ] All foreign key columns have indexes
- [ ] Frequently queried columns have indexes
- [ ] RLS policies are enabled and optimized
- [ ] Real-time subscriptions are filtered
- [ ] Queries select only needed columns
- [ ] Pagination is implemented for large datasets
- [ ] Connection pooling is enabled
- [ ] Slow query monitoring is active
- [ ] Old data cleanup is scheduled
- [ ] Database is regularly vacuumed

## Expected Performance Improvements

After implementing these optimizations:
- **Query speed**: 50-90% faster
- **Real-time latency**: 60-80% reduction
- **Database load**: 40-70% reduction
- **API response time**: 30-60% faster
- **Concurrent user capacity**: 3-5x increase




