# Vibe Buddy

A cute desktop AI companion that reacts to your music in real-time. Vibe Buddy analyzes audio from your microphone or system audio to detect BPM, genre, mood, and energy levels, then displays an animated character that dances and emotes along with your tunes.

## Audio Input Modes

Vibe Buddy supports two audio input modes, selectable via the toggle button in the top-right corner:

### Microphone Mode (Default)
- **Icon**: 🎤 Mic
- Works out of the box with no special permissions
- Captures ambient sound through your microphone
- Great for reacting to music playing through speakers
- Works on all platforms

### System Audio Mode
- **Icon**: 🖥️ Monitor
- Captures audio directly from applications (Spotify, YouTube, etc.)
- Requires Screen Recording permission on macOS
- No ambient noise interference
- Best for headphone users or quiet environments

## Features

- **Dual Audio Modes** - Switch between microphone and system audio capture
- **BPM Detection** - Detects beats per minute (50-200 BPM range) using beat detection algorithms
- **Genre Classification** - Identifies music genre (electronic, EDM, dubstep, trap, lo-fi, hip-hop, rock, pop, jazz, classical, ambient, metal, r&b, reggae, indie)
- **Mood Detection** - Classifies audio mood as chill, energetic, happy, sad, or sleep
- **Frequency Spectrum Analysis** - Monitors bass (0-250Hz), mid (250-2000Hz), and treble levels
- **Animated Character** - Bouncy sprite with physics-based animations that react to the beat
- **Desktop Widget** - Floating, always-on-top transparent window (300x350px)
- **Tray Menu** - System tray icon with quick controls
- **Global Shortcut** - Toggle visibility with `Ctrl+Shift+V` (or `Cmd+Shift+V` on Mac)
- **Transparent Mode** - Press `Ctrl+Shift+T` for a fully transparent background showing only the character
- **Mood Lock** - Lock the character to a specific mood animation via the dropdown menu
- **Custom Sprites** - Use your own character images
- **Web App Mode** - Also works in the browser with a character generator

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd cuteanimedesktopcompanion

# Install dependencies
npm install
```

## System Audio Setup

Vibe Buddy captures system audio (from Spotify, YouTube, etc.) using `electron-audio-loopback`. Setup varies by platform:

### macOS

On first launch, macOS will prompt for **Screen & System Audio Recording** permission:

1. Click "Open System Preferences" when prompted
2. Go to **Privacy & Security > Screen & System Audio Recording**
3. Enable the toggle for Vibe Buddy
4. **Restart the app** (required for permissions to take effect)

> **Note**: macOS 14.2+ uses Core Audio Taps API for zero-latency capture. Older versions use Chromium flags as fallback.

### Windows

System audio capture should work out-of-the-box on Windows 10/11 without any additional setup.

### Troubleshooting

| Issue | Solution |
|-------|----------|
| No audio detected | Check that music is playing and volume is not muted |
| Permission denied (macOS) | Grant Screen Recording permission and restart the app |
| BPM not detecting | Play music with a strong beat; BPM detection needs 2-3 seconds to stabilize |
| Wrong mood detected | The mood may take 1-2 seconds to stabilize; this is intentional to prevent flickering |

### Debug Mode

Enable debug mode to see real-time analysis metrics:

- **URL**: Add `?debug=1` to the URL
- **Keyboard**: Press `Ctrl+Shift+D` to toggle debug panel
- **Console**: Run `localStorage.setItem('VIBE_DEBUG', 'true')` and refresh

## Usage

### Desktop Mode (Electron)

Run the app as a floating desktop companion:

```bash
npm run electron-dev
```

This starts both the Next.js dev server and the Electron app. The companion will appear in the bottom-right corner of your screen.

### Web Mode

Run as a web application:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Controls

| Control | Action |
|---------|--------|
| `Ctrl/Cmd + Shift + V` | Toggle companion visibility |
| `Ctrl/Cmd + Shift + T` | Toggle transparent mode (character only, no glow/UI) |
| `Ctrl/Cmd + Shift + D` | Toggle debug panel |
| `Ctrl/Cmd + Shift + E` | Toggle expanded debug info |
| Mic/Monitor button | Toggle between microphone and system audio mode |
| Mood dropdown (top-left) | Lock mood to a specific animation |
| Tray Icon > Toggle Click-Through | Make window click-through |
| Tray Icon > Reset Position | Move back to default position |
| Drag window | Reposition the companion |

## Audio Metrics

Vibe Buddy analyzes the following metrics in real-time:

| Metric | Description | Range |
|--------|-------------|-------|
| **BPM** | Beats per minute | 50-200 |
| **Energy** | Overall loudness level | 0-100% |
| **Bass Level** | Low frequency energy (0-250Hz) | 0-100% |
| **Mid Level** | Mid frequency energy (250-2000Hz) | 0-100% |
| **Treble Level** | High frequency energy (2000Hz+) | 0-100% |
| **Genre** | Detected music genre | See list above |
| **Mood** | Emotional classification | chill, energetic, happy, sad, sleep |
| **Danceability** | How danceable the track is | 0-100% |
| **Valence** | Musical positivity | 0-100% |

## Project Structure

```
├── app/
│   ├── desktop/page.tsx     # Desktop companion UI
│   ├── popout/page.tsx      # Popout window UI
│   └── page.tsx             # Main web interface
├── components/
│   ├── music-companion.tsx  # Main web interface component
│   ├── pngtuber.tsx         # Character rendering with physics
│   ├── character-generator.tsx
│   ├── audio-visualizer.tsx
│   └── particles.tsx
├── electron/
│   └── main.js              # Electron app setup
├── hooks/
│   └── use-audio-capture.ts # Core audio analysis hook
├── lib/
│   └── audio-ml.ts          # ML heuristics for genre/mood
└── public/
    └── sprites/             # Character sprite images
        ├── chill.png
        ├── energetic.png
        ├── happy.png
        ├── sad.png
        └── sleep.png
```

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 16
- **Desktop**: [Electron](https://www.electronjs.org/) 40
- **UI**: [Tailwind CSS](https://tailwindcss.com/) 4, [Radix UI](https://www.radix-ui.com/)
- **Audio**: Web Audio API, [realtime-bpm-analyzer](https://www.npmjs.com/package/realtime-bpm-analyzer), [electron-audio-loopback](https://www.npmjs.com/package/electron-audio-loopback)
- **Language**: TypeScript

## Customization

### Custom Sprites

Replace the sprite images in `public/sprites/` with your own:

**Single sprites** (fallback):
- `chill.png` - Displayed when mood is "chill"
- `energetic.png` - Displayed when mood is "energetic"
- `happy.png` - Displayed when mood is "happy"
- `sad.png` - Displayed when mood is "sad"
- `sleep.png` - Displayed when mood is "sleep"

**Animated sprites** (4 frames per mood):
- `chill-1.png` through `chill-4.png`
- `happy-1.png` through `happy-4.png`
- `sad-1.png` through `sad-4.png`
- `energetic-1.png` through `energetic-4.png`
- `sleep-1.png` through `sleep-4.png`

Recommended size: 200x200px with transparent background.

### Tray Icon

Replace `electron/icon.png` with your own tray icon.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build for production |
| `npm run electron-dev` | Run Electron with Next.js dev server |
| `npm run electron` | Run Electron (requires built app) |
| `npm run lint` | Run ESLint |