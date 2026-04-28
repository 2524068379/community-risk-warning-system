import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dependabot workflow', () => {
  it('auto-merges minor and patch dependency updates', () => {
    const workflow = fs.readFileSync(new URL('./dependabot-auto-merge.yml', import.meta.url), 'utf8');

    expect(workflow).toContain('pull-requests: write');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('gh pr merge');
    expect(workflow).toContain('dependabot/fetch-metadata@');
  });
});
