"use client"

import {
  logClassification,
  logSmoothing,
  updateDebugState,
  type ClassificationDebugInfo,
} from "@/lib/audio-debug"

export interface AudioMLResult {
  genre: string
  genreConfidence: number
  mood: "chill" | "energetic" | "sad" | "happy"
  moodConfidence: number
  danceability: number
  energy: number
  valence: number
}

// Store genre scores for confidence calculation
let lastGenreScores: Record<string, number> = {}
let lastMoodScores: Record<string, number> = {}

export function analyzeAudioFeatures(frequencyData: Uint8Array, bpm: number, sampleRate: number = 44100): AudioMLResult {
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
  midEnergy /= (midEnd - bassEnd) || 1
  highEnergy /= (bufferLength - midEnd) || 1
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
  const spectralFlatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0

  // Input normalization: prevent volume-dependent classification
  // Normalize energy bands relative to total energy to get the spectral shape regardless of volume
  const avgBandEnergy = (bassEnergy + midEnergy + highEnergy) / 3 + 0.01 // Add small constant to avoid division by zero
  const normalizedBass = bassEnergy / avgBandEnergy
  const normalizedMid = midEnergy / avgBandEnergy
  const normalizedTreble = highEnergy / avgBandEnergy

  const { genre, scores: genreScores } = detectGenreWithScores(
    normalizedBass, normalizedMid, normalizedTreble,
    spectralCentroid, spectralFlatness, bpm
  )
  lastGenreScores = genreScores

  const energy = Math.min(1, totalEnergy * 2)
  // Improved valence calculation: bass contributes positively (energetic/happy music often has strong bass)
  // Combines spectral brightness with mid-range presence and bass contribution
  const valence = spectralCentroid * 0.4 + normalizedMid * 0.3 + normalizedBass * 0.2 + normalizedTreble * 0.1
  const danceability = calculateDanceability(bpm, normalizedBass, energy)

  // Fixed mood logic:
  // - "happy": high energy + high valence (bright, upbeat)
  // - "energetic": high energy + low/mid valence (intense but not necessarily bright)
  // - "chill": low energy + high valence (relaxed, pleasant)
  // - "sad": low energy + low valence (slow, dark)
  const moodScores = {
    happy: (energy * 0.5 + valence * 0.5),
    energetic: (energy * 0.7 + (1 - valence) * 0.3),
    chill: ((1 - energy) * 0.5 + valence * 0.5),
    sad: ((1 - energy) * 0.5 + (1 - valence) * 0.5),
  }
  lastMoodScores = moodScores

  // Pick mood with highest score
  let mood: "chill" | "energetic" | "sad" | "happy" = "chill"
  let maxMoodScore = 0
  for (const [m, score] of Object.entries(moodScores)) {
    if (score > maxMoodScore) {
      maxMoodScore = score
      mood = m as typeof mood
    }
  }

  // Calculate real confidence based on score margins (not random!)
  const sortedGenreScores = Object.values(genreScores).sort((a, b) => b - a)
  const genreConfidence = sortedGenreScores.length > 1
    ? Math.min(1, (sortedGenreScores[0] - sortedGenreScores[1]) / (sortedGenreScores[0] + 0.1) + 0.5)
    : 0.7

  const sortedMoodScores = Object.values(moodScores).sort((a, b) => b - a)
  const moodConfidence = sortedMoodScores.length > 1
    ? Math.min(1, (sortedMoodScores[0] - sortedMoodScores[1]) / 0.5 + 0.5)
    : 0.7

  // Log classification for debugging
  const classificationInfo: ClassificationDebugInfo = {
    genre,
    genreScores,
    mood,
    moodScores,
    spectralCentroid,
    spectralFlatness,
    bassEnergy,
    midEnergy,
    highEnergy,
  }
  logClassification(classificationInfo)
  updateDebugState("classificationInfo", classificationInfo)

  return {
    genre,
    genreConfidence,
    mood,
    moodConfidence,
    danceability,
    energy,
    valence,
  }
}

function detectGenreWithScores(
  bass: number,
  mid: number,
  high: number,
  brightness: number,
  flatness: number,
  bpm: number,
): { genre: string; scores: Record<string, number> } {
  // Expanded genre list with more electronic subgenres
  const scores: Record<string, number> = {
    electronic: 0,
    edm: 0,
    dubstep: 0,
    trap: 0,
    "lo-fi": 0,
    "hip-hop": 0,
    rock: 0,
    metal: 0,
    pop: 0,
    jazz: 0,
    classical: 0,
    reggae: 0,
    rnb: 0,
    indie: 0,
    ambient: 0,
  }

  const bassRatio = bass / (mid + 0.001)
  const trebleRatio = high / (mid + 0.001)

  // BPM-based scoring (reduced weight from 3 to 1.5 for more balanced detection)
  if (bpm >= 120 && bpm <= 140) {
    scores.electronic += 1.5
    scores.edm += 2
    scores.pop += 1.5
  }
  if (bpm >= 140 && bpm <= 160) {
    scores.edm += 2
    scores.dubstep += 1.5
    scores.electronic += 1
  }
  if (bpm >= 130 && bpm <= 150) {
    scores.trap += 1.5
  }
  if (bpm >= 85 && bpm <= 115) {
    scores["hip-hop"] += 1.5
    scores.rnb += 1.5
    scores.trap += 1
  }
  if (bpm >= 100 && bpm <= 130) {
    scores.rock += 1.5
    scores.indie += 1.5
  }
  if (bpm >= 140) {
    scores.metal += 1.5
    scores.electronic += 1
  }
  if (bpm >= 60 && bpm <= 90) {
    scores.reggae += 1.5
    scores.jazz += 1
    scores.classical += 1
    scores["lo-fi"] += 1.5
  }
  if (bpm >= 70 && bpm <= 100) {
    scores["lo-fi"] += 1.5
    scores.ambient += 1
  }
  if (bpm >= 70 && bpm <= 120) {
    scores.jazz += 1.5
  }
  if (bpm < 80) {
    scores.ambient += 2
    scores["lo-fi"] += 1
  }

  // Bass characteristics (increased weight for frequency-based detection)
  if (bass > 1.5) {
    scores["hip-hop"] += 2.5
    scores.trap += 2.5
    scores.dubstep += 2
    scores.electronic += 1.5
    scores.reggae += 1
  }
  if (bass > 2) {
    scores.dubstep += 2
    scores.trap += 2
  }
  if (bassRatio > 1.5) {
    scores["hip-hop"] += 2
    scores.trap += 1.5
    scores.rnb += 1
  }
  if (bass < 0.8) {
    scores.classical += 2
    scores.jazz += 1.5
    scores.indie += 1
    scores["lo-fi"] += 1
  }
  if (bass < 0.5) {
    scores.ambient += 2
    scores.classical += 1
  }

  // Mid frequencies (vocals, instruments)
  if (mid > 1.2) {
    scores.rock += 2.5
    scores.pop += 2
    scores.indie += 1.5
  }
  if (mid > bass && mid > high) {
    scores.pop += 2
    scores.indie += 2
    scores.jazz += 1.5
    scores["lo-fi"] += 1
  }

  // High frequencies (cymbals, hi-hats, synthesizers)
  if (high > 1.2) {
    scores.electronic += 2
    scores.edm += 1.5
    scores.pop += 1
    scores.metal += 1.5
  }
  if (brightness > 0.6) {
    scores.electronic += 2
    scores.edm += 2
    scores.pop += 1
    scores.metal += 1
  }
  if (brightness < 0.35) {
    scores.reggae += 2
    scores["hip-hop"] += 1.5
    scores.jazz += 1
    scores["lo-fi"] += 2
    scores.ambient += 1.5
  }
  if (trebleRatio > 1.3) {
    scores.electronic += 1.5
    scores.edm += 1.5
  }

  // Spectral flatness (noisy vs tonal)
  if (flatness > 0.4) {
    scores.metal += 2.5
    scores.rock += 2
    scores.electronic += 1.5
    scores.dubstep += 1.5
  }
  if (flatness < 0.2) {
    scores.classical += 2.5
    scores.jazz += 2
    scores.rnb += 1.5
    scores["lo-fi"] += 1
    scores.ambient += 1.5
  }
  if (flatness > 0.25 && flatness < 0.4) {
    scores.pop += 1.5
    scores.indie += 1
  }

  // Energy combinations for specific genres
  if (flatness > 0.35 && mid > 1.0 && bpm >= 110) {
    scores.rock += 2
  }
  if (bass > 1.2 && high > 1.0 && flatness > 0.3) {
    scores.electronic += 2
    scores.edm += 1.5
  }
  if (bass > 1.5 && brightness < 0.4 && bpm >= 130) {
    scores.dubstep += 2
  }
  if (bass > 1.3 && high > 0.8 && bpm >= 120 && bpm <= 160) {
    scores.trap += 2
  }
  if (brightness < 0.4 && flatness < 0.25 && bpm < 100) {
    scores["lo-fi"] += 2
    scores.ambient += 1.5
  }
  if (brightness < 0.3 && flatness < 0.2 && bass < 0.6) {
    scores.ambient += 2.5
  }

  let maxScore = 0
  let detectedGenre = "pop"

  for (const [genre, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      detectedGenre = genre
    }
  }

  return { genre: detectedGenre, scores }
}

function calculateDanceability(bpm: number, bass: number, energy: number): number {
  const bpmScore = 1 - Math.abs(bpm - 120) / 80
  const bassScore = bass
  const energyScore = energy

  return Math.min(1, Math.max(0, bpmScore * 0.4 + bassScore * 0.3 + energyScore * 0.3))
}

const predictionHistory: AudioMLResult[] = []
const HISTORY_SIZE = 30 // Reduced from 60 for faster response (~1s at 60fps instead of ~2s)

// Exponential moving average state for continuous values
let emaEnergy = 0.5
let emaValence = 0.5
let emaDanceability = 0.5
const EMA_ALPHA = 0.15 // Higher = more responsive, lower = more smooth

export function getSmoothedPrediction(result: AudioMLResult): AudioMLResult {
  predictionHistory.push(result)
  if (predictionHistory.length > HISTORY_SIZE) {
    predictionHistory.shift()
  }

  // Update exponential moving averages for continuous values (faster response than averaging)
  emaEnergy = EMA_ALPHA * result.energy + (1 - EMA_ALPHA) * emaEnergy
  emaValence = EMA_ALPHA * result.valence + (1 - EMA_ALPHA) * emaValence
  emaDanceability = EMA_ALPHA * result.danceability + (1 - EMA_ALPHA) * emaDanceability

  // Count categorical values (genre, mood) - still use voting but with smaller window
  const genreCounts: Record<string, number> = {}
  const moodCounts: Record<string, number> = {}

  // Weight recent predictions more heavily (recency bias)
  for (let i = 0; i < predictionHistory.length; i++) {
    const pred = predictionHistory[i]
    const weight = 1 + (i / predictionHistory.length) // Later items have higher weight
    genreCounts[pred.genre] = (genreCounts[pred.genre] || 0) + weight
    moodCounts[pred.mood] = (moodCounts[pred.mood] || 0) + weight
  }

  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])
  const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])

  const len = predictionHistory.length
  const totalWeight = (len * (1 + (len - 1) / len)) / 2 + len // Sum of weights

  const topMood = sortedMoods[0]
  const topMoodCount = topMood?.[1] || 0
  // 25% threshold with weighted counting for responsive mood changes
  const moodThreshold = totalWeight * 0.25

  let finalMood: AudioMLResult["mood"] = "chill"
  if (topMoodCount >= moodThreshold) {
    finalMood = topMood[0] as AudioMLResult["mood"]
  }

  // Log smoothing info for debugging
  logSmoothing(len, genreCounts, moodCounts, sortedGenres[0]?.[0] || result.genre, finalMood)

  return {
    genre: sortedGenres[0]?.[0] || result.genre,
    genreConfidence: Math.min(1, (sortedGenres[0]?.[1] || 0) / totalWeight),
    mood: finalMood,
    moodConfidence: Math.min(1, (sortedMoods[0]?.[1] || 0) / totalWeight),
    energy: emaEnergy,
    valence: emaValence,
    danceability: emaDanceability,
  }
}

export function resetPredictionHistory() {
  predictionHistory.length = 0
  emaEnergy = 0.5
  emaValence = 0.5
  emaDanceability = 0.5
}
