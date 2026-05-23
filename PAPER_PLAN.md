# Paper Plan: Cascaded Visual Intelligence for Edge-Deployed Community Safety Monitoring

**Venue**: AAAI 2027
**Page Limit**: 7 pages (excluding references)
**Format**: AAAI style, anonymous submission

---

## Title

**Cascaded Visual Intelligence: Efficient Community Safety Monitoring via Multi-Stage Filtering and Priority-Based VLM Scheduling**

---

## Abstract (150 words)

Vision-Language Models (VLMs) offer powerful capabilities for understanding surveillance footage, but their computational cost makes real-time deployment on edge hardware impractical when processing every video frame. We present a cascaded inference pipeline for community safety monitoring that reduces VLM computational cost by 94.4% while maintaining 100% risk detection coverage. Our three-stage architecture progressively filters frames: (1) pixel-level motion detection with adaptive sampling reduces frame volume by switching between 500ms active and 5000ms idle capture intervals; (2) lightweight object detection (COCO-SSD MobileNet v2) pre-screens frames, dispatching to the VLM only when relevant objects are detected; (3) a priority-based scheduler triggers immediate VLM analysis for high-priority detections (person) while using opportunistic dispatch for other objects. We deploy a quantized Qwen3.5-4B VLM via llama.cpp on consumer hardware and evaluate across four activity scenarios ranging from static nighttime scenes to high-traffic entrances. Ablation analysis shows object detection pre-filtering contributes the largest efficiency gain (93.3%), with adaptive sampling and priority scheduling providing additional cumulative benefits.

---

## Claims-Evidence Matrix

| Claim | Evidence | Section |
|-------|----------|---------|
| Cascaded pipeline reduces VLM calls by 94.4% | Table 1: Main results across 6 configurations | Experiments |
| Detection rate maintained at 100% | Table 1, Table 2: Per-scenario detection rates | Experiments |
| Object detection contributes most to efficiency | Table 3: Ablation study (93.3% → 80.0%) | Experiments |
| Adaptive sampling provides additional 7.3% gain | Table 3: Ablation (cascade-no-adaptive vs full) | Experiments |
| Priority scheduling provides additional 0.6% gain | Table 3: Ablation (cascade-no-priority vs full) | Experiments |
| System works across activity levels | Table 2: Static 99.97%, Low 97.3%, Medium 93.6%, High 86.6% | Experiments |
| Edge deployment feasible with quantized VLM | Section 3.3: Q4_K_M GGUF, ~2.55GB, llama.cpp | Method |

---

## Section Plan

### 1. Introduction (1 page)

**Structure**:
- Opening: Community safety monitoring is critical but labor-intensive
- Problem: VLMs are powerful but too expensive for real-time edge deployment
- Gap: Existing work either uses cloud (latency/privacy) or fixed-rate sampling (wasteful/misses events)
- Contribution statement: Three-stage cascaded pipeline with adaptive sampling and priority scheduling
- Paper organization paragraph

**Key points**:
- Community safety covers fire hazards, security threats, rescue needs, environmental risks
- Edge deployment requires sub-second latency on consumer hardware
- Our cascade: motion detection → COCO-SSD → VLM with priority scheduling
- 94.4% VLM call reduction, 100% detection rate maintained

**Figures**: None in introduction

### 2. Related Work (0.75 pages)

**Structure**:
- Edge VLM deployment: HazardNet, edgeVLM, LiteVLA-Edge
- Cascaded inference: Semantic Edge-Cloud, multi-stage pipelines
- Adaptive sampling: Event-driven surveillance, variable frame rate
- Community safety: Gap in residential monitoring with VLMs

**Key papers to cite**:
1. HazardNet (2502.20572) - Fine-tuned Qwen2-VL-2B for traffic safety
2. edgeVLM (2508.12638) - Cloud-edge VLM with context transfer
3. LiteVLA-Edge (2603.03380) - Quantized VLM via llama.cpp
4. Semantic Edge-Cloud (2509.21259) - YOLOv11 + ViT + LLM
5. GazeVLM (2509.16476) - Gaze-based token reduction

**Gap statement**: No existing work combines motion-triggered adaptive sampling + lightweight object detection pre-filter + priority-based VLM dispatch for community safety monitoring.

### 3. Method (2 pages)

#### 3.1 System Architecture (0.5 pages)
- Three-process Electron app with Express proxy
- VLM subprocess lifecycle management (llama-server.exe)
- Figure 1: System architecture diagram

#### 3.2 Cascaded Inference Pipeline (1 page)
- Stage 1: Adaptive Frame Capture
  - Motion detection via pixel-level grayscale comparison
  - 160×120 canvas for diff computation
  - Active interval: 500ms, Idle interval: 5000ms after 6 unchanged frames
- Stage 2: Object Detection Pre-screening
  - COCO-SSD Lite MobileNet v2 (TensorFlow.js)
  - Lazy loading, allowed labels filter
  - Confidence threshold: 0.4
- Stage 3: VLM Analysis
  - Qwen3.5-4B Q4_K_M GGUF via llama.cpp
  - Structured JSON output with risk assessment
- Figure 2: Pipeline flowchart

#### 3.3 Priority-Based Scheduling (0.25 pages)
- High-priority (person): abort stale, immediate dispatch
- Low-priority: opportunistic dispatch
- Fallback: every 10 seconds

#### 3.4 VLM Response Parsing (0.25 pages)
- JSON extraction from model output
- Validation and clamping
- Risk taxonomy: fire, security, rescue, environmental, equipment

### 4. Experiments (2 pages)

#### 4.1 Experimental Setup (0.5 pages)
- Simulation framework description
- Four activity scenarios: static, low, medium, high
- Six pipeline configurations for comparison
- Metrics: VLM calls, call reduction, detection rate, GPU utilization
- Table 4: System configuration and model specifications

#### 4.2 Main Results (0.5 pages)
- Table 1: Main results across all configurations
- Key finding: 94.4% reduction with 100% detection
- Figure 3: Bar chart comparing configurations

#### 4.3 Per-Scenario Analysis (0.5 pages)
- Table 2: Results by activity level
- Static: 99.97% reduction (motion filters almost everything)
- Low: 97.3% reduction (object detection + adaptive sampling)
- Medium: 93.6% reduction (more objects, but priority scheduling helps)
- High: 86.6% reduction (many objects, but still significant savings)
- Figure 4: Efficiency vs activity level

#### 4.4 Ablation Study (0.5 pages)
- Table 3: Contribution of each pipeline stage
- Object detection: 93.3% → 80.0% (largest contribution)
- Adaptive sampling: 80.0% → 93.3% (7.3% additional gain)
- Priority scheduling: 93.3% → 94.4% (0.6% additional gain)
- Figure 5: Ablation contribution chart

### 5. Discussion (0.5 pages)

- Practical deployment considerations
- Edge hardware requirements (consumer GPU, ~3GB VRAM)
- Privacy benefits of local processing
- Limitations: simulation-based evaluation, single model, limited categories
- Comparison with cloud-based alternatives

### 6. Conclusion (0.25 pages)

- Summary of contributions
- 94.4% VLM call reduction with 100% detection coverage
- Practical edge deployment with quantized VLM
- Future work: real-world deployment, multi-model comparison, temporal reasoning

---

## Figure Plan

### Auto-generated (Phase 2)

| # | Caption | Type | Data Source |
|---|---------|------|-------------|
| 3 | VLM call reduction across pipeline configurations | Bar chart | benchmark results |
| 4 | Efficiency vs scene activity level | Line/scatter | benchmark results |
| 5 | Ablation: contribution of each pipeline stage | Pareto chart | benchmark results |

### Manual / Phase 2b (Architecture)

| # | Caption | Type | Source |
|---|---------|------|--------|
| 1 | System architecture: Electron app with Express proxy and VLM subprocess | Architecture diagram | Phase 2b (figurespec) |
| 2 | Cascaded inference pipeline: Motion → COCO-SSD → VLM with priority scheduling | Flowchart | Phase 2b (figurespec) |

### Tables (LaTeX, Phase 3)

| # | Caption | Content |
|---|---------|---------|
| 1 | Main results: VLM call reduction and detection rate across configurations | 6 rows × 4 columns |
| 2 | Per-scenario results by activity level | 4 scenarios × 4 metrics |
| 3 | Ablation study: contribution of each pipeline stage | 5 rows × 3 columns |
| 4 | System configuration and model specifications | Model/runtime/hardware specs |

---

## Citation Structure

### Core citations (must include)
- HazardNet (2502.20572) - Edge VLM for traffic safety
- edgeVLM (2508.12638) - Cloud-edge VLM collaboration
- LiteVLA-Edge (2603.03380) - Quantized VLM deployment
- Semantic Edge-Cloud (2509.21259) - Multi-stage pipeline
- GazeVLM (2509.16476) - Efficient VLM inference

### Supporting citations
- COCO-SSD / MobileNet - Object detection baseline
- llama.cpp - Edge inference runtime
- Qwen-VL series - VLM architecture
- TensorFlow.js - Browser-side ML

### Application citations
- Community safety monitoring systems
- Smart surveillance literature
- Edge AI deployment papers

---

## Page Budget

| Section | Pages | Notes |
|---------|-------|-------|
| Abstract | - | In AAAI format header |
| 1. Introduction | 1.0 | Problem + contribution |
| 2. Related Work | 0.75 | 5 key papers + gap |
| 3. Method | 2.0 | Architecture + pipeline + scheduling |
| 4. Experiments | 2.0 | Setup + results + ablation |
| 5. Discussion | 0.5 | Deployment + limitations |
| 6. Conclusion | 0.25 | Summary |
| **Total** | **6.5** | Within 7-page limit |
| References | ~1.0 | 15-20 citations |
