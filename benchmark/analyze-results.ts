/**
 * Benchmark Analysis Script
 *
 * Runs the full pipeline benchmark and generates results tables
 * for the research paper.
 */

import {
  generateScenario,
  simulatePipeline,
  type PipelineConfig,
  type PipelineMetrics
} from './pipeline-simulator'

const DURATION_MS = 300000 // 5 minutes

const scenarios = [
  {
    name: 'Static (night)',
    activity: 'static' as const,
    riskEvents: [
      { startMs: 120000, endMs: 135000, category: 'fire_hazard', score: 85, hasPerson: false }
    ]
  },
  {
    name: 'Low activity (residential)',
    activity: 'low' as const,
    riskEvents: [
      { startMs: 60000, endMs: 85000, category: 'loitering', score: 70, hasPerson: true },
      { startMs: 200000, endMs: 220000, category: 'fallen_person', score: 80, hasPerson: true }
    ]
  },
  {
    name: 'Medium activity (daytime)',
    activity: 'medium' as const,
    riskEvents: [
      { startMs: 30000, endMs: 55000, category: 'fire_exit_blocked', score: 90, hasPerson: true },
      { startMs: 150000, endMs: 175000, category: 'gathering', score: 65, hasPerson: true },
      { startMs: 250000, endMs: 270000, category: 'ebike_charging', score: 88, hasPerson: false }
    ]
  },
  {
    name: 'High activity (entrance)',
    activity: 'high' as const,
    riskEvents: [
      { startMs: 20000, endMs: 45000, category: 'intrusion', score: 95, hasPerson: true },
      { startMs: 100000, endMs: 125000, category: 'loitering', score: 75, hasPerson: true },
      { startMs: 180000, endMs: 205000, category: 'fallen_person', score: 82, hasPerson: true },
      { startMs: 270000, endMs: 290000, category: 'fire_hazard', score: 88, hasPerson: false }
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

const configLabels: Record<PipelineConfig, string> = {
  'no-cascade': 'Naive (every frame)',
  'fixed-fast': 'Fixed 500ms',
  'fixed-slow': 'Fixed 5000ms',
  'cascade-no-adaptive': 'Cascade (no adaptive)',
  'cascade-no-priority': 'Cascade (no priority)',
  'full-cascade': 'Full Cascade (Ours)'
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%'
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function main() {
  console.log('=== Community Risk Warning System: Pipeline Benchmark Results ===')
  console.log(`Duration: ${DURATION_MS / 1000}s per scenario\n`)

  const allResults: Array<PipelineMetrics & { scenarioName: string }> = []

  for (const scenario of scenarios) {
    const frames = generateScenario(DURATION_MS, scenario.activity, scenario.riskEvents)
    console.log(`\n--- Scenario: ${scenario.name} (${frames.length} frames, ${scenario.riskEvents.length} risk events) ---`)

    const scenarioResults: PipelineMetrics[] = []
    for (const config of configs) {
      const metrics = simulatePipeline(frames, config)
      scenarioResults.push(metrics)
      allResults.push({ ...metrics, scenarioName: scenario.name })
    }

    // Table 1: VLM Call Efficiency
    console.log('\n| Configuration | Frames Processed | VLM Calls | Call Reduction | Detection Rate |')
    console.log('|---|---|---|---|---|')
    for (const r of scenarioResults) {
      console.log(`| ${configLabels[r.config]} | ${formatNumber(r.framesProcessed)} | ${formatNumber(r.vlmCalls)} | ${formatPercent(r.vlmCallReduction)} | ${formatPercent(r.detectionRate)} |`)
    }
  }

  // Aggregate results
  console.log('\n\n=== Aggregate Results Across All Scenarios ===\n')

  const aggregated = configs.map(config => {
    const configResults = allResults.filter(r => r.config === config)
    return {
      config,
      label: configLabels[config],
      avgVlmCalls: configResults.reduce((s, r) => s + r.vlmCalls, 0) / configResults.length,
      avgReduction: configResults.reduce((s, r) => s + r.vlmCallReduction, 0) / configResults.length,
      avgDetectionRate: configResults.reduce((s, r) => s + r.detectionRate, 0) / configResults.length,
      avgGpuUtil: configResults.reduce((s, r) => s + r.gpuUtilizationEstimate, 0) / configResults.length,
      totalVlmCalls: configResults.reduce((s, r) => s + r.vlmCalls, 0),
      totalFrames: configResults.reduce((s, r) => s + r.totalFrames, 0)
    }
  })

  console.log('| Configuration | Avg VLM Calls | Avg Call Reduction | Avg Detection Rate | Avg GPU Util |')
  console.log('|---|---|---|---|---|')
  for (const a of aggregated) {
    console.log(`| ${a.label} | ${Math.round(a.avgVlmCalls)} | ${formatPercent(a.avgReduction)} | ${formatPercent(a.avgDetectionRate)} | ${formatPercent(a.avgGpuUtil)} |`)
  }

  // Ablation table
  console.log('\n\n=== Ablation Study: Contribution of Each Stage ===\n')
  console.log('| Stage | VLM Calls | Reduction vs Naive | Detection Rate |')
  console.log('|---|---|---|---|')

  const naiveCalls = aggregated.find(a => a.config === 'no-cascade')!.avgVlmCalls
  for (const a of aggregated) {
    const reduction = 1 - (a.avgVlmCalls / naiveCalls)
    console.log(`| ${a.label} | ${Math.round(a.avgVlmCalls)} | ${formatPercent(reduction)} | ${formatPercent(a.avgDetectionRate)} |`)
  }

  // Efficiency vs Coverage tradeoff
  console.log('\n\n=== Efficiency vs Detection Coverage Tradeoff ===\n')
  console.log('Config | VLM Calls | Detection Rate | GPU Utilization')
  console.log('---|---|---|---')
  for (const a of aggregated) {
    console.log(`${a.label} | ${Math.round(a.avgVlmCalls)} | ${formatPercent(a.avgDetectionRate)} | ${formatPercent(a.avgGpuUtil)}`)
  }

  // Key findings
  console.log('\n\n=== Key Findings ===\n')
  const ours = aggregated.find(a => a.config === 'full-cascade')!
  const baseline = aggregated.find(a => a.config === 'no-cascade')!
  const reduction = 1 - (ours.avgVlmCalls / baseline.avgVlmCalls)
  console.log(`1. VLM Call Reduction: ${formatPercent(reduction)} fewer VLM calls vs naive baseline`)
  console.log(`2. Detection Rate: ${formatPercent(ours.avgDetectionRate)} risk event detection coverage`)
  console.log(`3. GPU Utilization: ${formatPercent(ours.avgGpuUtil)} estimated GPU utilization`)
  console.log(`4. Adaptive sampling reduces frame processing by ${formatPercent(1 - (ours.avgVlmCalls / baseline.avgVlmCalls))}`)
}

main()
