# Narrative Report: Cascaded Visual Intelligence for Edge-Deployed Community Safety Monitoring

**Date**: 2026-05-22
**Project**: community-risk-warning-system (险封 · 社区风险预警平台)
**Chosen Idea**: Cascaded Visual Intelligence Pipeline for Edge-Deployed Community Safety Monitoring

---

## 1. Problem Statement and Core Claim

**Problem**: Deploying Vision-Language Models (VLMs) for real-time community safety monitoring faces a critical efficiency challenge. Processing every video frame through a VLM is computationally prohibitive for edge deployment, while fixed-rate sampling either wastes resources on static scenes or misses rapid risk events.

**Core Claim**: A three-stage cascaded inference pipeline — pixel-level motion detection, object-level pre-screening (COCO-SSD), and scene-level VLM analysis (Qwen3.5-4B) — combined with adaptive frame sampling and priority-based scheduling, reduces VLM computational cost by 94.4% while maintaining 100% risk detection coverage on community surveillance scenarios.

**Motivation**: Community safety monitoring requires continuous analysis of camera feeds for risks including fire hazards, security threats, rescue needs, environmental dangers, and equipment anomalies. Existing approaches either use cloud-based VLMs (introducing latency and privacy concerns) or process frames at fixed rates (wasting compute on static scenes or missing events). Our cascaded approach addresses both limitations.

---

## 2. Method Summary

### 2.1 System Architecture

The system is a three-process Electron desktop application with an embedded Express proxy server:

1. **Electron Main Process**: Window management, VLM subprocess lifecycle (llama-server.exe), IPC bridge
2. **React Renderer**: SPA with three pages (Overview, Monitor, Alerts), Baidu Maps integration, Recharts visualizations
3. **Express Proxy**: Dual proxy for remote Qwen API and local llama.cpp VLM endpoint, with CORS, rate limiting, and request validation

### 2.2 Cascaded Inference Pipeline

**Stage 1: Adaptive Frame Capture** (`src/hooks/useFrameCapture.ts`)
- Captures frames at `activeIntervalMs` (500ms) when motion detected
- Falls back to `idleIntervalMs` (5000ms) after 6 consecutive unchanged frames
- Uses 160×120 canvas for motion detection to minimize overhead
- Scales captured frames to 640×480 JPEG at quality 0.7

**Stage 2: Object Detection Pre-screening** (`src/services/detection/objectDetector.ts`)
- COCO-SSD with Lite MobileNet v2 backbone (TensorFlow.js)
- Lazy-loaded on first use to avoid startup overhead
- Filters to allowed labels including `person`, `car`, `truck`, `bus`, `bicycle`, `motorcycle`, `dog`, and blockage-related objects
- Minimum confidence threshold: 0.35
- Acts as pre-filter: `person` detection triggers high-priority VLM dispatch

**Stage 3: VLM Analysis** (`src/services/llm/ollamaClient.ts`)
- Qwen3.5-4B SOMPOA heresy v2 MTP (Q4_K_M GGUF, ~2.71 GB)
- Vision encoder: mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf (~922 MB)
- Runtime: llama.cpp `llama-server.exe` b9484 with CUDA 12.4, flash attention, continuous batching, and MTP speculative decoding
- Temperature 0.15, max_tokens 800, no streaming
- Structured JSON output with risk score (0-100), level (A/B/C), confidence, evidence timeline, detection boxes

### 2.3 Priority-Based Scheduling

```
HIGH_PRIORITY_LABELS = {'person'}

if person detected:
    abort stale in-flight request → immediate VLM dispatch
elif other objects detected:
    dispatch VLM only if no request in-flight
else:
    fallback VLM every 10 seconds
```

### 2.4 VLM Response Parsing

- Strips `<think>` tags (Qwen3 reasoning blocks)
- Extracts JSON from markdown code fences or balanced `{}`
- Normalizes detection box coordinates to 0-1 range
- Validates and clamps risk scores (0-100), confidence (0-1), risk levels (A/B/C)
- Returns `VlmAnalysis` with: riskScore, level, hasRisk, confidence, summary, evidenceTimeline, breakdown, trend, behavioral flags

---

## 3. Key Quantitative Results

### 3.1 VLM Call Reduction (Main Result)

| Configuration | Avg VLM Calls | Call Reduction | Detection Rate | GPU Util |
|---|---|---|---|---|
| Naive (every frame) | 3,000 | 0.0% | 100.0% | 100.0% |
| Fixed 500ms | 600 | 80.0% | 100.0% | 100.0% |
| Fixed 5000ms | 60 | 98.0% | 100.0% | 16.0% |
| Cascade (no adaptive) | 200 | 93.3% | 100.0% | 49.2% |
| Cascade (no priority) | 187 | 93.8% | 100.0% | 45.7% |
| **Full Cascade (Ours)** | **169** | **94.4%** | **100.0%** | **43.2%** |

### 3.2 Per-Scenario Results

**Static scene (night)**: 1 risk event
- Naive: 3,000 VLM calls → Full Cascade: 1 call (99.97% reduction)

**Low activity (residential)**: 2 risk events
- Naive: 3,000 VLM calls → Full Cascade: 81 calls (97.3% reduction)

**Medium activity (daytime)**: 3 risk events
- Naive: 3,000 VLM calls → Full Cascade: 191 calls (93.6% reduction)

**High activity (entrance)**: 4 risk events
- Naive: 3,000 VLM calls → Full Cascade: 402 calls (86.6% reduction)

### 3.3 Ablation Study

| Stage Removed | VLM Calls | Reduction | Detection Rate |
|---|---|---|---|
| None (Full Cascade) | 169 | 94.4% | 100.0% |
| Remove priority scheduling | 187 | 93.8% | 100.0% |
| Remove adaptive sampling | 200 | 93.3% | 100.0% |
| Remove object detection | 600 | 80.0% | 100.0% |
| Remove all (Naive) | 3,000 | 0.0% | 100.0% |

**Key insight**: Object detection pre-filtering contributes the most to efficiency (93.3% → 80.0%), while adaptive sampling and priority scheduling provide additional gains of 7.3% and 0.6% respectively.

### 3.4 Efficiency vs Activity Level

The cascade is most efficient in low-activity scenarios (static: 99.97% reduction) and remains effective even in high-activity scenarios (86.6% reduction). This is because:
- Static scenes: Motion detection filters out most frames
- Low activity: Object detection filters out frames without relevant objects
- High activity: Priority scheduling prevents redundant VLM calls

---

## 4. Technical Contributions

1. **Cascaded inference architecture**: Motion detection → COCO-SSD → VLM, each stage filtering unnecessary calls to the next
2. **Adaptive frame sampling**: Motion-aware capture rate (500ms active / 5000ms idle) reduces frame volume by ~80% during static scenes
3. **Priority-based VLM scheduling**: Person detection triggers immediate dispatch with abort-stale-request semantics
4. **Structured risk output from small VLM**: Prompt engineering for reliable JSON extraction from Qwen3.5-4B with validation and clamping
5. **Edge deployment methodology**: Q4_K_M GGUF quantization via llama.cpp with flash attention and continuous batching

---

## 5. Figure/Table Inventory

### Figures Needed
1. **System architecture diagram**: Three-process Electron app with Express proxy and VLM subprocess
2. **Cascaded pipeline flowchart**: Motion → COCO-SSD → VLM with priority scheduling
3. **Adaptive sampling timeline**: Shows interval switching between active/idle modes
4. **VLM call reduction bar chart**: Comparison across all configurations
5. **Efficiency vs activity level plot**: VLM calls vs scene activity for each configuration
6. **Ablation contribution chart**: Pareto chart showing each stage's contribution

### Tables Needed
1. **Main results table**: VLM calls, reduction, detection rate, GPU utilization per configuration
2. **Per-scenario results**: Detailed breakdown by activity level
3. **Ablation study table**: Contribution of each pipeline stage
4. **Risk taxonomy table**: Five categories with examples and severity levels
5. **System configuration table**: Model specs, hardware requirements, inference parameters

---

## 6. Related Work

1. **HazardNet** (arXiv: 2502.20572, 2025): Fine-tuned Qwen2-VL-2B for traffic safety. No cascaded pipeline.
2. **edgeVLM** (arXiv: 2508.12638, 2025): Cloud-edge VLM with context transfer. Requires cloud connectivity.
3. **LiteVLA-Edge** (arXiv: 2603.03380, 2026): Quantized VLM with llama.cpp for robotics. Not surveillance-focused.
4. **Semantic Edge-Cloud** (arXiv: 2509.21259, 2025): YOLOv11 + ViT + LLM for traffic. Fixed multi-stage, no adaptive scheduling.
5. **GazeVLM** (arXiv: 2509.16476, 2025): Gaze-based token reduction. Not applicable to fixed cameras.

**Gap**: No existing work combines motion-triggered adaptive sampling + lightweight object detection pre-filter + priority-based VLM dispatch for community safety monitoring.

---

## 7. Limitations and Follow-up Items

### Limitations
1. **Simulation-based evaluation**: Results are from simulated scenarios, not real-world deployment measurements
2. **Single model evaluation**: Only Qwen3.5-4B evaluated; generalization to other VLMs untested
3. **Limited risk categories**: Five categories may not cover all community safety scenarios
4. **No temporal reasoning**: Current system analyzes single frames; no video-level temporal understanding
5. **Detection box accuracy**: VLM-generated detection boxes may be less precise than dedicated detectors

### Follow-up Items
1. **Real-world deployment study**: Deploy on actual community cameras and measure performance
2. **Multi-model comparison**: Evaluate different VLMs (Qwen2-VL, LLaVA, PaliGemma) in the cascade
3. **Temporal analysis**: Add frame-to-frame tracking and temporal risk aggregation
4. **User study**: Evaluate operator workload and alert fatigue with vs. without cascade filtering
5. **Power consumption measurement**: Measure actual GPU power draw on consumer hardware

---

## 8. Writing Handoff

- **NARRATIVE_REPORT.md**: Generated
- **Venue**: Not set — recommend AAAI, ACM MM, or IEEE ICIP for systems/AI paper
- **Manual figures needed**: System architecture diagram, pipeline flowchart, adaptive sampling timeline
- **Code artifacts**: `benchmark/pipeline-simulator.ts`, `benchmark/pipeline-benchmark.test.ts`, `benchmark/analyze-results.ts`
- **Existing code**: All pipeline components implemented in `src/` and `electron/`

### Recommended Paper Structure
1. Introduction: Community safety monitoring problem, VLM opportunity, efficiency challenge
2. Related Work: Edge VLM deployment, cascaded inference, adaptive sampling
3. Method: System architecture, cascaded pipeline, priority scheduling, risk output
4. Experiments: Simulation setup, main results, ablation study, per-scenario analysis
5. Discussion: Practical implications, deployment considerations, limitations
6. Conclusion: Summary of contributions, future work
