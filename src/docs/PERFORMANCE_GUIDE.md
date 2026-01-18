# Phase 2: Performance Optimization - Usage Examples

## 1. Enhanced Skeleton Loaders

### Import
```typescript
import {
  TableSkeleton,
  CardSkeleton,
  StatsCardSkeleton,
  ChartSkeleton,
  ListItemSkeleton,
  FormSkeleton,
  ProfileSkeleton,
  MessageSkeleton,
  PageSkeleton
} from './components/ui/Skeleton';
```

### Usage
```typescript
// In your component
{isLoading ? (
  <StatsCardSkeleton count={4} />
) : (
  <StatsCards data={stats} />
)}

// Full page loading
{isLoading && <PageSkeleton />}

// Table loading
{isLoadingProjects ? (
  <TableSkeleton rows={10} columns={5} />
) : (
  <ProjectTable projects={projects} />
)}
```

---

## 2. Data Caching

### Import
```typescript
import { cacheService, CacheKeys, CacheTTL } from '../services/cacheService';
```

### Basic Usage
```typescript
// Set cache
cacheService.set('user:123', userData, CacheTTL.MEDIUM);

// Get cache
const cached = cacheService.get('user:123');
if (cached) {
  return cached;
}

// Get or fetch pattern
const projects = await cacheService.getOrFetch(
  CacheKeys.projects(userId),
  () => projectService.getProjects(userId),
  CacheTTL.MEDIUM
);
```

### Invalidation
```typescript
// Invalidate specific key
cacheService.invalidate(CacheKeys.project(projectId));

// Invalidate pattern (all projects)
cacheService.invalidatePattern('projects:.*');

// Clear all
cacheService.clear();
```

### Example: Cached Project Fetch
```typescript
const loadProjects = async () => {
  setIsLoading(true);
  
  const projects = await cacheService.getOrFetch(
    CacheKeys.projects(user.id),
    async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id);
      return data || [];
    },
    CacheTTL.MEDIUM // 5 minutes
  );
  
  setProjects(projects);
  setIsLoading(false);
};

// Invalidate when creating new project
const createProject = async (projectData) => {
  await projectService.create(projectData);
  cacheService.invalidate(CacheKeys.projects(user.id));
  loadProjects(); // Refresh
};
```

---

## 3. Virtual Scrolling

### Import
```typescript
import { VirtualList, VirtualGrid } from './components/ui/VirtualList';
```

### List Usage
```typescript
<div style={{ height: '600px' }}>
  <VirtualList
    items={projects}
    itemHeight={80}
    renderItem={(project, index) => (
      <ProjectCard key={project.id} project={project} />
    )}
    emptyMessage="No projects found"
  />
</div>
```

### Grid Usage
```typescript
<div style={{ height: '800px' }}>
  <VirtualGrid
    items={galleryItems}
    itemHeight={200}
    itemsPerRow={3}
    gap={16}
    renderItem={(item, index) => (
      <GalleryCard key={item.id} item={item} />
    )}
  />
</div>
```

---

## 4. Optimistic Updates

### Import
```typescript
import { useOptimisticUpdate, useOptimisticList } from '../hooks/useOptimisticUpdate';
```

### Single Update
```typescript
const { execute, isUpdating } = useOptimisticUpdate();

const handleToggleFavorite = async (projectId: string) => {
  await execute(
    { ...project, isFavorite: !project.isFavorite }, // Optimistic data
    () => projectService.toggleFavorite(projectId),   // Server update
    {
      successMessage: 'Updated successfully',
      errorMessage: 'Failed to update',
      onSuccess: (result) => setProject(result),
    }
  );
};
```

### List Operations
```typescript
const { addOptimistic, updateOptimistic, deleteOptimistic } = useOptimisticList();

// Add
const handleAddProject = async () => {
  const tempId = `temp-${Date.now()}`;
  const newProject = { id: tempId, title: 'New Project', ...formData };
  
  await addOptimistic(
    projects,
    setProjects,
    newProject,
    () => projectService.create(formData)
  );
};

// Update
const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
  await updateOptimistic(
    projects,
    setProjects,
    projectId,
    updates,
    () => projectService.update(projectId, updates)
  );
};

// Delete
const handleDeleteProject = async (projectId: string) => {
  await deleteOptimistic(
    projects,
    setProjects,
    projectId,
    () => projectService.delete(projectId)
  );
};
```

---

## Complete Example: Optimized Project List

```typescript
import React, { useState, useEffect } from 'react';
import { VirtualList } from './components/ui/VirtualList';
import { CardSkeleton } from './components/ui/Skeleton';
import { cacheService, CacheKeys, CacheTTL } from './services/cacheService';
import { useOptimisticList } from './hooks/useOptimisticUpdate';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { updateOptimistic, deleteOptimistic } = useOptimisticList();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    
    // Use cache
    const cached = await cacheService.getOrFetch(
      CacheKeys.projects(user.id),
      () => projectService.getAll(user.id),
      CacheTTL.MEDIUM
    );
    
    setProjects(cached);
    setIsLoading(false);
  };

  const handleUpdate = async (id: string, updates: Partial<Project>) => {
    await updateOptimistic(
      projects,
      setProjects,
      id,
      updates,
      () => projectService.update(id, updates)
    );
    
    // Invalidate cache
    cacheService.invalidate(CacheKeys.projects(user.id));
  };

  const handleDelete = async (id: string) => {
    await deleteOptimistic(
      projects,
      setProjects,
      id,
      () => projectService.delete(id)
    );
    
    // Invalidate cache
    cacheService.invalidate(CacheKeys.projects(user.id));
  };

  if (isLoading) {
    return <CardSkeleton count={6} />;
  }

  return (
    <div style={{ height: '600px' }}>
      <VirtualList
        items={projects}
        itemHeight={120}
        renderItem={(project) => (
          <ProjectCard
            project={project}
            onUpdate={(updates) => handleUpdate(project.id, updates)}
            onDelete={() => handleDelete(project.id)}
          />
        )}
      />
    </div>
  );
};
```

---

## Performance Best Practices

1. **Use skeleton loaders** for all async operations
2. **Cache frequently accessed data** with appropriate TTL
3. **Invalidate cache** when data changes
4. **Use virtual scrolling** for lists > 50 items
5. **Implement optimistic updates** for better UX
6. **Show loading states** immediately
7. **Handle errors gracefully** with rollback

---

## Cache TTL Guidelines

- **SHORT (1 min)**: Real-time data (notifications, messages)
- **MEDIUM (5 min)**: User data, projects, invoices
- **LONG (15 min)**: Static content, preferences
- **VERY_LONG (1 hour)**: Rarely changing data
