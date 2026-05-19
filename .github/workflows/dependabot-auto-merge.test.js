import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dependabot auto-merge workflow', () => {
  const workflow = fs.readFileSync(new URL('./dependabot-auto-merge.yml', import.meta.url), 'utf8');

  it('has required permissions', () => {
    expect(workflow).toContain('pull-requests: write');
    expect(workflow).toContain('contents: write');
  });

  it('auto-merges minor and patch updates', () => {
    expect(workflow).toContain('gh pr merge');
    expect(workflow).toContain('dependabot/fetch-metadata@');
    expect(workflow).toContain('version-update:semver-minor');
    expect(workflow).toContain('version-update:semver-patch');
  });

  it('labels major updates for manual review instead of auto-merging', () => {
    expect(workflow).toContain('version-update:semver-major');
    expect(workflow).toContain('needs-review');
    expect(workflow).toContain('--add-label');
    // Major step must NOT contain auto-merge
    const majorBlock = workflow.split('Label major updates')[1];
    expect(majorBlock).not.toContain('gh pr merge');
  });
});
