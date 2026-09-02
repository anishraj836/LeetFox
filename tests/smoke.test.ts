import { describe, it, expect } from 'vitest';

describe('Smoke test', () => {
  it('has global storage mock', () => {
    expect((globalThis as any).browser).toBeDefined();
    expect((globalThis as any).browser.storage.local).toBeDefined();
  });
});
