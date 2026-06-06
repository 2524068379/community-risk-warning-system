#!/usr/bin/env python3
"""
IGCA R012: VLM End-to-End Test
Tests VLM risk detection on IG-miss clips (where gate never fired).
This is the KEY missing piece: downstream VLM detection accuracy.

Usage:
  python experiments/exp12_vlm_e2e_test.py --output experiments/exp12_vlm_e2e.json
"""

import os
import sys
import json
import time
import signal
import subprocess
import requests
import base64
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
VLM_DIR = Path(os.environ.get('VLM_DIR', ROOT / 'resources' / 'vlm'))
LLAMA_SERVER = VLM_DIR / 'llama-server.exe'
MODEL_GGUF = VLM_DIR / 'Qwen3.5-4B-Q4_K_M.gguf'
MMPROJ = VLM_DIR / 'mmproj-BF16.gguf'
PORT = 11434
URL = f'http://127.0.0.1:{PORT}'

OUTPUT_FILE = Path(os.environ.get('OUTPUT_FILE', ROOT / 'experiments' / 'exp12_vlm_e2e_all.json'))
REAL_FRAMES_DIR = Path(os.environ.get('REAL_FRAMES_DIR', ROOT / 'datasets' / 'real_frames'))
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

def check_server():
    """Check if llama-server is running."""
    try:
        resp = requests.get(f'{URL}/v1/models', timeout=5)
        return resp.status_code == 200
    except:
        return False

def start_server():
    """Start llama-server with Qwen3.5-4B in background."""
    if check_server():
        print("llama-server already running")
        return True

    print("Starting llama-server...")
    cmd = [
        str(LLAMA_SERVER),
        '-m', str(MODEL_GGUF),
        '--mmproj', str(MMPROJ),
        '-c', '4096',
        '--host', '127.0.0.1',
        '--port', str(PORT),
    ]
    print(f"Command: {' '.join(map(str, cmd))}")

    try:
        proc = subprocess.Popen(cmd, cwd=VLM_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"Server starting with PID {proc.pid}")

        # Wait for server to be ready
        for i in range(30):
            time.sleep(2)
            if check_server():
                print(f"Server ready after {2*(i+1)}s")
                return True
            if proc.poll() is not None:
                stdout, stderr = proc.communicate()
                print(f"Server exited early: {proc.returncode}")
                print(f"stdout: {stdout[:500]}")
                print(f"stderr: {stderr[:500]}")
                return False

        print("Server did not respond after 60s")
        return False
    except Exception as e:
        print(f"Failed to start server: {e}")
        return False

def stop_server():
    """Stop llama-server."""
    try:
        resp = requests.post(f'{URL}/v1/shutdown', timeout=5)
    except:
        pass

def encode_image(img_path):
    """Encode image to base64."""
    with open(img_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def test_vlm(prompt, image_path=None):
    """Test VLM with prompt and optional image."""
    model_name = "qwen3.5-4b-mtp:q4_k_m"
    if image_path:
        img_b64 = encode_image(image_path)
        payload = {
            "model": model_name,
            "messages": [
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                ]}
            ],
            "stream": False,
            "options": {"temperature": 0.1}
        }
    else:
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {"temperature": 0.1}
        }

    try:
        resp = requests.post(f'{URL}/v1/chat/completions', json=payload, timeout=120)
        if resp.status_code == 200:
            return resp.json().get('choices', [{}])[0].get('message', {}).get('content', '')
        else:
            return f"ERROR: {resp.status_code} - {resp.text[:200]}"
    except Exception as e:
        return f"ERROR: {e}"

print("=== IGCA R012: VLM End-to-End Test ===\n")

# Start server
if not start_server():
    print("FATAL: Could not start llama-server")
    sys.exit(1)

print("\nServer running. Testing VLM...")

# --- Test 1: Simple text-only test ---
print("\n[Test 1] Text-only: generic risk prompt")
prompt_generic = "Is there a community safety risk in this surveillance scene? Describe what you see and rate A/B/C risk level."
response = test_vlm(prompt_generic)
print(f"Response: {response[:300]}")

# --- Test 2: Test with a real frame ---
print("\n[Test 2] Testing with real frame images")
# Find real frames
real_frame_paths = []
for cat in ['fire', 'smoke', 'blockage', 'person']:
    cat_dir = REAL_FRAMES_DIR / cat
    if os.path.isdir(cat_dir):
        for f in os.listdir(cat_dir):
            if f.endswith(('.jpg', '.png')):
                real_frame_paths.append((cat_dir / f, cat))

print(f"Found {len(real_frame_paths)} real frames")

results = []
for fpath, cat in real_frame_paths:  # Test all frames
    fname = os.path.basename(fpath)
    print(f"\n[{fname}] ({cat})")

    # Generic prompt
    prompt = f"This is a surveillance camera image. Is there a {cat} risk present? Rate A (high risk), B (medium), or C (low/no risk). Respond with only the letter and a brief reason."
    response = test_vlm(prompt, fpath)
    print(f"  Generic response: {response[:200]}")

    # Parse response for risk — check if VLM rates as A (high risk)
    resp_upper = response.upper().strip()
    # Detect "A" rating: response starts with "A" or "A:" or contains "RISK LEVEL: A"
    has_risk = resp_upper.startswith('A') or 'RISK LEVEL: A' in resp_upper or 'RISK:A' in resp_upper
    # Also check for explicit risk keywords in the reason
    if not has_risk:
        has_risk = any(kw in resp_upper for kw in ['FIRE RISK', 'SMOKE RISK', 'HIGH RISK', 'DANGER', 'HAZARD'])
    results.append({
        'filename': fname,
        'category': cat,
        'vlm_response': response[:300],
        'vlm_has_risk': has_risk,
    })

# --- Test 3: Compare IG-miss vs gate-fired ---
print("\n" + "="*60)
print("RESULTS: VLM Risk Detection on Real Frames")
print("="*60)

for r in results:
    print(f"\n{r['filename']} ({r['category']}):")
    print(f"  VLM detected risk: {r['vlm_has_risk']}")
    print(f"  Response: {r['vlm_response'][:150]}")

# Summary
print("\n" + "="*60)
print("SUMMARY")
print("="*60)
for cat in ['fire', 'smoke', 'blockage', 'person']:
    cat_results = [r for r in results if r['category'] == cat]
    if cat_results:
        vlm_detected = sum(1 for r in cat_results if r['vlm_has_risk'])
        print(f"{cat}: {vlm_detected}/{len(cat_results)} detected by VLM ({vlm_detected/len(cat_results)*100:.1f}%)")

risk_positive = [r for r in results if r['category'] in ['fire', 'smoke']]
if risk_positive:
    vlm_detected = sum(1 for r in risk_positive if r['vlm_has_risk'])
    print(f"\nOverall risk-positive (fire/smoke): {vlm_detected}/{len(risk_positive)} detected by VLM ({vlm_detected/len(risk_positive)*100:.1f}%)")

# Stop server
print("\nStopping server...")
stop_server()

# Save results
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump({
        'experiment': 'IGCA R012: VLM End-to-End Test',
        'results': results,
    }, f, indent=2, ensure_ascii=False)
print(f"\nSaved to {OUTPUT_FILE}")
