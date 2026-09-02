import { describe, it, expect, beforeEach } from 'vitest';
import { PlatformRegistry } from '../src/core/platform/PlatformRegistry';
import { CodeforcesAdapter } from '../src/platforms/codeforces/CodeforcesAdapter';
import { CSESAdapter } from '../src/platforms/cses/CSESAdapter';

describe('Platform Detection & Registry', () => {
  let registry: PlatformRegistry;
  let cfAdapter: CodeforcesAdapter;
  let csesAdapter: CSESAdapter;

  beforeEach(() => {
    registry = PlatformRegistry.getInstance();
    registry.clear();
    cfAdapter = new CodeforcesAdapter();
    csesAdapter = new CSESAdapter();
    registry.register(cfAdapter);
    registry.register(csesAdapter);
  });

  it('detects Codeforces on problemset URLs', () => {
    const url = new URL('https://codeforces.com/problemset/problem/4/A');
    const adapter = registry.detectAdapter(url);
    expect(adapter).toBeDefined();
    expect(adapter?.platformId).toBe('codeforces');
    expect(adapter?.isProblemPage(url)).toBe(true);
  });

  it('detects Codeforces on contest URLs', () => {
    const url = new URL('https://codeforces.com/contest/1900/problem/C');
    const adapter = registry.detectAdapter(url);
    expect(adapter).toBeDefined();
    expect(adapter?.platformId).toBe('codeforces');
    expect(adapter?.isProblemPage(url)).toBe(true);
  });

  it('detects Codeforces on mirror domains', () => {
    const url = new URL('https://mirror.codeforces.com/problemset/problem/123/B');
    const adapter = registry.detectAdapter(url);
    expect(adapter?.platformId).toBe('codeforces');
  });

  it('detects CSES on problemset task URLs', () => {
    const url = new URL('https://cses.fi/problemset/task/1068');
    const adapter = registry.detectAdapter(url);
    expect(adapter).toBeDefined();
    expect(adapter?.platformId).toBe('cses');
    expect(adapter?.isProblemPage(url)).toBe(true);
  });

  it('detects CSES non-problem pages correctly as non-problem', () => {
    const url = new URL('https://cses.fi/problemset/list/');
    const adapter = registry.detectAdapter(url);
    expect(adapter?.platformId).toBe('cses');
    expect(adapter?.isProblemPage(url)).toBe(false);
  });

  it('returns null for unknown platforms without error', () => {
    const url = new URL('https://leetcode.com/problems/two-sum/');
    const adapter = registry.detectAdapter(url);
    expect(adapter).toBeNull();
  });
});
