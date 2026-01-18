# AlphaClone Video Meeting Critical Fixes

## Current Architecture Analysis

### System Components
1. **VideoEngine** - Direct Daily.co API interface
2. **MediaStateManager** - State management and participant tracking
3. **VideoPlatform** - Coordination layer
4. **useVideoPlatform** - React hook adapter
5. **CustomVideoRoom** - UI component
6. **CustomVideoTile** - Individual participant tiles

## Critical Bugs Identified

### 1. Participant Visibility Bug

**Symptom**: Non-admin participants only see one participant at a time

**Root Cause Analysis**:
- MediaStateManager.syncParticipants() rebuilds participant map from engine
- Line 211-239 iterates through ALL participants
- NO role-based filtering in the code
- Issue is likely in VideoEngine.getParticipants() OR Daily.co room configuration

**Hypothesis**:
1. Daily room might have `enable_people_ui: false` preventing non-owners from seeing others
2. Track subscription might not be automatic for all participants
3. Daily room `owner_only_broadcast` setting might be enabled

**Fix Required**:
```typescript
// In api/daily/create-room.ts
properties: {
    enable_screenshare: true,
    enable_chat: true,
    max_participants: maxParticipants,
    // CRITICAL: Ensure all participants can see each other
    enable_people_ui: true,
    owner_only_broadcast: false,
    enable_network_ui: true,
    // Auto-subscribe to all tracks
    enable_video_processing_ui: false,
    ...otherProperties
}
```

### 2. Screen Sharing Failure

**Symptom**: Screen sharing doesn't work on desktop or mobile

**Root Cause**:
- VideoEngine.startScreenShare() exists but may not handle errors properly
- No fallback messaging for mobile
- Browser permissions might not be requested correctly

**Fix Required**:
1. Add try-catch with user-friendly error messages
2. Detect mobile and show appropriate message
3. Ensure `getDisplayMedia` permissions are requested
4. Add fallback for browsers that don't support screen share

**Implementation**:
```typescript
async startScreenShare(): Promise<void> {
    try {
        // Check if screen share is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error('Screen sharing is not supported on this device');
        }

        await this.call.startScreenShare();
    } catch (error: any) {
        // Handle specific error cases
        if (error.name === 'NotAllowedError') {
            throw new NormalizedError('Permission denied. Please allow screen sharing.');
        } else if (error.name === 'NotSupportedError') {
            throw new NormalizedError('Screen sharing is not supported on mobile devices.');
        } else {
            throw new NormalizedError(`Screen sharing failed: ${error.message}`);
        }
    }
}
```

### 3. Admin Chat Not Working

**Symptom**: Admin cannot see messages during meetings

**Root Cause**:
- Chat is likely using dashboard-level messaging service
- NOT bound to Daily.co's real-time chat session
- Messages sent via Supabase instead of Daily chat events

**Fix Required**:
1. Use Daily.co's built-in chat: `call.sendAppMessage()`
2. Subscribe to `app-message` events
3. Store chat in local state during meeting
4. Optionally save to database after meeting ends

**Implementation**:
```typescript
// In VideoEngine
async sendChatMessage(message: string): Promise<void> {
    if (!this.callObject) {
        throw new Error('Not in a call');
    }

    await this.callObject.sendAppMessage({
        type: 'chat',
        message: message,
        sender: this.callObject.participants().local.user_name,
        timestamp: Date.now()
    }, '*'); // '*' broadcasts to all
}

// Listen for messages
this.callObject.on('app-message', (event) => {
    if (event.data.type === 'chat') {
        // Emit to UI layer
        this.emit('chat-message', event.data);
    }
});
```

### 4. Admin Authority Missing

**Symptom**: Admin cannot mute/unmute, remove participants, or lock room

**Root Cause**:
- No admin control methods implemented
- Daily.co requires owner/admin to send control messages
- No server-side enforcement of admin actions

**Fix Required**:
1. Add admin control methods to VideoEngine
2. Check user role before allowing actions
3. Use Daily.co's `updateParticipant()` for controls
4. Implement room locking via `setRoomConfig()`

**Implementation**:
```typescript
// In VideoEngine - Admin Controls
async muteParticipant(sessionId: string): Promise<void> {
    if (!this.callObject) throw new Error('Not in call');

    await this.callObject.updateParticipant(sessionId, {
        setAudio: false
    });
}

async removeParticipant(sessionId: string): Promise<void> {
    if (!this.callObject) throw new Error('Not in call');

    await this.callObject.updateParticipant(sessionId, {
        eject: true
    });
}

async lockRoom(locked: boolean): Promise<void> {
    if (!this.callObject) throw new Error('Not in call');

    const roomConfig = await this.callObject.room();
    await this.callObject.setRoomConfig({
        ...roomConfig.config,
        enable_knocking: locked
    });
}
```

### 5. Meeting Link Routing Issue

**Symptom**: Temporary links redirect to public website instead of meeting UI

**Root Cause**:
- Router might not handle `/meet/:roomName` or `/room/:roomName` properly
- No session initialization before redirect
- Missing route definition

**Fix Required**:
1. Add proper route in main router
2. Initialize session before rendering meeting
3. Handle both permanent and temporary links the same way

**Implementation**:
```typescript
// In App.tsx or main router
<Route path="/meet/:roomName" element={<MeetingJoinPage />} />
<Route path="/room/:roomName" element={<MeetingJoinPage />} />

// MeetingJoinPage component
const MeetingJoinPage = () => {
    const { roomName } = useParams();
    const [roomUrl, setRoomUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch room details and get Daily URL
        const loadRoom = async () => {
            const response = await fetch(`/api/daily/get-room/${roomName}`);
            const data = await response.json();
            setRoomUrl(data.url);
            setLoading(false);
        };
        loadRoom();
    }, [roomName]);

    if (loading) return <LoadingScreen />;
    if (!roomUrl) return <ErrorScreen />;

    return <CustomVideoRoom roomUrl={roomUrl} />;
};
```

## Implementation Priority

1. **FIX PARTICIPANT VISIBILITY** (5 min) - Update room properties in API
2. **FIX SCREEN SHARING** (10 min) - Add error handling and mobile detection
3. **FIX ADMIN CHAT** (15 min) - Implement Daily.co app messages
4. **ADD ADMIN CONTROLS** (20 min) - Implement mute/remove/lock methods
5. **FIX ROUTING** (10 min) - Add meeting routes and join page

Total estimated time: 60 minutes

## Testing Checklist

After fixes:
- [ ] Non-admin joins meeting - sees ALL participants
- [ ] Admin joins meeting - sees ALL participants
- [ ] Screen share works on desktop (all browsers)
- [ ] Screen share shows clear message on mobile
- [ ] Admin sends chat - all participants see it
- [ ] Participant sends chat - admin sees it
- [ ] Admin mutes participant - they are muted
- [ ] Admin removes participant - they are ejected
- [ ] Admin locks room - new participants cannot join
- [ ] Temporary link opens meeting directly
- [ ] Permanent link opens meeting directly
