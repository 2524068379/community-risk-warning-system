"""
Experiment 16b: Conditional VLM detection given gate fired.

Joins exp16 VLM results (70 SPHAR clips, vlm_has_risk per clip) with
exp13 gate cache (17 overlap), and runs YOLOv8n at conf=0.4 on the
remaining 53 clips so every VLM-evaluated clip has a paired gate decision.

Computes P(VLM detects | I=1, risk=1) overall and by taxonomy group.
"""

import os
import json
from pathlib import Path
from collections import defaultdict

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SPHAR_ROOT = Path(os.environ.get("SPHAR_ROOT", ROOT.parent / "SPHAR-Dataset" / "videos"))
VLM_JSON = ROOT / "idea-stage" / "refine-logs" / "experiments" / "exp16_text_only.json"
GATE_DETAIL = ROOT / "experiments" / "results" / "exp13_sphar_igca_detail.json"
YOLO_WEIGHTS = ROOT / "yolov8n.pt"
OUT_JSON = ROOT / "experiments" / "results" / "exp16b_vlm_conditional.json"

YOLO_CONF = 0.4
FRAME_COUNT = 8


def extract_frames(video_path, n=8):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []
    indices = np.linspace(0, total - 1, n, dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, fr = cap.read()
        if ok and fr is not None:
            frames.append(fr)
    cap.release()
    return frames


def index_sphar(root):
    idx = {}
    for cat in os.listdir(root):
        cat_dir = os.path.join(root, cat)
        if not os.path.isdir(cat_dir):
            continue
        for f in os.listdir(cat_dir):
            stem = os.path.splitext(f)[0]
            idx[stem] = os.path.join(cat_dir, f)
    return idx


def wilson_ci(k, n, z=1.96):
    if n == 0:
        return 0.0, 0.0
    p = k / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    spread = z * np.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denom
    return max(0.0, center - spread), min(1.0, center + spread)


def main():
    with open(VLM_JSON, encoding="utf-8") as f:
        vlm = json.load(f)
    with open(GATE_DETAIL, encoding="utf-8") as f:
        gate_rows = json.load(f)
    gate_cache = {os.path.splitext(r["video"])[0]: r["gate_fired"] for r in gate_rows}
    sphar_idx = index_sphar(SPHAR_ROOT)

    cached, fresh = [], []
    for r in vlm["results"]:
        (cached if r["video_id"] in gate_cache else fresh).append(r)
    print(f"cached gate decisions: {len(cached)}, fresh required: {len(fresh)}")

    from ultralytics import YOLO
    model = YOLO(str(YOLO_WEIGHTS))

    joined = []
    for r in cached:
        joined.append({
            "video_id": r["video_id"],
            "category": r["category"],
            "group": r["taxonomy_group"],
            "is_risk": r["is_risk"],
            "gate_fired": gate_cache[r["video_id"]],
            "vlm_has_risk": r["vlm_has_risk"],
            "gate_source": "exp13_cache",
        })

    for i, r in enumerate(fresh, 1):
        path = sphar_idx.get(r["video_id"])
        if path is None:
            print(f"  [SKIP] {r['video_id']}: not found in SPHAR")
            continue
        frames = extract_frames(path, FRAME_COUNT)
        if not frames:
            print(f"  [SKIP] {r['video_id']}: no frames")
            continue
        gate_fired = False
        for fr in frames:
            preds = model(fr, conf=YOLO_CONF, verbose=False)
            for p in preds:
                if p.boxes is not None and len(p.boxes) > 0:
                    gate_fired = True
                    break
            if gate_fired:
                break
        joined.append({
            "video_id": r["video_id"],
            "category": r["category"],
            "group": r["taxonomy_group"],
            "is_risk": r["is_risk"],
            "gate_fired": bool(gate_fired),
            "vlm_has_risk": r["vlm_has_risk"],
            "gate_source": "exp16b_fresh",
        })
        if i % 10 == 0:
            print(f"  fresh gate {i}/{len(fresh)}")

    risk_clips = [j for j in joined if j["is_risk"]]
    gated_risk = [j for j in risk_clips if j["gate_fired"]]
    detected = [j for j in gated_risk if j["vlm_has_risk"]]
    p_vlm = len(detected) / max(1, len(gated_risk))
    lo, hi = wilson_ci(len(detected), len(gated_risk))

    by_group = defaultdict(lambda: {"risk": 0, "gated": 0, "det": 0})
    for j in risk_clips:
        g = by_group[j["group"]]
        g["risk"] += 1
        if j["gate_fired"]:
            g["gated"] += 1
            if j["vlm_has_risk"]:
                g["det"] += 1

    by_cat = defaultdict(lambda: {"risk": 0, "gated": 0, "det": 0})
    for j in risk_clips:
        c = by_cat[j["category"]]
        c["risk"] += 1
        if j["gate_fired"]:
            c["gated"] += 1
            if j["vlm_has_risk"]:
                c["det"] += 1

    summary = {
        "experiment": "exp16b_vlm_conditional",
        "config": {"yolo_conf": YOLO_CONF, "frames_per_clip": FRAME_COUNT,
                   "sphar_clips_total": len(joined),
                   "cached_from_exp13": len(cached),
                   "fresh_yolo_runs": len([j for j in joined if j["gate_source"] == "exp16b_fresh"])},
        "overall": {
            "risk_clips": len(risk_clips),
            "gate_fired_and_risk": len(gated_risk),
            "vlm_detected_given_gate": len(detected),
            "p_vlm_given_gate_risk": round(p_vlm, 4),
            "wilson_ci_95": [round(lo, 4), round(hi, 4)],
        },
        "by_group": {g: {**s,
                         "p_vlm_given_gate": round(s["det"] / max(1, s["gated"]), 4),
                         "wilson_ci_95": [round(wilson_ci(s["det"], s["gated"])[0], 4),
                                          round(wilson_ci(s["det"], s["gated"])[1], 4)]}
                     for g, s in by_group.items()},
        "by_category": {c: {**s,
                            "p_vlm_given_gate": round(s["det"] / max(1, s["gated"]), 4)}
                        for c, s in by_cat.items()},
        "joined": joined,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("\n=== Conditional VLM detection ===")
    print(f"Overall  P(VLM | I=1, risk=1) = {len(detected)}/{len(gated_risk)} = {p_vlm:.3f}  CI=[{lo:.3f}, {hi:.3f}]")
    for g, s in by_group.items():
        p = s["det"] / max(1, s["gated"])
        print(f"  {g}: {s['det']}/{s['gated']} = {p:.3f}  (risk={s['risk']})")
    print(f"\nSaved to {OUT_JSON}")


if __name__ == "__main__":
    main()
