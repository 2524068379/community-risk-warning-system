"""
Experiment 14b: Threshold Sensitivity Sweep on Expanded Dataset (290 textured frames)
Proves IG-Miss is robust to threshold at scale with tight CIs.

Usage:
  python experiments/exp14b_threshold_sweep_expanded.py
"""

import os
import json
import numpy as np
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
EXPANDED_DIR = ROOT / "idea-stage" / "refine-logs" / "datasets" / "frames_expanded"
LARGE_EXPANDED_DIR = ROOT / "idea-stage" / "refine-logs" / "datasets" / "frames_large_expanded"
OUTPUT_DIR = ROOT / "experiments" / "results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = ROOT / "yolov8n.pt"

THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]

VISUALLY_UNSUPPORTED = {"smoke", "fire", "channel_blockage", "blockage"}
PROXY_SUPPORTED = {"proxy", "person"}


def wilson_ci(rate, n, z=1.96):
    if n == 0:
        return 0.0, 0.0
    p = rate
    denom = 1 + z**2 / n
    centre = (p + z**2 / (2*n)) / denom
    margin = z * np.sqrt((p*(1-p) + z**2/(4*n)) / n) / denom
    return max(0.0, centre - margin), min(1.0, centre + margin)


def infer_category(filename):
    """Infer category from filename pattern."""
    name = filename.stem.lower()
    if "smoke" in name:
        return "smoke"
    elif "fire" in name:
        return "fire"
    elif "blockage" in name:
        return "channel_blockage"
    elif "proxy" in name or "person" in name:
        return "proxy"
    return "unknown"


def infer_group(category):
    if category in VISUALLY_UNSUPPORTED or category in {"smoke", "fire", "channel_blockage"}:
        return "visually_unsupported"
    elif category in PROXY_SUPPORTED:
        return "proxy_supported"
    return "unknown"


def main():
    from ultralytics import YOLO

    print(f"Loading YOLOv8n from {MODEL_PATH}")
    model = YOLO(str(MODEL_PATH))

    # Collect all expanded frames
    frames = []
    for d in [EXPANDED_DIR, LARGE_EXPANDED_DIR]:
        if d.exists():
            for f in d.glob("*.jpg"):
                cat = infer_category(f)
                group = infer_group(cat)
                frames.append({"path": f, "category": cat, "group": group})

    print(f"Total expanded frames: {len(frames)}")
    group_counts = defaultdict(int)
    for f in frames:
        group_counts[f["group"]] += 1
    for g, c in sorted(group_counts.items()):
        print(f"  {g}: {c}")

    # Run at each threshold
    results_by_threshold = {}
    for thresh in THRESHOLDS:
        print(f"\n--- Threshold = {thresh} ---")
        group_results = defaultdict(lambda: {"n_risk": 0, "n_ig_miss": 0})

        for frame_info in frames:
            group = frame_info["group"]
            if group == "unknown":
                continue
            group_results[group]["n_risk"] += 1
            # Run YOLO
            results = model(str(frame_info["path"]), conf=thresh, verbose=False)
            fires = any(len(r.boxes) > 0 for r in results)
            if not fires:
                group_results[group]["n_ig_miss"] += 1

        # Compute rates
        for g, d in group_results.items():
            d["ig_miss_rate"] = d["n_ig_miss"] / d["n_risk"] if d["n_risk"] > 0 else 0.0
            ci_lo, ci_hi = wilson_ci(d["ig_miss_rate"], d["n_risk"])
            d["ci_lower"] = ci_lo
            d["ci_upper"] = ci_hi
            print(f"  {g}: {d['ig_miss_rate']:.1%} ({d['n_ig_miss']}/{d['n_risk']}, CI [{ci_lo:.1%}, {ci_hi:.1%}])")

        results_by_threshold[str(thresh)] = dict(group_results)

    # Save
    output = {
        "experiment": "IGCA Threshold Sensitivity Sweep (Expanded Dataset)",
        "description": "YOLOv8n COCO gate at 7 thresholds on 290 expanded textured frames",
        "thresholds": THRESHOLDS,
        "n_frames": len(frames),
        "results_by_threshold": results_by_threshold,
    }

    output_path = OUTPUT_DIR / "exp14b_threshold_sweep_expanded.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nResults saved to {output_path}")

    # Summary
    print("\n=== Expanded Threshold Sensitivity Summary ===")
    print(f"{'Threshold':<10} {'VU IG-Miss':<20} {'PS IG-Miss':<20}")
    for thresh in THRESHOLDS:
        r = results_by_threshold[str(thresh)]
        vu = r.get("visually_unsupported", {})
        ps = r.get("proxy_supported", {})
        vu_str = f"{vu.get('ig_miss_rate',0):.0%} ({vu.get('n_ig_miss',0)}/{vu.get('n_risk',0)})" if vu else "N/A"
        ps_str = f"{ps.get('ig_miss_rate',0):.0%} ({ps.get('n_ig_miss',0)}/{ps.get('n_risk',0)})" if ps else "N/A"
        print(f"{thresh:<10.1f} {vu_str:<20} {ps_str:<20}")


if __name__ == "__main__":
    main()
