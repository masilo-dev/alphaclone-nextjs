# Multi-Tenant Service Layer Update Guide

## Overview

This guide explains how to update all service layer files to properly use `tenant_id` for complete data isolation in your multi-tenant architecture.

## Migration Completed ✅

The database migration (`20260116_add_tenant_id_to_all_tables.sql`) has added:
- `tenant_id` column to 60+ tables
- Performance indexes on all `tenant_id` columns
- RLS policies for tenant isolation
- All existing data migrated to default tenant

---

## Next Step: Update Services

All services need to be updated to:
1. Accept `tenant_id` as a parameter
2. Filter queries by `tenant_id`
3. Automatically inject `tenant_id` when creating records

---

## Pattern to Follow

### Before (No Tenant Isolation):
```typescript
async getProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', userId);

  return data;
}
```

### After (With Tenant Isolation):
```typescript
async getProjects(tenantId: string, userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('tenant_id', tenantId)  // ← ADD THIS
    .eq('owner_id', userId);

  return data;
}

// Or with automatic tenant injection:
async getProjects(userId: string) {
  const tenantId = tenantService.getCurrentTenantId();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('tenant_id', tenantId)  // ← Auto-injected
    .eq('owner_id', userId);

  return data;
}
```

---

## Services That Need Updates (Priority Order)

### 🔴 CRITICAL (Update First - 1-2 days)

#### 1. **projectService.ts**
**What to update:**
```typescript
- getProjects() → Add .eq('tenant_id', tenantId)
- createProject() → Add tenant_id to INSERT
- updateProject() → Verify tenant_id match
- deleteProject() → Verify tenant_id match
```

#### 2. **taskService.ts**
```typescript
- getTasks() → Filter by tenant_id
- createTask() → Include tenant_id
- updateTask() → Verify tenant_id
- deleteTask() → Verify tenant_id
- getTasksByProject() → Filter by tenant_id
- getTasksByUser() → Filter by tenant_id
```

#### 3. **dealService.ts**
```typescript
- getDeals() → Filter by tenant_id
- createDeal() → Include tenant_id
- updateDeal() → Verify tenant_id
- deleteDeal() → Verify tenant_id
- getDealsByStage() → Filter by tenant_id
- getDealsByContact() → Filter by tenant_id
```

#### 4. **messageService.ts**
```typescript
- getMessages() → Filter by tenant_id
- sendMessage() → Include tenant_id
- getConversations() → Filter by tenant_id
```

#### 5. **quoteService.ts**
```typescript
- getQuotes() → Filter by tenant_id
- createQuote() → Include tenant_id
- updateQuote() → Verify tenant_id
- deleteQuote() → Verify tenant_id
```

### 🟡 IMPORTANT (Update Next - 2-3 days)

#### 6. **leadService.ts**
#### 7. **emailCampaignService.ts**
#### 8. **contractService.ts**
#### 9. **calendarService.ts**
#### 10. **workflowService.ts**
#### 11. **notificationService.ts**
#### 12. **activityService.ts**

### 🟢 SECONDARY (Update Last - 1-2 days)

#### 13. **analyticsService.ts**
#### 14. **reportingService.ts**
#### 15. **fileUploadService.ts**
#### 16. **aiGenerationService.ts**
#### 17. **videoService.ts**
#### 18. **paymentService.ts**

---

## Implementation Options

### Option 1: Explicit tenant_id Parameter (Recommended for MVP)

**Pros:** Clear, explicit, easy to test
**Cons:** More typing, need to pass tenant_id everywhere

```typescript
class ProjectService {
  async getProjects(tenantId: string, userId: string) {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('owner_id', userId);

    return data;
  }

  async createProject(tenantId: string, projectData: CreateProject) {
    const { data } = await supabase
      .from('projects')
      .insert({
        ...projectData,
        tenant_id: tenantId
      })
      .select()
      .single();

    return data;
  }
}
```

### Option 2: Automatic Tenant Context (Better DX, requires setup)

**Pros:** Less repetition, cleaner code
**Cons:** Need to set up context properly

```typescript
// First, create TenantContext
import { tenantService } from './tenancy/TenantService';

class ProjectService {
  private getTenantId(): string {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) {
      throw new Error('No active tenant context');
    }
    return tenantId;
  }

  async getProjects(userId: string) {
    const tenantId = this.getTenantId(); // Auto-inject

    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('owner_id', userId);

    return data;
  }

  async createProject(projectData: CreateProject) {
    const tenantId = this.getTenantId(); // Auto-inject

    const { data } = await supabase
      .from('projects')
      .insert({
        ...projectData,
        tenant_id: tenantId
      })
      .select()
      .single();

    return data;
  }
}
```

### Option 3: Supabase Query Wrapper (Most DRY)

Create a wrapper that auto-injects tenant_id:

```typescript
// utils/tenantQuery.ts
import { tenantService } from '../services/tenancy/TenantService';
import { supabase } from '../lib/supabase';

export function tenantQuery<T>(tableName: string) {
  const tenantId = tenantService.getCurrentTenantId();

  if (!tenantId) {
    throw new Error('No active tenant context');
  }

  return supabase
    .from(tableName)
    .select('*')
    .eq('tenant_id', tenantId);
}

// Usage in services:
async getProjects(userId: string) {
  const { data } = await tenantQuery('projects')
    .eq('owner_id', userId);

  return data;
}
```

---

## Step-by-Step Implementation

### Day 1-2: Core Services
1. ✅ Update `projectService.ts` - Projects are central to the platform
2. ✅ Update `taskService.ts` - Tasks are linked to projects
3. ✅ Update `dealService.ts` - CRM is critical
4. ✅ Update `messageService.ts` - Communication must be isolated
5. ✅ Test these 4 services thoroughly

### Day 3-4: Business Logic Services
6. ✅ Update `quoteService.ts`
7. ✅ Update `leadService.ts`
8. ✅ Update `emailCampaignService.ts`
9. ✅ Update `contractService.ts`
10. ✅ Update `calendarService.ts`
11. ✅ Update `workflowService.ts`

### Day 5: Supporting Services
12. ✅ Update `notificationService.ts`
13. ✅ Update `activityService.ts`
14. ✅ Update `analyticsService.ts`
15. ✅ Update `fileUploadService.ts`

### Day 6: Auxiliary Services
16. ✅ Update `aiGenerationService.ts`
17. ✅ Update `videoService.ts`
18. ✅ Update `paymentService.ts`
19. ✅ Update `reportingService.ts`

### Day 7: Testing & Verification
20. ✅ Create 2 test tenants
21. ✅ Test data isolation (Tenant A can't see Tenant B data)
22. ✅ Test CRUD operations for each service
23. ✅ Test RLS policies are working
24. ✅ Load testing with multiple tenants

---

## Testing Checklist

### Data Isolation Test
```typescript
// Create 2 test tenants
const tenant1 = await tenantService.createTenant({
  name: 'Acme Corp',
  slug: 'acme',
  adminUserId: 'user1'
});

const tenant2 = await tenantService.createTenant({
  name: 'Widget Inc',
  slug: 'widget',
  adminUserId: 'user2'
});

// Create project in tenant1
const project1 = await projectService.createProject(tenant1.id, {
  name: 'Acme Project',
  ...
});

// Try to access from tenant2 (should fail or return empty)
tenantService.setCurrentTenant(tenant2.id);
const projects = await projectService.getProjects('user1');

// ✅ PASS: projects should be empty (no access to tenant1 data)
// ❌ FAIL: if tenant1 project appears, isolation is broken
```

### RLS Policy Test
```sql
-- In Supabase SQL Editor, test as specific user:

-- Set user context
SET request.jwt.claims.sub = 'user-id-here';

-- Try to query projects from another tenant
SELECT * FROM projects WHERE tenant_id = 'other-tenant-id';

-- ✅ PASS: Should return 0 rows
-- ❌ FAIL: If returns data, RLS is broken
```

---

## Quick Reference: Service Update Template

```typescript
// services/exampleService.ts

import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

class ExampleService {
  // Helper method to get tenant_id
  private getTenantId(): string {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) {
      throw new Error('No active tenant context');
    }
    return tenantId;
  }

  // READ - Always filter by tenant_id
  async getItems(userId: string) {
    const tenantId = this.getTenantId();

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('tenant_id', tenantId)  // ← CRITICAL
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  }

  // CREATE - Always include tenant_id
  async createItem(itemData: CreateItem) {
    const tenantId = this.getTenantId();

    const { data, error } = await supabase
      .from('items')
      .insert({
        ...itemData,
        tenant_id: tenantId  // ← CRITICAL
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // UPDATE - Verify tenant_id matches
  async updateItem(itemId: string, updates: Partial<Item>) {
    const tenantId = this.getTenantId();

    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId)
      .eq('tenant_id', tenantId)  // ← CRITICAL - prevents cross-tenant updates
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // DELETE - Verify tenant_id matches
  async deleteItem(itemId: string) {
    const tenantId = this.getTenantId();

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId)
      .eq('tenant_id', tenantId);  // ← CRITICAL - prevents cross-tenant deletes

    if (error) throw error;
  }

  // COUNT/AGGREGATE - Filter by tenant_id
  async getItemCount(userId: string) {
    const tenantId = this.getTenantId();

    const { count, error } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)  // ← CRITICAL
      .eq('user_id', userId);

    if (error) throw error;
    return count || 0;
  }
}

export const exampleService = new ExampleService();
```

---

## Common Mistakes to Avoid

### ❌ MISTAKE 1: Forgetting tenant_id in WHERE clauses
```typescript
// BAD - No tenant isolation
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('owner_id', userId);

// GOOD - With tenant isolation
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('tenant_id', tenantId)  // ← Always include
  .eq('owner_id', userId);
```

### ❌ MISTAKE 2: Not including tenant_id on INSERT
```typescript
// BAD - Missing tenant_id
await supabase
  .from('projects')
  .insert({ name, description });

// GOOD - With tenant_id
await supabase
  .from('projects')
  .insert({
    name,
    description,
    tenant_id: tenantId  // ← Always include
  });
```

### ❌ MISTAKE 3: Not verifying tenant_id on UPDATE/DELETE
```typescript
// BAD - Can update/delete any tenant's data
await supabase
  .from('projects')
  .update({ name })
  .eq('id', projectId);

// GOOD - Restricted to current tenant
await supabase
  .from('projects')
  .update({ name })
  .eq('id', projectId)
  .eq('tenant_id', tenantId);  // ← Prevents cross-tenant modification
```

### ❌ MISTAKE 4: Hardcoding tenant_id
```typescript
// BAD - Hardcoded tenant
const tenantId = 'some-uuid-here';

// GOOD - Get from context
const tenantId = tenantService.getCurrentTenantId();
```

### ❌ MISTAKE 5: Skipping tenant_id on JOIN queries
```typescript
// BAD - Join without tenant filtering
const { data } = await supabase
  .from('projects')
  .select('*, tasks(*)')
  .eq('owner_id', userId);

// GOOD - Filter both parent and joined tables
const { data } = await supabase
  .from('projects')
  .select('*, tasks!inner(*)')  // inner join
  .eq('tenant_id', tenantId)
  .eq('tasks.tenant_id', tenantId)  // ← Filter joined table too
  .eq('owner_id', userId);
```

---

## Verification Script

Run this after updating each service:

```typescript
// tests/tenantIsolation.test.ts

import { tenantService } from '../services/tenancy/TenantService';
import { projectService } from '../services/projectService';

describe('Tenant Isolation', () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let project1Id: string;

  beforeAll(async () => {
    // Create 2 test tenants
    const t1 = await tenantService.createTenant({
      name: 'Tenant 1',
      slug: 'tenant1',
      adminUserId: 'admin1'
    });
    tenant1Id = t1.id;

    const t2 = await tenantService.createTenant({
      name: 'Tenant 2',
      slug: 'tenant2',
      adminUserId: 'admin2'
    });
    tenant2Id = t2.id;
  });

  test('Tenant 1 can create project', async () => {
    tenantService.setCurrentTenant(tenant1Id);

    const project = await projectService.createProject({
      name: 'Test Project',
      description: 'Test'
    });

    expect(project.tenant_id).toBe(tenant1Id);
    project1Id = project.id;
  });

  test('Tenant 2 cannot see Tenant 1 projects', async () => {
    tenantService.setCurrentTenant(tenant2Id);

    const projects = await projectService.getProjects('admin1');

    expect(projects).toHaveLength(0);
    expect(projects.find(p => p.id === project1Id)).toBeUndefined();
  });

  test('Tenant 2 cannot update Tenant 1 project', async () => {
    tenantService.setCurrentTenant(tenant2Id);

    await expect(
      projectService.updateProject(project1Id, { name: 'Hacked' })
    ).rejects.toThrow();
  });

  test('Tenant 2 cannot delete Tenant 1 project', async () => {
    tenantService.setCurrentTenant(tenant2Id);

    await expect(
      projectService.deleteProject(project1Id)
    ).rejects.toThrow();
  });

  test('Tenant 1 can still access their project', async () => {
    tenantService.setCurrentTenant(tenant1Id);

    const projects = await projectService.getProjects('admin1');

    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(project1Id);
  });
});
```

---

## Performance Considerations

### 1. Indexes
✅ All `tenant_id` columns have been indexed in the migration

### 2. Query Optimization
Always put `tenant_id` filter FIRST in queries:

```typescript
// GOOD - tenant_id first (uses index efficiently)
.eq('tenant_id', tenantId)
.eq('user_id', userId)
.eq('status', 'active')

// LESS OPTIMAL - tenant_id last
.eq('status', 'active')
.eq('user_id', userId)
.eq('tenant_id', tenantId)
```

### 3. Composite Indexes
For frequently queried combinations, create composite indexes:

```sql
-- Example: Projects by tenant and owner
CREATE INDEX idx_projects_tenant_owner
ON projects(tenant_id, owner_id);

-- Example: Tasks by tenant and status
CREATE INDEX idx_tasks_tenant_status
ON tasks(tenant_id, status);
```

---

## Summary Checklist

- [ ] Run database migration: `20260116_add_tenant_id_to_all_tables.sql`
- [ ] Update 18 core services with tenant_id filtering
- [ ] Create TenantContext provider in frontend
- [ ] Update all API calls to pass tenant_id
- [ ] Test data isolation with 2+ tenants
- [ ] Verify RLS policies are working
- [ ] Load test with multiple tenants
- [ ] Update documentation
- [ ] Train team on multi-tenant patterns

---

## Questions?

**Q: Do I need to update every service at once?**
A: No, prioritize by usage. Core services (projects, tasks, deals, messages) first.

**Q: What if a service doesn't have tenant_id yet?**
A: The migration added it to all tables. If a new table is created, add tenant_id immediately.

**Q: Can users belong to multiple tenants?**
A: Yes! The `tenant_users` table is many-to-many. Use tenant switcher UI.

**Q: What about system-wide data (email templates, plugins)?**
A: Some can be global (NULL tenant_id) or per-tenant. Use judgement based on business rules.

**Q: How do I handle tenant signup?**
A: Create tenant first, then add admin user via `tenant_users` table. See tenant onboarding guide.

---

**Status:** Database migration complete ✅
**Next:** Update service layer (Days 1-7)
**Timeline:** ~1 week for all services + testing
