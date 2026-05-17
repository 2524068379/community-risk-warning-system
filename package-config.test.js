import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VLM_MODEL_FILE, VLM_MMPROJ_FILE } from './shared/vlmModelConfig.js';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

describe('package configuration', () => {
  it('keeps Windows packages branded with metadata and an icon', () => {
    expect(packageJson.description).toBeTruthy();
    expect(packageJson.author).toBeTruthy();
    expect(packageJson.build.win.icon).toBe('build/icon.ico');
  });

  it('packages VLM runtime resources under resources\\vlm next to the Windows exe', () => {
    const vlmResources = packageJson.build.extraResources?.find(
      (entry) => entry.from === 'resources/vlm' && entry.to === 'vlm'
    );

    expect(vlmResources?.filter).toEqual(expect.arrayContaining([
      '**/*',
      `!${VLM_MODEL_FILE}`,
      `!${VLM_MMPROJ_FILE}`
    ]));
  });

  it('keeps the local VLM resource download script available', () => {
    expect(packageJson.scripts['download-model']).toBe('node scripts/download-model.js');
    expect(packageJson.scripts.prepackage).toBe('npm run download-model');
    expect(existsSync('scripts/download-model.js')).toBe(true);

    const script = readFileSync('scripts/download-model.js', 'utf8');

    expect(script).toContain('../shared/vlmModelConfig.js');
    expect(script).toContain('VLM_MODEL_FILE');
    expect(script).toContain('VLM_MODEL_URL');
    expect(script).toContain('VLM_MODEL_SHA256');
    expect(script).toContain('VLM_MMPROJ_FILE');
    expect(script).toContain('VLM_MMPROJ_URL');
    expect(script).toContain('VLM_MMPROJ_SHA256');
  });
});
