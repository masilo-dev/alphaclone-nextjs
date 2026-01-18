# Event Bus System - Manual Deployment Guide

## Step 1: Deploy Database Schema

Go to your Supabase Dashboard → SQL Editor and run the migration file:
`supabase/migrations/20260113_event_bus_system.sql`

Or use this direct SQL:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/20260113_event_bus_system.sql
```

## Step 2: Verify Tables Created

Check that these tables exist:
- `events`
- `event_subscriptions`
- `event_handlers`
- `event_logs`

## Step 3: Test Event Bus

```typescript
import { eventBus, eventBusHelpers } from './services/eventBus';

// Publish a test event
await eventBusHelpers.publishSystemEvent('info', 'Event Bus initialized');

// Subscribe to events
eventBus.subscribe('system.*', async (event) => {
    console.log('System event:', event);
});
```

## Step 4: Integrate into Existing Services

See `services/eventBus/examples.ts` for integration examples.

## Quick Start

1. Deploy SQL migration to Supabase
2. Import Event Bus in your services
3. Start publishing and subscribing to events
4. Watch your Business OS come alive! 🚀
