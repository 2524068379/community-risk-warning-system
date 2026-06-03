/**
 * Pipeline Simulator for Benchmarking Cascaded Inference
 *
 * Simulates the motion detection → object detection → VLM analysis pipeline
 * with different configurations to measure efficiency gains.
 */

export interface SimulatedFrame {
  timestamp: number
  hasMotion: boolean
  motionEnergy: number // 0-1
  detectedObjects: SimulatedDetection[]
  groundTruthRisk: boolean
  riskCategory: string
  riskScore: number
}

export interface SimulatedDetection {
  label: string
  score: number
  bbox: [number, number, number, number]
}

export type PipelineConfig =
  | 'full-cascade'        // Motion → COCO-SSD → VLM with adaptive sampling
  | 'no-cascade'          // VLM every frame (naive baseline)
  | 'fixed-fast'          // VLM every 500ms (no cascade)
  | 'fixed-slow'          // VLM every 5000ms (no cascade)
  | 'cascade-no-adaptive' // Motion → COCO-SSD → VLM, fixed 500ms sampling
  | 'cascade-no-priority' // Motion → adaptive → VLM (no priority scheduling)

export interface PipelineMetrics {
  config: PipelineConfig
  totalFrames: number
  framesProcessed: number
  motionDetectedFrames: number
  objectDetectedFrames: number
  vlmCalls: number
  vlmCallReduction: number // vs no-cascade baseline
  riskEventsDetected: number
  riskEventsTotal: number
  detectionRate: number
  falseNegatives: number
  avgVlmLatencyMs: number
  totalSimulatedTimeMs: number
  gpuUtilizationEstimate: number // 0-1
}

const HIGH_PRIORITY_LABELS = new Set(['person', 'motorcycle', 'bicycle'])
const ACTIVE_INTERVAL_MS = 500
const IDLE_INTERVAL_MS = 5000
const IDLE_AFTER_FRAMES = 6
const FALLBACK_INTERVAL_MS = 6000
const MOTION_THRESHOLD = 0.05

export function generateScenario(
  durationMs: number,
  activityLevel: 'static' | 'low' | 'medium' | 'high',
  riskEvents: Array<{ startMs: number; endMs: number; category: string; score: number; hasPerson: boolean }>
): SimulatedFrame[] {
  const frames: SimulatedFrame[] = []
  const frameInterval = 100 // 10 fps for finer-grained simulation
  const totalFrames = Math.floor(durationMs / frameInterval)

  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i * frameInterval
    let hasMotion = false
    let motionEnergy = 0
    let detectedObjects: SimulatedDetection[] = []
    let groundTruthRisk = false
    let riskCategory = 'none'
    let riskScore = 0

    // Base activity
    switch (activityLevel) {
      case 'static':
        hasMotion = Math.random() < 0.02
        motionEnergy = hasMotion ? 0.03 + Math.random() * 0.05 : 0
        break
      case 'low':
        hasMotion = Math.random() < 0.15
        motionEnergy = hasMotion ? 0.05 + Math.random() * 0.1 : 0
        if (hasMotion && Math.random() < 0.3) {
          detectedObjects.push({ label: 'car', score: 0.7 + Math.random() * 0.2, bbox: [0.1, 0.1, 0.3, 0.3] })
        }
        break
      case 'medium':
        hasMotion = Math.random() < 0.4
        motionEnergy = hasMotion ? 0.05 + Math.random() * 0.3 : 0
        if (hasMotion && Math.random() < 0.5) {
          detectedObjects.push({ label: 'person', score: 0.6 + Math.random() * 0.3, bbox: [0.2, 0.2, 0.4, 0.6] })
        }
        if (hasMotion && Math.random() < 0.2) {
          detectedObjects.push({ label: 'bicycle', score: 0.5 + Math.random() * 0.3, bbox: [0.5, 0.3, 0.2, 0.3] })
        }
        break
      case 'high':
        hasMotion = Math.random() < 0.8
        motionEnergy = hasMotion ? 0.1 + Math.random() * 0.5 : 0
        if (hasMotion && Math.random() < 0.7) {
          detectedObjects.push({ label: 'person', score: 0.7 + Math.random() * 0.25, bbox: [0.2, 0.2, 0.4, 0.6] })
        }
        if (hasMotion && Math.random() < 0.3) {
          detectedObjects.push({ label: 'car', score: 0.6 + Math.random() * 0.3, bbox: [0.5, 0.1, 0.3, 0.3] })
        }
        break
    }

    // Inject risk events
    for (const event of riskEvents) {
      if (timestamp >= event.startMs && timestamp <= event.endMs) {
        groundTruthRisk = true
        riskCategory = event.category
        riskScore = event.score
        if (event.hasPerson && !detectedObjects.some(d => d.label === 'person')) {
          detectedObjects.push({ label: 'person', score: 0.85, bbox: [0.3, 0.3, 0.3, 0.5] })
        }
        // Risk events always have motion
        hasMotion = true
        motionEnergy = Math.max(motionEnergy, 0.2)
      }
    }

    frames.push({
      timestamp,
      hasMotion,
      motionEnergy,
      detectedObjects,
      groundTruthRisk,
      riskCategory,
      riskScore
    })
  }

  return frames
}

export function simulatePipeline(
  frames: SimulatedFrame[],
  config: PipelineConfig
): PipelineMetrics {
  let framesProcessed = 0
  let motionDetectedFrames = 0
  let objectDetectedFrames = 0
  let vlmCalls = 0
  let riskEventsDetected = 0
  let riskEventsTotal = 0
  let unchangedCount = 0
  let currentInterval = ACTIVE_INTERVAL_MS
  let lastVlmTime = -Infinity
  let lastCaptureTime = -Infinity
  let inFlightVlm = false
  let detectedRiskCategories = new Set<string>()

  // Count total unique risk events
  const riskEventSet = new Set<string>()
  for (const frame of frames) {
    if (frame.groundTruthRisk) {
      riskEventSet.add(frame.riskCategory)
    }
  }
  riskEventsTotal = riskEventSet.size

  for (const frame of frames) {
    const timeSinceLastCapture = frame.timestamp - lastCaptureTime

    // Adaptive sampling logic
    if (config === 'full-cascade' || config === 'cascade-no-priority') {
      // Check if we should capture this frame based on adaptive interval
      if (timeSinceLastCapture < currentInterval) {
        continue // Skip this frame
      }
      lastCaptureTime = frame.timestamp
      framesProcessed++

      // Update adaptive interval
      if (frame.hasMotion) {
        unchangedCount = 0
        currentInterval = ACTIVE_INTERVAL_MS
      } else {
        unchangedCount++
        if (unchangedCount >= IDLE_AFTER_FRAMES) {
          currentInterval = IDLE_INTERVAL_MS
        }
      }
    } else if (config === 'cascade-no-adaptive') {
      // Fixed fast sampling
      if (timeSinceLastCapture < ACTIVE_INTERVAL_MS) {
        continue
      }
      lastCaptureTime = frame.timestamp
      framesProcessed++
    } else if (config === 'fixed-fast') {
      if (timeSinceLastCapture < ACTIVE_INTERVAL_MS) {
        continue
      }
      lastCaptureTime = frame.timestamp
      framesProcessed++
    } else if (config === 'fixed-slow') {
      if (timeSinceLastCapture < IDLE_INTERVAL_MS) {
        continue
      }
      lastCaptureTime = frame.timestamp
      framesProcessed++
    } else {
      // no-cascade: process every frame
      framesProcessed++
    }

    // Motion detection stage
    if (config !== 'no-cascade' && config !== 'fixed-fast' && config !== 'fixed-slow') {
      if (!frame.hasMotion && frame.motionEnergy < MOTION_THRESHOLD) {
        continue // Skip static frames
      }
      motionDetectedFrames++
    }

    // Object detection stage
    let shouldSendVlm = false
    let isHighPriority = false

    if (config === 'no-cascade' || config === 'fixed-fast' || config === 'fixed-slow') {
      // Direct VLM, no object detection filtering
      shouldSendVlm = true
    } else if (config === 'full-cascade' || config === 'cascade-no-adaptive') {
      // Full cascade with object detection
      if (frame.detectedObjects.length > 0) {
        objectDetectedFrames++
        shouldSendVlm = true
        isHighPriority = frame.detectedObjects.some(d => HIGH_PRIORITY_LABELS.has(d.label))
      } else {
        // Fallback: send VLM every FALLBACK_INTERVAL_MS
        if (frame.timestamp - lastVlmTime >= FALLBACK_INTERVAL_MS) {
          shouldSendVlm = true
        }
      }
    } else if (config === 'cascade-no-priority') {
      // Cascade without priority scheduling
      if (frame.detectedObjects.length > 0) {
        objectDetectedFrames++
        shouldSendVlm = true
        // No priority - don't abort in-flight
      } else {
        if (frame.timestamp - lastVlmTime >= FALLBACK_INTERVAL_MS) {
          shouldSendVlm = true
        }
      }
    }

    if (!shouldSendVlm) continue

    // Priority scheduling
    if (config === 'full-cascade') {
      if (!isHighPriority && inFlightVlm) {
        continue // Skip non-priority when in-flight
      }
      // High-priority aborts in-flight and replaces (counts as 1 call, not 2)
    }

    // Make VLM call
    vlmCalls++
    lastVlmTime = frame.timestamp
    inFlightVlm = true

    // Simulate VLM detection (assume VLM detects risk if ground truth says so)
    if (frame.groundTruthRisk) {
      riskEventsDetected++
      detectedRiskCategories.add(frame.riskCategory)
    }

    // Simulate VLM latency
    setTimeout(() => { inFlightVlm = false }, 100)
  }

  // Calculate metrics
  const vlmCallReduction = vlmCalls > 0
    ? 1 - (vlmCalls / frames.length)
    : 0

  const detectionRate = riskEventsTotal > 0
    ? detectedRiskCategories.size / riskEventsTotal
    : 1

  const totalSimulatedTimeMs = frames.length > 0
    ? frames[frames.length - 1].timestamp - frames[0].timestamp
    : 0

  // Estimate GPU utilization based on VLM call frequency
  const vlmCallsPerSecond = totalSimulatedTimeMs > 0
    ? (vlmCalls / (totalSimulatedTimeMs / 1000))
    : 0
  const avgVlmLatencyMs = 800 // Estimated from Qwen3.5-4B Q4_K_M on consumer GPU
  const gpuUtilizationEstimate = Math.min(1, vlmCallsPerSecond * (avgVlmLatencyMs / 1000))

  return {
    config,
    totalFrames: frames.length,
    framesProcessed,
    motionDetectedFrames,
    objectDetectedFrames,
    vlmCalls,
    vlmCallReduction,
    riskEventsDetected: detectedRiskCategories.size,
    riskEventsTotal,
    detectionRate,
    falseNegatives: riskEventsTotal - detectedRiskCategories.size,
    avgVlmLatencyMs,
    totalSimulatedTimeMs,
    gpuUtilizationEstimate
  }
}

export function runFullBenchmark(durationMs: number = 300000): PipelineMetrics[] {
  const scenarios = [
    {
      name: 'Static scene (night)',
      activity: 'static' as const,
      riskEvents: [
        { startMs: 120000, endMs: 130000, category: 'fire_hazard', score: 85, hasPerson: false }
      ]
    },
    {
      name: 'Low activity (residential)',
      activity: 'low' as const,
      riskEvents: [
        { startMs: 60000, endMs: 80000, category: 'loitering', score: 70, hasPerson: true },
        { startMs: 200000, endMs: 215000, category: 'fallen_person', score: 80, hasPerson: true }
      ]
    },
    {
      name: 'Medium activity (daytime)',
      activity: 'medium' as const,
      riskEvents: [
        { startMs: 30000, endMs: 50000, category: 'fire_exit_blocked', score: 90, hasPerson: true },
        { startMs: 150000, endMs: 170000, category: 'gathering', score: 65, hasPerson: true },
        { startMs: 250000, endMs: 260000, category: 'ebike_charging', score: 88, hasPerson: false }
      ]
    },
    {
      name: 'High activity (entrance)',
      activity: 'high' as const,
      riskEvents: [
        { startMs: 20000, endMs: 40000, category: 'intrusion', score: 95, hasPerson: true },
        { startMs: 100000, endMs: 120000, category: 'loitering', score: 75, hasPerson: true },
        { startMs: 180000, endMs: 200000, category: 'fallen_person', score: 82, hasPerson: true },
        { startMs: 270000, endMs: 285000, category: 'fire_hazard', score: 88, hasPerson: false }
      ]
    }
  ]

  const configs: PipelineConfig[] = [
    'no-cascade',
    'fixed-fast',
    'fixed-slow',
    'cascade-no-adaptive',
    'cascade-no-priority',
    'full-cascade'
  ]

  const results: PipelineMetrics[] = []

  for (const scenario of scenarios) {
    const frames = generateScenario(durationMs, scenario.activity, scenario.riskEvents)
    for (const config of configs) {
      const metrics = simulatePipeline(frames, config)
      results.push(metrics)
    }
  }

  return results
}
