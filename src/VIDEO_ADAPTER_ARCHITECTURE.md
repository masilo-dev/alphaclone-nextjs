# Video Meeting Adapter Architecture

## Overview
This document outlines the architecture for hiding Daily.co as an infrastructure backend (like AWS/Stripe) and exposing only AlphaClone branded meeting URLs with 40-minute time limits and single-use links.

---

## Goals

1. **Hide Daily.co Backend**: Treat Daily.co as infrastructure only - no direct references in frontend
2. **AlphaClone URLs**: Use `/meet/:token` instead of `daily.co/room-name`
3. **40-Minute Time Limit**: Automatically end meetings after 40 minutes
4. **Single-Use Links**: Meeting links expire after one use
5. **Secure Token System**: Short-lived access tokens for joining meetings

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                          │
│  - /meet/:token route                                       │
│  - AlphaClone branded meeting page                          │
│  - 40-minute countdown timer                                │
│  - No Daily.co references                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ API Calls
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   ADAPTER API LAYER                          │
│  - POST /api/meetings/create                                │
│  - GET /api/meetings/:token/validate                        │
│  - POST /api/meetings/:token/join                           │
│  - POST /api/meetings/:meetingId/end                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Service Layer
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              MEETING ADAPTER SERVICE                         │
│  - meetingAdapterService.ts                                 │
│  - Single-use link management                               │
│  - 40-minute timer enforcement                              │
│  - Token generation/validation                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Wraps
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              DAILY.CO BACKEND (Hidden)                       │
│  - dailyService.ts                                          │
│  - Room creation                                            │
│  - Token generation                                         │
│  - Meeting lifecycle                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Table: `meeting_links`

```sql
CREATE TABLE meeting_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
    link_token VARCHAR(64) UNIQUE NOT NULL, -- For /meet/:token
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    used_by UUID REFERENCES profiles(id),
    expires_at TIMESTAMP NOT NULL, -- 40 minutes from creation
    max_uses INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_meeting_links_token ON meeting_links(link_token);
CREATE INDEX idx_meeting_links_meeting_id ON meeting_links(meeting_id);
CREATE INDEX idx_meeting_links_expires_at ON meeting_links(expires_at);
```

### Modify Table: `video_calls`

```sql
-- Add new columns for 40-minute enforcement
ALTER TABLE video_calls ADD COLUMN duration_limit_minutes INTEGER DEFAULT 40;
ALTER TABLE video_calls ADD COLUMN auto_end_scheduled_at TIMESTAMP;
ALTER TABLE video_calls ADD COLUMN ended_reason VARCHAR(50); -- 'manual', 'time_limit', 'all_left'

-- Keep daily_room_url and daily_room_name but they're backend-only
-- Frontend never sees these fields
```

---

## Backend API Routes

### 1. **POST /api/meetings/create**

**Purpose:** Create a new meeting with single-use link

**Request Body:**
```typescript
{
    title: string;
    hostId: string;
    maxParticipants?: number; // default: 10
    durationMinutes?: number; // default: 40, max: 40
    calendarEventId?: string;
    participants?: string[]; // User IDs to invite
}
```

**Response:**
```typescript
{
    meetingId: string;
    meetingUrl: string; // "https://alphaclone.com/meet/:token"
    expiresAt: string; // ISO timestamp
    durationMinutes: number; // 40
}
```

**Logic:**
1. Create Daily.co room via `dailyService.createRoom()` (backend only)
2. Insert into `video_calls` table with Daily URL (not exposed)
3. Generate secure random token (32 chars)
4. Insert into `meeting_links` with 40-minute expiry
5. Return AlphaClone URL: `/meet/:token`

---

### 2. **GET /api/meetings/:token/validate**

**Purpose:** Validate meeting link before showing join UI

**Response:**
```typescript
{
    valid: boolean;
    reason?: string; // "expired", "used", "not_found"
    meeting?: {
        id: string;
        title: string;
        hostName: string;
        maxParticipants: number;
        expiresAt: string;
    }
}
```

**Logic:**
1. Look up `meeting_links` by token
2. Check if used (use_count >= max_uses)
3. Check if expired (expires_at < now)
4. Return meeting metadata without Daily URL

---

### 3. **POST /api/meetings/:token/join**

**Purpose:** Join meeting - generates temporary Daily token and marks link as used

**Request Body:**
```typescript
{
    userId: string;
    userName: string;
}
```

**Response:**
```typescript
{
    success: boolean;
    dailyUrl: string; // Daily.co room URL (only returned here, one-time)
    dailyToken: string; // Short-lived Daily token
    meetingId: string;
    autoEndAt: string; // ISO timestamp (40 minutes from start)
}
```

**Logic:**
1. Validate token (not used, not expired)
2. Mark `meeting_links.used = true`, `used_at = NOW()`, `used_by = userId`
3. Increment `use_count`
4. Get Daily room URL from `video_calls.daily_room_url`
5. Generate Daily meeting token (40-minute expiry) via Daily API
6. Update `video_calls.status = 'active'`, `started_at = NOW()`, `auto_end_scheduled_at = NOW() + 40min`
7. Return Daily URL + token (only time frontend sees it)

---

### 4. **POST /api/meetings/:meetingId/end**

**Purpose:** Admin ends meeting for all participants

**Request Body:**
```typescript
{
    userId: string;
    reason: 'manual' | 'time_limit' | 'all_left';
}
```

**Response:**
```typescript
{
    success: boolean;
}
```

**Logic:**
1. Verify user is host or admin
2. Update `video_calls.status = 'ended'`, `ended_at = NOW()`, `ended_reason = reason`
3. Mark all `meeting_links` for this meeting as expired
4. Broadcast to all participants via realtime subscription
5. Optionally: Call Daily.co API to forcefully end room

---

### 5. **GET /api/meetings/:meetingId/status** (Optional)

**Purpose:** Check meeting status (for auto-end timer)

**Response:**
```typescript
{
    status: 'scheduled' | 'active' | 'ended';
    timeRemaining?: number; // seconds until auto-end
    endReason?: string;
}
```

---

## Meeting Adapter Service

**File:** `services/meetingAdapterService.ts`

```typescript
import { supabase } from '../lib/supabase';
import { dailyService } from './dailyService';
import crypto from 'crypto';

export interface AlphaCloneMeeting {
    id: string;
    title: string;
    meetingUrl: string; // /meet/:token
    hostId: string;
    expiresAt: Date;
    durationMinutes: number;
    status: 'scheduled' | 'active' | 'ended';
}

export interface MeetingLink {
    id: string;
    meetingId: string;
    token: string;
    used: boolean;
    usedAt?: Date;
    expiresAt: Date;
    maxUses: number;
    useCount: number;
}

class MeetingAdapterService {
    /**
     * Create a new meeting with single-use link
     * Returns AlphaClone URL, NOT Daily.co URL
     */
    async createMeeting(options: {
        title: string;
        hostId: string;
        maxParticipants?: number;
        durationMinutes?: number;
        calendarEventId?: string;
        participants?: string[];
    }): Promise<{ meeting: AlphaCloneMeeting | null; error: string | null }> {
        // Implementation...
    }

    /**
     * Validate meeting link
     */
    async validateMeetingLink(token: string): Promise<{
        valid: boolean;
        reason?: string;
        meeting?: {
            id: string;
            title: string;
            hostName: string;
            maxParticipants: number;
            expiresAt: Date;
        };
        error: string | null;
    }> {
        // Implementation...
    }

    /**
     * Join meeting - generates Daily token and marks link as used
     */
    async joinMeeting(
        token: string,
        userId: string,
        userName: string
    ): Promise<{
        success: boolean;
        dailyUrl?: string; // One-time return of Daily URL
        dailyToken?: string; // Short-lived token
        meetingId?: string;
        autoEndAt?: Date;
        error: string | null;
    }> {
        // Implementation...
    }

    /**
     * End meeting (admin/host only, or auto-end on timer)
     */
    async endMeeting(
        meetingId: string,
        userId: string,
        reason: 'manual' | 'time_limit' | 'all_left'
    ): Promise<{ success: boolean; error: string | null }> {
        // Implementation...
    }

    /**
     * Check if meeting has exceeded 40-minute limit
     */
    async checkTimeLimit(meetingId: string): Promise<{
        exceeded: boolean;
        timeRemaining?: number;
        error: string | null;
    }> {
        // Implementation...
    }

    /**
     * Generate secure random token for meeting link
     */
    private generateToken(): string {
        return crypto.randomBytes(32).toString('base64url');
    }

    /**
     * Subscribe to meeting status changes (for auto-end enforcement)
     */
    subscribeToMeetingStatus(
        meetingId: string,
        onStatusChange: (status: 'active' | 'ended', reason?: string) => void
    ): () => void {
        // Supabase realtime subscription
    }
}

export const meetingAdapterService = new MeetingAdapterService();
```

---

## Frontend Implementation

### Route: `/meet/:token`

**File:** `components/meeting/MeetingPage.tsx`

```typescript
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Daily, { DailyCall } from '@daily-co/daily-js';
import toast from 'react-hot-toast';

const MeetingPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [isValidating, setIsValidating] = useState(true);
    const [meetingInfo, setMeetingInfo] = useState<any>(null);
    const [timeRemaining, setTimeRemaining] = useState(40 * 60); // 40 minutes in seconds
    const callObjectRef = useRef<DailyCall | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        validateAndJoin();
    }, [token]);

    const validateAndJoin = async () => {
        // Step 1: Validate token
        const validateRes = await fetch(`/api/meetings/${token}/validate`);
        const { valid, reason, meeting } = await validateRes.json();

        if (!valid) {
            toast.error(`Meeting link ${reason}`);
            navigate('/dashboard');
            return;
        }

        setMeetingInfo(meeting);

        // Step 2: Join meeting (marks as used, gets Daily URL)
        const joinRes = await fetch(`/api/meetings/${token}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                userName: user.name
            })
        });

        const { success, dailyUrl, dailyToken, autoEndAt } = await joinRes.json();

        if (!success) {
            toast.error('Failed to join meeting');
            navigate('/dashboard');
            return;
        }

        // Step 3: Embed Daily iframe (hidden from user)
        const callObject = Daily.createFrame(containerRef.current!, {
            showLeaveButton: true,
            iframeStyle: {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                border: '0',
            }
        });

        callObjectRef.current = callObject;

        // Step 4: Join Daily room
        await callObject.join({
            url: dailyUrl,
            token: dailyToken,
            userName: user.name
        });

        setIsValidating(false);

        // Step 5: Start 40-minute countdown
        startTimer(autoEndAt);
    };

    const startTimer = (autoEndAt: string) => {
        const endTime = new Date(autoEndAt).getTime();
        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
            setTimeRemaining(remaining);

            if (remaining === 0) {
                clearInterval(interval);
                handleAutoEnd();
            }
        }, 1000);
    };

    const handleAutoEnd = async () => {
        toast.error('Meeting time limit reached (40 minutes)');
        await callObjectRef.current?.leave();
        navigate('/dashboard');
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (isValidating) {
        return <div>Loading meeting...</div>;
    }

    return (
        <div className="fixed inset-0 bg-gray-900">
            {/* 40-Minute Timer Overlay */}
            <div className="absolute top-4 right-4 z-50 bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg">
                <div className="text-white font-mono text-lg">
                    <span className={timeRemaining < 300 ? 'text-red-400 animate-pulse' : ''}>
                        {formatTime(timeRemaining)}
                    </span>
                    <span className="text-slate-400 text-sm ml-2">remaining</span>
                </div>
            </div>

            {/* AlphaClone Branding */}
            <div className="absolute top-4 left-4 z-50 bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg">
                <h2 className="text-white font-bold">{meetingInfo?.title}</h2>
                <p className="text-slate-400 text-sm">Powered by AlphaClone Systems</p>
            </div>

            {/* Daily.co iframe (embedded but branded) */}
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
};

export default MeetingPage;
```

---

## Link Generation Updates

### Update all meeting link generation:

**Before:**
```typescript
// Returns: https://alphaclone.daily.co/room-12345
const meetingUrl = videoCall.daily_room_url;
```

**After:**
```typescript
// Returns: https://alphaclone.com/meet/abc123xyz...
const { meeting } = await meetingAdapterService.createMeeting({
    title: 'Client Meeting',
    hostId: user.id
});
const meetingUrl = meeting.meetingUrl; // /meet/:token
```

### Files to Update:
- `components/dashboard/calendar/CalendarTab.tsx` - Calendar event creation
- `components/dashboard/ConferenceTab.tsx` - Ad-hoc meeting creation
- `services/emailService.ts` - Email invites (if any)
- Any other places that generate meeting links

---

## Security Considerations

1. **Token Entropy**: Use 32-byte random tokens (base64url encoded = 43 chars)
2. **Single-Use Enforcement**: Mark token as used immediately after join
3. **Expiry Validation**: Check both token expiry AND 40-minute meeting duration
4. **Authorization**: Verify user permissions before join/end operations
5. **Rate Limiting**: Prevent token brute-force attacks (add to API routes)
6. **Daily Token TTL**: Generate Daily tokens with 40-minute expiry
7. **No URL Leakage**: Never expose `daily_room_url` in API responses (except /join)

---

## Migration Plan

### Phase 1: Database Setup
1. Run migration to create `meeting_links` table
2. Add new columns to `video_calls` table

### Phase 2: Backend Implementation
1. Create `meetingAdapterService.ts`
2. Implement API routes: `/api/meetings/*`
3. Test token generation/validation

### Phase 3: Frontend Implementation
1. Create `/meet/:token` route
2. Implement `MeetingPage.tsx` with 40-minute timer
3. Add timer countdown UI

### Phase 4: Link Generation Updates
1. Update all components that create meetings
2. Replace Daily.co URLs with AlphaClone URLs
3. Update calendar integration

### Phase 5: Cleanup
1. Remove direct Daily.co references from frontend
2. Make `daily_room_url` backend-only (hidden from SELECT queries)
3. Update documentation

---

## Testing Checklist

- [ ] Create meeting via adapter API
- [ ] Validate meeting link (valid case)
- [ ] Validate meeting link (expired case)
- [ ] Validate meeting link (used case)
- [ ] Join meeting with valid token
- [ ] Verify token marked as used after join
- [ ] Verify 40-minute timer starts correctly
- [ ] Test timer countdown display
- [ ] Test auto-end at 40 minutes
- [ ] Test manual meeting end (admin)
- [ ] Verify single-use link cannot be reused
- [ ] Test meeting status subscription
- [ ] Verify Daily.co URLs not exposed to frontend
- [ ] Test calendar integration with new URLs
- [ ] Test email invites with new URLs

---

## Benefits

1. **Brand Control**: Users see only AlphaClone URLs and branding
2. **Infrastructure Flexibility**: Can swap Daily.co for another provider easily
3. **Enhanced Security**: Single-use tokens, time limits, controlled access
4. **Better UX**: Consistent AlphaClone experience, clear time limits
5. **Compliance**: Easier to enforce meeting policies (duration, usage)

---

## Status

- **Current State**: Daily.co directly exposed in frontend
- **Target State**: Daily.co hidden as infrastructure backend
- **Estimated Work**: 3-5 days for full implementation
- **Priority**: High (per user request)
