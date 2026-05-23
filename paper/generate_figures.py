"""
Generate figures for the paper: Cascaded Visual Intelligence for Edge-Deployed Community Safety Monitoring
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

# Set style
plt.rcParams.update({
    'font.size': 11,
    'font.family': 'sans-serif',
    'font.sans-serif': ['Microsoft YaHei', 'SimHei', 'Arial Unicode MS', 'DejaVu Sans'],
    'axes.labelsize': 12,
    'axes.titlesize': 13,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10,
    'legend.fontsize': 10,
    'figure.dpi': 300,
    'savefig.dpi': 300,
    'savefig.bbox': 'tight',
    'axes.unicode_minus': False,
})

output_dir = os.path.join(os.path.dirname(__file__), 'figures')
os.makedirs(output_dir, exist_ok=True)

# ============================================================
# Data
# ============================================================

configs = ['逐帧\nVLM', '固定\n500ms', '固定\n5000ms', '级联\n无自适应', '级联\n无优先级', '完整级联\n本文']
vlm_calls = [3000, 600, 60, 200, 187, 169]
detection_rate = [100, 100, 100, 100, 100, 100]
gpu_util = [800, 160, 16, 53, 50, 45]

scenarios = ['静态\n夜间', '低活动\n住宅区', '中活动\n白天', '高活动\n入口']
scenario_naive = [3000, 3000, 3000, 3000]
scenario_ours = [1, 81, 191, 402]
scenario_reduction = [99.97, 97.3, 93.6, 86.6]

ablation_labels = ['逐帧\nVLM', '+固定\n500ms', '+运动/目标\n级联', '+自适应\n采样', '+优先级\n调度']
ablation_calls = [3000, 600, 200, 187, 169]
ablation_reduction = [0.0, 80.0, 93.3, 93.8, 94.4]

# ============================================================
# Figure 3: VLM Call Reduction Bar Chart
# ============================================================

fig, ax = plt.subplots(figsize=(8, 4))

colors = ['#95a5a6', '#95a5a6', '#95a5a6', '#3498db', '#3498db', '#e74c3c']
bars = ax.bar(range(len(configs)), vlm_calls, color=colors, edgecolor='white', linewidth=0.5)

# Highlight ours
bars[-1].set_edgecolor('#c0392b')
bars[-1].set_linewidth(2)

ax.set_xticks(range(len(configs)))
ax.set_xticklabels(configs, fontsize=9)
ax.set_ylabel('VLM调用次数（5分钟）')
ax.set_title('不同流水线配置的VLM调用量')
ax.set_ylim(0, 3500)

# Add value labels
for bar, val in zip(bars, vlm_calls):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 50,
            str(val), ha='center', va='bottom', fontsize=9, fontweight='bold')

# Add reduction annotations
for i, (bar, val) in enumerate(zip(bars, vlm_calls)):
    if i > 0:
        reduction = (1 - val/3000) * 100
        if val < 120:
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 190,
                    f'-{reduction:.0f}%', ha='center', va='bottom', fontsize=8, color='#2c3e50', fontweight='bold')
        else:
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height()/2,
                    f'-{reduction:.0f}%', ha='center', va='center', fontsize=8, color='white', fontweight='bold')

ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.grid(axis='y', alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'fig3_vlm_call_reduction.pdf'))
plt.savefig(os.path.join(output_dir, 'fig3_vlm_call_reduction.png'))
plt.close()
print("Generated: fig3_vlm_call_reduction.pdf")

# ============================================================
# Figure 4: Efficiency vs Activity Level
# ============================================================

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))

# Left: VLM calls comparison
x = np.arange(len(scenarios))
width = 0.35

bars1 = ax1.bar(x - width/2, scenario_naive, width, label='逐帧VLM', color='#95a5a6', edgecolor='white')
bars2 = ax1.bar(x + width/2, scenario_ours, width, label='完整级联', color='#e74c3c', edgecolor='white')

ax1.set_xticks(x)
ax1.set_xticklabels(scenarios, fontsize=9)
ax1.set_ylabel('VLM调用次数')
ax1.set_title('不同活动水平下的调用量')
ax1.legend(loc='upper left')
ax1.set_ylim(0, 3500)
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)
ax1.grid(axis='y', alpha=0.3)

# Right: Reduction percentage
ax2.plot(scenarios, scenario_reduction, 'o-', color='#e74c3c', linewidth=2, markersize=8, label='VLM调用缩减')
ax2.fill_between(range(len(scenarios)), scenario_reduction, alpha=0.1, color='#e74c3c')

ax2.set_xticks(range(len(scenarios)))
ax2.set_xticklabels(scenarios, fontsize=9)
ax2.set_ylabel('VLM调用缩减（%）')
ax2.set_title('效率与场景活动水平')
ax2.set_ylim(80, 101)
ax2.axhline(y=90, color='gray', linestyle='--', alpha=0.5, label='90%阈值')
ax2.legend(loc='lower left')
ax2.spines['top'].set_visible(False)
ax2.spines['right'].set_visible(False)
ax2.grid(axis='y', alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'fig4_efficiency_vs_activity.pdf'))
plt.savefig(os.path.join(output_dir, 'fig4_efficiency_vs_activity.png'))
plt.close()
print("Generated: fig4_efficiency_vs_activity.pdf")

# ============================================================
# Figure 5: Ablation Study
# ============================================================

fig, ax = plt.subplots(figsize=(8, 4))

colors_ablation = ['#95a5a6', '#3498db', '#3498db', '#3498db', '#e74c3c']
bars = ax.bar(range(len(ablation_labels)), ablation_calls, color=colors_ablation, edgecolor='white', linewidth=0.5)

# Highlight ours
bars[-1].set_edgecolor('#c0392b')
bars[-1].set_linewidth(2)

ax.set_xticks(range(len(ablation_labels)))
ax.set_xticklabels(ablation_labels, fontsize=9)
ax.set_ylabel('VLM调用次数（5分钟）')
ax.set_title('累积消融：逐步增加过滤与调度机制')
ax.set_ylim(0, 3300)

# Add value and reduction labels
for bar, val, red in zip(bars, ablation_calls, ablation_reduction):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 10,
            f'{val}', ha='center', va='bottom', fontsize=10, fontweight='bold')
    if red > 0:
        ax.text(bar.get_x() + bar.get_width()/2, max(bar.get_height()/2, 120),
                f'{red}%', ha='center', va='center', fontsize=9, color='white', fontweight='bold')

ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.grid(axis='y', alpha=0.3)

for i, delta in enumerate(['+80.0%', '+13.3%', '+0.5%', '+0.6%'], start=1):
    y = max(ablation_calls[i], ablation_calls[i - 1]) + 160
    ax.annotate('', xy=(i, ablation_calls[i] + 40), xytext=(i - 1, ablation_calls[i - 1] + 40),
                arrowprops=dict(arrowstyle='->', color='#2ecc71', lw=1.5))
    ax.text(i - 0.5, y, delta, ha='center', fontsize=8, color='#2ecc71', fontweight='bold')

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'fig5_ablation_study.pdf'))
plt.savefig(os.path.join(output_dir, 'fig5_ablation_study.png'))
plt.close()
print("Generated: fig5_ablation_study.pdf")

print("\nAll figures generated in:", output_dir)
