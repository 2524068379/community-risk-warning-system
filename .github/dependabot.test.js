import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dependabot config', () => {
  it('covers npm and GitHub Actions with daily schedule and grouped updates', () => {
    const config = fs.readFileSync(new URL('./dependabot.yml', import.meta.url), 'utf8');
    const githubActionsBlock = config.split("  - package-ecosystem: 'github-actions'")[1];

    expect(config).toContain("package-ecosystem: 'npm'");
    expect(config).toContain("package-ecosystem: 'github-actions'");
    expect(config).toContain("timezone: 'Asia/Shanghai'");
    expect(config).toContain("interval: 'daily'");

    // Minor/patch grouped for auto-merge
    expect(config).toContain('npm-production-minor-patch:');
    expect(config).toContain('npm-development-minor-patch:');
    expect(config).toContain('github-actions-minor-patch:');

    // Major grouped separately for manual review
    expect(config).toContain('npm-production-major:');
    expect(config).toContain('npm-development-major:');
    expect(config).toContain('github-actions-major:');

    expect(config).toContain("prefix-development: 'chore(dev)'");
    expect(config).toContain("open-pull-requests-limit: 10");
    expect(config).toContain("semver-major-days: 7");

    // GitHub Actions block should not have npm-specific cooldown keys
    expect(githubActionsBlock).not.toContain('semver-major-days');
    expect(githubActionsBlock).not.toContain('semver-minor-days');
    expect(githubActionsBlock).not.toContain('semver-patch-days');
  });
});
