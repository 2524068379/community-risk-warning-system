import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('build workflow', () => {
  it('runs tests and typecheck before the production build', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');

    const testIndex = workflow.indexOf('npm run test');
    const typecheckIndex = workflow.indexOf('npm run typecheck');
    const buildIndex = workflow.indexOf('npm run build');

    expect(testIndex).toBeGreaterThan(-1);
    expect(typecheckIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(-1);
    expect(testIndex).toBeLessThan(buildIndex);
    expect(typecheckIndex).toBeLessThan(buildIndex);
  });
});
