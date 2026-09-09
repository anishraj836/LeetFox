import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { CodeforcesAdapter } from '../src/platforms/codeforces/CodeforcesAdapter';
import { LeetfoxApp } from '../src/ui/LeetfoxApp';
import { CodeEditorPane } from '../src/ui/components/CodeEditorPane';
import { StorageManager } from '../src/core/storage/StorageManager';
import { DEFAULT_PREFERENCES } from '../src/core/models/preferences';

describe('Resizable Split Borders & Layout Controls', () => {
  let storage: StorageManager;

  beforeEach(async () => {
    storage = StorageManager.getInstance();
    await (globalThis as any).browser.storage.local.clear();
  });

  it('initializes vertical resizer and respects saved horizontalSplitPercent', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/codeforces/problem_4a.html');
    const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');
    const dom = new JSDOM(fixtureHtml, { url: 'https://codeforces.com/contest/4/problem/A' });
    const doc = dom.window.document;

    const adapter = new CodeforcesAdapter();
    const problem = adapter.parseProblem(doc, new URL('https://codeforces.com/contest/4/problem/A'))!;

    // Custom preference: 60% split
    const prefs = { ...DEFAULT_PREFERENCES, horizontalSplitPercent: 60 };
    const state = await storage.getProblemState(problem.platform, problem.id);

    const app = new LeetfoxApp(adapter, problem, state, prefs);
    await app.mount(doc);

    const appEl = doc.getElementById('leetfox-app')!;
    const splitContainer = appEl.querySelector('.lf-split-container') as HTMLElement;
    const resizer = appEl.querySelector('.lf-resizer-vertical') as HTMLElement;

    expect(resizer).not.toBeNull();
    expect(splitContainer.style.getPropertyValue('--lf-split-left-width')).toBe('60%');

    // Double click resets to 48%
    resizer.dispatchEvent(new dom.window.MouseEvent('dblclick'));
    expect(splitContainer.style.getPropertyValue('--lf-split-left-width')).toBe('48%');

    const updatedPrefs = await storage.getPreferences();
    expect(updatedPrefs.horizontalSplitPercent).toBe(48);

    app.destroy();
  });

  it('initializes horizontal console resizer and collapse toggle in CodeEditorPane', async () => {
    const pane = new CodeEditorPane({
      platform: 'codeforces',
      id: '4A',
      qualifiedId: 'codeforces:4a',
      title: 'Watermelon',
      url: 'https://codeforces.com/contest/4/problem/A',
      limits: { timeLimit: '1.0s', memoryLimit: '64MB' },
      navigation: {},
      tags: ['math'],
      statementHtml: '<p>statement</p>',
      examples: [{ id: 1, input: '8', output: 'YES' }]
    });

    const el = pane.getElement();
    const horizontalResizer = el.querySelector('.lf-resizer-horizontal') as HTMLElement;
    const consoleCard = el.querySelector('.lf-console-card') as HTMLElement;
    const toggleBtn = el.querySelector('.lf-btn-console-toggle') as HTMLButtonElement;

    expect(horizontalResizer).not.toBeNull();
    expect(consoleCard).not.toBeNull();
    expect(toggleBtn).not.toBeNull();
    expect(consoleCard.classList.contains('collapsed')).toBe(false);

    // Toggle collapse
    toggleBtn.click();
    expect(consoleCard.classList.contains('collapsed')).toBe(true);
    expect(toggleBtn.textContent).toBe('▴');

    // Toggle expand
    toggleBtn.click();
    expect(consoleCard.classList.contains('collapsed')).toBe(false);
    expect(toggleBtn.textContent).toBe('▾');

    // Double-click resizer resets to 270px
    horizontalResizer.dispatchEvent(new MouseEvent('dblclick'));
    expect(consoleCard.style.height).toBe('270px');

    const updatedPrefs = await storage.getPreferences();
    expect(updatedPrefs.consoleHeightPx).toBe(270);
  });
});
