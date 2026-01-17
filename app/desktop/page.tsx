"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useAudioCapture, type AudioData, type Mood, type AudioMode } from "@/hooks/use-audio-capture"

type MoodLock = "auto" | Mood
import { GripVertical, Bug, ImageIcon, Mic, Monitor } from "lucide-react"
import { getDebugState, isDebugEnabled } from "@/lib/audio-debug"

const SPRITE_FRAMES: Record<Mood, string[]> = {
  chill: [
    "/sprites/chill-1.png",
    "/sprites/chill-2.png",
    "/sprites/chill-3.png",
    "/sprites/chill-4.png",
  ],
  happy: [
    "/sprites/happy-1.png",
    "/sprites/happy-2.png",
    "/sprites/happy-3.png",
    "/sprites/happy-4.png",
  ],
  sad: [
    "/sprites/sad-1.png",
    "/sprites/sad-2.png",
    "/sprites/sad-3.png",
    "/sprites/sad-4.png",
  ],
  energetic: [
    "/sprites/energetic-1.png",
    "/sprites/energetic-2.png",
    "/sprites/energetic-3.png",
    "/sprites/energetic-4.png",
  ],
  sleep: [
    "/sprites/sleep-1.png",
    "/sprites/sleep-2.png",
    "/sprites/sleep-3.png",
    "/sprites/sleep-4.png",
  ],
}

// Fallback single sprites if frames not available
const MOOD_SPRITES: Record<Mood, string> = {
  chill: "/sprites/chill.png",
  happy: "/sprites/happy.png",
  sad: "/sprites/sad.png",
  energetic: "/sprites/energetic.png",
  sleep: "/sprites/sleep-1.png",
}

const FRAME_SPEEDS: Record<Mood, number> = {
  chill: 800, // Slow gentle sway
  happy: 200, // Bouncy
  sad: 1200, // Very slow breathing
  energetic: 100, // Fast headbang
  sleep: 1800, // Very slow breathing animation
}

export default function DesktopPage() {
  const [showControls, setShowControls] = useState(false)
  const [useCustomSprites, setUseCustomSprites] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [debugExpanded, setDebugExpanded] = useState(false)
  const [spritesLoaded, setSpritesLoaded] = useState(false)
  const [hasFrameSprites, setHasFrameSprites] = useState(false)
  const [spriteError, setSpriteError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<AudioMode>("microphone")
  const [moodLock, setMoodLock] = useState<MoodLock>("auto")
  const [transparentMode, setTransparentMode] = useState(false)
  const { isListening, audioData, error, startCapture, stopCapture } = useAudioCapture(inputMode)

  // Toggle debug with keyboard shortcut (Ctrl+Shift+D)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
      setShowDebug((prev) => !prev)
      e.preventDefault()
    }
    // Toggle expanded debug with Ctrl+Shift+E
    if (e.ctrlKey && e.shiftKey && e.key === "E") {
      setDebugExpanded((prev) => !prev)
      e.preventDefault()
    }
    // Toggle transparent mode with Ctrl+Shift+T
    if (e.ctrlKey && e.shiftKey && e.key === "T") {
      setTransparentMode((prev) => !prev)
      e.preventDefault()
    }
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // Apply transparent background class for Electron window transparency
  useEffect(() => {
    document.documentElement.classList.add('electron-transparent')
    return () => {
      document.documentElement.classList.remove('electron-transparent')
    }
  }, [])

  useEffect(() => {
    const checkSprites = async () => {
      // Check single sprites
      try {
        const response = await fetch(MOOD_SPRITES.chill, { method: "HEAD" })
        if (response.ok) {
          setSpritesLoaded(true)
          setSpriteError(null)
        } else {
          throw new Error("Single sprites not found")
        }
      } catch {
        setSpritesLoaded(false)
        setSpriteError("Add sprites to /public/sprites/ (chill.png, happy.png, sad.png, energetic.png)")
        setUseCustomSprites(false)
      }

      // Check frame sprites
      try {
        const response = await fetch(SPRITE_FRAMES.chill[0], { method: "HEAD" })
        if (response.ok) {
          setHasFrameSprites(true)
        }
      } catch {
        setHasFrameSprites(false)
      }
    }
    checkSprites()
  }, [])

  return (
    <div
      className="w-full h-screen bg-transparent overflow-hidden select-none"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Drag handle - hidden in transparent mode */}
      {!transparentMode && (
        <div
          className="absolute top-2 left-0 right-0 h-6 sm:h-8 flex items-center justify-center cursor-move"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <GripVertical
            className={`w-6 h-6 sm:w-8 sm:h-8 text-white/50`}
          />
        </div>
      )}

      {/* Mood lock dropdown - left side, hidden in transparent mode */}
      {!transparentMode && (
        <div
          className={`absolute top-2 left-2 transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <select
            value={moodLock}
            onChange={(e) => setMoodLock(e.target.value as MoodLock)}
            className="p-2 rounded-full bg-black/50 text-white/70 text-sm border-none outline-none cursor-pointer"
            title="Lock mood animation"
          >
            <option value="auto">Auto</option>
            <option value="energetic">Energetic</option>
            <option value="happy">Happy</option>
            <option value="chill">Chill</option>
            <option value="sad">Sad</option>
            <option value="sleep">Sleep</option>
          </select>
        </div>
      )}

      {/* Mini controls - right side, hidden in transparent mode */}
      {!transparentMode && (
        <div
          className={`absolute top-2 right-2 flex gap-1 sm:gap-2 transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={() => setInputMode(inputMode === "microphone" ? "system" : "microphone")}
            className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-all ${inputMode === "system" ? "bg-purple-500/70 text-white" : "bg-black/50 hover:bg-black/70 text-white/70 hover:text-white"}`}
            title={inputMode === "microphone" ? "Switch to System Audio" : "Switch to Microphone"}
          >
            {inputMode === "microphone" ? <Mic className="w-6 h-6 sm:w-8 sm:h-8" /> : <Monitor className="w-6 h-6 sm:w-8 sm:h-8" />}
          </button>
          <button
            onClick={() => spritesLoaded && setUseCustomSprites(!useCustomSprites)}
            className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-all ${spritesLoaded
              ? useCustomSprites
                ? "bg-green-500/70 text-white"
                : "bg-black/50 hover:bg-black/70 text-white/70 hover:text-white"
              : "bg-red-500/50 text-white/50 cursor-not-allowed"
              }`}
            title={spritesLoaded ? "Toggle custom sprites" : "Add sprites to /public/sprites/"}
          >
            <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-all ${showDebug ? "bg-yellow-500/70 text-black" : "bg-black/50 hover:bg-black/70 text-white/70 hover:text-white"}`}
            title="Toggle debug info"
          >
            <Bug className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        </div>
      )}

      {!transparentMode && spriteError && showControls && (
        <div
          className="absolute top-10 left-2 right-2 bg-orange-500/90 text-white text-xs p-2 rounded"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {spriteError}
        </div>
      )}

      {/* Debug panel - hidden in transparent mode */}
      {!transparentMode && showDebug && isListening && (
        <DebugPanel
          audioData={audioData}
          spriteError={spriteError}
          showControls={showControls}
          spritesLoaded={spritesLoaded}
          hasFrameSprites={hasFrameSprites}
          expanded={debugExpanded}
          onToggleExpanded={() => setDebugExpanded(!debugExpanded)}
        />
      )}

      {/* Character */}
      <div className={`w-full h-full flex items-center justify-center ${showDebug && isListening ? "pt-40" : "pt-4"}`}>
        <DesktopBuddy
          audioData={audioData}
          isActive={isListening}
          useCustomSprites={useCustomSprites && spritesLoaded}
          hasFrameSprites={hasFrameSprites}
          moodLock={moodLock}
          transparentMode={transparentMode}
        />
      </div>

      {/* Start/Stop button - hidden in transparent mode */}
      {!transparentMode && (
        <div
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-opacity ${showControls || !isListening ? "opacity-100" : "opacity-0"}`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={() => (isListening ? stopCapture() : startCapture())}
            className={`px-5 py-1.5 sm:px-7 sm:py-2 md:px-9 md:py-2.5 rounded-full text-base sm:text-lg font-medium transition-all ${isListening
              ? "bg-red-500/80 hover:bg-red-500 text-white"
              : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
              }`}
          >
            {isListening ? "Stop" : "Start Vibing"}
          </button>
        </div>
      )}

      {!transparentMode && error && (
        <div className="absolute bottom-16 left-2 right-2 bg-red-500/80 text-white text-xs p-2 rounded">{error}</div>
      )}
    </div>
  )
}

interface DesktopBuddyProps {
  audioData: AudioData
  isActive: boolean
  useCustomSprites: boolean
  hasFrameSprites: boolean
  moodLock: MoodLock
  transparentMode: boolean
}

function DesktopBuddy({ audioData, isActive, useCustomSprites, hasFrameSprites, moodLock, transparentMode }: DesktopBuddyProps) {
  // Compute effective mood: use locked mood if set, otherwise use detected mood
  const effectiveMood = moodLock !== "auto" ? moodLock : audioData.mood

  const [currentFrame, setCurrentFrame] = useState(0)
  const [bounce, setBounce] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [scale, setScale] = useState({ x: 1, y: 1 })

  const frameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const animationRef = useRef<number | null>(null)
  const timeRef = useRef(0)
  const lastBeatRef = useRef(0)
  const bounceVelocityRef = useRef(0)
  const bouncePositionRef = useRef(0)
  const rotationRef = useRef(0)

  useEffect(() => {
    if (!isActive || !audioData.isActive) {
      setBounce(0)
      setRotation(0)
      setScale({ x: 1, y: 1 })
      setCurrentFrame(0)
      bounceVelocityRef.current = 0
      bouncePositionRef.current = 0
      rotationRef.current = 0
    }
  }, [isActive, audioData.isActive])

  useEffect(() => {
    if (!isActive || !hasFrameSprites) return

    const frames = SPRITE_FRAMES[effectiveMood]
    const baseSpeed = FRAME_SPEEDS[effectiveMood]

    // Sync frame speed to BPM if available
    const bpmSpeed = audioData.bpm > 0 ? 60000 / audioData.bpm / frames.length : baseSpeed
    const speed = Math.max(80, Math.min(bpmSpeed, baseSpeed)) // Clamp between 80ms and base speed

    frameTimerRef.current = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % frames.length)
    }, speed)

    return () => {
      if (frameTimerRef.current) clearInterval(frameTimerRef.current)
    }
  }, [isActive, effectiveMood, audioData.bpm, hasFrameSprites])

  // Beat reaction
  useEffect(() => {
    if (audioData.beat && isActive) {
      lastBeatRef.current = Date.now()

      const intensity =
        effectiveMood === "energetic" ? -40 : effectiveMood === "happy" ? -25 : effectiveMood === "sad" ? -5 : effectiveMood === "sleep" ? -2 : -15

      bounceVelocityRef.current = intensity * (0.8 + audioData.energy * 0.5)
    }
  }, [audioData.beat, audioData.energy, effectiveMood, isActive])

  // Physics animation loop
  useEffect(() => {
    if (!isActive) return

    const animate = () => {
      timeRef.current += 16

      // Spring physics for bounce
      const springStrength = 0.15
      const damping = 0.8
      bounceVelocityRef.current += -bouncePositionRef.current * springStrength
      bounceVelocityRef.current *= damping
      bouncePositionRef.current += bounceVelocityRef.current

      // Gentle idle sway based on mood
      let idleRotation = 0
      if (effectiveMood === "energetic") {
        idleRotation = Math.sin(timeRef.current / 150) * 12
      } else if (effectiveMood === "happy") {
        idleRotation = Math.sin(timeRef.current / 300) * 8
      } else if (effectiveMood === "chill") {
        idleRotation = Math.sin(timeRef.current / 800) * 5
      } else if (effectiveMood === "sleep") {
        idleRotation = Math.sin(timeRef.current / 2000) * 2 // Very slow, minimal movement
      } else {
        idleRotation = Math.sin(timeRef.current / 1500) * 2
      }

      rotationRef.current += (idleRotation - rotationRef.current) * 0.1

      // Squash and stretch
      const squashAmount = Math.abs(bouncePositionRef.current) * 0.012
      const scaleY = 1 - squashAmount * 0.5
      const scaleX = 1 + squashAmount * 0.3
      const breathe = 1 + Math.sin(timeRef.current / 600) * 0.02

      setBounce(bouncePositionRef.current)
      setRotation(rotationRef.current)
      setScale({ x: scaleX * breathe, y: scaleY * breathe })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isActive, effectiveMood])

  const glowColors: Record<Mood, string> = {
    chill: "rgba(34, 211, 238, 0.5)",
    happy: "rgba(250, 204, 21, 0.5)",
    sad: "rgba(129, 140, 248, 0.4)",
    energetic: "rgba(251, 146, 60, 0.6)",
    sleep: "rgba(147, 112, 219, 0.3)", // Soft muted purple
  }

  const getCurrentSprite = () => {
    if (hasFrameSprites) {
      const frames = SPRITE_FRAMES[effectiveMood]
      return frames[currentFrame] || frames[0]
    }
    return MOOD_SPRITES[effectiveMood]
  }

  if (useCustomSprites) {
    return (
      <div className="relative">
        {/* Glow effect - hidden in transparent mode */}
        {!transparentMode && (
          <div
            className="absolute inset-0 rounded-full blur-3xl"
            style={{
              backgroundColor: glowColors[effectiveMood],
              transform: `scale(${1.5 + audioData.energy * 0.8 + (audioData.beat ? 0.3 : 0)})`,
              opacity: 0.6 + audioData.energy * 0.4,
              transition: "background-color 0.5s ease-out, transform 0.1s ease-out",
            }}
          />
        )}

        {/* Animated sprite */}
        <div
          className="relative w-48 h-48"
          style={{
            transformOrigin: "center bottom",
            transform: `
              translateY(${bounce}px)
              rotate(${rotation}deg)
              scaleX(${scale.x})
              scaleY(${scale.y})
            `,
          }}
        >
          <img
            src={getCurrentSprite() || "/placeholder.svg"}
            alt={`${effectiveMood} buddy`}
            className="w-full h-full object-contain"
            style={{
              filter: transparentMode ? "none" : `drop-shadow(0 0 ${15 + audioData.energy * 20}px ${glowColors[effectiveMood]})`,
            }}
            onError={(e) => {
              // Fallback to single sprite if frame not found
              e.currentTarget.src = MOOD_SPRITES[effectiveMood]
            }}
          />
        </div>
      </div>
    )
  }

  // Default blob character (same as before)
  return (
    <div
      className="relative"
      style={{
        transform: `translateY(${bounce}px) rotate(${rotation}deg) scaleX(${scale.x}) scaleY(${scale.y})`,
      }}
    >
      {/* Glow - hidden in transparent mode */}
      {!transparentMode && (
        <div
          className="absolute inset-0 rounded-full blur-2xl transition-all duration-500"
          style={{
            backgroundColor: glowColors[effectiveMood],
            transform: `scale(${1.2 + audioData.energy * 0.3})`,
          }}
        />
      )}
      <div
        className={`relative w-40 h-40 rounded-full transition-all duration-500 ${transparentMode
          ? "bg-transparent"
          : effectiveMood === "chill"
            ? "bg-linear-to-br from-cyan-400 to-blue-500"
            : effectiveMood === "happy"
              ? "bg-linear-to-br from-yellow-400 to-amber-500"
              : effectiveMood === "sad"
                ? "bg-linear-to-t from-indigo-400 to-purple-500"
                : effectiveMood === "sleep"
                  ? "bg-linear-to-br from-purple-300 to-indigo-400"
                  : "bg-linear-to-br from-orange-400 to-red-500"
          }`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex gap-6 -mt-2">
            <BlobEye mood={effectiveMood} beat={audioData.beat} />
            <BlobEye mood={effectiveMood} beat={audioData.beat} />
          </div>
          <div className="mt-3">
            <BlobMouth mood={effectiveMood} />
          </div>
          {(effectiveMood === "happy" || effectiveMood === "energetic") && (
            <>
              <div className="absolute left-5 top-1/2 w-5 h-2.5 rounded-full bg-pink-400/40" />
              <div className="absolute right-5 top-1/2 w-5 h-2.5 rounded-full bg-pink-400/40" />
            </>
          )}
        </div>
        {/* Headphones */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-44">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 border-t-[6px] border-slate-700 rounded-t-full" />
          <div className="absolute -left-1 top-3 w-8 h-10 bg-slate-700 rounded-lg">
            <div className="absolute inset-1 bg-slate-600 rounded" />
          </div>
          <div className="absolute -right-1 top-3 w-8 h-10 bg-slate-700 rounded-lg">
            <div className="absolute inset-1 bg-slate-600 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

function BlobEye({ mood, beat }: { mood: Mood; beat: boolean }) {
  const [blink, setBlink] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setBlink(true)
        setTimeout(() => setBlink(false), 150)
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const squeezed = (beat && mood === "energetic") || blink

  if (mood === "sad") {
    return (
      <div className="relative">
        <div className={`w-5 ${squeezed ? "h-0.5" : "h-3"} bg-slate-800 rounded-full transition-all`} />
        <div className="absolute -top-1.5 w-6 h-0.5 bg-slate-700 rounded-full -rotate-12" />
      </div>
    )
  }

  return (
    <div
      className={`w-5 ${squeezed ? "h-0.5" : mood === "happy" ? "h-4" : "h-5"} bg-slate-800 rounded-full transition-all relative`}
    >
      {!squeezed && <div className="absolute top-0.5 left-1 w-1.5 h-1.5 bg-white rounded-full" />}
    </div>
  )
}

function BlobMouth({ mood }: { mood: Mood }) {
  if (mood === "sad") {
    return <div className="w-6 h-3 border-b-[3px] border-slate-800 rounded-b-full rotate-180" />
  }
  if (mood === "energetic") {
    return (
      <div className="w-8 h-5 bg-slate-800 rounded-full flex items-end justify-center pb-0.5">
        <div className="w-5 h-1.5 bg-pink-400 rounded-full" />
      </div>
    )
  }
  if (mood === "happy") {
    return <div className="w-8 h-4 border-b-[3px] border-slate-800 rounded-b-full" />
  }
  return <div className="w-5 h-2 border-b-[3px] border-slate-800 rounded-b-full" />
}

interface DebugPanelProps {
  audioData: AudioData
  spriteError: string | null
  showControls: boolean
  spritesLoaded: boolean
  hasFrameSprites: boolean
  expanded: boolean
  onToggleExpanded: () => void
}

function DebugPanel({
  audioData,
  spriteError,
  showControls,
  spritesLoaded,
  hasFrameSprites,
  expanded,
  onToggleExpanded,
}: DebugPanelProps) {
  const debugState = getDebugState()
  const bpmInfo = debugState.bpmInfo
  const classificationInfo = debugState.classificationInfo

  // Get mood scores for display
  const moodScores = classificationInfo?.moodScores || {}

  return (
    <div
      className={`absolute ${spriteError && showControls ? "top-24" : "top-12"} left-2 right-2 bg-black/90 rounded-lg p-2 text-xs font-mono text-white/90 space-y-1 max-h-[70vh] overflow-y-auto`}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {/* Header with expand toggle */}
      <div className="flex justify-between items-center border-b border-white/20 pb-1 mb-1">
        <span className="text-white/50">Debug (Ctrl+Shift+D to toggle)</span>
        <button
          onClick={onToggleExpanded}
          className="text-white/50 hover:text-white text-[10px] px-1"
        >
          {expanded ? "[-]" : "[+]"}
        </button>
      </div>

      {/* Audio Presence Indicator */}
      <div className="flex justify-between">
        <span>Audio:</span>
        <span className={audioData.maxFrequency > 10 ? "text-green-400" : "text-red-400"}>
          {audioData.maxFrequency > 10 ? `YES (max: ${audioData.maxFrequency})` : `NO (noise: ${audioData.maxFrequency})`}
        </span>
      </div>

      {/* BPM Section with Status */}
      <div className="flex justify-between">
        <span>BPM:</span>
        <span className={audioData.bpm > 0 ? "text-green-400" : "text-yellow-400"}>
          {audioData.bpm > 0
            ? audioData.bpm
            : audioData.bpmStatus === 'warming-up'
              ? 'warming up...'
              : audioData.bpmStatus === 'stabilizing'
                ? `stabilizing (${audioData.beatCount} beats)`
                : audioData.bpmStatus === 'lost'
                  ? 'lost (was ' + (bpmInfo?.currentBpm || '?') + ')'
                  : 'detecting...'}
        </span>
      </div>
      {expanded && bpmInfo && (
        <div className="pl-2 text-[10px] text-white/60 space-y-0.5">
          <div>Custom: {bpmInfo.currentBpm} | Realtime: {bpmInfo.realtimeBpm}</div>
          <div>Beats: {bpmInfo.beatCount} | Threshold: {bpmInfo.threshold.toFixed(3)}</div>
          <div>Status: {audioData.bpmStatus}</div>
        </div>
      )}

      {/* Mood Section */}
      <div className="flex justify-between">
        <span>Mood:</span>
        <span
          className={`${audioData.mood === "chill"
            ? "text-blue-400"
            : audioData.mood === "happy"
              ? "text-yellow-400"
              : audioData.mood === "sad"
                ? "text-purple-400"
                : "text-orange-400"
            }`}
        >
          {audioData.mood}
          <span className="text-white/40 ml-1">({(audioData.moodConfidence * 100).toFixed(0)}%)</span>
        </span>
      </div>
      {expanded && Object.keys(moodScores).length > 0 && (
        <div className="pl-2 text-[10px] text-white/60 flex gap-2">
          {Object.entries(moodScores).map(([m, s]) => (
            <span key={m} className={m === audioData.mood ? "text-white/80" : ""}>
              {m}: {(s as number).toFixed(2)}
            </span>
          ))}
        </div>
      )}

      {/* Energy Bar */}
      <div className="flex justify-between items-center">
        <span>Energy:</span>
        <div className="flex items-center gap-1">
          <div className="w-16 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400"
              style={{ width: `${audioData.energy * 100}%` }}
            />
          </div>
          <span className="text-white/60 w-8 text-right">{(audioData.energy * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Expanded metrics */}
      {expanded && classificationInfo && (
        <>
          <div className="border-t border-white/20 pt-1 mt-1">
            <div className="text-white/50 mb-1">Spectral Analysis</div>
            <div className="flex justify-between">
              <span>Centroid:</span>
              <span>{classificationInfo.spectralCentroid.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Flatness:</span>
              <span>{classificationInfo.spectralFlatness.toFixed(3)}</span>
            </div>
          </div>
          <div className="border-t border-white/20 pt-1 mt-1">
            <div className="text-white/50 mb-1">Additional</div>
            <div className="flex justify-between">
              <span>Valence:</span>
              <span>{(audioData.valence * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="border-t border-white/20 pt-1 mt-1">
            <div className="text-white/50 mb-1">Waveform</div>
            <div className="relative h-16 bg-black/30 rounded">
              <canvas
                ref={(canvas) => {
                  if (!canvas) return
                  const ctx = canvas.getContext("2d")
                  if (!ctx) return

                  const width = canvas.width
                  const height = canvas.height

                  ctx.clearRect(0, 0, width, height)

                  if (!audioData.isActive || !audioData.frequencyData || audioData.frequencyData.length === 0) return

                  const barCount = audioData.frequencyData.length
                  const barWidth = width / barCount
                  const gap = 1

                  audioData.frequencyData.forEach((value, i) => {
                    const normalizedValue = value / 255
                    const barHeight = Math.min(height, normalizedValue * height) // Natural height without stretching

                    const x = i * barWidth
                    const y = height - barHeight

                    const hue = 270
                    const opacity = 0.3 + normalizedValue * 0.6

                    ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${opacity})`
                    ctx.fillRect(x, y, barWidth - gap, barHeight)
                  })
                }}
                width={300}
                height={64}
                className="w-full h-full"
              />
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              Samples: {audioData.frequencyData?.length || 0}
            </div>
          </div>
        </>
      )}

      {/* Status indicators */}
      <div className="border-t border-white/20 pt-1 mt-1 flex justify-between gap-2">
        <div className="flex items-center gap-1">
          <span>Active:</span>
          <span className={audioData.isActive ? "text-green-400" : "text-red-400"}>
            {audioData.isActive ? "YES" : "NO"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>Beat:</span>
          <span className={audioData.beat ? "text-green-400" : "text-white/40"}>
            {audioData.beat ? "!" : "-"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>Sprites:</span>
          <span className={spritesLoaded ? "text-green-400" : "text-red-400"}>
            {hasFrameSprites ? "Frames" : spritesLoaded ? "Single" : "None"}
          </span>
        </div>
      </div>

      {/* Console logging hint */}
      {expanded && (
        <div className="text-[10px] text-white/40 pt-1 border-t border-white/20 mt-1">
          Enable console logs: localStorage.setItem('VIBE_DEBUG', 'true')
        </div>
      )}
    </div>
  )
}
