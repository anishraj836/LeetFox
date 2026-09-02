import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/core/utils/sanitize';

describe('HTML Sanitizer', () => {
  it('strips dangerous <script> tags and onerror handlers', () => {
    const malicious = '<p>Normal text</p><script>alert("hacked")</script><img src="x" onerror="alert(1)">';
    const clean = sanitizeHtml(malicious);

    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('<p>Normal text</p>');
  });

  it('strips iframes, objects, and forms', () => {
    const dangerous = '<div><iframe src="https://evil.com"></iframe><form action="/login"><input name="pw"></form></div>';
    const clean = sanitizeHtml(dangerous);

    expect(clean).not.toContain('iframe');
    expect(clean).not.toContain('form');
    expect(clean).not.toContain('input');
  });

  it('preserves mathematical formulas, KaTeX spans, and code tags', () => {
    const mathContent = `
      <p>Let <span class="math math-inline">1 &le; n &le; 10^6</span> be an integer.</p>
      <div class="katex"><span class="katex-html">Formula</span></div>
      <pre><code>int x = 42;</code></pre>
    `;
    const clean = sanitizeHtml(mathContent);

    expect(clean).toContain('class="math math-inline"');
    expect(clean).toContain('class="katex"');
    expect(clean).toContain('<pre><code>int x = 42;</code></pre>');
  });
});
