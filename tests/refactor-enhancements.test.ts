import { DEFAULT_PROBLEM_STATE } from '../src/core/models/state';
import { Header } from '../src/ui/components/Header';
import { KeyboardCheatSheet } from '../src/ui/components/KeyboardCheatSheet';
import { sanitizeHtml } from '../src/core/utils/sanitize';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { CodeforcesParser } from '../src/platforms/codeforces/CodeforcesParser';
import { CSESParser } from '../src/platforms/cses/CSESParser';
import { KeyboardManager } from '../src/core/keyboard/KeyboardManager';
import { StorageManager } from '../src/core/storage/StorageManager';
import { LeetfoxApp } from '../src/ui/LeetfoxApp';
import { CodeforcesAdapter } from '../src/platforms/codeforces/CodeforcesAdapter';
import { DEFAULT_PREFERENCES } from '../src/core/models/preferences';

describe('Refactor Enhancements & Edge Cases', () => {
  beforeEach(async () => {
    await (globalThis as any).browser.storage.local.clear();
  });

  it('parses multiple examples in Codeforces when contained in a single .sample-test', () => {
    const parser = new CodeforcesParser();
    const multiExampleHtml = `
      <div class="problem-statement">
        <div class="header">
          <div class="title">C. Array Splitting</div>
        </div>
        <div><p>Given an array of integers.</p></div>
        <div class="sample-tests">
          <div class="section-title">Examples</div>
          <div class="sample-test">
            <div class="input">
              <div class="title">Input</div>
              <pre>3\n1 2 3</pre>
            </div>
            <div class="output">
              <div class="title">Output</div>
              <pre>6</pre>
            </div>
            <div class="input">
              <div class="title">Input</div>
              <pre>4\n0 0 0 0</pre>
            </div>
            <div class="output">
              <div class="title">Output</div>
              <pre>0</pre>
            </div>
          </div>
        </div>
      </div>
    `;

    const dom = new JSDOM(multiExampleHtml, { url: 'https://codeforces.com/problemset/problem/1200/C' });
    const problem = parser.parse(dom.window.document, new URL('https://codeforces.com/problemset/problem/1200/C'));

    expect(problem).not.toBeNull();
    expect(problem?.examples).toHaveLength(2);
    expect(problem?.examples[0].input).toContain('1 2 3');
    expect(problem?.examples[0].output).toBe('6');
    expect(problem?.examples[1].input).toContain('0 0 0 0');
    expect(problem?.examples[1].output).toBe('0');
  });

  it('resolves relative URLs in problem statement images and links to absolute URLs', () => {
    const parser = new CodeforcesParser();
    const htmlWithRelativeUrls = `
      <div class="problem-statement">
        <div class="header"><div class="title">D. Graph Art</div></div>
        <div>
          <p>See diagram below:</p>
          <img src="/predownloaded/cf/graph.png" alt="Graph">
          <a href="/contest/1500">Contest Page</a>
        </div>
      </div>
    `;

    const dom = new JSDOM(htmlWithRelativeUrls, { url: 'https://codeforces.com/contest/1500/problem/D' });
    const problem = parser.parse(dom.window.document, new URL('https://codeforces.com/contest/1500/problem/D'));

    expect(problem?.statementHtml).toContain('https://codeforces.com/predownloaded/cf/graph.png');
    expect(problem?.statementHtml).toContain('https://codeforces.com/contest/1500');
  });

  it('resolves relative URLs in CSES markdown statements', () => {
    const parser = new CSESParser();
    const csesHtml = `
      <div class="content">
        <div class="title-block"><h1>Grid Paths</h1></div>
        <div class="md">
          <p>Find paths in grid:</p>
          <img src="/file/grid.png">
        </div>
      </div>
    `;

    const dom = new JSDOM(csesHtml, { url: 'https://cses.fi/problemset/task/1625' });
    const problem = parser.parse(dom.window.document, new URL('https://cses.fi/problemset/task/1625'));

    expect(problem?.statementHtml).toContain('https://cses.fi/file/grid.png');
  });

  it('suppresses keyboard navigation when a modal or palette is open', () => {
    const keyboard = new KeyboardManager();
    const nextFn = vi.fn();

    keyboard.registerAction({
      id: 'next-problem',
      name: 'Next',
      description: 'Next',
      keyCombination: 'j',
      handler: nextFn
    });

    let modalOpen = false;
    keyboard.setModalChecker(() => modalOpen);
    keyboard.start();

    // When modal is false -> j triggers
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    expect(nextFn).toHaveBeenCalledTimes(1);

    // When modal is true -> j does NOT trigger
    modalOpen = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    expect(nextFn).toHaveBeenCalledTimes(1);

    keyboard.stop();
  });

  it('destroys LeetfoxApp instance cleanly and restores original DOM', async () => {
    const storage = StorageManager.getInstance();
    const adapter = new CodeforcesAdapter();

    const html = `
      <div id="pageContent"><div class="problem-statement"><div class="header"><div class="title">A. Test</div></div><div>Statement</div></div></div>
    `;
    const dom = new JSDOM(html, { url: 'https://codeforces.com/contest/1/problem/A' });
    const doc = dom.window.document;

    const problem = adapter.parseProblem(doc, new URL('https://codeforces.com/contest/1/problem/A'));
    expect(problem).not.toBeNull();
    if (!problem) return;

    const state = await storage.getProblemState(problem.platform, problem.id);
    const app = new LeetfoxApp(adapter, problem, state, { ...DEFAULT_PREFERENCES });

    await app.mount(doc);
    expect(doc.getElementById('leetfox-app')).not.toBeNull();
    expect(doc.body.classList.contains('lf-active')).toBe(true);

    // Destroy
    app.destroy();
    expect(doc.getElementById('leetfox-app')).toBeNull();
    expect(doc.body.classList.contains('lf-active')).toBe(false);
  });
});

describe('Interactive problems & Storage deduplication', () => {
  it('parses Codeforces interactive problems with interaction block', () => {
    const parser = new CodeforcesParser();
    const interactiveHtml = `
      <div class="problem-statement">
        <div class="header">
          <div class="title">A. Guess the Number</div>
        </div>
        <div>
          <p>This is an interactive problem.</p>
        </div>
        <div class="interaction">
          <div class="section-title">Interaction</div>
          <p>To ask a question, print your guess to standard output.</p>
        </div>
        <div class="sample-tests">
          <div class="sample-test">
            <div class="input"><pre>10</pre></div>
            <div class="output"><pre>OK</pre></div>
          </div>
        </div>
      </div>
    `;

    const dom = new JSDOM(interactiveHtml, { url: 'https://codeforces.com/contest/1000/problem/A' });
    const problem = parser.parse(dom.window.document, new URL('https://codeforces.com/contest/1000/problem/A'));

    expect(problem).not.toBeNull();
    expect(problem?.statementHtml).toContain('This is an interactive problem');
    expect(problem?.statementHtml).not.toContain('To ask a question');
    expect(problem?.interactionSpecificationHtml).toContain('To ask a question, print your guess');
  });

  it('handles hanging or unclosed example in CSES without dropping', () => {
    const parser = new CSESParser();
    const csesHangingHtml = `
      <div class="content">
        <div class="title-block"><h1>Unclosed Example Task</h1></div>
        <div class="md">
          <p>Problem description.</p>
          <h1 id="example">Example</h1>
          <p>Input:</p>
          <pre>42</pre>
        </div>
      </div>
    `;

    const dom = new JSDOM(csesHangingHtml, { url: 'https://cses.fi/problemset/task/9999' });
    const problem = parser.parse(dom.window.document, new URL('https://cses.fi/problemset/task/9999'));

    expect(problem?.examples).toHaveLength(1);
    expect(problem?.examples[0].input).toBe('42');
    expect(problem?.examples[0].output).toBe('');
  });

  it('deduplicates identical storage event notifications', async () => {
    const storage = StorageManager.getInstance();
    const listener = vi.fn();
    const unsub = storage.onStateChange(listener);

    await storage.saveProblemState('codeforces', '99a', { solved: true });
    // First save fires listener once
    expect(listener).toHaveBeenCalledTimes(1);

    // If storage.onChanged fires with identical state or identical save is called:
    await storage.saveProblemState('codeforces', '99a', { solved: true });
    // Since state is identical, it does not re-fire unnecessarily
    expect(listener).toHaveBeenCalledTimes(1);

    // Different state fires
    await storage.saveProblemState('codeforces', '99a', { solved: false });
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });
});

describe('Auditor Findings & Escape Handling', () => {
  it('preserves center tags in sanitized HTML for legacy Codeforces problems', () => {
    const raw = '<center><p>Centered equation</p></center><script>alert(1)</script>';
    const sanitized = sanitizeHtml(raw);
    expect(sanitized).toContain('<center>');
    expect(sanitized).toContain('Centered equation');
    expect(sanitized).not.toContain('<script>');
  });

  it('closes active modals when Escape is pressed on window even if input is blurred', async () => {
    const storage = StorageManager.getInstance();
    const adapter = new CodeforcesAdapter();
    const dom = new JSDOM('<div id="pageContent"><div class="problem-statement"><div class="header"><div class="title">A. Test</div></div><div>Statement</div></div></div>', { url: 'https://codeforces.com/contest/1/problem/A' });
    const doc = dom.window.document;

    const problem = adapter.parseProblem(doc, new URL('https://codeforces.com/contest/1/problem/A'));
    expect(problem).not.toBeNull();
    if (!problem) return;

    const state = await storage.getProblemState(problem.platform, problem.id);
    const app = new LeetfoxApp(adapter, problem, state, { ...DEFAULT_PREFERENCES });
    await app.mount(doc);

    // Open Command Palette via command or shortcut
    const palette = (app as any).commandPalette;
    palette.open();
    expect(palette.isPaletteOpen()).toBe(true);

    // Blur active element so no input is focused
    if (doc.activeElement && 'blur' in doc.activeElement) {
      (doc.activeElement as HTMLElement).blur();
    }

    // Press Escape on window
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(palette.isPaletteOpen()).toBe(false);

    app.destroy();
  });

  it('renders only original site when hideOriginalPage is set to false initially', async () => {
    const storage = StorageManager.getInstance();
    const adapter = new CodeforcesAdapter();
    const dom = new JSDOM('<div id="pageContent"><div class="problem-statement"><div class="header"><div class="title">A. Test</div></div><div>Statement</div></div></div>', { url: 'https://codeforces.com/contest/1/problem/A' });
    const doc = dom.window.document;

    const problem = adapter.parseProblem(doc, new URL('https://codeforces.com/contest/1/problem/A'));
    expect(problem).not.toBeNull();
    if (!problem) return;

    const state = await storage.getProblemState(problem.platform, problem.id);
    const app = new LeetfoxApp(adapter, problem, state, {
      ...DEFAULT_PREFERENCES,
      hideOriginalPage: false
    });
    await app.mount(doc);

    const appEl = doc.getElementById('leetfox-app');
    expect(appEl?.style.display).toBe('none');
    expect(doc.body.classList.contains('lf-active')).toBe(false);

    const switcher = doc.getElementById('lf-floating-switcher');
    expect(switcher).not.toBeNull();
    expect(switcher?.style.display).toContain('flex');

    app.destroy();
  });
});

describe('Modal Close Button and State Toggle', () => {
  it('closes KeyboardCheatSheet modal when clicking the ✕ button', () => {
    const sheet = new KeyboardCheatSheet();
    sheet.open();
    expect(sheet.isModalOpen()).toBe(true);
    expect(sheet.getElement().classList.contains('open')).toBe(true);

    const closeBtn = sheet.getElement().querySelector('.lf-btn-icon') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(sheet.isModalOpen()).toBe(false);
    expect(sheet.getElement().classList.contains('open')).toBe(false);
  });

  it('closes KeyboardCheatSheet modal when clicking overlay backdrop', () => {
    const sheet = new KeyboardCheatSheet();
    sheet.open();
    expect(sheet.isModalOpen()).toBe(true);

    sheet.getElement().click();

    expect(sheet.isModalOpen()).toBe(false);
    expect(sheet.getElement().classList.contains('open')).toBe(false);
  });
});

import { CodeEditorPane } from '../src/ui/components/CodeEditorPane';

describe('LeetCode-Style Code Editor & Split Workspace', () => {
  it('renders code editor pane with language selector and testcase console', () => {
    const mockProblem = {
      platform: 'codeforces',
      id: '4A',
      qualifiedId: 'codeforces:4a',
      title: 'Watermelon',
      statementHtml: '<p>Weight w</p>',
      examples: [{ id: 1, input: '8', output: 'YES' }],
      tags: ['math'],
      limits: { timeLimit: '1.0s', memoryLimit: '64MB' },
      navigation: {},
      url: 'https://codeforces.com/contest/4/problem/A'
    };

    const pane = new CodeEditorPane(mockProblem);
    const el = pane.getElement();
    expect(el).not.toBeNull();

    // Verify language selector
    const select = el.querySelector('.lf-lang-select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('cpp');

    // Verify textarea has starter template
    const textarea = el.querySelector('.lf-editor-textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toContain('#include <iostream>');

    // Verify line numbers
    const lineNumbers = el.querySelector('.lf-line-numbers');
    expect(lineNumbers?.textContent).toContain('1');

    // Verify testcase console
    const consoleTabs = el.querySelector('.lf-console-tabs');
    expect(consoleTabs?.textContent).toContain('Case 1');
  });

  it('supports toggling between Split View and Full Statement View', async () => {
    const storage = StorageManager.getInstance();
    const adapter = new CodeforcesAdapter();
    const dom = new JSDOM('<div id="pageContent"><div class="problem-statement"><div class="header"><div class="title">A. Test</div></div><div>Statement</div></div></div>', { url: 'https://codeforces.com/contest/1/problem/A' });
    const doc = dom.window.document;

    const problem = adapter.parseProblem(doc, new URL('https://codeforces.com/contest/1/problem/A'));
    expect(problem).not.toBeNull();
    if (!problem) return;

    const state = await storage.getProblemState(problem.platform, problem.id);
    const app = new LeetfoxApp(adapter, problem, state, { ...DEFAULT_PREFERENCES });
    await app.mount(doc);

    const splitContainer = doc.querySelector('.lf-split-container');
    const editorRight = doc.querySelector('.lf-split-right') as HTMLElement;
    expect(splitContainer).not.toBeNull();
    expect(editorRight?.style.display).not.toBe('none');

    // Toggle to full statement
    app.toggleSplitMode();
    expect(splitContainer?.classList.contains('lf-full-statement')).toBe(true);
    expect(editorRight?.style.display).toBe('none');

    // Toggle back to split
    app.toggleSplitMode();
    expect(splitContainer?.classList.contains('lf-full-statement')).toBe(false);
    expect(editorRight?.style.display).toBe('flex');

    app.destroy();
  });
});

describe('Code Editor Keyboard Enhancements', () => {
  it('automatically closes bracket pairs when typing opening brackets', () => {
    const pane = new CodeEditorPane({
      platform: 'codeforces',
      id: '1A',
      qualifiedId: 'codeforces:1a',
      title: 'Theatre Square',
      statementHtml: '',
      examples: [],
      tags: [],
      limits: {},
      navigation: {},
      url: 'https://codeforces.com/contest/1/problem/A'
    });

    const textarea = pane.getElement().querySelector('.lf-editor-textarea') as HTMLTextAreaElement;
    textarea.value = '';
    textarea.selectionStart = textarea.selectionEnd = 0;

    // Type '{'
    textarea.dispatchEvent(new (window as any).KeyboardEvent('keydown', { key: '{', bubbles: true }));
    expect(textarea.value).toBe('{}');
    expect(textarea.selectionStart).toBe(1);

    // Type '(' inside
    textarea.dispatchEvent(new (window as any).KeyboardEvent('keydown', { key: '(', bubbles: true }));
    expect(textarea.value).toBe('{()}');
    expect(textarea.selectionStart).toBe(2);
  });

  it('replaces highlighted selected text on Enter key', () => {
    const pane = new CodeEditorPane({
      platform: 'codeforces',
      id: '1A',
      qualifiedId: 'codeforces:1a',
      title: 'Theatre Square',
      statementHtml: '',
      examples: [],
      tags: [],
      limits: {},
      navigation: {},
      url: 'https://codeforces.com/contest/1/problem/A'
    });

    const textarea = pane.getElement().querySelector('.lf-editor-textarea') as HTMLTextAreaElement;
    textarea.value = 'hello WORLD test';
    // Select 'WORLD' (index 6 to 11)
    textarea.selectionStart = 6;
    textarea.selectionEnd = 11;

    // Press Enter
    textarea.dispatchEvent(new (window as any).KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(textarea.value).not.toContain('WORLD');
    expect(textarea.value).toBe('hello \n test');
  });
});

describe('Live Contest Protection & Solutions Button', () => {
  it('detects live contest and locks solutions button to prevent contest violations', () => {
    const parser = new CodeforcesParser();
    const liveContestHtml = `
      <div id="pageContent">
        <div class="problem-statement">
          <div class="header"><div class="title">B. Running Problem</div></div>
          <div>Statement</div>
        </div>
      </div>
      <div id="sidebar">
        <div class="contest-state-phase">Contest is running</div>
        <div id="countdown">01:45:20</div>
      </div>
    `;

    const dom = new JSDOM(liveContestHtml, { url: 'https://codeforces.com/contest/999/problem/B' });
    const problem = parser.parse(dom.window.document, new URL('https://codeforces.com/contest/999/problem/B'));

    expect(problem).not.toBeNull();
    expect(problem?.isLiveContest).toBe(true);

    // Mount and verify solutions button is locked
    const header = new Header(problem!, { ...DEFAULT_PROBLEM_STATE }, { ...DEFAULT_PREFERENCES }, {
      onToggleSolved: () => {},
      onToggleBookmark: () => {},
      onToggleNotes: () => {},
      onToggleTheme: () => {},
      onToggleViewOriginal: () => {},
      onToggleSplitMode: () => {},
      onOpenPalette: () => {},
      onOpenShortcuts: () => {}
    });

    const solBtn = header.getElement().querySelector('.lf-btn-locked') as HTMLButtonElement;
    expect(solBtn).not.toBeNull();
    expect(solBtn.disabled).toBe(true);
    expect(solBtn.textContent).toContain('Solutions');
    expect(solBtn.title).toContain('hidden during active contests');
  });

  it('enables solutions button during practice/problemset mode', () => {
    const parser = new CodeforcesParser();
    const practiceHtml = `
      <div id="pageContent">
        <div class="problem-statement">
          <div class="header"><div class="title">A. Practice Problem</div></div>
          <div>Statement</div>
        </div>
      </div>
      <div id="sidebar">
        <div class="sidebox">
          <div class="caption">→ Contest materials</div>
          <ul>
            <li><a href="/blog/entry/7890">Tutorial (en)</a></li>
          </ul>
        </div>
      </div>
    `;

    const dom = new JSDOM(practiceHtml, { url: 'https://codeforces.com/problemset/problem/100/A' });
    const problem = parser.parse(dom.window.document, new URL('https://codeforces.com/problemset/problem/100/A'));

    expect(problem).not.toBeNull();
    expect(problem?.isLiveContest).toBe(false);
    expect(problem?.editorialUrl).toContain('https://codeforces.com/blog/entry/7890');
    expect(problem?.solutionsUrl).toContain('https://codeforces.com/problemset/status/100/problem/A');
  });

  it('synchronizes Split View button label across Header and LeetfoxApp', async () => {
    const storage = StorageManager.getInstance();
    const adapter = new CodeforcesAdapter();
    const dom = new JSDOM('<div id="pageContent"><div class="problem-statement"><div class="header"><div class="title">A. Test</div></div><div>Statement</div></div></div>', { url: 'https://codeforces.com/contest/1/problem/A' });
    const doc = dom.window.document;

    const problem = adapter.parseProblem(doc, new URL('https://codeforces.com/contest/1/problem/A'));
    expect(problem).not.toBeNull();
    if (!problem) return;

    const state = await storage.getProblemState(problem.platform, problem.id);
    const app = new LeetfoxApp(adapter, problem, state, { ...DEFAULT_PREFERENCES });
    await app.mount(doc);

    const splitBtn = doc.querySelector('.lf-header')!.querySelectorAll('.lf-btn')[3] as HTMLButtonElement;
    expect(splitBtn.textContent).toBe('◫ Split');

    // Toggle via app
    app.toggleSplitMode();
    expect(splitBtn.textContent).toBe('▢ Full');

    app.toggleSplitMode();
    expect(splitBtn.textContent).toBe('◫ Split');

    app.destroy();
  });
});
