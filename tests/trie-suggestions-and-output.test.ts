import { describe, it, expect } from 'vitest';
import { createTrieForLanguage } from '../src/core/editor/CompletionTrie';
import { CodeEditorPane } from '../src/ui/components/CodeEditorPane';
import { JSDOM } from 'jsdom';
import { SubmissionManager } from '../src/core/submission/SubmissionManager';

describe('Trie-Based Suggestions Engine', () => {
  it('suggests vector and vec2d when prefix is "vec"', () => {
    const trie = createTrieForLanguage('cpp');
    const matches = trie.search('vec');
    expect(matches.length).toBeGreaterThan(0);

    const labels = matches.map(m => m.label);
    expect(labels).toContain('vector');
    expect(labels).toContain('vec2d');
    expect(matches[0].label).toBe('vector');
  });

  it('suggests sort and swap when prefix is "s"', () => {
    const trie = createTrieForLanguage('cpp');
    const matches = trie.search('so');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some(m => m.label === 'sort')).toBe(true);
  });

  it('suggests Python STL like defaultdict and Counter', () => {
    const trie = createTrieForLanguage('python');
    const matches = trie.search('def');
    expect(matches.some(m => m.label === 'defaultdict')).toBe(true);

    const countMatches = trie.search('count');
    expect(countMatches.some(m => m.label === 'Counter')).toBe(true);
  });

  it('indexes user-defined variable and function names dynamically', () => {
    const trie = createTrieForLanguage('cpp');
    trie.indexDocumentTokens('int maxSubarraySum = 0; void dfsTree() {}');

    const matches = trie.search('maxSub');
    expect(matches.some(m => m.label === 'maxSubarraySum')).toBe(true);

    const dfsMatches = trie.search('dfs');
    expect(dfsMatches.some(m => m.label === 'dfsTree')).toBe(true);
  });
});

describe('Suggestions Toggle in CodeEditorPane', () => {
  it('renders suggestions toggle button and toggles between ON and OFF', () => {
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

    const toggleBtn = el.querySelector('.lf-btn-suggestions') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.textContent).toContain('Suggestions: ON');

    // Toggle off
    pane.toggleSuggestions();
    expect(toggleBtn.textContent).toContain('Suggestions: OFF');
    expect(toggleBtn.classList.contains('inactive')).toBe(true);

    // Toggle on
    pane.toggleSuggestions();
    expect(toggleBtn.textContent).toContain('Suggestions: ON');
    expect(toggleBtn.classList.contains('active')).toBe(true);
  });
});

describe('Console Output Grid & Result Presentation', () => {
  it('renders Input and Expected Output in console grid prior to running', () => {
    const mockProblem = {
      platform: 'codeforces',
      id: '4A',
      qualifiedId: 'codeforces:4a',
      title: 'Watermelon',
      statementHtml: '<p>Weight w</p>',
      examples: [{ id: 1, input: '8', output: 'YES' }],
      tags: [],
      limits: {},
      navigation: {},
      url: 'https://codeforces.com/contest/4/problem/A'
    };

    const pane = new CodeEditorPane(mockProblem);
    const el = pane.getElement();

    const grid = el.querySelector('.lf-console-grid');
    expect(grid).not.toBeNull();
    expect(grid?.textContent).toContain('Input');
    expect(grid?.textContent).toContain('Expected Output');
    expect(grid?.textContent).toContain('8');
    expect(grid?.textContent).toContain('YES');
  });

  it('renders Your Output block even when programOutput is empty string', async () => {
    const mockProblem = {
      platform: 'codeforces',
      id: '4A',
      qualifiedId: 'codeforces:4a',
      title: 'Watermelon',
      statementHtml: '<p>Weight w</p>',
      examples: [{ id: 1, input: '8', output: 'YES' }],
      tags: [],
      limits: {},
      navigation: {},
      url: 'https://codeforces.com/contest/4/problem/A'
    };

    const pane = new CodeEditorPane(mockProblem);
    const el = pane.getElement();

    // Mock test result with empty output
    (pane as any).testResults.set(0, {
      status: 'wrong_answer',
      programOutput: '',
      expectedOutput: 'YES',
      executionTimeMs: 40
    });
    (pane as any).renderTestcaseTabs();

    const grid = el.querySelector('.lf-console-grid');
    expect(grid?.textContent).toContain('Your Output');
    expect(grid?.textContent).toContain('<no output produced>');

    const emptyPre = el.querySelector('.lf-console-pre.output-empty');
    expect(emptyPre).not.toBeNull();
  });
});

describe('Submission Countdown Banner & Automation', () => {
  it('renders auto-submit countdown and cancel button on Codeforces submit banner', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '4A',
      language: 'cpp',
      code: '#include <iostream>\nint main() {}',
      timestamp: Date.now()
    });

    const dom = new JSDOM(`
      <html><body>
        <form class="submitForm" action="/contest/4/submit" method="post">
          <input name="submittedProblemCode" value="">
          <select name="programTypeId"><option value="54">GNU G++20</option></select>
          <textarea id="sourceCodeTextarea" name="source"></textarea>
          <input type="submit" value="Submit">
        </form>
      </body></html>
    `, { url: 'https://codeforces.com/contest/4/submit' });

    const handled = await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/contest/4/submit'));
    expect(handled).toBe(true);

    const banner = dom.window.document.getElementById('lf-cf-submit-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Auto-submitting');
    expect(banner?.textContent).toContain('Cancel');
    expect(banner?.textContent).toContain('Submit Now');
  });

  it('renders auto-submit countdown and cancel button on CSES submit banner', async () => {
    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: 'cses',
      problemId: '1068',
      language: 'cpp',
      code: '#include <iostream>\nint main() {}',
      timestamp: Date.now()
    });

    const dom = new JSDOM(`
      <html><body>
        <form action="/problemset/submit/1068/" method="post" enctype="multipart/form-data">
          <input type="file" name="file">
          <input type="submit" value="Submit">
        </form>
      </body></html>
    `, { url: 'https://cses.fi/problemset/submit/1068/' });

    const handled = await subManager.handleCSESSubmitPage(dom.window.document, new URL('https://cses.fi/problemset/submit/1068/'));
    expect(handled).toBe(true);

    const banner = dom.window.document.getElementById('lf-cses-submit-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Auto-submitting');
    expect(banner?.textContent).toContain('Cancel');
    expect(banner?.textContent).toContain('Submit Now');
  });
});
