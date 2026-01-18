# Moeko-chan 🎵

Moeko-chan is a cute desktop companion that lives on your screen and vibes to your music in real-time. Using advanced audio analysis, Moeko-chan detects the BPM, mood, and energy of whatever you're listening to, changing her expressions and dance moves to match your flow.

## ✨ Features

- **🎨 Immersive Desktop Spirit** – Moeko-chan floats on your desktop as a transparent, always-on-top widget. She sits above your code, your games, and your browser!
- **🧠 Intelligent Mood Sync** – Using real-time ML heuristics, Moeko-chan transitions between 5 distinct moods: **Chill, Energetic, Happy, Sad,** and **Sleep**.
- **🥁 Custom BPM Engine** – Built with a high-accuracy bass-isolation filter. By ignoring vocals and melodies, Moeko-chan "hears" the kick drum, ensuring her bounces are perfectly in sync with the beat.
- **💤 Signature Sleep Mode** – If the room goes quiet for more than 5 seconds, Moeko-chan will close her eyes and drift into a slow breathing animation until the music starts again.
- **👁️ Immersive Mode** – Press `Ctrl + L` to hide all UI buttons and her background glow. Moeko-chan becomes a clean, floating sticker on your screen for maximum cuteness.
- **✨ Physics-Based Animation** – Moeko-chan uses spring physics for her bops and squashes, making her feel soft, squishy, and alive.

## ⌨️ Controls & Hotkeys

| Control | Action |
|---------|--------|
| `Ctrl + L` | **Toggle Immersive Mode** (Hides UI & Background Glow) |
| `Ctrl + Shift + D` | **Toggle Moeko's Brain** (Debug Panel) |
| `Ctrl + Shift + E` | **Expand Brain Metrics** (Waveform & Spectral Data) |
| **Eye Icon** | Toggle Immersive Mode manually |
| **Start/Stop Button** | Wake Moeko-chan up and start the audio analysis |

---

## 🚀 Installation & Setup

### 1. Clone & Install
```bash
git clone https://github.com/Eskalade/moeko-chan
cd cuteanimedesktopcompanion
npm install
```

### 2. Run Moeko-chan
### Desktop Companion Mode (Recommended)
```bash
npm run electron-dev
```
### Web Mode (Browser Only)
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
| **Mood** | Emotional classification | chill, energetic, happy, sleep |
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
- **Audio Processing**: Custom Web Audio API graph featuring:
    Biquad Low-Pass Filter: Set at 130Hz to isolate kick drums from vocal noise.
    Adaptive Peak Detection: Dynamically adjusts thresholding based on the song's volume.
    Median-Interval Filtering: Uses the median of the last 12 beats to calculate stable BPM.
- **Language**: TypeScript

## Customization

### Custom Sprites

Replace the sprite images in `public/sprites/` with your own:

**Single sprites** (fallback):
- `chill.png` - Displayed when mood is "chill"
- `energetic.png` - Displayed when mood is "energetic"
- `happy.png` - Displayed when mood is "happy"
- `sleep.png` - Displayed when mood is "sleep"

**Animated sprites** (4 frames per mood):
- `chill-1.png` through `chill-4.png`
- `happy-1.png` through `happy-4.png`
- `energetic-1.png` through `energetic-4.png`
- `sleep-1.png` through `sleep-4.png`

Recommended size: 200x200px with transparent background.

### Tray Icon

Replace `electron/icon.png` with your own tray icon.

## 🌸 "Because every desktop deserves a little more moe."
Moeko-chan was built with ❤️ for hacknroll'26.
