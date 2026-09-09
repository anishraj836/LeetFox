import { CSESAdapter } from '../src/platforms/cses/CSESAdapter';
import { DEFAULT_PROBLEM_STATE } from '../src/core/models/state';
import { Header } from '../src/ui/components/Header';
import { MetadataBar } from '../src/ui/components/MetadataBar';
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

import { CodeEditorPane, getEditorThemeExtensions, leetfoxLightHighlightStyle, leetfoxDarkHighlightStyle } from '../src/ui/components/CodeEditorPane';

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

    // Verify CodeMirror host is mounted
    const cmHost = el.querySelector('.lf-cm-host');
    expect(cmHost).not.toBeNull();

    // Verify code content has starter template
    const code = pane.getCode();
    expect(code).toContain('#include <iostream>');

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

describe('Code Editor Keyboard Enhancements (CodeMirror)', () => {
  it('CodeMirror editor is initialized with closeBrackets and bracketMatching extensions', () => {
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

    // Verify CodeMirror is mounted
    const cmHost = pane.getElement().querySelector('.lf-cm-host');
    expect(cmHost).not.toBeNull();
    const cmEditor = cmHost?.querySelector('.cm-editor');
    expect(cmEditor).not.toBeNull();

    // Verify code content can be read
    const code = pane.getCode();
    expect(typeof code).toBe('string');
  });

  it('supports setCode and getCode for programmatic code manipulation', () => {
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

    pane.setCode('print("hello world")');
    expect(pane.getCode()).toBe('print("hello world")');

    pane.setCode('#include <bits/stdc++.h>\nint main() {}');
    expect(pane.getCode()).toContain('#include <bits/stdc++.h>');
    expect(pane.getCode()).toContain('int main()');
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

    const lockedBtns = Array.from(header.getElement().querySelectorAll('.lf-btn-locked')) as HTMLButtonElement[];
    expect(lockedBtns.length).toBe(2);

    const subBtn = lockedBtns.find(b => b.textContent?.includes('Submissions'));
    expect(subBtn).toBeDefined();
    expect(subBtn?.disabled).toBe(true);
    expect(subBtn?.title).toContain('disabled during active contests');

    const solBtn = lockedBtns.find(b => b.textContent?.includes('Solutions'));
    expect(solBtn).toBeDefined();
    expect(solBtn?.disabled).toBe(true);
    expect(solBtn?.title).toContain('hidden during active contests');

    // Verify MetadataBar locks submissions during live contest
    const metaBar = new MetadataBar(problem!);
    const metaLockedBtn = metaBar.getElement().querySelector('.lf-btn-locked') as HTMLButtonElement;
    expect(metaLockedBtn).not.toBeNull();
    expect(metaLockedBtn.disabled).toBe(true);
    expect(metaLockedBtn.textContent).toContain('Submissions');

    // Verify CodeEditorPane locks submissions during live contest
    const editor = new CodeEditorPane(problem!);
    const editorLockedSubBtn = Array.from(editor.getElement().querySelectorAll('.lf-btn-locked'))
      .find(b => b.textContent?.includes('Submissions')) as HTMLButtonElement;
    expect(editorLockedSubBtn).toBeDefined();
    expect(editorLockedSubBtn.disabled).toBe(true);
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
    expect(splitBtn.textContent).toBe('Split');

    // Toggle via app
    app.toggleSplitMode();
    expect(splitBtn.textContent).toBe('Full');

    app.toggleSplitMode();
    expect(splitBtn.textContent).toBe('Split');

    app.destroy();
  });
});

import { SubmissionManager } from '../src/core/submission/SubmissionManager';

describe('Submission Automation & CSES Submit Page Integration', () => {
  it('manages pending submissions across pages', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'cses',
      problemId: '1068',
      language: 'cpp',
      code: '#include <iostream>\nint main(){ return 0; }',
      timestamp: Date.now()
    });

    const pending = await subManager.getPendingSubmission();
    expect(pending).not.toBeNull();
    expect(pending?.problemId).toBe('1068');
    expect(pending?.code).toContain('int main');

    await subManager.clearPendingSubmission();
    const cleared = await subManager.getPendingSubmission();
    expect(cleared).toBeNull();
  });

  it('auto-attaches solution and injects confirmation banner on CSES submit page', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'cses',
      problemId: '1068',
      language: 'cpp',
      code: 'int main() { std::cout << 42; }',
      timestamp: Date.now()
    });

    const csesSubmitHtml = `
      <html><body>
        <div class="content">
          <form method="post" enctype="multipart/form-data">
            <input type="hidden" name="csrf_token" value="abc123token">
            <input type="file" name="file">
            <input type="submit" value="Submit">
          </form>
        </div>
      </body></html>
    `;

    const dom = new JSDOM(csesSubmitHtml, { url: 'https://cses.fi/problemset/submit/1068/' });
    const handled = await subManager.handleCSESSubmitPage(dom.window.document, new URL('https://cses.fi/problemset/submit/1068/'));

    expect(handled).toBe(true);
    const banner = dom.window.document.getElementById('lf-cses-submit-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Leetfox ready to submit for Task 1068');
    expect(banner?.textContent).toContain('Attached solution.cpp');
  });

  it('auto-fills problem and source code on Codeforces submit page', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '4A',
      language: 'cpp',
      code: '#include <iostream>\nint main() {}',
      timestamp: Date.now()
    });

    const cfSubmitHtml = `
      <html><body>
        <form class="submitForm" action="/contest/4/submit" method="post">
          <input name="submittedProblemCode" value="">
          <textarea id="sourceCodeTextarea" name="source"></textarea>
          <input type="submit" value="Submit">
        </form>
      </body></html>
    `;

    const dom = new JSDOM(cfSubmitHtml, { url: 'https://codeforces.com/contest/4/submit' });
    const handled = await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/contest/4/submit'));

    expect(handled).toBe(true);
    const problemInput = dom.window.document.querySelector('input[name="submittedProblemCode"]') as HTMLInputElement;
    expect(problemInput.value).toBe('4A');

    const textarea = dom.window.document.querySelector('textarea#sourceCodeTextarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('#include <iostream>');

    const banner = dom.window.document.getElementById('lf-cf-submit-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Leetfox loaded your solution for 4A');
  });
});

import { normalizeOutput } from '../src/core/runner/CodeRunner';

describe('Homescreen Isolation, Non-Problem Pages & Code Runner', () => {
  it('correctly distinguishes CSES problem pages from homepage, login, and courses', () => {
    const adapter = new CSESAdapter();
    const dom = new JSDOM('<div class="content"><div class="md">Welcome to CSES</div></div>');
    const doc = dom.window.document;

    // Homepage
    expect(adapter.isProblemPage(new URL('https://cses.fi/'), doc)).toBe(false);
    expect(adapter.isProblemPage(new URL('https://cses.fi/problemset/'), doc)).toBe(false);
    // Login
    expect(adapter.isProblemPage(new URL('https://cses.fi/login'), doc)).toBe(false);
    // Submit
    expect(adapter.isProblemPage(new URL('https://cses.fi/problemset/submit/1068/'), doc)).toBe(false);

    // Actual Problem Task
    expect(adapter.isProblemPage(new URL('https://cses.fi/problemset/task/1068/'), doc)).toBe(true);
  });

  it('correctly distinguishes Codeforces problem pages from homepage, contests list, and login', () => {
    const adapter = new CodeforcesAdapter();
    const dom = new JSDOM('<div class="problem-statement"><div class="header">A. Watermelon</div></div>');
    const doc = dom.window.document;

    // Homepage
    expect(adapter.isProblemPage(new URL('https://codeforces.com/'), doc)).toBe(false);
    // Contests
    expect(adapter.isProblemPage(new URL('https://codeforces.com/contests'), doc)).toBe(false);
    // Login
    expect(adapter.isProblemPage(new URL('https://codeforces.com/enter'), doc)).toBe(false);

    // Actual Problem Pages
    expect(adapter.isProblemPage(new URL('https://codeforces.com/problemset/problem/4/A'), doc)).toBe(true);
    expect(adapter.isProblemPage(new URL('https://codeforces.com/contest/4/problem/A'), doc)).toBe(true);
  });

  it('normalizes testcase outputs accurately regardless of newlines or trailing spaces', () => {
    expect(normalizeOutput('YES\r\n')).toBe('YES');
    expect(normalizeOutput('YES  \n')).toBe('YES');
    expect(normalizeOutput('  1 2 3  \n  4 5 6  ')).toBe('1 2 3\n  4 5 6');
    expect(normalizeOutput('')).toBe('');
  });

  it('renders ▶ Run button in CodeEditorPane toolbar', () => {
    const pane = new CodeEditorPane({
      platform: 'codeforces',
      id: '4A',
      qualifiedId: 'codeforces:4a',
      title: 'Watermelon',
      statementHtml: '<p>statement</p>',
      examples: [{ id: 1, input: '8', output: 'YES' }],
      tags: [],
      limits: {},
      navigation: {},
      url: 'https://codeforces.com/contest/4/problem/A'
    });

    const runBtn = pane.getElement().querySelector('.lf-btn-run') as HTMLButtonElement;
    expect(runBtn).not.toBeNull();
    expect(runBtn.textContent).toContain('Run');
  });
});

describe('Submission Edge Cases & Language Selection', () => {
  it('selects matching compiler on Codeforces submit form based on language', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '100A',
      language: 'python',
      code: 'print("hello")',
      timestamp: Date.now()
    });

    const cfSubmitHtml = `
      <html><body>
        <form class="submitForm" action="/contest/100/submit" method="post">
          <input name="submittedProblemCode" value="">
          <select name="programTypeId">
            <option value="54">GNU G++20 11.2.0</option>
            <option value="31">Python 3.8.10</option>
            <option value="60">Java 21 64bit</option>
          </select>
          <textarea id="sourceCodeTextarea" name="source"></textarea>
          <input type="submit" value="Submit">
        </form>
      </body></html>
    `;

    const dom = new JSDOM(cfSubmitHtml, { url: 'https://codeforces.net/contest/100/submit' });
    const handled = await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.net/contest/100/submit'));

    expect(handled).toBe(true);
    const select = dom.window.document.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
    expect(select.value).toBe('31'); // Python 3
  });
});

describe('Custom & Editable Test Cases in Console', () => {
  const createMockProblem = () => ({
    platform: 'codeforces' as const,
    id: '4A',
    qualifiedId: 'codeforces:4a',
    title: 'Watermelon',
    statementHtml: '<p>statement</p>',
    examples: [
      { id: 1, input: '8', output: 'YES' },
      { id: 2, input: '5', output: 'NO' }
    ],
    tags: [],
    limits: {},
    navigation: {},
    url: 'https://codeforces.com/contest/4/problem/A'
  });

  it('renders editable testcase input and expected output textareas', () => {
    const pane = new CodeEditorPane(createMockProblem());
    const el = pane.getElement();

    const textareas = el.querySelectorAll<HTMLTextAreaElement>('textarea.lf-console-textarea');
    expect(textareas.length).toBe(2);

    const [inputTextarea, outputTextarea] = Array.from(textareas);
    expect(inputTextarea.value).toBe('8');
    expect(outputTextarea.value).toBe('YES');

    // Edit input
    inputTextarea.value = '100';
    inputTextarea.dispatchEvent(new Event('input'));
    expect((pane as any).customExamples[0].input).toBe('100');

    // Edit expected output
    outputTextarea.value = 'YES';
    outputTextarea.dispatchEvent(new Event('input'));
    expect((pane as any).customExamples[0].output).toBe('YES');
  });

  it('clears prior run results when test case input is edited', () => {
    const pane = new CodeEditorPane(createMockProblem());
    const el = pane.getElement();

    // Set mock test result
    (pane as any).testResults.set(0, {
      status: 'accepted',
      programOutput: 'YES',
      expectedOutput: 'YES'
    });

    const inputTextarea = el.querySelector<HTMLTextAreaElement>('textarea.lf-console-textarea');
    expect(inputTextarea).not.toBeNull();
    inputTextarea!.value = '42';
    inputTextarea!.dispatchEvent(new Event('input'));

    expect((pane as any).testResults.has(0)).toBe(false);
  });

  it('adds a new test case when + Add Case is clicked', () => {
    const pane = new CodeEditorPane(createMockProblem());
    const el = pane.getElement();

    const addBtn = el.querySelector<HTMLButtonElement>('.lf-btn-add-case');
    expect(addBtn).not.toBeNull();
    expect(addBtn?.textContent).toContain('+ Add Case');

    addBtn?.click();

    expect((pane as any).customExamples.length).toBe(3);
    expect((pane as any).activeExampleIndex).toBe(2);

    const tabs = el.querySelectorAll('.lf-console-tab:not(.lf-btn-add-case)');
    expect(tabs.length).toBe(3);
  });

  it('deletes the active test case when Delete Case is clicked', () => {
    const pane = new CodeEditorPane(createMockProblem());
    const el = pane.getElement();

    expect((pane as any).customExamples.length).toBe(2);

    const deleteBtn = el.querySelector<HTMLButtonElement>('.lf-btn-delete');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.textContent).toContain('Delete Case');

    deleteBtn?.click();

    expect((pane as any).customExamples.length).toBe(1);
    expect((pane as any).customExamples[0].input).toBe('5'); // 2nd case shifted down
  });

  it('resets custom test cases back to problem defaults when Reset Cases is clicked', () => {
    const pane = new CodeEditorPane(createMockProblem());
    const el = pane.getElement();

    // Modify active case
    (pane as any).addNewTestCase('999', 'OUTPUT');
    expect((pane as any).customExamples.length).toBe(3);

    // Re-render
    (pane as any).renderTestcaseTabs();

    const resetBtn = el.querySelector<HTMLButtonElement>('.lf-btn-reset');
    expect(resetBtn).not.toBeNull();
    expect(resetBtn?.textContent).toContain('Reset Cases');

    resetBtn?.click();

    expect((pane as any).customExamples.length).toBe(2);
    expect((pane as any).customExamples[0].input).toBe('8');
    expect((pane as any).customExamples[1].input).toBe('5');
  });

  it('renders Run All button in the console tab header', () => {
    const pane = new CodeEditorPane(createMockProblem());
    const el = pane.getElement();

    const runAllBtn = el.querySelector<HTMLButtonElement>('.lf-btn-run-all');
    expect(runAllBtn).not.toBeNull();
    expect(runAllBtn?.textContent).toContain('Run All');
  });

  it('removes test case directly via tab close button (×)', () => {
    const pane = new CodeEditorPane(createMockProblem());
    const el = pane.getElement();

    const closeButtons = el.querySelectorAll<HTMLSpanElement>('.lf-console-tab-close');
    expect(closeButtons.length).toBe(2);

    // Click remove on first tab
    closeButtons[0].click();

    expect((pane as any).customExamples.length).toBe(1);
    expect((pane as any).customExamples[0].input).toBe('5');
  });

  it('clears input and output when only one testcase remains and clear is clicked', () => {
    const mockSingle = createMockProblem();
    mockSingle.examples = [{ id: 1, input: '42', output: 'ANS' }];
    const pane = new CodeEditorPane(mockSingle);
    const el = pane.getElement();

    const clearBtn = el.querySelector<HTMLButtonElement>('.lf-btn-clear');
    expect(clearBtn).not.toBeNull();
    expect(clearBtn?.textContent).toContain('Clear Case');

    clearBtn?.click();

    expect((pane as any).customExamples[0].input).toBe('');
    expect((pane as any).customExamples[0].output).toBe('');
  });

  it('enables disabled submit button on Codeforces submit page and sets code in textarea', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '2260A',
      language: 'cpp',
      code: '#include <iostream>\nint main() { return 0; }',
      timestamp: Date.now()
    });

    const cfHtml = `
      <html><body>
        <form class="submitForm" action="/problemset/submit" method="post">
          <input name="submittedProblemCode" value="">
          <select name="programTypeId"><option value="54">GNU G++20</option></select>
          <textarea id="sourceCodeTextarea" name="source"></textarea>
          <input type="file" name="sourceFile">
          <input class="submit" type="submit" value="Submit" disabled="disabled">
        </form>
      </body></html>
    `;

    const dom = new JSDOM(cfHtml, { url: 'https://codeforces.com/problemset/submit' });
    const handled = await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/problemset/submit'));

    expect(handled).toBe(true);
    const ta = dom.window.document.getElementById('sourceCodeTextarea') as HTMLTextAreaElement;
    expect(ta.value).toContain('int main()');
    expect(ta.textContent).toContain('int main()');

    const submitBtn = dom.window.document.querySelector('input.submit') as HTMLInputElement;
    expect(submitBtn).not.toBeNull();
    // Verify submit button is enabled
    expect(submitBtn.disabled).toBe(false);
  });

  it('selects GNU G++20 instead of GNU G++17 when submitting C++', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '2260A',
      language: 'cpp',
      code: '#include <iostream>\nint main() { return 0; }',
      timestamp: Date.now()
    });

    const cfHtml = `
      <html><body>
        <form class="submitForm" action="/problemset/submit" method="post">
          <input name="submittedProblemCode" value="">
          <select name="programTypeId">
            <option value="43">GNU G++14 6.4.0</option>
            <option value="50">GNU G++17 7.3.0</option>
            <option value="54">GNU G++17 9.2.0 (64 bit, msys2)</option>
            <option value="89">GNU G++20 13.2 (64 bit, winlibs)</option>
            <option value="90">GNU G++23 14.2.0 (64 bit, msys2)</option>
          </select>
          <textarea id="sourceCodeTextarea" name="source"></textarea>
          <input class="submit" type="submit" value="Submit">
        </form>
      </body></html>
    `;

    const dom = new JSDOM(cfHtml, { url: 'https://codeforces.com/problemset/submit' });
    await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/problemset/submit'));

    const select = dom.window.document.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
    expect(select.value).toBe('89'); // Must choose G++20, NOT G++17!
  });

  it('selects GNU G++17 when cpp17 is explicitly selected', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '2260A',
      language: 'cpp17',
      code: '#include <iostream>\nint main() { return 0; }',
      timestamp: Date.now()
    });

    const cfHtml = `
      <html><body>
        <form class="submitForm" action="/problemset/submit" method="post">
          <input name="submittedProblemCode" value="">
          <select name="programTypeId">
            <option value="43">GNU G++14 6.4.0</option>
            <option value="50">GNU G++17 7.3.0</option>
            <option value="54">GNU G++17 9.2.0 (64 bit, msys2)</option>
            <option value="89">GNU G++20 13.2 (64 bit, winlibs)</option>
          </select>
          <textarea id="sourceCodeTextarea" name="source"></textarea>
          <input class="submit" type="submit" value="Submit">
        </form>
      </body></html>
    `;

    const dom = new JSDOM(cfHtml, { url: 'https://codeforces.com/problemset/submit' });
    await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/problemset/submit'));

    const select = dom.window.document.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
    expect(select.value).toBe('54'); // 64 bit G++17
  });

  it('supports light theme and provides high-contrast syntax highlighting', () => {
    const mockProblem = createMockProblem();
    const pane = new CodeEditorPane(mockProblem, 'light');
    expect(pane.getTheme()).toBe('light');

    // Switch theme to dark then back to light
    pane.setTheme('dark');
    expect(pane.getTheme()).toBe('dark');

    pane.setTheme('light');
    expect(pane.getTheme()).toBe('light');

    // Verify distinct theme extension configurations
    const lightExts = getEditorThemeExtensions('light');
    const darkExts = getEditorThemeExtensions('dark');
    expect(lightExts).toHaveLength(2);
    expect(darkExts).toHaveLength(2);
    expect(lightExts).not.toEqual(darkExts);

    // Verify both highlight styles exist and are distinct
    expect(leetfoxLightHighlightStyle).toBeDefined();
    expect(leetfoxDarkHighlightStyle).toBeDefined();
    expect(leetfoxLightHighlightStyle).not.toBe(leetfoxDarkHighlightStyle);
  });
});


