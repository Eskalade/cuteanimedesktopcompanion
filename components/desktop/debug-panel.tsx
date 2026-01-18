"use client"

import type React from "react"
import type { AudioData } from "@/hooks/use-audio-capture"
import { getDebugState } from "@/lib/audio-debug"

interface DebugPanelProps {
   audioData: AudioData
   spriteError: string | null
   showControls: boolean
   spritesLoaded: boolean
   hasFrameSprites: boolean
   expanded: boolean
   onToggleExpanded: () => void
}

export function DebugPanel({
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

   const moodScores = classificationInfo?.moodScores || {}

   return (
      <div
         className={`absolute ${spriteError && showControls ? "top-24" : "top-12"} left-2 right-2 bg-black/90 rounded-lg p-2 text-xs font-mono text-white/90 space-y-1 max-h-[70vh] overflow-y-auto`}
         style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
         <div className="flex justify-between items-center border-b border-white/20 pb-1 mb-1">
            <span className="text-white/50">Debug (Ctrl+Shift+D to toggle)</span>
            <button
               onClick={onToggleExpanded}
               className="text-white/50 hover:text-white text-[10px] px-1"
            >
               {expanded ? "[-]" : "[+]"}
            </button>
         </div>

         <div className="flex justify-between">
            <span>Audio:</span>
            <span className={audioData.maxFrequency > 10 ? "text-green-400" : "text-red-400"}>
               {audioData.maxFrequency > 10 ? `YES (max: ${audioData.maxFrequency})` : `NO (noise: ${audioData.maxFrequency})`}
            </span>
         </div>

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
            </>
         )}

         <div className="border-t border-white/20 pt-1 mt-1 flex justify-between gap-2">
            <div className="flex items-center gap-1">
               <span>Active:</span>
               <span className={audioData.isActive ? "text-green-400" : "text-red-400"}>
                  {audioData.isActive ? "YES" : "NO"}
               </span>
            </div>
            <div className="flex items-center gap-1">
               <span>Beat:</span>
               <div className="relative">
                  <div className={`w-3 h-3 rounded-full transition-all duration-100 ${audioData.beat
                        ? "bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.6)]"
                        : "bg-white/20"
                     }`} />
                  {audioData.beat && (
                     <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping" />
                  )}
               </div>
            </div>
            <div className="flex items-center gap-1">
               <span>Sprites:</span>
               <span className={spritesLoaded ? "text-green-400" : "text-red-400"}>
                  {hasFrameSprites ? "Frames" : spritesLoaded ? "Single" : "None"}
               </span>
            </div>
         </div>

         {expanded && (
            <div className="text-[10px] text-white/40 pt-1 border-t border-white/20 mt-1">
               Enable console logs: localStorage.setItem('VIBE_DEBUG', 'true')
            </div>
         )}
      </div>
   )
}
