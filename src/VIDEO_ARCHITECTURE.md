# Video Platform Architecture

## Overview

This is a **production-ready video conferencing platform** built with a clean, layered architecture. Daily.co provides the infrastructure, but the platform is fully customizable, branded, and reliable at scale.

## Architecture Principles

1. **Daily.co is infrastructure, not the product**
2. **Clean separation of concerns** - Each layer has clear responsibilities
3. **State is centralized and authoritative** - No UI desync
4. **UI never controls state directly** - UI only reacts to state changes
5. **Failures are contained** - Errors never cascade
6. **Easy to customize** - Configuration over code changes

---

## Architectural Layers

### LAYER 1: Core Video Engine (`VideoEngine.ts`)

**Owns:**
- Daily call object lifecycle
- Join/leave operations
- Device management
- Network state
- Media constraints

**Constraints:**
- NO UI knowledge
- NO state management
- Exposes clean, stable interface
- Fully defensive against failures

**Extension Points:**
```typescript
// Add custom device handling
engine.getDevices() → DeviceInfo

// Listen to low-level events
engine.on('participant-joined', handler)

// Advanced: Access Daily call object
engine.getCallObject()
```

---

### LAYER 2: Media State Manager (`MediaStateManager.ts`)

**Owns:**
- Camera state (on/off)
- Microphone state (on/off)
- Participant streams
- Audio/video availability
- Screen share state

**Constraints:**
- Single source of truth
- Prevents UI desync
- Guarantees media correctness
- NO UI knowledge
- Uses VideoEngine (never calls Daily directly)

**Extension Points:**
```typescript
// Subscribe to all state changes
mediaState.subscribe((state) => {
  // React to any media change
})

// Get specific participant
mediaState.getParticipant(sessionId)

// Get filtered participant lists
mediaState.getRemoteParticipants()
```

---

### LAYER 3: Video Configuration (`VideoConfiguration.ts`)

**Owns:**
- Brand colors
- Layout rules
- Feature flags
- Behavior toggles
- UI controls visibility

**Constraints:**
- Declarative, not imperative
- Easy to override per-deployment
- No logic, only configuration

**Extension Points:**
```typescript
// Customize branding
const config = new VideoConfiguration({
  branding: {
    primaryColor: '#14b8a6',
    accentColor: '#3b82f6',
    logoUrl: '/logo.png'
  }
});

// Toggle features
config.isFeatureEnabled('screenShare') → boolean
config.isControlVisible('showMuteButton') → boolean

// Update at runtime
config.updateConfig({ features: { recording: true } })
```

---

### LAYER 4: Error Handler (`ErrorHandler.ts`)

**Owns:**
- Error normalization
- User-facing messages
- Recovery strategies
- Error logging

**Constraints:**
- Prevents crashes
- Prevents UI freezes
- Turns Daily errors into safe states
- Provides clear user messages

**Extension Points:**
```typescript
// Handle any error
const normalized = errorHandler.handle(error, context)
// Returns: { code, message, userMessage, recoverable, action }

// Get error history
errorHandler.getLog() → ErrorLog[]

// Check recent errors
errorHandler.getRecentErrors(10)
```

---

### LAYER 5: Video Platform (`VideoPlatform.ts`)

**Owns:**
- Orchestrates all layers
- Provides unified API
- Manages lifecycle

**Constraints:**
- Single entry point
- Coordinates layers
- No direct Daily calls

**Extension Points:**
```typescript
// Main platform interface
const platform = new VideoPlatform(config);
await platform.initialize();
await platform.join({ url, userName });

// Toggle media
await platform.toggleAudio();
await platform.toggleVideo();
await platform.toggleScreenShare();

// Subscribe to changes
platform.subscribeToMediaState((state) => {
  // React to any change
});
```

---

### LAYER 6: UI Adapter (`useVideoPlatform.ts`)

**Owns:**
- React integration
- Maps state → UI
- Handles user interactions
- Visual feedback

**Constraints:**
- NEVER calls Daily APIs
- NEVER manages media directly
- Only reacts to state changes
- Clean interface for components

**Usage:**
```typescript
function VideoRoom() {
  const {
    isJoined,
    participants,
    isAudioEnabled,
    toggleAudio,
    join,
    leave,
  } = useVideoPlatform();

  // UI is purely reactive - no state management needed
}
```

---

## Data Flow

```
USER ACTION (click button)
      ↓
UI ADAPTER (useVideoPlatform hook)
      ↓
VIDEO PLATFORM (orchestrator)
      ↓
MEDIA STATE MANAGER (state logic)
      ↓
VIDEO ENGINE (Daily wrapper)
      ↓
DAILY.CO (infrastructure)
```

**State updates flow back up:**

```
DAILY.CO (event fired)
      ↓
VIDEO ENGINE (normalizes event)
      ↓
MEDIA STATE MANAGER (updates state)
      ↓
VIDEO PLATFORM (forwards state)
      ↓
UI ADAPTER (React state update)
      ↓
UI COMPONENTS (re-render)
```

---

## Extension Examples

### Adding a New Feature

**Example: Add "Raise Hand" feature**

1. **Configuration** (`VideoConfiguration.ts`):
```typescript
features: {
  raiseHand: true, // Add flag
}
```

2. **Media State** (`MediaStateManager.ts`):
```typescript
async toggleRaiseHand(): Promise<void> {
  // Add state management
}
```

3. **UI Adapter** (`useVideoPlatform.ts`):
```typescript
const toggleRaiseHand = useCallback(async () => {
  await platform.toggleRaiseHand();
}, []);
```

4. **UI Component**: Just use the hook!
```typescript
<button onClick={toggleRaiseHand}>Raise Hand</button>
```

**No changes needed to:**
- VideoEngine
- ErrorHandler
- VideoPlatform core

---

### Customizing Branding

```typescript
const customConfig = new VideoConfiguration({
  branding: {
    primaryColor: '#ff6b6b',
    accentColor: '#4ecdc4',
    backgroundColor: '#1a1a2e',
    logoUrl: '/custom-logo.png',
  },
  layout: {
    maxParticipantsPerRow: 6,
    aspectRatio: '4:3',
  },
});

const platform = new VideoPlatform(customConfig);
```

---

### Adding Custom Error Handling

```typescript
platform.subscribeToMediaState((state) => {
  if (error) {
    // Show custom error UI
    if (error.action === 'retry') {
      showRetryButton();
    } else if (error.action === 'contact-support') {
      showSupportLink();
    }
  }
});
```

---

## Reliability Features

### Error Recovery

- **Automatic retry** for network errors
- **Graceful degradation** when features unavailable
- **Clear user feedback** for permission issues
- **Contained failures** - errors never crash the app

### State Consistency

- **Single source of truth** - MediaStateManager
- **No UI desync** - UI is purely reactive
- **Predictable state transitions** - State machine in VideoEngine
- **Immutable state** - State changes trigger new objects

### Scalability

- **Lightweight** - Only active call consumes resources
- **Memory-safe** - Proper cleanup on destroy
- **Event-driven** - No polling
- **Optimized re-renders** - React hooks with proper dependencies

---

## Migration Path

### Current Components

The existing `CustomVideoRoom`, `CustomVideoTile`, and `VideoControls` components can be gradually migrated to use the new architecture:

**Option 1: Full Migration (Recommended)**
- Replace with new components that use `useVideoPlatform` hook
- Clean, predictable behavior
- Production-ready from day one

**Option 2: Adapter Pattern**
- Keep existing UI components
- Create adapter to wire them to new state management
- Gradual migration

---

## Testing Strategy

### Unit Tests

- **VideoEngine**: Mock Daily.co, test lifecycle
- **MediaStateManager**: Test state transitions
- **ErrorHandler**: Test error normalization

### Integration Tests

- **VideoPlatform**: Test layer coordination
- **useVideoPlatform**: Test React integration

### E2E Tests

- Join/leave flows
- Media toggle flows
- Error recovery flows
- Multi-participant scenarios

---

## Performance Characteristics

- **Initial load**: ~200KB (including Daily SDK)
- **Memory**: ~50MB per active call
- **CPU**: Minimal (video encoding handled by browser)
- **Network**: Depends on participants and quality

---

## Future-Proof Design

### What Can Be Added Without Core Changes:

✅ Recording
✅ Virtual backgrounds
✅ Reactions/emojis
✅ Chat
✅ Polls
✅ Breakout rooms
✅ Custom layouts
✅ Analytics
✅ Quality monitoring
✅ Custom branding per-room

### What Would Require Core Changes:

❌ Switching from Daily.co to another provider (VideoEngine rewrite)
❌ P2P mode (architecture assumes SFU)
❌ Custom video encoding (browser limitation)

---

## Summary

This architecture provides:

✅ **Zoom-level reliability** - Production-ready error handling
✅ **Easy customization** - Configuration over code
✅ **Clean separation** - Each layer has one job
✅ **Future-proof** - Easy to extend without breaking
✅ **Full control** - Your branding, your rules
✅ **Type-safe** - Full TypeScript support
✅ **React-friendly** - Clean hooks API

The platform is built to **scale**, **adapt**, and **never break**. Daily.co is just the engine - you own the product.
