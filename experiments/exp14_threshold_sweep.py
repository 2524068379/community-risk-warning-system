"""
Experiment 14: Threshold Sensitivity Sweep
Runs YOLOv8n at multiple confidence thresholds on pilot + textured frames
to prove IG-Miss is robust to threshold choice, not an artifact of conf=0.4.

Usage:
  python experiments/exp14_threshold_sweep.py
"""

import os
import json
import numpy as np
from pathlib import Path
from collections import defaultdict

# Paths
ROOT = Path(__file__).parent.parent
PILOT_DIR = ROOT / "idea-stage" / "refine-logs" / "datasets" / "frames"
TEXTURED_DIR = ROOT / "idea-stage" / "refine-logs" / "datasets" / "frames_textured"
ANNOTATIONS = ROOT / "idea-stage" / "refine-logs" / "datasets" / "annotations.tsv"
OUTPUT_DIR = ROOT / "experiments" / "results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = ROOT / "yolov8n.pt"

THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]

# Gate support taxonomy
VISUALLY_UNSUPPORTED = {"smoke", "fire", "channel_blockage"}
MODALITY_UNSUPPORTED = {"audio_threat"}
PROXY_SUPPORTED = {"loitering", "crowd", "theft", "aggression", "vandalism", "fall"}


def wilson_ci(rate, n, z=1.96):
    if n == 0:
        return 0.0, 0.0
    p = rate
    denom = 1 + z**2 / n
    centre = (p + z**2 / (2*n)) / denom
    margin = z * np.sqrt((p*(1-p) + z**2/(4*n)) / n) / denom
    return max(0.0, centre - margin), min(1.0, centre + margin)


def load_annotations(annotations_path):
    clips = {}
    with open(annotations_path) as f:
        next(f)  # skip header
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) == 3:
                clip_id, category, risk_present = parts
                clips[clip_id] = {
                    "category": category,
                    "risk_present": risk_present == "True"
                }
    return clips


def yolo_gate_fires(image_path, model, threshold):
    """Return True if YOLO detects any COCO object above threshold."""
    results = model(str(image_path), conf=threshold, verbose=False)
    for r in results:
        if len(r.boxes) > 0:
            return True
    return False


def main():
    from ultralytics import YOLO

    print(f"Loading YOLOv8n from {MODEL_PATH}")
    model = YOLO(str(MODEL_PATH))

    annotations = load_annotations(ANNOTATIONS)

    # Collect all clips with risk_present=True
    risk_clips = {cid: info for cid, info in annotations.items() if info["risk_present"]}
    print(f"Total risk-positive clips: {len(risk_clips)}")

    # Find image files for each clip — use textured frames when available (better quality)
    clip_images = {}
    for clip_id in risk_clips:
        textured_path = TEXTURED_DIR / f"{clip_id}_textured.jpg"
        pilot_path = PILOT_DIR / f"{clip_id}.jpg"
        if textured_path.exists():
            clip_images[clip_id] = textured_path
        elif pilot_path.exists():
            clip_images[clip_id] = pilot_path

    print(f"Clips with images found: {len(clip_images)}")

    # Run YOLO at each threshold
    results_by_threshold = {}
    for thresh in THRESHOLDS:
        print(f"\n--- Threshold = {thresh} ---")
        gate_results = {}
        for clip_id, img_path in clip_images.items():
            fires = yolo_gate_fires(img_path, model, thresh)
            gate_results[clip_id] = fires

        # Compute IG-Miss per category
        cat_results = {}
        for clip_id, info in risk_clips.items():
            cat = info["category"]
            if cat not in cat_results:
                cat_results[cat] = {"n_risk": 0, "n_ig_miss": 0}
            cat_results[cat]["n_risk"] += 1
            if clip_id in gate_results and not gate_results[clip_id]:
                cat_results[cat]["n_ig_miss"] += 1

        # Compute IG-Miss rates
        for cat, d in cat_results.items():
            d["ig_miss_rate"] = d["n_ig_miss"] / d["n_risk"] if d["n_risk"] > 0 else 0.0
            ci_lo, ci_hi = wilson_ci(d["ig_miss_rate"], d["n_risk"])
            d["ci_lower"] = ci_lo
            d["ci_upper"] = ci_hi

        # Group-level
        group_results = {}
        for group_name, cat_set in [
            ("visually_unsupported", VISUALLY_UNSUPPORTED),
            ("modality_unsupported", MODALITY_UNSUPPORTED),
            ("proxy_supported", PROXY_SUPPORTED),
        ]:
            total_risk = sum(cat_results.get(c, {}).get("n_risk", 0) for c in cat_set)
            total_miss = sum(cat_results.get(c, {}).get("n_ig_miss", 0) for c in cat_set)
            rate = total_miss / total_risk if total_risk > 0 else 0.0
            ci_lo, ci_hi = wilson_ci(rate, total_risk)
            group_results[group_name] = {
                "n_risk": total_risk,
                "n_ig_miss": total_miss,
                "ig_miss_rate": rate,
                "ci_lower": ci_lo,
                "ci_upper": ci_hi,
            }
            print(f"  {group_name}: {rate:.1%} ({total_miss}/{total_risk}, CI [{ci_lo:.1%}, {ci_hi:.1%}])")

        results_by_threshold[str(thresh)] = {
            "per_category": cat_results,
            "group_level": group_results,
            "n_clips_evaluated": len(clip_images),
            "n_gate_fires": sum(1 for v in gate_results.values() if v),
        }

    # Save results
    output = {
        "experiment": "IGCA Threshold Sensitivity Sweep",
        "description": "YOLOv8n COCO gate evaluated at 7 confidence thresholds on pilot + textured frames",
        "thresholds": THRESHOLDS,
        "n_clips": len(clip_images),
        "results_by_threshold": results_by_threshold,
    }

    output_path = OUTPUT_DIR / "exp14_threshold_sweep.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nResults saved to {output_path}")

    # Summary table
    print("\n=== Threshold Sensitivity Summary ===")
    print(f"{'Threshold':<10} {'VU IG-Miss':<15} {'MU IG-Miss':<15} {'PS IG-Miss':<15} {'Gate Fires':<10}")
    for thresh in THRESHOLDS:
        r = results_by_threshold[str(thresh)]
        vu = r["group_level"]["visually_unsupported"]
        mu = r["group_level"]["modality_unsupported"]
        ps = r["group_level"]["proxy_supported"]
        print(f"{thresh:<10.1f} {vu['ig_miss_rate']:.0%} ({vu['n_ig_miss']}/{vu['n_risk']})"
              f"       {mu['ig_miss_rate']:.0%} ({mu['n_ig_miss']}/{mu['n_risk']})"
              f"       {ps['ig_miss_rate']:.0%} ({ps['n_ig_miss']}/{ps['n_risk']})"
              f"       {r['n_gate_fires']}/{r['n_clips_evaluated']}")


if __name__ == "__main__":
    main()
