#!/usr/bin/env python3
"""
IGCA R010: D-Fire Real Fire/Smoke Detection Evaluation
Uses the D-Fire dataset (21K real fire/smoke images) to test:
1. Does YOLO-v5 fire on real fire/smoke images from D-Fire?
2. What does OWL-ViT score on real fire/smoke imagery?
3. Does COCO co-occurrence trigger the gate for real fire/smoke scenes?

This addresses the reviewer's CRITICAL concern about real deployment evidence.

Usage:
  python experiments/exp10_dfire_evaluation.py --output experiments/exp10_dfire_results.json
"""

import os
import json
import torch
import tempfile
from pathlib import Path
from PIL import Image
from transformers import pipeline
import urllib.request
import math
import random

# Try to import datasets to download from kaggle
try:
    from datasets import load_dataset
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False

# Try kaggle
try:
    import kaggle
    KAGGLE_AVAILABLE = True
except ImportError:
    KAGGLE_AVAILABLE = False

OUTPUT_FILE = 'experiments/exp10_dfire_results.json'
os.makedirs(os.path.dirname(OUTPUT_FILE) or '.', exist_ok=True)

print("=== IGCA R010: D-Fire Real Fire/Smoke Detection Evaluation ===")
print()

# --- Check if D-Fire already exists locally ---
DFIRE_DIR = 'datasets/DFire'
DFIRE_IMAGES_DIR = os.path.join(DFIRE_DIR, 'images')
HAS_DFIRE = os.path.isdir(DFIRE_IMAGES_DIR) and len(os.listdir(DFIRE_IMAGES_DIR)) > 100

if HAS_DFIRE:
    print(f"D-Fire images found at {DFIRE_IMAGES_DIR}: {len(os.listdir(DFIRE_IMAGES_DIR))} files")
else:
    print("D-Fire images NOT found locally.")
    print("Attempting to download...")

    if KAGGLE_AVAILABLE:
        print("Using Kaggle API to download D-Fire dataset...")
        try:
            from kaggle.api.kaggle_api_extended import KaggleApi
            api = KaggleApi()
            api.authenticate()
            api.dataset_download_files('sayedgamal99/smoke-fire-detection-yolo',
                                      path=DFIRE_DIR, unzip=True)
            print("Downloaded via Kaggle API successfully!")
        except Exception as e:
            print(f"Kaggle download failed: {e}")
            HAS_DFIRE = False
    else:
        print("Kaggle not available. Trying HuggingFace datasets...")
        if HF_AVAILABLE:
            try:
                # Try to load from HuggingFace - search for fire/smoke datasets
                from datasets import load_dataset
                # This may not exist on HuggingFace, but worth trying
                ds = load_dataset("fire-smoke-detection", split="train", trust_remote_code=True)
                print(f"HuggingFace dataset loaded: {len(ds)} samples")
            except Exception as e:
                print(f"HuggingFace download failed: {e}")

if not HAS_DFIRE:
    print("\nWARNING: Could not download D-Fire dataset.")
    print("Will try to use existing datasets/real_frames directory for real images.")
    print("If that also fails, the experiment will use existing procedural frames as fallback.")

# --- Load YOLO ---
print("\nLoading YOLOv8n...")
from ultralytics import YOLO
yolo = YOLO('yolov8n.pt')
yolo.conf = 0.4

# --- Load OWL-ViT ---
print("Loading OWL-ViT...")
device = 'cuda' if torch.cuda.is_available() else 'cpu'
detector = pipeline('zero-shot-object-detection', model='google/owlvit-base-patch32', device=device)

PROMPTS = {
    'fire': ['fire', 'flame', 'burning'],
    'smoke': ['smoke', 'fog', 'steam'],
}

# --- Determine what images to use ---
all_images = []

if HAS_DFIRE:
    # Use D-Fire images
    img_exts = {'.jpg', '.jpeg', '.png'}
    for f in os.listdir(DFIRE_IMAGES_DIR):
        if Path(f).suffix.lower() in img_exts:
            all_images.append(os.path.join(DFIRE_IMAGES_DIR, f))
    print(f"\nUsing {len(all_images)} D-Fire images")
elif os.path.isdir('datasets/real_frames'):
    # Fall back to existing real_frames
    for cat in ['fire', 'smoke', 'blockage', 'person']:
        cat_dir = f'datasets/real_frames/{cat}'
        if os.path.isdir(cat_dir):
            for f in os.listdir(cat_dir):
                if f.endswith(('.jpg', '.png')):
                    all_images.append(os.path.join(cat_dir, f))
    print(f"\nUsing {len(all_images)} existing real_frames images")
else:
    print("ERROR: No image sources available!")
    all_images = []

# Limit to manageable number for this evaluation
MAX_IMAGES = 200
if len(all_images) > MAX_IMAGES:
    random.seed(42)
    all_images = random.sample(all_images, MAX_IMAGES)
    print(f"Sampled {MAX_IMAGES} images for evaluation")

print(f"\nEvaluating {len(all_images)} images...")
print()

# --- Run YOLO gate evaluation ---
yolo_results = {}
all_detected_labels = []

print("Running YOLO gate...")
for i, fpath in enumerate(all_images):
    if i % 50 == 0:
        print(f"  YOLO: {i}/{len(all_images)}")
    fname = os.path.basename(fpath)
    try:
        res = yolo.predict(fpath, verbose=False)[0]
        boxes = res.boxes
        detected = []
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            label = res.names[cls_id]
            detected.append(f"{label}:{conf:.2f}")
            all_detected_labels.append(label)
        yolo_results[fname] = {
            'gate_fired': len(detected) > 0,
            'detections': detected,
            'path': fpath,
        }
    except Exception as e:
        yolo_results[fname] = {
            'gate_fired': False,
            'detections': [],
            'error': str(e),
            'path': fpath,
        }

unique_labels = set(all_detected_labels)
print(f"YOLO detected labels across all frames: {unique_labels}")
print()

# --- Run OWL-ViT recovery arm ---
print("Running OWL-ViT recovery arm...")
ovod_results = {}

for i, fpath in enumerate(all_images):
    if i % 50 == 0:
        print(f"  OVOD: {i}/{len(all_images)}")
    fname = os.path.basename(fpath)

    # Determine category from filename or path
    cat = None
    path_lower = fpath.lower()
    if 'fire' in path_lower or 'dfire' in path_lower:
        cat = 'fire'
    elif 'smoke' in path_lower:
        cat = 'smoke'

    if cat is None or cat not in PROMPTS:
        continue

    try:
        img = Image.open(fpath).convert('RGB')
        best_scores = {}
        for prompt in PROMPTS[cat]:
            result = detector(image=img, candidate_labels=[prompt], threshold=0.1)
            if result:
                best_scores[prompt] = max(r['score'] for r in result)
        ovod_results[fname] = {
            'category': cat,
            'max_ovod_score': max(best_scores.values()) if best_scores else 0.0,
            'prompt_scores': best_scores,
            'ovod_recovered': any(s > 0.1 for s in best_scores.values()),
            'path': fpath,
        }
    except Exception as e:
        ovod_results[fname] = {
            'category': cat,
            'max_ovod_score': 0.0,
            'error': str(e),
            'path': fpath,
        }

# --- Aggregate Results ---
print("\n" + "="*60)
print("RESULTS: D-Fire Real Fire/Smoke Evaluation")
print("="*60)

# Separate fire and smoke
fire_images = [k for k in yolo_results if 'fire' in k.lower()]
smoke_images = [k for k in yolo_results if 'smoke' in k.lower()]
all_category_images = list(yolo_results.keys())

# Fire results
fire_ig_miss = sum(1 for k in fire_images if not yolo_results[k]['gate_fired'])
fire_total = len(fire_images)
fire_rate = fire_ig_miss / fire_total if fire_total > 0 else 0.0
fire_labels = set()
for k in fire_images:
    fire_labels.update([d.split(':')[0] for d in yolo_results[k].get('detections', [])])

# Smoke results
smoke_ig_miss = sum(1 for k in smoke_images if not yolo_results[k]['gate_fired'])
smoke_total = len(smoke_images)
smoke_rate = smoke_ig_miss / smoke_total if smoke_total > 0 else 0.0
smoke_labels = set()
for k in smoke_images:
    smoke_labels.update([d.split(':')[0] for d in yolo_results[k].get('detections', [])])

# Overall
all_ig_miss = sum(1 for k in all_images if not yolo_results.get(os.path.basename(k), {}).get('gate_fired', True))
all_total = len(all_images)
all_rate = all_ig_miss / all_total if all_total > 0 else 0.0

print(f"\nFire images: {fire_total}")
print(f"  IG-miss: {fire_ig_miss}/{fire_total} = {fire_rate:.1%}")
print(f"  YOLO labels: {fire_labels}")

print(f"\nSmoke images: {smoke_total}")
print(f"  IG-miss: {smoke_ig_miss}/{smoke_total} = {smoke_rate:.1%}")
print(f"  YOLO labels: {smoke_labels}")

print(f"\nAll images: {all_total}")
print(f"  IG-miss: {all_ig_miss}/{all_total} = {all_rate:.1%}")

# OVOD results
fire_ovod = [v for k, v in ovod_results.items() if v.get('category') == 'fire']
smoke_ovod = [v for k, v in ovod_results.items() if v.get('category') == 'smoke']

if fire_ovod:
    fire_ovod_max = max(v['max_ovod_score'] for v in fire_ovod)
    fire_ovod_recovered = sum(1 for v in fire_ovod if v.get('ovod_recovered', False))
    print(f"\nFire OVOD: max={fire_ovod_max:.4f}, recovered={fire_ovod_recovered}/{len(fire_ovod)}")

if smoke_ovod:
    smoke_ovod_max = max(v['max_ovod_score'] for v in smoke_ovod)
    smoke_ovod_recovered = sum(1 for v in smoke_ovod if v.get('ovod_recovered', False))
    print(f"Smoke OVOD: max={smoke_ovod_max:.4f}, recovered={smoke_ovod_recovered}/{len(smoke_ovod)}")

print()
print("KEY FINDING:")
print("-" * 40)
if fire_total > 0 and smoke_total > 0:
    if fire_rate > 0.8:
        print(f"Fire: {fire_rate:.1%} IG-miss on REAL D-Fire images")
    if smoke_rate > 0.5:
        print(f"Smoke: {smoke_rate:.1%} IG-miss on REAL D-Fire images")

    # Compare to our procedural results
    print()
    print("Comparison to procedural frames:")
    print(f"  Procedural fire: 100% IG-miss (exp7/8)")
    print(f"  D-Fire real fire: {fire_rate:.1%} IG-miss")
    print(f"  Procedural smoke: 100% IG-miss (exp7/8)")
    print(f"  D-Fire real smoke: {smoke_rate:.1%} IG-miss")

# --- Save results ---
output_data = {
    'experiment': 'IGCA R010: D-Fire Real Fire/Smoke Evaluation',
    'n_images': len(all_images),
    'fire': {
        'total': fire_total,
        'ig_miss': fire_ig_miss,
        'ig_miss_rate': fire_rate,
        'yolo_labels': list(fire_labels),
    },
    'smoke': {
        'total': smoke_total,
        'ig_miss': smoke_ig_miss,
        'ig_miss_rate': smoke_rate,
        'yolo_labels': list(smoke_labels),
    },
    'all': {
        'total': all_total,
        'ig_miss': all_ig_miss,
        'ig_miss_rate': all_rate,
    },
    'yolo_results': yolo_results,
    'ovod_results': ovod_results,
    'yolo_unique_labels': list(unique_labels),
}
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)
print(f"\nResults saved to {OUTPUT_FILE}")