"""
Experiment 13: IGCA on SPHAR real surveillance dataset.
Maps SPHAR action classes to IGCA risk taxonomy and measures IG-Miss rates.

IGCA taxonomy:
  - proxy_supported: person-mediated risks (COCO "person" triggers gate)
  - visually_unsupported: no COCO category (fire, crash, vandalism)
  - modality_unsupported: audio-only (not applicable for video-only SPHAR)
  - neutral: low-risk / baseline activities

SPHAR → IGCA mapping:
  proxy_supported: hitting, kicking, falling, murdering, stealing, panicking, running, sitting, walking
  visually_unsupported: igniting, carcrash, vandalizing
  neutral: neutral, luggage
"""

import os
import sys
import json
import random
import time
from pathlib import Path
from collections import defaultdict

import cv2
import numpy as np

# --- Config ---
ROOT = Path(__file__).resolve().parent.parent
SPHAR_ROOT = Path(os.environ.get("SPHAR_ROOT", ROOT.parent / "SPHAR-Dataset" / "videos"))
OUTPUT_DIR = Path(__file__).resolve().parent / "results"
OUTPUT_DIR.mkdir(exist_ok=True)

SAMPLES_PER_CATEGORY = 30  # sample 30 videos per category
FRAME_COUNT = 8            # frames per video (match IGCA protocol)
YOLO_CONF = 0.4            # match paper's gate threshold
YOLO_MODEL = "yolov8n.pt"  # COCO-pretrained

# SPHAR → IGCA mapping
RISK_TAXONOMY = {
    "hitting": "proxy_supported",
    "kicking": "proxy_supported",
    "falling": "proxy_supported",
    "murdering": "proxy_supported",
    "stealing": "proxy_supported",
    "panicking": "proxy_supported",
    "running": "proxy_supported",
    "sitting": "proxy_supported",
    "walking": "proxy_supported",
    "igniting": "visually_unsupported",
    "carcrash": "visually_unsupported",
    "vandalizing": "visually_unsupported",
    "neutral": "neutral",
    "luggage": "neutral",
}

# Categories considered "risk-positive" for IGCA
RISK_CATEGORIES = {k: v for k, v in RISK_TAXONOMY.items() if v != "neutral"}


def extract_frames(video_path: str, n_frames: int = 8) -> list:
    """Extract n_frames uniformly from video."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []
    indices = np.linspace(0, total - 1, n_frames, dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret and frame is not None:
            frames.append(frame)
    cap.release()
    return frames


def run_yolo_gate(frames: list, model, conf: float = 0.4) -> dict:
    """Run YOLO gate on frames. Returns gate decision and detections."""
    all_detections = []
    gate_fired = False
    for frame in frames:
        results = model(frame, conf=conf, verbose=False)
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                cls_name = model.names[cls_id]
                conf_val = float(box.conf[0])
                all_detections.append({
                    "class": cls_name,
                    "confidence": round(conf_val, 3),
                })
                if conf_val >= conf:
                    gate_fired = True
    return {
        "gate_fired": gate_fired,
        "detections": all_detections,
        "n_frames": len(frames),
    }


def sample_videos(category: str, n: int) -> list:
    """Sample n videos from a category directory."""
    cat_dir = os.path.join(SPHAR_ROOT, category)
    if not os.path.isdir(cat_dir):
        return []
    videos = [f for f in os.listdir(cat_dir) if f.endswith(".mp4")]
    if len(videos) <= n:
        return videos
    return random.sample(videos, n)


def main():
    random.seed(42)

    print("=" * 60)
    print("SPHAR IGCA Experiment")
    print("=" * 60)

    # Load YOLO
    print(f"\nLoading YOLO model: {YOLO_MODEL}")
    from ultralytics import YOLO
    model = YOLO(YOLO_MODEL)
    print("YOLO loaded.")

    results = []
    category_stats = defaultdict(lambda: {"total": 0, "risk_positive": 0, "ig_miss": 0,
                                           "gate_fired": 0, "detections_detail": []})

    for category, risk_type in RISK_TAXONOMY.items():
        print(f"\n--- {category} ({risk_type}) ---")
        videos = sample_videos(category, SAMPLES_PER_CATEGORY)
        print(f"  Sampled {len(videos)} videos")

        for vid_name in videos:
            vid_path = os.path.join(SPHAR_ROOT, category, vid_name)
            frames = extract_frames(vid_path, FRAME_COUNT)
            if not frames:
                print(f"  [SKIP] {vid_name}: no frames")
                continue

            gate_result = run_yolo_gate(frames, model, YOLO_CONF)

            # Determine IG-Miss: risk-positive AND gate did NOT fire
            is_risk_positive = risk_type != "neutral"
            ig_miss = is_risk_positive and not gate_result["gate_fired"]

            result = {
                "video": vid_name,
                "category": category,
                "risk_type": risk_type,
                "is_risk_positive": is_risk_positive,
                "gate_fired": gate_result["gate_fired"],
                "ig_miss": ig_miss,
                "n_detections": len(gate_result["detections"]),
                "detections": gate_result["detections"][:10],  # cap for storage
            }
            results.append(result)

            category_stats[category]["total"] += 1
            if is_risk_positive:
                category_stats[category]["risk_positive"] += 1
                if ig_miss:
                    category_stats[category]["ig_miss"] += 1
                if gate_result["gate_fired"]:
                    category_stats[category]["gate_fired"] += 1

            # Track what COCO objects are detected
            for det in gate_result["detections"]:
                category_stats[category]["detections_detail"].append(det["class"])

    # --- Compute Wilson CIs ---
    def wilson_ci(k, n, z=1.96):
        if n == 0:
            return 0.0, 0.0
        p = k / n
        denom = 1 + z**2 / n
        center = (p + z**2 / (2 * n)) / denom
        spread = z * np.sqrt((p * (1 - p) + z**2 / (4 * n)) / n) / denom
        return max(0, center - spread), min(1, center + spread)

    # --- Aggregate by IGCA taxonomy ---
    taxonomy_stats = defaultdict(lambda: {"risk_positive": 0, "ig_miss": 0, "gate_fired": 0, "categories": []})
    for cat, stats in category_stats.items():
        risk_type = RISK_TAXONOMY[cat]
        if risk_type == "neutral":
            continue
        taxonomy_stats[risk_type]["risk_positive"] += stats["risk_positive"]
        taxonomy_stats[risk_type]["ig_miss"] += stats["ig_miss"]
        taxonomy_stats[risk_type]["gate_fired"] += stats["gate_fired"]
        taxonomy_stats[risk_type]["categories"].append(cat)

    print("\n" + "=" * 60)
    print("RESULTS BY IGCA TAXONOMY")
    print("=" * 60)

    summary = {"taxonomy": {}, "per_category": {}, "total_clips": len(results)}

    for tax_type, stats in sorted(taxonomy_stats.items()):
        n = stats["risk_positive"]
        k = stats["ig_miss"]
        rate = k / n if n > 0 else 0
        lo, hi = wilson_ci(k, n)
        print(f"\n{tax_type}:")
        print(f"  Risk-positive clips: {n}")
        print(f"  IG-Miss: {k} ({rate*100:.1f}%)")
        print(f"  95% Wilson CI: [{lo*100:.1f}%, {hi*100:.1f}%]")
        print(f"  Categories: {stats['categories']}")
        summary["taxonomy"][tax_type] = {
            "n": n, "ig_miss": k, "rate": round(rate, 4),
            "ci_lo": round(lo, 4), "ci_hi": round(hi, 4),
            "categories": stats["categories"],
        }

    print("\n" + "=" * 60)
    print("PER-CATEGORY BREAKDOWN")
    print("=" * 60)

    for cat in sorted(category_stats.keys()):
        stats = category_stats[cat]
        if stats["risk_positive"] == 0:
            continue
        n = stats["risk_positive"]
        k = stats["ig_miss"]
        rate = k / n if n > 0 else 0
        lo, hi = wilson_ci(k, n)
        # Top detected COCO objects
        det_counter = defaultdict(int)
        for d in stats["detections_detail"]:
            det_counter[d] += 1
        top_dets = sorted(det_counter.items(), key=lambda x: -x[1])[:5]
        det_str = ", ".join(f"{c}({v})" for c, v in top_dets) if top_dets else "none"

        print(f"\n  {cat} ({RISK_TAXONOMY[cat]}):")
        print(f"    n={n}, IG-Miss={k} ({rate*100:.1f}%), CI=[{lo*100:.1f}%, {hi*100:.1f}%]")
        print(f"    Top detections: {det_str}")

        summary["per_category"][cat] = {
            "risk_type": RISK_TAXONOMY[cat],
            "n": n, "ig_miss": k, "rate": round(rate, 4),
            "ci_lo": round(lo, 4), "ci_hi": round(hi, 4),
            "top_detections": dict(top_dets),
        }

    # Save results
    output_file = OUTPUT_DIR / "exp13_sphar_igca.json"
    with open(output_file, "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"\nResults saved to: {output_file}")

    # Save detailed per-video results
    detail_file = OUTPUT_DIR / "exp13_sphar_igca_detail.json"
    with open(detail_file, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Detailed results: {detail_file}")

    print("\nDone.")


if __name__ == "__main__":
    main()
