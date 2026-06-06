#!/usr/bin/env python3
"""
IGCA R011: Real Image Evaluation
Evaluate all real images we have:
- datasets/real_frames/ (18 images: fire/smoke/blockage/person)
- datasets/real_fire_smoke_frames/ (60 synthetic realistic scenes from exp9)

Generate real-world IG-miss rates to compare with procedural results.
"""

import os
import json
import random
import torch
from pathlib import Path
from PIL import Image
from ultralytics import YOLO
from transformers import pipeline

OUTPUT_FILE = 'experiments/exp11_real_image_results.json'
os.makedirs('experiments', exist_ok=True)

print("=== IGCA R011: Real Image Evaluation ===\n")

# --- Load models ---
print("Loading YOLOv8n...")
yolo = YOLO('yolov8n.pt')
yolo.conf = 0.4

print("Loading OWL-ViT...")
device = 'cuda' if torch.cuda.is_available() else 'cpu'
detector = pipeline('zero-shot-object-detection', model='google/owlvit-base-patch32', device=device)

PROMPTS = {
    'fire': ['fire', 'flame', 'burning'],
    'smoke': ['smoke', 'fog', 'steam'],
    'person': ['person', 'human'],
    'blockage': ['chair', 'table', 'box', 'obstacle'],
}

# --- Collect all real images ---
all_images = []
image_metadata = {}

# Source 1: real_frames
for cat in ['fire', 'smoke', 'blockage', 'person']:
    cat_dir = f'datasets/real_frames/{cat}'
    if os.path.isdir(cat_dir):
        for f in os.listdir(cat_dir):
            if f.endswith(('.jpg', '.png')):
                fpath = os.path.join(cat_dir, f)
                all_images.append(fpath)
                image_metadata[fpath] = {'source': 'real_frames', 'category': cat}

# Source 2: real_fire_smoke_frames (60 from exp9)
smoke_frames_dir = 'datasets/real_fire_smoke_frames'
if os.path.isdir(smoke_frames_dir):
    for f in os.listdir(smoke_frames_dir):
        if f.endswith(('.jpg', '.png')):
            fpath = os.path.join(smoke_frames_dir, f)
            all_images.append(fpath)
            # Determine category from filename
            if 'fire_person' in f:
                cat = 'fire_with_person'
            elif 'fire_scene' in f:
                cat = 'fire_scene'
            elif 'smoke_person' in f:
                cat = 'smoke_with_person'
            elif 'smoke_scene' in f:
                cat = 'smoke_scene'
            else:
                cat = 'unknown'
            image_metadata[fpath] = {'source': 'exp9_real_scenes', 'category': cat}

print(f"Total images: {len(all_images)}")
for src in ['real_frames', 'exp9_real_scenes']:
    n = sum(1 for p in all_images if image_metadata[p]['source'] == src)
    if n > 0:
        print(f"  From {src}: {n}")

# --- Run YOLO evaluation ---
print("\nRunning YOLO gate evaluation...")
yolo_results = {}
all_labels = []

for i, fpath in enumerate(all_images):
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
            all_labels.append(label)
        yolo_results[fpath] = {
            'gate_fired': len(detected) > 0,
            'detections': detected,
        }
    except Exception as e:
        yolo_results[fpath] = {
            'gate_fired': False,
            'detections': [],
            'error': str(e),
        }

print(f"Unique YOLO detections: {set(all_labels)}")

# --- Run OWL-ViT evaluation ---
print("\nRunning OWL-ViT recovery arm...")
ovod_results = {}

for i, fpath in enumerate(all_images):
    fname = os.path.basename(fpath)
    meta = image_metadata.get(fpath, {})
    cat = meta.get('category', 'unknown')

    if cat not in ['fire', 'smoke', 'fire_with_person', 'fire_scene', 'smoke_with_person', 'smoke_scene']:
        continue

    prompt_cat = 'fire' if 'fire' in cat else 'smoke'
    if prompt_cat not in PROMPTS:
        continue

    try:
        img = Image.open(fpath).convert('RGB')
        best_scores = {}
        for prompt in PROMPTS[prompt_cat]:
            result = detector(image=img, candidate_labels=[prompt], threshold=0.1)
            if result:
                best_scores[prompt] = max(r['score'] for r in result)
        ovod_results[fpath] = {
            'category': cat,
            'max_score': max(best_scores.values()) if best_scores else 0.0,
            'recovered': any(s > 0.1 for s in best_scores.values()),
        }
    except Exception as e:
        ovod_results[fpath] = {
            'category': cat,
            'max_score': 0.0,
            'error': str(e),
        }

# --- Aggregate by category ---
print("\n" + "="*60)
print("RESULTS")
print("="*60)

categories = {}
for fpath in all_images:
    meta = image_metadata.get(fpath, {})
    cat = meta['category']
    if cat not in categories:
        categories[cat] = {'total': 0, 'ig_miss': 0, 'yolo_labels': [], 'ovod_scores': []}
    categories[cat]['total'] += 1
    yres = yolo_results.get(fpath, {'gate_fired': False})
    if not yres['gate_fired']:
        categories[cat]['ig_miss'] += 1
    categories[cat]['yolo_labels'].extend([d.split(':')[0] for d in yres.get('detections', [])])
    ovod = ovod_results.get(fpath, {})
    categories[cat]['ovod_scores'].append(ovod.get('max_score', 0.0))

print()
for cat in sorted(categories.keys()):
    info = categories[cat]
    rate = info['ig_miss'] / info['total'] if info['total'] > 0 else 0.0
    ovod_max = max(info['ovod_scores']) if info['ovod_scores'] else 0.0
    unique_labels = set(info['yolo_labels'])
    print(f"{cat}: IG-miss {info['ig_miss']}/{info['total']}={rate:.1%} | YOLO: {unique_labels} | OVOD max={ovod_max:.4f}")

# --- Summary comparison ---
print("\n" + "="*60)
print("KEY COMPARISON: Procedural vs Real Images")
print("="*60)
print()
print("Source             | Category          | IG-miss Rate | OVOD max")
print("-"*60)

# Group by category type - using exact matches
comparisons = [
    ('real_frames', 'fire', 'Fire (real photos)'),
    ('real_frames', 'smoke', 'Smoke (real photos)'),
    ('real_frames', 'blockage', 'Blockage (real photos)'),
    ('real_frames', 'person', 'Person (real photos)'),
]

for src, cat, label in comparisons:
    info = categories.get(cat)
    if info is None:
        print(f"{src:18} | {label:17} | N/A")
        continue
    rate = info['ig_miss'] / info['total'] if info['total'] > 0 else 0.0
    ovod_max = max(info['ovod_scores']) if info['ovod_scores'] else 0.0
    print(f"{src:18} | {label:17} | {rate:12.1%} | {ovod_max:.4f}")

print()
print("Procedural reference (exp7/8):")
print("  Smoke (texture): 100% IG-miss | OVOD max=0.0000")
print("  Fire (texture): 100% IG-miss | OVOD max=0.0000")
print("  Blockage (texture): 100% IG-miss | OVOD max=0.0000")

# --- Save ---
output_data = {
    'experiment': 'IGCA R011: Real Image Evaluation',
    'n_total': len(all_images),
    'by_category': categories,
    'yolo_results': {os.path.basename(k): v for k, v in yolo_results.items()},
    'ovod_results': {os.path.basename(k): v for k, v in ovod_results.items()},
}
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)
print(f"\nSaved to {OUTPUT_FILE}")