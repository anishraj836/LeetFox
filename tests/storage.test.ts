import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager } from '../src/core/storage/StorageManager';

describe('StorageManager', () => {
  let storage: StorageManager;

  beforeEach(async () => {
    storage = StorageManager.getInstance();
    await (globalThis as any).browser.storage.local.clear();
  });

  it('generates correct platform-qualified storage keys', () => {
    expect(storage.getQualifiedKey('Codeforces', '4A')).toBe('problem:codeforces:4a');
    expect(storage.getQualifiedKey('CSES', '1068')).toBe('problem:cses:1068');
  });

  it('persists and loads problem state with isolation', async () => {
    // Save Codeforces 4A
    await storage.saveProblemState('codeforces', '4A', {
      solved: true,
      bookmarked: true,
      notes: 'Watermelon problem note'
    });

    // Save CSES 4A (same ID, different platform)
    await storage.saveProblemState('cses', '4A', {
      solved: false,
      bookmarked: false,
      notes: 'CSES note'
    });

    const cfState = await storage.getProblemState('codeforces', '4A');
    const csesState = await storage.getProblemState('cses', '4A');

    expect(cfState.solved).toBe(true);
    expect(cfState.bookmarked).toBe(true);
    expect(cfState.notes).toBe('Watermelon problem note');

    expect(csesState.solved).toBe(false);
    expect(csesState.bookmarked).toBe(false);
    expect(csesState.notes).toBe('CSES note');
  });

  it('updates problem state partially without overwriting other fields', async () => {
    await storage.saveProblemState('codeforces', '123B', {
      bookmarked: true,
      notes: 'Important trick'
    });

    // Mark solved later
    await storage.saveProblemState('codeforces', '123B', {
      solved: true
    });

    const state = await storage.getProblemState('codeforces', '123B');
    expect(state.solved).toBe(true);
    expect(state.bookmarked).toBe(true);
    expect(state.notes).toBe('Important trick');
    expect(state.lastVisited).toBeGreaterThan(0);
  });

  it('retrieves all problem states for a specific platform', async () => {
    await storage.saveProblemState('cses', '1068', { solved: true });
    await storage.saveProblemState('cses', '1083', { solved: true });
    await storage.saveProblemState('codeforces', '1068', { solved: false });

    const csesProblems = await storage.getAllProblemStatesForPlatform('cses');
    expect(csesProblems.size).toBe(2);
    expect(csesProblems.get('1068')?.solved).toBe(true);
    expect(csesProblems.get('1083')?.solved).toBe(true);
  });

  it('saves and loads user preferences', async () => {
    const defaultPrefs = await storage.getPreferences();
    expect(defaultPrefs.theme).toBe('dark');

    await storage.savePreferences({ theme: 'light', fontSize: 'large' });
    const updatedPrefs = await storage.getPreferences();
    expect(updatedPrefs.theme).toBe('light');
    expect(updatedPrefs.fontSize).toBe('large');
  });
});
