import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dependabot config', () => {
  it('covers npm and GitHub Actions with daily schedule and enough PR capacity', () => {
    const config = fs.readFileSync(new URL('./dependabot.yml', import.meta.url), 'utf8');
    const githubActionsBlock = config.split("  - package-ecosystem: 'github-actions'")[1];

    expect(config).toContain("package-ecosystem: 'npm'");
    expect(config).toContain("package-ecosystem: 'github-actions'");
    expect(config).toContain("timezone: 'Asia/Shanghai'");
    expect(config).toContain("interval: 'daily'");

    // Keep Dependabot quiet, but leave one spare slot when a major update awaits review.
    expect(config.match(/open-pull-requests-limit: 2/g)).toHaveLength(2);
    expect(config).not.toContain('open-pull-requests-limit: 1');
    expect(config).not.toContain('groups:');

    expect(config).toContain("prefix-development: 'chore(dev)'");
    expect(config).toContain("semver-major-days: 7");

    // GitHub Actions block should not have npm-specific cooldown keys
    expect(githubActionsBlock).not.toContain('semver-major-days');
    expect(githubActionsBlock).not.toContain('semver-minor-days');
    expect(githubActionsBlock).not.toContain('semver-patch-days');
  });
});
