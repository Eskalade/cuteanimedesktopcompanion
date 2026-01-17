# Changelog

test

## 2026-01-17 - BPM Detection Critical Bug Fixes

### Bug Fixes

#### 1. Fixed Bass Level Always Capped at 1.0 (CRITICAL)
**File:** `hooks/use-audio-capture.ts`

**Problem:** Bass level was always capped at 1.0 due to `Math.min(1, ...)`, making it impossible to detect beats. Since microphone picks up strong low frequencies, the bass level would hit the cap and stay at 1.0. With threshold = avgBass * 1.3 = 1.0 * 1.3 = 1.3, the bass (1.0) could never exceed threshold (1.3), resulting in no beats detected after initial warmup.

**Fix:**
- Introduced `rawBassLevel` that can exceed 1.0 for beat detection (line 171)
- Keep `bassLevel` capped at 1.0 for display purposes (line 173)
- Energy history now tracks `rawBassLevel` instead of capped value (line 218)
- Beat detection now compares `rawBassLevel` against threshold (line 244)
- Debug logs now show both `bass` (capped) and `rawBass` (uncapped) values

**Impact:** Beat detection now works correctly by allowing transient detection through uncapped raw values.

#### 2. Fixed realtime-bpm-analyzer Connection Errors
**File:** `hooks/use-audio-capture.ts`

**Problem:** The type assertions for connecting the BPM processor were causing runtime errors:
```
TypeError: Failed to execute 'connect' on 'AudioNode': Overload resolution failed.
```

**Fix:**
- Added runtime type checking before attempting connection (line 456)
- Gracefully handles non-standard object return types from the library
- Separated connection logic from message handler setup (lines 456-466)
- Added debug logging to identify processor type (line 449-450)

**Impact:** The realtime-bpm-analyzer now either connects properly or gracefully falls back to custom beat detection without throwing errors.

#### 3. Added Minimum Energy Requirement for Beat Detection
**File:** `hooks/use-audio-capture.ts`

**Problem:** Initial false beats during startup noise were poisoning the threshold calculation. The first 3 false beats filled the energy history with 1.0 values, causing the threshold to jump to 1.3 immediately and preventing any future beat detection.

**Fix:**
- Added `rawBassLevel > 0.1` minimum energy check to beat detection (line 244)
- Prevents beats from being detected during initial warmup noise
- Debug logs now show `minEnergyMet` status (line 239)

**Impact:** Eliminates false positive beats during startup, allowing the threshold to stabilize with real audio data.

### Expected Behavior After Fix

Debug logs should now show proper beat detection:
```
Levels: {energy: '0.10', bass: '1.00', rawBass: '2.45', mid: '0.85', treble: '0.42', maxFreq: 180}
Beat check: {rawBass: '2.45', threshold: '1.89', diff: '0.56', aboveThreshold: true, timeSinceLast: '520ms', canTrigger: true, minEnergyMet: true}
[AUDIO-DBG] BEAT DETECTED! interval: 520ms beatCount: 4
[AUDIO-DBG] BPM calculated: {calculated: 115, smoothed: 117, previous: 118, medianInterval: '521ms', beatCount: 4}
```

Key differences:
- `rawBass` can exceed 1.0 and varies with actual audio transients
- Threshold comparison is now meaningful
- Beats are detected consistently when audio has real bass transients

#### 4. Fixed NotSupportedError When Stopping Audio Capture
**File:** `hooks/use-audio-capture.ts`

**Problem:** When clicking "Stop Vibing", an error was thrown:
```
[v0] Capture error: NotSupportedError: Not supported
```

This occurred when trying to close the AudioContext in the cleanup function.

**Fix:**
- Wrapped `audioContext.close()` in try-catch block (line 111-117)
- Logs a warning instead of throwing an error
- Prevents user-facing error when stopping audio capture

**Impact:** Audio capture can now be stopped cleanly without console errors.

---

## Debugging Mode Documentation

### Overview
The application includes a comprehensive debugging system for monitoring audio analysis in real-time.

**Enable Debug Mode:**
- Set localStorage: `localStorage.setItem('VIBE_DEBUG', 'true')`
- Or use URL parameter: `?debug=1`
- Toggle debug panel: Press `Ctrl+Shift+D`

### Debug Values Tracked

**File:** `lib/audio-debug.ts`

#### 1. Audio Metrics (`AudioMetrics`)
Tracks raw audio analysis values:
- `energy` (number): Overall audio energy level (0-1, normalized)
- `bassLevel` (number): Bass frequency energy (0-1, capped for display)
- `midLevel` (number): Mid frequency energy (0-1)
- `trebleLevel` (number): High frequency energy (0-1)
- `isActive` (boolean): Whether audio is above silence threshold (0.05)
- `isSilent` (boolean): Whether audio is below silence threshold
- `silenceCount` (number): Number of consecutive silent frames

**Logged every 60 frames (~1 second):**
```
[Audio] energy=0.104 bass=1.000 mid=0.849 treble=0.424 active=true silent=false silenceFrames=0
```

#### 2. BPM Detection Info (`BpmDebugInfo`)
Tracks beat detection and BPM calculation:
- `currentBpm` (number): Custom beat detection BPM
- `realtimeBpm` (number): realtime-bpm-analyzer library BPM
- `beatCount` (number): Number of beats in recent history
- `lastInterval` (number): Time since last beat (ms)
- `threshold` (number): Current beat detection threshold
- `avgEnergy` (number): Average raw bass energy (for threshold calculation)

**Logged on each beat:**
```
[BPM] current=120 realtime=118 beats=4 interval=500ms threshold=1.890 avgEnergy=1.453
```

**Additional BPM logs:**
```
[Beat] bass=2.450 threshold=1.890 bpm=120
[BPM calculated] {calculated: 115, smoothed: 117, previous: 118, medianInterval: '521ms', beatCount: 4}
[Realtime BPM] tempo=120 candidates=3
[BPM Reset] reason="silence" preservedBpm=120
```

#### 3. Classification Debug Info (`ClassificationDebugInfo`)
Tracks ML-based genre and mood classification:
- `genre` (string): Detected genre (Rock, EDM, Hip-Hop, Jazz, Classical, Pop)
- `genreScores` (Record<string, number>): Confidence scores for each genre
- `mood` (string): Detected mood (chill, energetic, sad, happy)
- `moodScores` (Record<string, number>): Confidence scores for each mood
- `spectralCentroid` (number): Brightness of the sound
- `spectralFlatness` (number): Noisiness vs tonality
- `bassEnergy` (number): Bass band energy
- `midEnergy` (number): Mid band energy
- `highEnergy` (number): High band energy

**Logged every 60 frames (~1 second):**
```
[ML] genre=EDM (EDM:8.5 Rock:3.2 Pop:2.1) | mood=energetic (energetic:0.85 happy:0.45 chill:0.20 sad:0.10)
     centroid=0.342 flatness=0.156 bass=0.892 mid=0.645 high=0.234
[Smooth] history=10 | genres: EDM:7 Rock:2 Pop:1 -> EDM | moods: energetic:8 happy:2 -> energetic
```

### Debug State Access

The debug state is accessible via `getDebugState()` for UI rendering:
```typescript
const debugState = getDebugState()
// Returns:
{
  audioMetrics: AudioMetrics | null,
  bpmInfo: BpmDebugInfo | null,
  classificationInfo: ClassificationDebugInfo | null
}
```

### Debug Panel (UI)
**File:** `app/desktop/page.tsx`

The debug panel displays real-time values and can be toggled with `Ctrl+Shift+D`. It shows:
- Current BPM and status
- Beat count
- Energy levels (bass, mid, treble)
- Mood and genre classification
- Active/silence status

---

## Known Non-Issues

### Sprite 404 Errors
**Not a bug:** The application checks for frame-based sprites (e.g., `chill-1.png`, `chill-2.png`) and falls back to single sprites (`chill.png`) if they don't exist. The 404 errors are part of the feature detection logic and are handled gracefully.

**Files involved:**
- `app/desktop/page.tsx:84` - Checks for frame sprites with HEAD request
- Fallback to single sprites at `public/sprites/chill.png`, etc.
