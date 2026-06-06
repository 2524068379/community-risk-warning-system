"""
Experiment 17: Grounding DINO false-positive evaluation on SPHAR non-risk clips.

Runs Grounding DINO-tiny with the same risk prompt as exp15 over the five
non-risk SPHAR categories (walking, sitting, neutral, luggage, running) at
thresholds 0.3 and 0.5. Reports per-category FP rate, FP/min, and combines
with exp15 TP counts to produce precision and PR-AUC. Saves to
experiments/results/exp17_gd_negative_fp.json.
"""

import os
import json
import random
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPHAR_ROOT = Path(os.environ.get("SPHAR_ROOT", ROOT.parent / "SPHAR-Dataset" / "videos"))
EXP15_JSON = ROOT / "experiments" / "results" / "exp15_grounding_dino_recovery.json"
OUT_JSON = ROOT / "experiments" / "results" / "exp17_gd_negative_fp.json"

NEG_CATEGORIES = ["walking", "sitting", "neutral", "luggage", "running"]
SAMPLES_PER_CATEGORY = 20
FRAMES_PER_CLIP = 8
RISK_PROMPT = "smoke . fire . flames . burning . channel blockage . obstacle . debris"
THRESHOLDS = [0.3, 0.5]
SEED = 42
ASSUMED_FPS = 25.0


def extract_frames(video_path, n=8):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return [], 0.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or ASSUMED_FPS
    if total <= 0:
        cap.release()
        return [], 0.0
    duration = total / fps if fps > 0 else total / ASSUMED_FPS
    indices = np.linspace(0, total - 1, n, dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, fr = cap.read()
        if ok and fr is not None:
            frames.append(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
    cap.release()
    return frames, duration


def wilson_ci(k, n, z=1.96):
    if n == 0:
        return 0.0, 0.0
    p = k / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    spread = z * np.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denom
    return max(0.0, center - spread), min(1.0, center + spread)


def main():
    random.seed(SEED)
    print(f"Loading Grounding DINO-tiny ...")
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
    processor = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-tiny")
    model = AutoModelForZeroShotObjectDetection.from_pretrained("IDEA-Research/grounding-dino-tiny")
    model.eval()

    sampled = {}
    total_minutes = 0.0
    per_cat_minutes = {}
    per_frame_results = []

    for cat in NEG_CATEGORIES:
        cat_dir = os.path.join(SPHAR_ROOT, cat)
        if not os.path.isdir(cat_dir):
            print(f"  [WARN] missing category dir: {cat_dir}")
            continue
        files = [f for f in os.listdir(cat_dir) if f.lower().endswith((".mp4", ".avi", ".mov", ".mkv"))]
        random.shuffle(files)
        files = files[:SAMPLES_PER_CATEGORY]
        sampled[cat] = files
        per_cat_minutes[cat] = 0.0
        print(f"\n[{cat}] sampled {len(files)} clips")

        for i, fname in enumerate(files, 1):
            vp = os.path.join(cat_dir, fname)
            frames, duration = extract_frames(vp, FRAMES_PER_CLIP)
            if not frames:
                print(f"  [SKIP] {fname}")
                continue
            per_cat_minutes[cat] += duration / 60.0
            total_minutes += duration / 60.0

            clip_max_score = 0.0
            n_above = {str(t): 0 for t in THRESHOLDS}

            for fr in frames:
                pil = Image.fromarray(fr)
                inputs = processor(images=pil, text=RISK_PROMPT, return_tensors="pt")
                with torch.no_grad():
                    outputs = model(**inputs)
                post = processor.post_process_grounded_object_detection(
                    outputs, inputs["input_ids"],
                    threshold=0.25, text_threshold=0.1,
                    target_sizes=[pil.size[::-1]],
                )[0]
                scores = post["scores"].cpu().numpy() if len(post["scores"]) > 0 else np.array([])
                if len(scores):
                    fmax = float(scores.max())
                    clip_max_score = max(clip_max_score, fmax)
                    for t in THRESHOLDS:
                        if (scores >= t).any():
                            n_above[str(t)] += 1

            per_frame_results.append({
                "video": fname,
                "category": cat,
                "duration_sec": round(duration, 2),
                "clip_max_score": round(clip_max_score, 4),
                "frames_above_thresh": n_above,
                "fired_at_0.3": clip_max_score >= 0.3,
                "fired_at_0.5": clip_max_score >= 0.5,
            })
            if i % 5 == 0:
                print(f"  {i}/{len(files)}  max={clip_max_score:.3f}")

    by_cat = {}
    for cat in NEG_CATEGORIES:
        rows = [r for r in per_frame_results if r["category"] == cat]
        n = len(rows)
        fp03 = sum(1 for r in rows if r["fired_at_0.3"])
        fp05 = sum(1 for r in rows if r["fired_at_0.5"])
        mins = per_cat_minutes.get(cat, 0.0)
        by_cat[cat] = {
            "n_clips": n,
            "fp_at_0.3": fp03,
            "fp_at_0.5": fp05,
            "fp_rate_0.3": round(fp03 / max(1, n), 4),
            "fp_rate_0.5": round(fp05 / max(1, n), 4),
            "fp_rate_0.3_ci": [round(c, 4) for c in wilson_ci(fp03, n)],
            "fp_rate_0.5_ci": [round(c, 4) for c in wilson_ci(fp05, n)],
            "minutes": round(mins, 2),
            "fp_per_min_0.3": round(fp03 / mins, 3) if mins > 0 else 0.0,
            "fp_per_min_0.5": round(fp05 / mins, 3) if mins > 0 else 0.0,
        }

    n_total = len(per_frame_results)
    fp03_total = sum(1 for r in per_frame_results if r["fired_at_0.3"])
    fp05_total = sum(1 for r in per_frame_results if r["fired_at_0.5"])

    tp03 = tp05 = pos_total = None
    if EXP15_JSON.exists():
        with open(EXP15_JSON, encoding="utf-8") as f:
            e15 = json.load(f)
        thr = e15.get("summary", {}).get("threshold_analysis", {})
        n_pos = e15.get("summary", {}).get("n_frames_tested", 0)
        tp03 = thr.get("0.3"); tp05 = thr.get("0.5")
        pos_total = n_pos

    summary = {
        "experiment": "exp17_gd_negative_fp",
        "config": {
            "neg_categories": NEG_CATEGORIES,
            "samples_per_category": SAMPLES_PER_CATEGORY,
            "frames_per_clip": FRAMES_PER_CLIP,
            "thresholds": THRESHOLDS,
            "prompt": RISK_PROMPT,
            "seed": SEED,
        },
        "overall_negatives": {
            "n_clips": n_total,
            "fp_at_0.3": fp03_total,
            "fp_at_0.5": fp05_total,
            "fp_rate_0.3": round(fp03_total / max(1, n_total), 4),
            "fp_rate_0.5": round(fp05_total / max(1, n_total), 4),
            "fp_rate_0.3_ci": [round(c, 4) for c in wilson_ci(fp03_total, n_total)],
            "fp_rate_0.5_ci": [round(c, 4) for c in wilson_ci(fp05_total, n_total)],
            "total_minutes": round(total_minutes, 2),
            "fp_per_min_0.3": round(fp03_total / total_minutes, 3) if total_minutes > 0 else 0.0,
            "fp_per_min_0.5": round(fp05_total / total_minutes, 3) if total_minutes > 0 else 0.0,
        },
        "by_category": by_cat,
        "linked_exp15_positive": {
            "n_pos_frames": pos_total,
            "tp_at_0.3": tp03,
            "tp_at_0.5": tp05,
            "precision_at_0.3": (
                round(tp03 / (tp03 + fp03_total), 4)
                if tp03 is not None and (tp03 + fp03_total) > 0 else None
            ),
            "precision_at_0.5": (
                round(tp05 / (tp05 + fp05_total), 4)
                if tp05 is not None and (tp05 + fp05_total) > 0 else None
            ),
            "note": (
                "exp15 positives are synthetic visually_unsupported frames; "
                "exp17 negatives are real SPHAR clips. Precision is therefore "
                "an across-domain estimate, not a deployment number."
            ),
        },
        "per_clip_results": per_frame_results,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("\n=== Grounding DINO FP on SPHAR non-risk clips ===")
    for cat, s in by_cat.items():
        print(f"  {cat:>9}: FP@0.3={s['fp_at_0.3']}/{s['n_clips']} ({s['fp_rate_0.3']:.1%})  "
              f"FP@0.5={s['fp_at_0.5']}/{s['n_clips']} ({s['fp_rate_0.5']:.1%})  "
              f"FP/min@0.3={s['fp_per_min_0.3']:.2f} FP/min@0.5={s['fp_per_min_0.5']:.2f}")
    print(f"  Overall : FP@0.3={fp03_total}/{n_total}  FP@0.5={fp05_total}/{n_total}  "
          f"({total_minutes:.1f} min)")
    print(f"\nSaved to {OUT_JSON}")


if __name__ == "__main__":
    main()
