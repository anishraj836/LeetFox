import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { CodeforcesAdapter } from '../src/platforms/codeforces/CodeforcesAdapter';
import { CSESAdapter } from '../src/platforms/cses/CSESAdapter';
import { LeetfoxApp } from '../src/ui/LeetfoxApp';
import { StorageManager } from '../src/core/storage/StorageManager';
import { DEFAULT_PREFERENCES } from '../src/core/models/preferences';

describe('LeetfoxApp Integration', () => {
  let storage: StorageManager;

  beforeEach(async () => {
    storage = StorageManager.getInstance();
    await (globalThis as any).browser.storage.local.clear();
  });

  it('mounts on Codeforces, renders modern UI, and handles user interactions', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/codeforces/problem_4a.html');
    const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');
    const dom = new JSDOM(fixtureHtml, { url: 'https://codeforces.com/contest/4/problem/A' });
    const doc = dom.window.document;

    const adapter = new CodeforcesAdapter();
    const problem = adapter.parseProblem(doc, new URL('https://codeforces.com/contest/4/problem/A'));
    expect(problem).not.toBeNull();
    if (!problem) return;

    const state = await storage.getProblemState(problem.platform, problem.id);
    const prefs = { ...DEFAULT_PREFERENCES };

    const app = new LeetfoxApp(adapter, problem, state, prefs);
    await app.mount(doc);

    // Verify mounted elements
    const appEl = doc.getElementById('leetfox-app');
    expect(appEl).not.toBeNull();
    expect(appEl?.dataset.lfTheme).toBe('dark');
    expect(doc.body.classList.contains('lf-active')).toBe(true);

    // Header checks
    const titleEl = appEl?.querySelector('.lf-header-title');
    expect(titleEl?.textContent).toBe('Watermelon');

    const idEl = appEl?.querySelector('.lf-header-id');
    expect(idEl?.textContent).toBe('4A');

    // Metadata checks
    const ratingBadge = appEl?.querySelector('.lf-spec-badge.difficulty');
    expect(ratingBadge?.textContent).toContain('800');

    // Submissions button checks
    const headerBtns = Array.from(appEl?.querySelectorAll('.lf-header-actions button') || []);
    const headerSubmissionsBtn = headerBtns.find(btn => btn.textContent?.includes('Submissions'));
    expect(headerSubmissionsBtn).toBeDefined();

    const metaLinks = Array.from(appEl?.querySelectorAll('.lf-metadata-actions a') || []);
    const metaSubmissionsLink = metaLinks.find(link => link.textContent?.includes('Submissions'));
    expect(metaSubmissionsLink).toBeDefined();
    expect(metaSubmissionsLink?.getAttribute('href')).toBe('https://codeforces.com/contest/4/my');

    const editorBtns = Array.from(appEl?.querySelectorAll('.lf-editor-toolbar button') || []);
    const editorSubmissionsBtn = editorBtns.find(btn => btn.textContent?.includes('Submissions'));
    expect(editorSubmissionsBtn).toBeDefined();

    // Examples checks
    const exampleCards = appEl?.querySelectorAll('.lf-example-card');
    expect(exampleCards?.length).toBe(1);

    // Toggle Solved
    await app.toggleSolved();
    let savedState = await storage.getProblemState('codeforces', '4a');
    expect(savedState.solved).toBe(true);

    const solvedBtn = appEl?.querySelector('.lf-btn-solved');
    expect(solvedBtn?.textContent).toContain('Solved');

    // Toggle Bookmark
    await app.toggleBookmark();
    savedState = await storage.getProblemState('codeforces', '4a');
    expect(savedState.bookmarked).toBe(true);

    // Notes auto-save
    await app.saveNotes('Binary search on answer');
    savedState = await storage.getProblemState('codeforces', '4a');
    expect(savedState.notes).toBe('Binary search on answer');

    // Toggle Theme
    await app.toggleTheme();
    expect(appEl?.dataset.lfTheme).toBe('light');
    let savedPrefs = await storage.getPreferences();
    expect(savedPrefs.theme).toBe('light');

    // Toggle View Original Page
    expect(appEl?.style.display).toBe('block');
    expect(doc.body.classList.contains('lf-active')).toBe(true);

    // Toggle to view original
    await app.toggleViewOriginal();
    expect(doc.body.classList.contains('lf-active')).toBe(false);
    expect(appEl?.style.display).toBe('none');

    // Floating switcher is present on original site
    const switcher = doc.getElementById('lf-floating-switcher');
    expect(switcher).not.toBeNull();

    // Toggle back to Leetfox view
    await app.toggleViewOriginal();
    expect(doc.body.classList.contains('lf-active')).toBe(true);
    expect(appEl?.style.display).toBe('block');
  });

  it('mounts on CSES cleanly without progress bar bloat and handles state changes', async () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/cses/task_1068.html');
    const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');
    const dom = new JSDOM(fixtureHtml, { url: 'https://cses.fi/problemset/task/1068' });
    const doc = dom.window.document;

    const adapter = new CSESAdapter();
    const problem = adapter.parseProblem(doc, new URL('https://cses.fi/problemset/task/1068'));
    expect(problem).not.toBeNull();
    if (!problem) return;

    const state = await storage.getProblemState(problem.platform, problem.id);
    const prefs = { ...DEFAULT_PREFERENCES };

    const app = new LeetfoxApp(adapter, problem, state, prefs);
    await app.mount(doc);

    const appEl = doc.getElementById('leetfox-app');
    expect(appEl).not.toBeNull();

    // Verify category progress bar is NOT mounted in the UI
    const progressCount = appEl?.querySelector('.lf-progress-count');
    expect(progressCount).toBeNull();
    const progressCard = appEl?.querySelector('.lf-progress-card');
    expect(progressCard).toBeNull();

    // Mark current problem solved
    await app.toggleSolved();

    // Verify stored state in storage
    const savedState = await storage.getProblemState('cses', '1068');
    expect(savedState.solved).toBe(true);
  });
});
