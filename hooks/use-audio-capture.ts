"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { createRealTimeBpmProcessor } from "realtime-bpm-analyzer"
import {
	analyzeAudioFeatures,
	getSmoothedPrediction,
	resetPredictionHistory
} from "@/lib/audio-ml"
import {
	logAudioMetrics,
	logBpmDetection,
	logBeat,
	logBpmReset,
	logRealtimeBpmUpdate,
	updateDebugState,
	resetDebugState,
	type AudioMetrics,
	type BpmDebugInfo
} from "@/lib/audio-debug"

// Debug mode: enable via URL param ?debug=1 or localStorage
const isVerboseDebug = false

const showSpeechDetectionDebug = true

// Throttle counter for verbose logging (every 30 frames ~0.5s)
let debugFrameCount = 0
const DEBUG_LOG_INTERVAL = 30

// Unified audio settings
const AUDIO_MULTIPLIER = 5
const SILENCE_THRESHOLD = 0.03

// BPM decay settings (for when no beats detected)
const BPM_DECAY_RATE = 0.97 // Decay multiplier per frame (~0.5 BPM/sec at 60fps)
const BPM_DECAY_THRESHOLD = 5 // Below this value, set BPM to 0

export type AudioMode = "system" | "microphone"
export type Mood = "chill" | "energetic" | "sad" | "happy" | "sleep"
export type BpmStatus =
	| "idle"
	| "warming-up"
	| "detecting"
	| "stabilizing"
	| "detected"
	| "lost"

export interface AudioData {
	bpm: number
	bpmStatus: BpmStatus
	beatCount: number
	energy: number
	mood: Mood
	isActive: boolean
	valence: number
	moodConfidence: number
	beat: boolean
	maxFrequency: number // For debugging: max value in frequency data
	frequencyData: number[] // Waveform visualization data
}

const defaultAudioData: AudioData = {
	bpm: 0,
	bpmStatus: "idle",
	beatCount: 0,
	energy: 0,
	mood: "chill", // Default mood is chill
	isActive: false,
	valence: 0,
	moodConfidence: 0,
	beat: false,
	maxFrequency: 0,
	frequencyData: []
}

export function useAudioCapture(mode: AudioMode = "microphone") {
	const [isListening, setIsListening] = useState(false)
	const [audioData, setAudioData] = useState<AudioData>(defaultAudioData)
	const [error, setError] = useState<string | null>(null)

	const audioContextRef = useRef<AudioContext | null>(null)
	const analyserRef = useRef<AnalyserNode | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const animationFrameRef = useRef<number | null>(null)

	const bpmProcessorRef = useRef<AudioWorkletNode | null>(null)
	const currentBpmRef = useRef<number>(0)
	const lastValidBpmRef = useRef<number>(0) // Preserve BPM during silence
	const realtimeBpmRef = useRef<number>(0) // Store realtime-bpm-analyzer result separately
	const beatTimesRef = useRef<number[]>([])
	const lastBeatTimeRef = useRef<number>(0)
	const lastValidBeatTimeRef = useRef<number>(0)
	const energyHistoryRef = useRef<number[]>([])

	const silenceCountRef = useRef<number>(0)
	const lastActiveTimeRef = useRef<number>(Date.now())
	const beatRef = useRef<boolean>(false)
	const startTimeRef = useRef<number>(0) // Track when capture started for warmup period

	const cleanup = useCallback(() => {
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = null
		}

		if (bpmProcessorRef.current) {
			try {
				bpmProcessorRef.current.disconnect()
			} catch {
				// Ignore cleanup errors
			}
			bpmProcessorRef.current = null
		}

		if (streamRef.current) {
			streamRef.current.getTracks().forEach(track => track.stop())
			streamRef.current = null
		}
		if (audioContextRef.current && audioContextRef.current.state !== "closed") {
			try {
				audioContextRef.current.close()
			} catch (err) {
				// Ignore errors when closing AudioContext (can throw NotSupportedError in some cases)
				console.warn(
					"[AUDIO-DBG] AudioContext close error (safe to ignore):",
					err
				)
			}
			audioContextRef.current = null
		}
		analyserRef.current = null
		currentBpmRef.current = 0
		lastValidBpmRef.current = 0
		realtimeBpmRef.current = 0
		beatTimesRef.current = []
		lastBeatTimeRef.current = 0
		lastValidBeatTimeRef.current = 0
		energyHistoryRef.current = []
		silenceCountRef.current = 0
		resetPredictionHistory()
		resetDebugState()
		setAudioData(defaultAudioData)
	}, [])

	const analyze = useCallback(() => {
		if (!analyserRef.current) return

		const analyser = analyserRef.current
		const bufferLength = analyser.frequencyBinCount
		const dataArray = new Uint8Array(bufferLength)
		analyser.getByteFrequencyData(dataArray)

		// Get max frequency value for debugging (helps identify if real audio vs noise)
		const maxFrequency = Math.max(...Array.from(dataArray))

		// Verbose debug logging (throttled)
		debugFrameCount++
		if (isVerboseDebug && debugFrameCount % DEBUG_LOG_INTERVAL === 0) {
			console.log(
				"[AUDIO-DBG] Raw frequency sample:",
				Array.from(dataArray.slice(0, 10)),
				"max:",
				maxFrequency
			)
		}

		const sampleRate = audioContextRef.current?.sampleRate || 44100
		const nyquist = sampleRate / 2
		const binSize = nyquist / bufferLength

		const bassEndBin = Math.min(Math.floor(250 / binSize), bufferLength)
		const midEndBin = Math.min(Math.floor(2000 / binSize), bufferLength)

		let bassSum = 0,
			midSum = 0,
			trebleSum = 0,
			totalSum = 0

		for (let i = 0; i < bassEndBin; i++) {
			bassSum += dataArray[i]
			totalSum += dataArray[i]
		}
		for (let i = bassEndBin; i < midEndBin; i++) {
			midSum += dataArray[i]
			totalSum += dataArray[i]
		}
		for (let i = midEndBin; i < bufferLength; i++) {
			trebleSum += dataArray[i]
			totalSum += dataArray[i]
		}

		// Speech detection: Speech has strong mid-range (300-3000Hz) and lower bass/treble
		const midLevel = midSum / ((midEndBin - bassEndBin) * 255)
		const bassLevel = bassSum / (bassEndBin * 255)
		const trebleLevel = trebleSum / ((bufferLength - midEndBin) * 255)

		// Calculate spectral flatness to detect noise vs tonal sounds
		let logSum = 0
		let arithmeticSum = 0
		for (let i = 0; i < bufferLength; i++) {
			const value = dataArray[i] + 1
			logSum += Math.log(value)
			arithmeticSum += value
		}
		const geometricMean = Math.exp(logSum / bufferLength)
		const arithmeticMean = arithmeticSum / bufferLength
		const spectralFlatness =
			arithmeticMean > 0 ? geometricMean / arithmeticMean : 0

		// Speech typically has:
		// - Moderate mid-range energy (0.08-0.20)
		// - Very low treble compared to mid (speech doesn't have high frequencies)
		// - Low-ish spectral flatness (tonal, not white noise)
		// Music has more treble, more balanced spectrum, and often sharper transients
		// Unified gain multiplier for consistent levels
		// RAW values for beat detection (can exceed 1.0 to detect transients)
		const rawBassLevel = (bassSum / (bassEndBin * 255)) * AUDIO_MULTIPLIER
		const rawEnergy =
			((bassSum + midSum) / (midEndBin * 255)) * AUDIO_MULTIPLIER
		const energy = Math.min(
			1,
			(totalSum / (bufferLength * 255)) * AUDIO_MULTIPLIER
		)

		const isSpeech =
			midLevel > 0.08 &&
			trebleLevel < 0.025 &&
			midLevel > trebleLevel * 4 &&
			spectralFlatness < 0.35

		// Debug speech detection - log all activity when audio is present
		if (showSpeechDetectionDebug && energy > 0.05) {
			console.log(
				"[SPEECH-DBG]",
				isSpeech ? "SPEECH DETECTED:" : "Audio (no speech):",
				{
					midLevel: midLevel.toFixed(4),
					bassLevel: bassLevel.toFixed(4),
					trebleLevel: trebleLevel.toFixed(4),
					spectralFlatness: spectralFlatness.toFixed(4),
					midVsTreble:
						trebleLevel > 0 ? (midLevel / trebleLevel).toFixed(2) + "x" : "N/A",
					checks: {
						midHigh: midLevel > 0.08,
						trebleLow: trebleLevel < 0.015,
						midOverTreble: midLevel > trebleLevel * 10,
						flatnessOk: spectralFlatness < 0.35
					}
				}
			)
		}

		// Unified silence threshold
		const isSilent = energy < SILENCE_THRESHOLD
		if (isSilent) {
			silenceCountRef.current++
		} else {
			silenceCountRef.current = 0
			lastActiveTimeRef.current = Date.now()
		}

		// Increased silence timeout from 120 (~2sec) to 300 (~5sec) to avoid resetting during quiet moments
		const isInSilence = silenceCountRef.current > 300

		// Log audio metrics for debugging
		const audioMetrics: AudioMetrics = {
			energy,
			isActive: energy >= SILENCE_THRESHOLD,
			isSilent,
			silenceCount: silenceCountRef.current
		}
		logAudioMetrics(audioMetrics)
		updateDebugState("audioMetrics", audioMetrics)

		const now = performance.now()
		// Use RAW total energy for beat detection (can exceed 1.0 to detect transients)
		energyHistoryRef.current.push(rawEnergy)
		if (energyHistoryRef.current.length > 30) {
			energyHistoryRef.current.shift()
		}

		const avgEnergy =
			energyHistoryRef.current.reduce((a, b) => a + b, 0) /
			energyHistoryRef.current.length
		const threshold = avgEnergy * 1.15

		let isBeat = false
		let lastInterval = 0
		const timeSinceLastBeat = now - lastBeatTimeRef.current

		// Debug: log beat check details periodically
		if (isVerboseDebug && debugFrameCount % DEBUG_LOG_INTERVAL === 0) {
			console.log("[AUDIO-DBG] Beat check:", {
				rawBass: rawBassLevel.toFixed(4),
				threshold: threshold.toFixed(4),
				diff: (rawBassLevel - threshold).toFixed(4),
				aboveThreshold: rawBassLevel > threshold,
				timeSinceLast: timeSinceLastBeat.toFixed(0) + "ms",
				canTrigger: timeSinceLastBeat > 150,
				minEnergyMet: rawBassLevel > 0.05
			})
		}

		// Use RAW total energy for beat detection + require minimum energy to avoid false positives
		// Filter out speech patterns to prevent detecting talking as BPM
		const beatWouldTrigger =
			rawEnergy > threshold && rawEnergy > 0.03 && timeSinceLastBeat > 200

		if (beatWouldTrigger && !isSpeech) {
			beatTimesRef.current.push(now)
			lastInterval = timeSinceLastBeat
			lastBeatTimeRef.current = now
			lastValidBeatTimeRef.current = now
			isBeat = true

			if (isVerboseDebug) {
				console.log(
					"[AUDIO-DBG] BEAT DETECTED! interval:",
					lastInterval.toFixed(0) + "ms",
					"beatCount:",
					beatTimesRef.current.length
				)
			}

			if (beatTimesRef.current.length > 20) {
				beatTimesRef.current.shift()
			}

			// Lowered beat requirement from 4 to 2 for faster BPM detection
			if (beatTimesRef.current.length >= 2) {
				const intervals: number[] = []
				for (let i = 1; i < beatTimesRef.current.length; i++) {
					intervals.push(beatTimesRef.current[i] - beatTimesRef.current[i - 1])
				}

				intervals.sort((a, b) => a - b)
				const medianInterval = intervals[Math.floor(intervals.length / 2)]

				if (medianInterval > 0) {
					const calculatedBpm = Math.round(60000 / medianInterval)
					if (calculatedBpm >= 50 && calculatedBpm <= 200) {
						const oldBpm = currentBpmRef.current
						if (currentBpmRef.current === 0) {
							currentBpmRef.current = calculatedBpm
						} else {
							currentBpmRef.current = Math.round(
								currentBpmRef.current * 0.6 + calculatedBpm * 0.4
							)
						}
						// Preserve valid BPM
						lastValidBpmRef.current = currentBpmRef.current

						if (isVerboseDebug) {
							console.log("[AUDIO-DBG] BPM calculated:", {
								calculated: calculatedBpm,
								smoothed: currentBpmRef.current,
								previous: oldBpm,
								medianInterval: medianInterval.toFixed(0) + "ms",
								beatCount: beatTimesRef.current.length
							})
						}
					}
				}
			}

			logBeat(rawBassLevel, threshold, currentBpmRef.current)
		} else if (beatWouldTrigger && isSpeech) {
			if (showSpeechDetectionDebug) {
				console.log("[SPEECH-DBG] Beat rejected due to speech detection", {
					rawBass: rawBassLevel.toFixed(4),
					threshold: threshold.toFixed(4),
					timeSinceLast: timeSinceLastBeat.toFixed(0) + "ms"
				})
			}
		}

		// Log BPM detection info
		const bpmInfo: BpmDebugInfo = {
			currentBpm: currentBpmRef.current,
			realtimeBpm: realtimeBpmRef.current,
			beatCount: beatTimesRef.current.length,
			lastInterval,
			threshold,
			avgEnergy
		}
		if (isBeat) {
			logBpmDetection(bpmInfo)
		}
		updateDebugState("bpmInfo", bpmInfo)

		beatRef.current = isBeat
		if (isBeat) {
			setTimeout(() => {
				beatRef.current = false
			}, 100)
		}

		// Reset BPM if no beats detected for 5 seconds (even if audio is still playing)
		const timeSinceLastValidBeat = now - lastValidBeatTimeRef.current
		const hasRecentBeat =
			lastValidBeatTimeRef.current > 0 && timeSinceLastValidBeat < 5000

		if (
			!hasRecentBeat &&
			(currentBpmRef.current > 0 || lastValidBpmRef.current > 0)
		) {
			if (isVerboseDebug) {
				console.log("[AUDIO-DBG] No beats for 5s, resetting BPM")
			}
			currentBpmRef.current = 0
			lastValidBpmRef.current = 0
			realtimeBpmRef.current = 0
			beatTimesRef.current = []
		}

		// Calculate BPM status for UI feedback
		const timeSinceStart = Date.now() - startTimeRef.current
		const beatCount = beatTimesRef.current.length
		let bpmStatus: BpmStatus = "detecting"

		if (timeSinceStart < 2000) {
			bpmStatus = "warming-up"
		} else if (currentBpmRef.current >= 40 || realtimeBpmRef.current >= 40) {
			bpmStatus = "detected"
		} else if (beatCount >= 1) {
			bpmStatus = "stabilizing"
		} else if (isInSilence && lastValidBpmRef.current > 0) {
			bpmStatus = "lost"
		}

		if (isInSilence) {
			// Decay BPM during silence instead of preserving indefinitely
			if (lastValidBpmRef.current > BPM_DECAY_THRESHOLD) {
				lastValidBpmRef.current = Math.floor(
					lastValidBpmRef.current * BPM_DECAY_RATE
				)
			} else {
				lastValidBpmRef.current = 0
			}

			logBpmReset("silence-decay", lastValidBpmRef.current)
			setAudioData({
				...defaultAudioData,
				bpm: lastValidBpmRef.current,
				bpmStatus: lastValidBpmRef.current > 0 ? "lost" : "detecting",
				beatCount: 0,
				isActive: false,
				mood: "sleep", // Trigger sleep mode after 5s inactivity
				beat: false,
				maxFrequency
			})
		} else {
			// FIXED: Use custom detection as primary (faster), let realtime override once stable
			// Previous: realtimeBpmRef.current || currentBpmRef.current (waits 10s for realtime)
			// Now: currentBpmRef.current || realtimeBpmRef.current (uses custom immediately)
			const displayBpm =
				currentBpmRef.current ||
				realtimeBpmRef.current ||
				lastValidBpmRef.current
			const effectiveBpm = displayBpm || 100 // Fallback for ML analysis

			// Verbose debug logging for BPM sources
			if (isVerboseDebug && debugFrameCount % DEBUG_LOG_INTERVAL === 0) {
				console.log("[AUDIO-DBG] BPM sources:", {
					custom: currentBpmRef.current,
					realtime: realtimeBpmRef.current,
					lastValid: lastValidBpmRef.current,
					display: displayBpm,
					status: bpmStatus,
					beatCount
				})
			}

			const mlResult = analyzeAudioFeatures(dataArray, effectiveBpm, sampleRate)
			const smoothedResult = getSmoothedPrediction(mlResult)

			setAudioData({
				bpm: displayBpm,
				bpmStatus,
				beatCount,
				energy,
				mood: smoothedResult.mood,
				isActive: energy >= SILENCE_THRESHOLD, // Fixed: was 0.02, now matches silence threshold 0.05
				valence: smoothedResult.valence,
				moodConfidence: smoothedResult.moodConfidence,
				beat: isBeat,
				maxFrequency,
				frequencyData: Array.from(
					dataArray.slice(0, Math.floor(dataArray.length * 0.6))
				)
					.filter((_, i) => i % Math.floor((dataArray.length * 0.6) / 64) === 0)
					.slice(0, 64) // Sample first 60% of spectrum (exclude very high frequencies)
			})
		}

		animationFrameRef.current = requestAnimationFrame(analyze)
	}, [])

	const startCapture = useCallback(async () => {
		setError(null)
		cleanup()
		resetPredictionHistory()

		try {
			let stream: MediaStream

			if (mode === "system") {
				// Check if running in Electron with loopback available
				const electronAPI = (window as any).electronAPI

				if (electronAPI?.enableLoopbackAudio) {
					// Enable loopback before getDisplayMedia
					if (isVerboseDebug) {
						console.log("[AUDIO-DBG] Using Electron audio loopback")
					}
					await electronAPI.enableLoopbackAudio()

					// MUST request video: true for the library to intercept
					stream = await navigator.mediaDevices.getDisplayMedia({
						video: true,
						audio: true
					})

					// Remove video tracks immediately
					stream.getVideoTracks().forEach(t => {
						t.stop()
						stream.removeTrack(t)
					})

					// Disable loopback after getting stream
					await electronAPI.disableLoopbackAudio()
				} else {
					// Fallback for non-Electron (web browser) or loopback device
					const devices = await navigator.mediaDevices.enumerateDevices()
					const loopbackDevice = devices.find(
						d =>
							d.kind === "audioinput" &&
							(d.label.toLowerCase().includes("loopback") ||
								d.label.toLowerCase().includes("system audio"))
					)

					if (loopbackDevice) {
						if (isVerboseDebug) {
							console.log(
								"[AUDIO-DBG] Found loopback device:",
								loopbackDevice.label
							)
						}
						stream = await navigator.mediaDevices.getUserMedia({
							audio: { deviceId: { exact: loopbackDevice.deviceId } }
						})
					} else {
						if (isVerboseDebug) {
							console.log(
								"[AUDIO-DBG] No loopback device found, using getDisplayMedia fallback"
							)
						}
						stream = await navigator.mediaDevices.getDisplayMedia({
							audio: {
								echoCancellation: false,
								noiseSuppression: false
							},
							video: { width: 1, height: 1, frameRate: 1 }
						})
						// Stop video track, keep only audio
						stream.getVideoTracks().forEach(t => t.stop())
					}
				}
			} else {
				// Microphone mode (default)
				stream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: false,
						noiseSuppression: false,
						autoGainControl: false
					}
				})
			}

			streamRef.current = stream

			const audioContext = new AudioContext()
			if (audioContext.state === "suspended") await audioContext.resume()
			audioContextRef.current = audioContext

			const analyser = audioContext.createAnalyser()
			analyser.fftSize = 4096
			analyser.smoothingTimeConstant = 0.8
			analyserRef.current = analyser

			const source = audioContext.createMediaStreamSource(stream)
			source.connect(analyser)

			try {
				const realtimeBpmProcessor = await createRealTimeBpmProcessor(
					audioContext,
					{
						continuousAnalysis: true,
						stabilizationTime: 3_000 // REDUCED from 10_000 for faster detection
					}
				)

				if (isVerboseDebug) {
					console.log(
						"[AUDIO-DBG] Realtime BPM analyzer initialized with 3s stabilization"
					)
				}

				// The realtime-bpm-analyzer library automatically taps into the AudioContext
				// No need to manually connect it to the source
				bpmProcessorRef.current =
					realtimeBpmProcessor as unknown as AudioWorkletNode

				// Set up message handler for BPM results
				const processorNode =
					realtimeBpmProcessor as unknown as AudioWorkletNode
				if (processorNode?.port) {
					processorNode.port.onmessage = (event: MessageEvent) => {
						if (isVerboseDebug) {
							console.log("[AUDIO-DBG] Realtime BPM event:", event.data)
						}

						if (event.data?.result?.bpm?.length > 0) {
							const topCandidate = event.data.result.bpm[0]
							if (topCandidate?.tempo) {
								const tempo = Math.round(topCandidate.tempo)
								// Store in separate ref so it doesn't get overwritten on silence
								realtimeBpmRef.current = tempo
								// Also update current and valid refs
								currentBpmRef.current = tempo
								lastValidBpmRef.current = tempo

								if (isVerboseDebug) {
									console.log(
										"[AUDIO-DBG] Realtime BPM detected:",
										tempo,
										"candidates:",
										event.data.result.bpm.length
									)
								}
								logRealtimeBpmUpdate(tempo, event.data.result.bpm.length)
							}
						}
					}
				}
			} catch (bpmErr) {
				// This is fine - our custom beat detection will work as fallback
				console.warn(
					"[AUDIO-DBG] realtime-bpm-analyzer setup failed, using custom beat detection:",
					bpmErr
				)
			}

			// Track start time for warmup period
			startTimeRef.current = Date.now()
			if (isVerboseDebug) {
				console.log(`[AUDIO-DBG] Audio capture started (${mode} mode)`)
			}

			setIsListening(true)
			analyze()
		} catch (err) {
			console.error("[AUDIO] Capture error:", err)
			setError(err instanceof Error ? err.message : "Failed to capture audio")
			cleanup()
		}
	}, [mode, analyze, cleanup])

	const stopCapture = useCallback(() => {
		cleanup()
		setIsListening(false)
	}, [cleanup])

	useEffect(() => {
		return () => cleanup()
	}, [cleanup])

	return {
		isListening,
		audioData,
		error,
		startCapture,
		stopCapture
	}
}
