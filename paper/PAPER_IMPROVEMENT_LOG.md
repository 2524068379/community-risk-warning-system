# Paper Improvement Log

## Score Progression

| Round | Score | Verdict | Key Changes |
|-------|-------|---------|-------------|
| Round 0 (original) | 5/10 | No | Simulation-only, no latency data, unrealistic detection rate |
| Round 1 | 6/10 | Almost | Added hardware specs, latency measurements, simulation caveats, deployment table |
| Round 2 | 7/10 | Almost | Added comparison table, compressed abstract, added future work |
| Round 3 (this loop) | 3/10 | No | GPT-5.5 xhigh review: simulation tautological, novelty weak, model unclear |
| Round 4 (this loop) | 3/10 | No | Same core issues remain; fixed algorithm format, GPU math, overclaims |
| Round 5 (fresh continuation) | 3/10 | No | Oracle framing, algorithm fix, GPU load correction, cumulative ablation, reproducibility tables, figure relabeling |
| Round 6 (fresh continuation) | 4/10 | No | Stronger oracle upper-bound framing, formal budgeted-monitoring problem, non-evaluated-scope section, risk trigger taxonomy, simulator audit tables, resource-budget scope |

## Round 3 Review (GPT-5.5 xhigh)

<details>
<summary>GPT-5.5 xhigh Review (Round 3)</summary>

**Overall Score: 3/10**

The paper proposes a practical cascade for reducing VLM calls in community monitoring: motion filtering, COCO-SSD prefiltering, then priority-based VLM scheduling. The engineering direction is reasonable, but the current evidence is mostly simulated and assumes perfect detector/VLM behavior, so the central claims are not yet AAAI-level.

**Strengths**
1. Clear practical motivation: reducing local VLM inference cost for privacy-sensitive monitoring is a real problem.
2. The cascade is easy to understand and deploy, with sensible components.
3. The paper is honest in several places that the 100% detection rate is simulated.
4. The ablation table communicates where efficiency gains come from.
5. The system perspective is useful for implementation readers.

**Weaknesses**

CRITICAL 1: Detection performance is not actually evaluated. The 100% detection rate is assumed by the simulator.

CRITICAL 2: The cascade can miss important safety risks by design. Stage 2 only keeps person/car/bicycle/motorcycle/dog.

CRITICAL 3: The contribution is mostly an engineering cascade, not yet a research contribution.

MAJOR 1: GPU utilization and real-time feasibility are under-specified.

MAJOR 2: Experimental setup lacks enough detail to reproduce.

MAJOR 3: Baselines are too weak.

MAJOR 4: Model identity and reproducibility are unclear.

MAJOR 5: Not in AAAI format.

**Verdict: No**

</details>

### Fixes Implemented (Round 3)
1. Added hidelinks to hyperref to remove colored link boxes
2. Softened abstract to explicitly mention simulation limitations
3. Reframed contributions to emphasize formal scheduling problem
4. Added risk-class coverage analysis (Table 2) showing COCO-SSD gaps
5. Added throughput analysis with GPU utilization formula
6. Added simulation protocol details (Poisson process, event durations, random seed)
7. Added deployment parameters (model source, decoding params, runtime versions)
8. Added pseudocode for priority scheduling algorithm
9. Added missing references: NoScope, BlazeIt, VideoStorm, Chameleon, Qwen-VL, LLaVA
10. Added citations in method section for COCO-SSD, MobileNetV2, TensorFlow.js, llama.cpp
11. Updated comparison table to include video analytics baselines
12. Softened overclaims: "打破权衡" → "取得更好的平衡"
13. Expanded limitations section with detailed caveats

## Round 4 Review (GPT-5.5 xhigh)

<details>
<summary>GPT-5.5 xhigh Review (Round 4)</summary>

**Overall Score: 3/10**

Same core issues remain: simulation-only evaluation, novelty framing, model reproducibility. The reviewer acknowledged improvements in risk-class coverage analysis and deployment parameters.

**Verdict: No**

</details>

### Fixes Implemented (Round 4)
1. Fixed algorithm formatting (changed from figure to algorithm environment)
2. Fixed GPU utilization math (clarified formula, added equation environment)
3. Softened priority scheduling claims
4. Minor text reformatting to reduce overfull warnings

## Round 5 Review (GPT-5.5 xhigh, Fresh Zero-Context)

<details>
<summary>GPT-5.5 xhigh Review (Round 5)</summary>

**Overall Score: 3/10**

The paper describes a practical local VLM cascade, but the reviewer found that the evaluation still assumed the central perception outcome. The paper needed to state that the reported 100% result is an oracle scheduling upper bound, not an evaluated detection rate.

**Critical Issues**
1. The experiment assumed perfect detector/VLM behavior and therefore did not establish safety-event detection accuracy.
2. Novelty was overstated relative to existing cascaded video analytics and adaptive sampling systems.
3. Algorithm 1 used malformed pseudocode syntax (`\Elsif`) and did not clearly model in-flight request behavior.

**Major Issues**
1. GPU load calculations were inconsistent with the reported latency and call volume.
2. The ablation table could be misread as independent one-factor ablations rather than cumulative policy variants.
3. The model identity and simulator settings were not sufficiently reproducible.
4. Figure labels and captions were not clear enough about oracle simulation.

**Verdict: No**

</details>

### Fixes Implemented (Round 5)
1. Reframed the abstract and result language around oracle simulation and VLM call-volume upper bounds.
2. Rewrote contributions to emphasize engineering integration, scheduling, prompt/output structuring, and resource modeling rather than detection accuracy.
3. Fixed Algorithm 1 with valid `\ElsIf` syntax, explicit `lastVlmTime`, in-flight handling, and stale request abort semantics.
4. Corrected GPU load discussion and aligned the load estimate with measured latency and call counts.
5. Recast ablation results as cumulative policy variants.
6. Added reproducibility detail for simulator parameters and event generation.
7. Relabeled figures to reduce detection-rate overclaiming.

## Round 6 Review (GPT-5.5 xhigh, Fresh Zero-Context)

<details>
<summary>GPT-5.5 xhigh Review (Round 6)</summary>

**Overall Score: 4/10**

The reviewer found the paper more honest and technically cleaner, but still not AAAI-ready. The strongest remaining problem is that the evidence supports only resource reduction under an oracle event simulator, not real-world detection or warning reliability.

**Critical Issues**
1. The paper was still easy to read as a detection/warning evaluation unless the oracle upper-bound framing was made unavoidable.
2. The evaluated scope did not include false positives, false negatives, localization, temporal alert latency under real model errors, or human-usable warning quality.
3. The scheduling problem needed a clearer formal statement of inputs, decisions, budget, and measured outcomes.

**Major Issues**
1. Priority scheduling remained an engineering policy rather than a demonstrated research novelty.
2. Multi-camera deployment claims exceeded the measured single-GPU resource budget.
3. Simulator configuration and event windows needed audit-friendly tables.
4. Risk taxonomy needed to distinguish direct COCO-triggered, indirect, and fallback-only event classes.
5. Model citation needed to identify the GGUF model source directly.

**Verdict: No**

</details>

### Fixes Implemented (Round 6)
1. Strengthened title, abstract, metric names, table captions, and conclusion around "oracle scheduling coverage upper bound".
2. Added a formal "预算化本地VLM监控问题" statement with stream inputs, gate decisions, VLM budget, priority order, and measured outputs.
3. Added an explicit "未评估内容" subsection listing the real detection and warning-quality questions not covered by the simulator.
4. Revised the risk taxonomy into direct-trigger, indirect-trigger, and fallback-only classes.
5. Added simulator event-window and per-scenario call-count tables for auditability.
6. Replaced the loose model wording with a direct citation to the GGUF model entry.
7. Narrowed deployment claims to single-camera feasibility and stated that community-scale multi-camera deployment is unproven.
8. Removed unused bibliography entries and regenerated all figures.

## PDFs
- `main_round0_original.pdf` — Original generated paper
- `main_round1.pdf` — After Round 3 fixes
- `main_round2.pdf` — After Round 4 fixes (final)
- `main_round4_baseline_20260522-190921.pdf` — Baseline for fresh continuation loop
- `main_round5.pdf` — After Round 5 fixes
- `main_round6.pdf` — After Round 6 fixes (final for this loop)

## Remaining Issues (Fundamental)
1. **Simulation-only evaluation**: The paper now frames results as an oracle scheduling upper bound, but still needs real video data.
2. **No real detection metrics**: False positives, false negatives, localization, real temporal latency, and alert quality are not evaluated.
3. **Novelty**: The core method remains an engineering combination of existing cascade, adaptive sampling, and priority scheduling ideas.
4. **AAAI format**: Paper uses `ctexart` single-column, not the AAAI double-column template.
5. **Weak baselines**: No equal-budget comparison with mature video analytics systems under real data.

## Recommendations for AAAI Submission
1. Run experiments on public surveillance datasets (UCF-Crime, ShanghaiTech, etc.)
2. Report actual precision/recall/F1 on real risk events
3. Formalize the scheduling problem with provable guarantees
4. Use official AAAI LaTeX template
5. Compare against NoScope/Chameleon-style adaptive baselines
