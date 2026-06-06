"""
Experiment 15: Grounding DINO Recovery Arm
Tests Grounding DINO-tiny on visually_unsupported IG-Miss clips
to determine if a stronger OVOD model can recover what the COCO gate misses.

Compares with OWL-ViT-base results from E13b.

Usage:
  python experiments/exp15_grounding_dino_recovery.py
"""

import os
import json
import numpy as np
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent.parent
OUTPUT_DIR = ROOT / "experiments" / "results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Load threshold sweep data to find visually_unsupported clips that IG-Miss at 0.4
with open(OUTPUT_DIR / "exp14b_threshold_sweep_expanded.json") as f:
    sweep_data = json.load(f)

# Find visually_unsupported clips that IG-Miss at threshold 0.4
# These are the clips the COCO gate cannot detect
EXPANDED_DIR = ROOT / "idea-stage" / "refine-logs" / "datasets" / "frames_expanded"
LARGE_EXPANDED_DIR = ROOT / "idea-stage" / "refine-logs" / "datasets" / "frames_large_expanded"

# Collect visually_unsupported frames
vu_frames = []
for d in [EXPANDED_DIR, LARGE_EXPANDED_DIR]:
    if d.exists():
        for f in d.glob("*.jpg"):
            name = f.stem.lower()
            if any(x in name for x in ["smoke", "fire", "blockage"]):
                vu_frames.append(f)

print(f"Total visually_unsupported frames: {len(vu_frames)}")

# Load Grounding DINO
print("\nLoading Grounding DINO tiny...")
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
model_id = "IDEA-Research/grounding-dino-tiny"
processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id)
model.eval()
print("Grounding DINO loaded.")

# Test prompts — risk-relevant text queries
RISK_PROMPTS = [
    "smoke . fire . flames . burning . channel blockage . obstacle . debris",
]

# Thresholds to test
GD_THRESHOLDS = [0.3, 0.5, 0.7]

print(f"\nRunning Grounding DINO on {len(vu_frames)} visually_unsupported frames...")
results = []

for i, frame_path in enumerate(vu_frames):
    if (i + 1) % 25 == 0:
        print(f"  Processing {i+1}/{len(vu_frames)}...")

    image = Image.open(frame_path).convert("RGB")

    frame_result = {
        "file": frame_path.name,
        "category": "smoke" if "smoke" in frame_path.stem.lower() else
                    "fire" if "fire" in frame_path.stem.lower() else
                    "channel_blockage",
        "detections": {},
    }

    for prompt in RISK_PROMPTS:
        inputs = processor(images=image, text=prompt, return_tensors="pt")

        with __import__("torch").no_grad():
            outputs = model(**inputs)

        results_post = processor.post_process_grounded_object_detection(
            outputs,
            inputs["input_ids"],
            threshold=0.25,
            text_threshold=0.1,
            target_sizes=[image.size[::-1]],
        )[0]

        scores = results_post["scores"].numpy()
        labels = results_post["labels"]
        boxes = results_post["boxes"].numpy()

        frame_result["detections"][prompt] = {
            "max_score": float(scores.max()) if len(scores) > 0 else 0.0,
            "n_detections": len(scores),
            "top_detections": [
                {
                    "label": labels[j],
                    "score": float(scores[j]),
                    "box": boxes[j].tolist() if len(boxes) > 0 else [],
                }
                for j in np.argsort(-scores)[:5]
            ],
        }

    results.append(frame_result)

# Analyze results
print("\n=== Grounding DINO Recovery Analysis ===")

for thresh in GD_THRESHOLDS:
    n_detected = 0
    for r in results:
        for prompt, det in r["detections"].items():
            if det["max_score"] >= thresh:
                n_detected += 1
                break
    print(f"Threshold {thresh}: {n_detected}/{len(results)} frames detected ({n_detected/len(results):.1%})")

# Per-category breakdown
categories = {}
for r in results:
    cat = r["category"]
    if cat not in categories:
        categories[cat] = {"n": 0, "max_scores": []}
    categories[cat]["n"] += 1
    for prompt, det in r["detections"].items():
        categories[cat]["max_scores"].append(det["max_score"])

print("\nPer-category max scores:")
for cat, data in sorted(categories.items()):
    scores = data["max_scores"]
    print(f"  {cat}: n={data['n']}, max={max(scores):.4f}, mean={np.mean(scores):.4f}, "
          f"median={np.median(scores):.4f}")

# Overall summary
all_max_scores = []
for r in results:
    for prompt, det in r["detections"].items():
        all_max_scores.append(det["max_score"])

summary = {
    "n_frames_tested": len(results),
    "model": "IDEA-Research/grounding-dino-tiny",
    "prompts": RISK_PROMPTS,
    "overall": {
        "max_score": float(max(all_max_scores)),
        "mean_score": float(np.mean(all_max_scores)),
        "median_score": float(np.median(all_max_scores)),
        "n_above_0.3": sum(1 for s in all_max_scores if s >= 0.3),
        "n_above_0.5": sum(1 for s in all_max_scores if s >= 0.5),
    },
    "per_category": {
        cat: {
            "n": data["n"],
            "max_score": float(max(data["max_scores"])),
            "mean_score": float(np.mean(data["max_scores"])),
        }
        for cat, data in categories.items()
    },
    "threshold_analysis": {
        str(t): sum(1 for s in all_max_scores if s >= t)
        for t in GD_THRESHOLDS
    },
}

# Compare with OWL-ViT
owl_max = 0.0277  # from E13b results
print(f"\n=== OVOD Model Comparison ===")
print(f"OWL-ViT-base max ceiling: {owl_max:.4f}")
print(f"Grounding DINO-tiny max:  {max(all_max_scores):.4f}")
print(f"Improvement factor:       {max(all_max_scores)/owl_max:.1f}x" if owl_max > 0 else "N/A")

# Save
output = {
    "experiment": "Grounding DINO Recovery on Visually_Unsupported IG-Miss Frames",
    "summary": summary,
    "per_frame_results": results,
}

output_path = OUTPUT_DIR / "exp15_grounding_dino_recovery.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
print(f"\nResults saved to {output_path}")

# Operational detection count at threshold 0.5
n_op = sum(1 for s in all_max_scores if s >= 0.5)
print(f"\nOperational detections (threshold 0.5): {n_op}/{len(all_max_scores)}")
print(f"Operational detections (threshold 0.3): {sum(1 for s in all_max_scores if s >= 0.3)}/{len(all_max_scores)}")
