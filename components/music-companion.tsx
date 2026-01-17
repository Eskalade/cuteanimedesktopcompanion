"use client"

import { useState } from "react"
import { useAudioCapture, type AudioMode } from "@/hooks/use-audio-capture"
import { PNGTuber } from "./pngtuber"
import { AudioVisualizer } from "./audio-visualizer"
import { Particles } from "./particles"
import { Waveform } from "./waveform"
import { CharacterGenerator } from "./character-generator"
import { Button } from "@/components/ui/button"
import { MonitorSpeaker, Square, Mic, ExternalLink, Sparkles } from "lucide-react"

export type Mood = "chill" | "energetic" | "sad" | "happy" | "sleep"

export interface AudioData {
  bpm: number
  mood: Mood
  energy: number
  beat: boolean
}

export function MusicCompanion() {
  const { isListening, audioData: rawAudioData, error, startCapture, stopCapture } = useAudioCapture()
  const [isPopped, setIsPopped] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [customCharacter, setCustomCharacter] = useState<string | null>(null)

  const audioData: AudioData = {
    bpm: rawAudioData.bpm,
    bpmStatus: rawAudioData.bpmStatus,
    beatCount: rawAudioData.beatCount,
    mood: rawAudioData.mood,
    energy: rawAudioData.energy,
    beat: rawAudioData.beat,
    isActive: rawAudioData.isActive,
    valence: rawAudioData.valence,
    moodConfidence: rawAudioData.moodConfidence,
    maxFrequency: rawAudioData.maxFrequency,
    frequencyData: rawAudioData.frequencyData,
  }

  const moodConfidence = rawAudioData.moodConfidence || 0

  const handleStart = (mode: AudioMode) => {
    startCapture(mode)
  }

  const handlePopOut = () => {
    const width = 400
    const height = 600
    const left = window.screen.width - width - 50
    const top = 50

    const popup = window.open(
      "/popout",
      "VibeBuddy",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no,resizable=yes`,
    )

    if (popup) {
      setIsPopped(true)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-2">Vibe Buddy</h1>
        <p className="text-muted-foreground">Your AI-powered musical companion that vibes with you</p>
      </div>

      {/* Character Display */}
      <div className="relative w-80 h-80">
        <Waveform frequencyData={rawAudioData.frequencyData} isActive={isListening} />
        <Particles audioData={audioData} isActive={isListening} />
        <PNGTuber audioData={audioData} isActive={isListening} customImage={customCharacter} />
      </div>

      {/* Audio Visualizer */}
      <AudioVisualizer audioData={audioData} isActive={isListening} />

      {/* Stats Display - reorganized with ML-based mood with confidence */}
      <div className="flex gap-3 text-center flex-wrap justify-center">
        <div className="bg-card/50 rounded-xl px-5 py-3 backdrop-blur border border-border">
          <p className="text-2xl font-bold text-foreground">{audioData.bpm || "—"}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">BPM</p>
        </div>
        <div className="bg-card/50 rounded-xl px-5 py-3 backdrop-blur border border-border">
          <p className="text-2xl font-bold text-foreground capitalize">{audioData.mood}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Mood {moodConfidence > 0 && <span className="text-primary">({Math.round(moodConfidence * 100)}%)</span>}
          </p>
        </div>
        <div className="bg-card/50 rounded-xl px-5 py-3 backdrop-blur border border-border">
          <p className="text-2xl font-bold text-foreground">{Math.round(audioData.energy * 100)}%</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Energy</p>
        </div>
      </div>

      {/* Controls - removed manual identify button */}
      <div className="flex flex-col items-center gap-4">
        {!isListening ? (
          <div className="flex gap-3 flex-wrap justify-center">
            <Button
              size="lg"
              onClick={() => handleStart("microphone")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-6 text-lg rounded-full"
            >
              <Mic className="mr-2 h-5 w-5" />
              Use Microphone
            </Button>
            <Button
              size="lg"
              onClick={() => handleStart("system")}
              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-6 text-lg rounded-full"
            >
              <MonitorSpeaker className="mr-2 h-5 w-5" />
              Share Tab Audio
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap justify-center">
            <Button size="lg" variant="destructive" onClick={stopCapture} className="px-8 py-6 text-lg rounded-full">
              <Square className="mr-2 h-5 w-5" />
              Stop
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handlePopOut}
              className="px-6 py-6 text-lg rounded-full bg-transparent"
              title="Open in floating window"
            >
              <ExternalLink className="h-5 w-5" />
            </Button>
          </div>
        )}

        <Button variant="outline" onClick={() => setShowGenerator(true)} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {customCharacter ? "Change Character" : "Generate AI Character"}
        </Button>

        {error && <p className="text-destructive text-sm text-center max-w-md">{error}</p>}

        <p className="text-muted-foreground text-sm text-center max-w-md">
          {isListening
            ? "Analyzing audio with ML... Play some music!"
            : "Use Microphone to listen via speakers, or Share Tab Audio for direct capture."}
        </p>

        {isPopped && <p className="text-emerald-400 text-sm">Vibe Buddy opened in a new window!</p>}
      </div>

      {showGenerator && (
        <CharacterGenerator onCharacterGenerated={setCustomCharacter} onClose={() => setShowGenerator(false)} />
      )}
    </div>
  )
}
