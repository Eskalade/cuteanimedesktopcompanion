"use client"

import {
	logClassification,
	logSmoothing,
	updateDebugState,
	type ClassificationDebugInfo
} from "@/lib/audio-debug"

export interface AudioMLResult {
	mood: "chill" | "energetic" | "sad" | "happy" | "sleep"
	moodConfidence: number
	energy: number
	valence: number
}

// Store mood scores for confidence calculation
let lastMoodScores: Record<string, number> = {}

export function analyzeAudioFeatures(
	frequencyData: Uint8Array,
	bpm: number,
	sampleRate: number = 44100
): AudioMLResult {
	const bufferLength = frequencyData.length

	let bassEnergy = 0
	let midEnergy = 0
	let highEnergy = 0
	let totalEnergy = 0

	// Use proper frequency-based bins matching use-audio-capture.ts (250Hz/2000Hz cutoffs)
	const nyquist = sampleRate / 2
	const binSize = nyquist / bufferLength
	const bassEnd = Math.min(Math.floor(250 / binSize), bufferLength)
	const midEnd = Math.min(Math.floor(2000 / binSize), bufferLength)

	for (let i = 0; i < bufferLength; i++) {
		const value = frequencyData[i] / 255
		totalEnergy += value

		if (i < bassEnd) {
			bassEnergy += value
		} else if (i < midEnd) {
			midEnergy += value
		} else {
			highEnergy += value
		}
	}

	bassEnergy /= bassEnd || 1
	midEnergy /= midEnd - bassEnd || 1
	highEnergy /= bufferLength - midEnd || 1
	totalEnergy /= bufferLength

	let weightedSum = 0
	let sum = 0
	for (let i = 0; i < bufferLength; i++) {
		weightedSum += i * frequencyData[i]
		sum += frequencyData[i]
	}
	// Spectral centroid: weighted average of frequency bin indices, normalized to 0-1
	// Result is where the "center of mass" of the spectrum is located
	// 0 = all energy at lowest frequency, 1 = all energy at highest frequency
	const rawCentroid = sum > 0 ? weightedSum / sum : bufferLength / 2
	const spectralCentroid = rawCentroid / (bufferLength - 1) // Normalize to 0-1 range

	let logSum = 0
	let arithmeticSum = 0
	let validCount = 0
	for (let i = 0; i < bufferLength; i++) {
		const value = frequencyData[i] + 1
		logSum += Math.log(value)
		arithmeticSum += value
		validCount++
	}
	const geometricMean = Math.exp(logSum / validCount)
	const arithmeticMean = arithmeticSum / validCount
	const spectralFlatness =
		arithmeticMean > 0 ? geometricMean / arithmeticMean : 0

	// Input normalization: prevent volume-dependent classification
	// Normalize energy bands relative to total energy to get the spectral shape regardless of volume
	const avgBandEnergy = (bassEnergy + midEnergy + highEnergy) / 3 + 0.01 // Add small constant to avoid division by zero
	const normalizedBass = bassEnergy / avgBandEnergy
	const normalizedMid = midEnergy / avgBandEnergy
	const normalizedTreble = highEnergy / avgBandEnergy

	const energy = Math.min(1, totalEnergy * 2)
	// Improved valence calculation: bass contributes positively (energetic/happy music often has strong bass)
	// Combines spectral brightness with mid-range presence and bass contribution
	const valence =
		spectralCentroid * 0.4 +
		normalizedMid * 0.3 +
		normalizedBass * 0.2 +
		normalizedTreble * 0.1

	// Fixed mood logic:
	// - "happy": high energy + high valence (bright, upbeat)
	// - "energetic": high energy + low/mid valence (intense but not necessarily bright)
	// - "chill": low energy + high valence (relaxed, pleasant)
	// - "sad": low energy + low valence (slow, dark)
	const moodScores = {
		happy: energy * 0.4 + valence * 0.6, // Favor valence more to catch bright songs
		energetic: energy * 0.7 + (1 - valence) * 0.3,
		chill: (1 - energy) * 0.3 + valence * 0.4, // Lower weight on low-energy to reduce false chill detection
		sad: (1 - energy) * 0.5 + (1 - valence) * 0.5
	}
	lastMoodScores = moodScores

	// Pick mood with highest score
	let mood: "chill" | "energetic" | "sad" | "happy" | "sleep" = "chill"
	let maxMoodScore = 0
	for (const [m, score] of Object.entries(moodScores)) {
		if (score > maxMoodScore) {
			maxMoodScore = score
			mood = m as typeof mood
		}
	}

	// Calculate real confidence based on score margins (not random!)
	const sortedMoodScores = Object.values(moodScores).sort((a, b) => b - a)
	const moodConfidence =
		sortedMoodScores.length > 1
			? Math.min(1, (sortedMoodScores[0] - sortedMoodScores[1]) / 0.5 + 0.5)
			: 0.7

	// Log classification for debugging
	const classificationInfo: ClassificationDebugInfo = {
		mood,
		moodScores,
		spectralCentroid,
		spectralFlatness,
		bassEnergy,
		midEnergy,
		highEnergy
	}
	logClassification(classificationInfo)
	updateDebugState("classificationInfo", classificationInfo)

	return {
		mood,
		moodConfidence,
		energy,
		valence
	}
}

const predictionHistory: AudioMLResult[] = []
const HISTORY_SIZE = 30 // Reduced from 60 for faster response (~1s at 60fps instead of ~2s)

// Exponential moving average state for continuous values
let emaEnergy = 0.5
let emaValence = 0.5
const EMA_ALPHA = 0.5 // Higher = more responsive, lower = more smooth (increased from 0.15 for faster energy response)

export function getSmoothedPrediction(result: AudioMLResult): AudioMLResult {
	predictionHistory.push(result)
	if (predictionHistory.length > HISTORY_SIZE) {
		predictionHistory.shift()
	}

	// Update exponential moving averages for continuous values (faster response than averaging)
	emaEnergy = EMA_ALPHA * result.energy + (1 - EMA_ALPHA) * emaEnergy
	emaValence = EMA_ALPHA * result.valence + (1 - EMA_ALPHA) * emaValence

	// Count categorical values (mood) - still use voting but with smaller window
	const moodCounts: Record<string, number> = {}

	// Weight recent predictions more heavily (recency bias)
	for (let i = 0; i < predictionHistory.length; i++) {
		const pred = predictionHistory[i]
		const weight = 1 + i / predictionHistory.length // Later items have higher weight
		moodCounts[pred.mood] = (moodCounts[pred.mood] || 0) + weight
	}

	const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])

	const len = predictionHistory.length
	const totalWeight = (len * (1 + (len - 1) / len)) / 2 + len // Sum of weights

	const topMood = sortedMoods[0]
	const topMoodCount = topMood?.[1] || 0
	// 25% threshold with weighted counting for responsive mood changes
	const moodThreshold = totalWeight * 0.25

	let finalMood: AudioMLResult["mood"] = "chill" as AudioMLResult["mood"]
	if (topMoodCount >= moodThreshold) {
		finalMood = topMood[0] as AudioMLResult["mood"]
	}

	// Log smoothing info for debugging
	logSmoothing(len, moodCounts, finalMood)
	return {
		mood: finalMood,
		moodConfidence: Math.min(1, (sortedMoods[0]?.[1] || 0) / totalWeight),
		energy: emaEnergy,
		valence: emaValence
	}
}

export function resetPredictionHistory() {
	predictionHistory.length = 0
	emaEnergy = 0.5
	emaValence = 0.5
}
