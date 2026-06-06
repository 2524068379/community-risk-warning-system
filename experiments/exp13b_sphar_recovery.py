"""
Experiment 13b: OWL-ViT recovery + VLM E2E on SPHAR visually_unsupported IG-Miss clips.
Tests whether open-vocabulary detection or VLM can recover the IG-Miss cases.
"""

import os
import json
import random
from pathlib import Path
from collections import defaultdict

import cv2
import numpy as np
import torch
from PIL import Image

# --- Config ---
ROOT = Path(__file__).resolve().parent.parent
SPHAR_ROOT = Path(os.environ.get("SPHAR_ROOT", ROOT.parent / "SPHAR-Dataset" / "videos"))
OUTPUT_DIR = Path(__file__).resolve().parent / "results"
OUTPUT_DIR.mkdir(exist_ok=True)

# Load prior results
with open(OUTPUT_DIR / "exp13_sphar_igca_detail.json") as f:
    prior_results = json.load(f)

# Find visually_unsupported IG-Miss clips
vu_ig_miss = [r for r in prior_results
              if r["risk_type"] == "visually_unsupported" and r["ig_miss"]]

print(f"Found {len(vu_ig_miss)} visually_unsupported IG-Miss clips:")
for r in vu_ig_miss:
    print(f"  {r['category']}: {r['video']}")

# --- OWL-ViT Recovery ---
print("\n=== OWL-ViT Recovery Test ===")
try:
    from transformers import OwlViTProcessor, OwlViTForObjectDetection
    owl_processor = OwlViTProcessor.from_pretrained("google/owlvit-base-patch32")
    owl_model = OwlViTForObjectDetection.from_pretrained("google/owlvit-base-patch32")
    owl_model.eval()
    OWL_AVAILABLE = True
    print("OWL-ViT loaded.")
except Exception as e:
    OWL_AVAILABLE = False
    print(f"OWL-ViT not available: {e}")

# Risk-relevant text prompts for OWL-ViT
RISK_PROMPTS = [
    ["fire", "flames", "burning"],
    ["smoke", "fog", "haze"],
    ["car crash", "car accident", "vehicle collision"],
    ["vandalism", "property damage", "broken window"],
    ["person falling", "person lying on ground"],
    ["fight", "assault", "violence"],
]

# Single combined prompt for testing
COMBINED_PROMPT = ["fire", "smoke", "car crash", "vandalism", "person falling", "assault"]


def extract_frames(video_path, n_frames=8):
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
            frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    cap.release()
    return frames


def run_owlvit(frames, prompts, threshold=0.1):
    """Run OWL-ViT on frames with given prompts."""
    if not OWL_AVAILABLE:
        return {"available": False}
    scores_all = []
    detections = []
    for frame in frames:
        pil_img = Image.fromarray(frame)
        inputs = owl_processor(text=prompts, images=pil_img, return_tensors="pt")
        with torch.no_grad():
            outputs = owl_model(**inputs)
        # Manual post-processing (new transformers API)
        logits = outputs.logits[0]  # (num_queries, num_classes)
        pred_boxes = outputs.pred_boxes[0]  # (num_queries, 4)
        scores = torch.sigmoid(logits)
        max_scores, label_indices = scores.max(-1)

        w, h = pil_img.size
        for i in range(len(max_scores)):
            s = max_scores[i].item()
            if s < threshold:
                continue
            lbl = label_indices[i].item()
            if lbl < len(prompts):
                detections.append({
                    "prompt": prompts[lbl],
                    "score": round(s, 4),
                })
                scores_all.append(s)

    max_score = max(scores_all) if scores_all else 0.0
    return {
        "available": True,
        "max_score": round(max_score, 4),
        "n_detections": len(detections),
        "top_detections": sorted(detections, key=lambda x: -x["score"])[:5],
    }


# Run OWL-ViT on IG-Miss clips
owl_results = []
for item in vu_ig_miss:
    vid_path = os.path.join(SPHAR_ROOT, item["category"], item["video"])
    frames = extract_frames(vid_path, 8)
    if not frames:
        print(f"  [SKIP] {item['video']}: no frames")
        continue

    # Test with combined prompt
    owl_out = run_owlvit(frames, COMBINED_PROMPT, threshold=0.001)  # very low threshold to see ceiling
    owl_out_high = run_owlvit(frames, COMBINED_PROMPT, threshold=0.1)  # operational threshold

    result = {
        "video": item["video"],
        "category": item["category"],
        "owl_ceiling": owl_out,
        "owl_operational": owl_out_high,
    }
    owl_results.append(result)
    print(f"  {item['category']}/{item['video']}: ceiling={owl_out.get('max_score', 'N/A')}, "
          f"operational_n={owl_out_high.get('n_detections', 'N/A')}")

# --- VLM E2E Test ---
print("\n=== VLM E2E Test (Qwen3.5-4B) ===")

import requests

VLM_API = "http://127.0.0.1:11434/v1/chat/completions"
VLM_MODEL = "qwen3.5-4b"

VLM_PROMPT = """You are a surveillance safety analyst. Analyze this image and rate the risk level:

A: Immediate danger (fire, crash, assault, falling person)
B: Potential concern (unusual activity, suspicious behavior)
C: Normal / no risk

Reply with ONLY the letter (A, B, or C) and one brief sentence explaining why."""


def run_vlm_e2e(frames):
    """Test VLM on sampled frames."""
    results = []
    for i, frame in enumerate(frames[:3]):  # test 3 frames per video to save time
        pil_img = Image.fromarray(frame)
        import io, base64
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode()
        try:
            resp = requests.post(VLM_API, json={
                "model": VLM_MODEL,
                "messages": [{"role": "user", "content": [
                    {"type": "text", "text": VLM_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
                ]}],
                "max_tokens": 100,
                "temperature": 0.1,
            }, timeout=60)
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            detected = text.upper().startswith("A") or "A:" in text.upper()[:5]
            results.append({"frame": i, "response": text[:100], "detected": detected})
        except Exception as e:
            results.append({"frame": i, "error": str(e)[:80], "detected": False})
    n_detected = sum(1 for r in results if r.get("detected"))
    return {"per_frame": results, "n_detected": n_detected, "n_tested": len(results)}


# Test VLM on IG-Miss clips
vlm_results = []
try:
    for item in vu_ig_miss:
        vid_path = os.path.join(SPHAR_ROOT, item["category"], item["video"])
        frames = extract_frames(vid_path, 3)
        if not frames:
            continue
        vlm_out = run_vlm_e2e(frames)
        vlm_results.append({
            "video": item["video"],
            "category": item["category"],
            **vlm_out,
        })
        print(f"  {item['category']}/{item['video']}: {vlm_out['n_detected']}/{vlm_out['n_tested']} detected")
except Exception as e:
    print(f"VLM test error: {e}")

# --- Save ---
summary = {
    "ig_miss_clips": len(vu_ig_miss),
    "owl_results": owl_results,
    "vlm_results": vlm_results,
}

# OWL summary
if owl_results:
    owl_scores = [r["owl_ceiling"]["max_score"] for r in owl_results if r["owl_ceiling"].get("available")]
    owl_op_n = [r["owl_operational"]["n_detections"] for r in owl_results if r["owl_operational"].get("available")]
    summary["owl_summary"] = {
        "n_tested": len(owl_scores),
        "max_ceiling_score": max(owl_scores) if owl_scores else 0,
        "mean_ceiling_score": round(sum(owl_scores)/len(owl_scores), 4) if owl_scores else 0,
        "operational_detections": sum(owl_op_n),
    }
    print(f"\nOWL-ViT Summary: {summary['owl_summary']}")

# VLM summary
if vlm_results:
    total_detected = sum(r["n_detected"] for r in vlm_results)
    total_tested = sum(r["n_tested"] for r in vlm_results)
    summary["vlm_summary"] = {
        "n_clips": len(vlm_results),
        "total_frames_tested": total_tested,
        "total_detected": total_detected,
        "detection_rate": round(total_detected / total_tested, 4) if total_tested else 0,
    }
    print(f"VLM Summary: {summary['vlm_summary']}")

output_file = OUTPUT_DIR / "exp13b_sphar_recovery.json"
with open(output_file, "w") as f:
    json.dump(summary, f, indent=2, ensure_ascii=False)
print(f"\nResults saved to: {output_file}")
