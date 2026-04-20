import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('escapes characters that can break out of HTML text', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & device')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; device'
    );
  });

  it('handles non-string values through normal string conversion', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('');
  });
});
