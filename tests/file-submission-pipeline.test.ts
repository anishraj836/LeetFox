import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmissionManager } from '../src/core/submission/SubmissionManager';
import { CodeEditorPane } from '../src/ui/components/CodeEditorPane';
import { JSDOM } from 'jsdom';

describe('File Submission Pipeline', () => {
  let subManager: SubmissionManager;

  beforeEach(async () => {
    subManager = SubmissionManager.getInstance();
    await subManager.clearPendingSubmission();
  });

  it('converts user code into standard File objects for all supported languages', () => {
    const cppFile = subManager.createSubmissionFile('#include <iostream>\nint main(){}', 'cpp');
    expect(cppFile.name).toBe('solution.cpp');
    expect(cppFile.type).toBe('text/x-c++src');
    expect(cppFile.size).toBeGreaterThan(0);

    const pyFile = subManager.createSubmissionFile('print("hello")', 'python');
    expect(pyFile.name).toBe('solution.py');
    expect(pyFile.type).toBe('text/x-python');

    const javaFile = subManager.createSubmissionFile('public class Solution {}', 'java');
    expect(javaFile.name).toBe('Solution.java');
    expect(javaFile.type).toBe('text/x-java-source');

    const rustFile = subManager.createSubmissionFile('fn main() {}', 'rust');
    expect(rustFile.name).toBe('solution.rs');
    expect(rustFile.type).toBe('text/x-rust');

    const goFile = subManager.createSubmissionFile('package main', 'go');
    expect(goFile.name).toBe('solution.go');
    expect(goFile.type).toBe('text/x-go');
  });

  it('persists and retrieves pending submission files across storage mechanisms', async () => {
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '4A',
      language: 'cpp',
      code: '#include <vector>',
      timestamp: Date.now()
    });

    const pending = await subManager.getPendingSubmission();
    expect(pending).not.toBeNull();
    expect(pending?.problemId).toBe('4A');
    expect(pending?.code).toBe('#include <vector>');

    const file = subManager.createSubmissionFile(pending!.code, pending!.language);
    expect(file.name).toBe('solution.cpp');

    await subManager.clearPendingSubmission();
    const cleared = await subManager.getPendingSubmission();
    expect(cleared).toBeNull();
  });

  it('handles Codeforces submit page by attaching file and setting Ace editor synchronizer', async () => {
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '4A',
      language: 'cpp',
      code: '#include <iostream>\nint main() { return 0; }',
      timestamp: Date.now()
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <form class="submitForm" action="/contest/4/submit" method="post" enctype="multipart/form-data">
            <select name="submittedProblemIndex">
              <option value="A">A - Watermelon</option>
              <option value="B">B - Before an Exam</option>
            </select>
            <select name="programTypeId">
              <option value="54">GNU G++20 13.2 (64 bit)</option>
            </select>
            <input type="file" name="sourceFile">
            <textarea id="sourceCodeTextarea" name="source"></textarea>
            <input type="submit" value="Submit">
          </form>
        </body>
      </html>
    `;

    const dom = new JSDOM(html, { url: 'https://codeforces.com/contest/4/submit', runScripts: 'dangerously' });
    const handled = await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/contest/4/submit'));

    expect(handled).toBe(true);

    // Problem index selected
    const probSelect = dom.window.document.querySelector('select[name="submittedProblemIndex"]') as HTMLSelectElement;
    expect(probSelect.value).toBe('A');

    // Textarea populated with native value and text content
    const ta = dom.window.document.querySelector('#sourceCodeTextarea') as HTMLTextAreaElement;
    expect(ta.value).toContain('int main()');
    expect(ta.textContent).toContain('int main()');
    expect(ta.defaultValue).toContain('int main()');

    // File input cleared so Codeforces processes the textarea (avoiding "Put your source into the textarea or choose the file")
    const fileInput = dom.window.document.querySelector('input[name="sourceFile"]') as HTMLInputElement;
    expect(fileInput.value).toBe('');

    // Leetfox submit banner injected
    const banner = dom.window.document.getElementById('lf-cf-submit-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('CPP');
  });

  it('handles CSES submit page by converting code to file and attaching to input[type="file"]', async () => {
    await subManager.setPendingSubmission({
      platform: 'cses',
      problemId: '1068',
      language: 'python',
      code: 'print(42)',
      timestamp: Date.now()
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <form action="/problemset/submit/1068/" method="post" enctype="multipart/form-data">
            <input type="hidden" name="csrf_token" value="test_token">
            <input type="file" name="file">
            <input type="submit" value="Submit">
          </form>
        </body>
      </html>
    `;

    const dom = new JSDOM(html, { url: 'https://cses.fi/problemset/submit/1068/' });
    const handled = await subManager.handleCSESSubmitPage(dom.window.document, new URL('https://cses.fi/problemset/submit/1068/'));

    expect(handled).toBe(true);

    const fileInput = dom.window.document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.files?.length).toBe(1);
    expect(fileInput.files?.[0].name).toBe('solution.py');

    const banner = dom.window.document.getElementById('lf-cses-submit-banner');
    expect(banner?.textContent).toContain('solution.py');
  });

  it('handles AtCoder submit page with file attachment and task selection', async () => {
    await subManager.setPendingSubmission({
      platform: 'atcoder',
      problemId: 'abc100_a',
      language: 'cpp',
      code: '#include <iostream>',
      timestamp: Date.now()
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <form action="/contests/abc100/submit" method="post" enctype="multipart/form-data">
            <select name="data.TaskScreenName">
              <option value="abc100_a">A - Happy Birthday!</option>
              <option value="abc100_b">B - Ringo's Favorite Numbers</option>
            </select>
            <select name="data.LanguageId">
              <option value="5001">C++ 23 (gcc 12.2)</option>
            </select>
            <input type="file" name="sourceFile">
            <textarea name="sourceCode"></textarea>
            <button type="submit">Submit</button>
          </form>
        </body>
      </html>
    `;

    const dom = new JSDOM(html, { url: 'https://atcoder.jp/contests/abc100/submit' });
    const handled = await subManager.handleAtCoderSubmitPage(dom.window.document, new URL('https://atcoder.jp/contests/abc100/submit'));

    expect(handled).toBe(true);

    const taskSelect = dom.window.document.querySelector('select[name="data.TaskScreenName"]') as HTMLSelectElement;
    expect(taskSelect.value).toBe('abc100_a');

    const fileInput = dom.window.document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.files?.length).toBe(1);
    expect(fileInput.files?.[0].name).toBe('solution.cpp');

    const banner = dom.window.document.getElementById('lf-atcoder-submit-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('solution.cpp');
  });

  it('CodeEditorPane triggers submission when submit button is clicked', async () => {
    const mockProblem = {
      platform: 'cses',
      id: '1068',
      qualifiedId: 'cses:1068',
      title: 'Weird Algorithm',
      statementHtml: '<p>Test</p>',
      examples: [],
      tags: [],
      limits: {},
      navigation: {},
      url: 'https://cses.fi/problemset/task/1068'
    };

    const pane = new CodeEditorPane(mockProblem);
    pane.setCode('int main() { return 0; }');

    const el = pane.getElement();
    const submitBtn = el.querySelector('.lf-btn-primary') as HTMLButtonElement;
    expect(submitBtn).not.toBeNull();

    // Spy on submitCSESDirect
    const submitSpy = vi.spyOn(subManager, 'submitCSESDirect').mockResolvedValue({
      success: true,
      resultUrl: 'https://cses.fi/problemset/result/12345/'
    });

    submitBtn.click();
    await new Promise(r => setTimeout(r, 50));

    expect(submitSpy).toHaveBeenCalledWith('1068', 'int main() { return 0; }', 'cpp');
    expect(submitBtn.textContent).toContain('Submitted');
  });

  it('CodeEditorPane opens Codeforces submit page in a new tab without navigating away', async () => {
    const mockProblem = {
      platform: 'codeforces',
      id: '2260A',
      qualifiedId: 'codeforces:2260a',
      title: "Monocarp's Contest",
      statementHtml: '<p>Test</p>',
      examples: [],
      tags: [],
      limits: {},
      navigation: {},
      url: 'https://codeforces.com/problemset/problem/2260/A',
      submitUrl: 'https://codeforces.com/problemset/submit'
    };

    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as any);

    const pane = new CodeEditorPane(mockProblem as any);
    pane.setCode('int main() { return 0; }');

    const el = pane.getElement();
    const submitBtn = el.querySelector('.lf-btn-primary') as HTMLButtonElement;
    expect(submitBtn).not.toBeNull();

    submitBtn.click();
    await new Promise(r => setTimeout(r, 50));

    expect(openSpy).toHaveBeenCalledWith('https://codeforces.com/problemset/submit', '_blank');
    expect(submitBtn.textContent).toContain('Opened in New Tab');

    const pending = await subManager.getPendingSubmission();
    expect(pending).not.toBeNull();
    expect(pending?.problemId).toBe('2260A');
    expect(pending?.code).toBe('int main() { return 0; }');
  });

  it('never matches Codeforces search form when search form precedes submit form in the DOM', async () => {
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '2260A',
      language: 'cpp',
      code: '#include <bits/stdc++.h>\nint main(){ return 0; }',
      timestamp: Date.now()
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="header">
            <form class="search" method="post" action="/search">
              <input class="search" name="query" value="">
            </form>
          </div>
          <div id="pageContent">
            <form class="submit-form" action="/problemset/submit" method="post" enctype="multipart/form-data">
              <input name="submittedProblemCode" value="">
              <select name="programTypeId">
                <option value="54">GNU G++20 13.2 (64 bit)</option>
              </select>
              <input type="file" name="sourceFile">
              <textarea id="sourceCodeTextarea" name="source"></textarea>
              <input type="submit" value="Submit">
            </form>
          </div>
        </body>
      </html>
    `;

    const dom = new JSDOM(html, { url: 'https://codeforces.com/problemset/submit', runScripts: 'dangerously' });
    const searchForm = dom.window.document.querySelector('form.search') as HTMLFormElement;
    const submitForm = dom.window.document.querySelector('form.submit-form') as HTMLFormElement;

    const handled = await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/problemset/submit'));
    expect(handled).toBe(true);

    // Search query form MUST NOT be touched
    const searchInput = searchForm.querySelector('input[name="query"]') as HTMLInputElement;
    expect(searchInput.value).toBe('');
    expect(searchForm.querySelector('#lf-cf-submit-banner')).toBeNull();

    // Submit form must have correct problem code and language
    const problemInput = submitForm.querySelector('input[name="submittedProblemCode"]') as HTMLInputElement;
    expect(problemInput.value).toBe('2260A');

    const fileInput = submitForm.querySelector('input[name="sourceFile"]') as HTMLInputElement;
    expect(fileInput.value).toBe('');

    // Leetfox banner injected above the submit form, NOT the search form
    const banner = dom.window.document.getElementById('lf-cf-submit-banner');
    expect(banner).not.toBeNull();
    expect(submitForm.previousElementSibling).toBe(banner);
  });

  it('accurately identifies authenticated and unauthenticated Codeforces sessions', () => {
    const loggedInDom = new JSDOM(`
      <html><body>
        <div id="header">
          <a href="/profile/tourist">tourist</a> | <a href="/logout">Logout</a>
        </div>
      </body></html>
    `);
    expect(subManager.isUserLoggedInOnCodeforces(loggedInDom.window.document)).toBe(true);

    const loggedOutDom = new JSDOM(`
      <html><body>
        <div id="header">
          <a href="/enter?back=%2Fproblemset">Enter</a> | <a href="/register">Register</a>
        </div>
      </body></html>
    `);
    expect(subManager.isUserLoggedInOnCodeforces(loggedOutDom.window.document)).toBe(false);
  });

  it('renders auth warning notice banner when visiting Codeforces submit page while logged out', async () => {
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '2260A',
      language: 'cpp',
      code: 'int main(){}',
      timestamp: Date.now()
    });

    const unauthHtml = `
      <html><body>
        <div id="header">
          <a href="/enter">Enter</a>
          <form class="search" action="/search" method="post"><input name="query"></form>
        </div>
        <div id="pageContent">
          <form class="handleForm" method="post"><input class="handleBox"></form>
        </div>
      </body></html>
    `;

    const dom = new JSDOM(unauthHtml, { url: 'https://codeforces.com/problemset/submit' });
    const handled = await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/problemset/submit'));

    expect(handled).toBe(true);
    const authBanner = dom.window.document.getElementById('lf-auth-banner');
    expect(authBanner).not.toBeNull();
    expect(authBanner?.textContent).toContain('Log In to Codeforces Required');
    // Search form must remain untouched
    const queryInput = dom.window.document.querySelector('input[name="query"]') as HTMLInputElement;
    expect(queryInput.value).toBe('');
  });

  it('protects Codeforces textarea and restores code on form submit', async () => {
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '4A',
      language: 'cpp',
      code: '#include <iostream>\nint main(){ return 0; }',
      timestamp: Date.now()
    });

    const html = `
      <html><body>
        <div id="header"><a href="/profile/tourist">tourist</a></div>
        <form class="submitForm" action="/contest/4/submit" method="post">
          <select name="submittedProblemIndex"><option value="A">A</option></select>
          <select name="programTypeId"><option value="89">GNU G++20</option></select>
          <input type="file" name="sourceFile">
          <textarea id="sourceCodeTextarea" name="source"></textarea>
          <input class="submit" type="submit" value="Submit">
        </form>
      </body></html>
    `;

    const dom = new JSDOM(html, { url: 'https://codeforces.com/contest/4/submit', runScripts: 'dangerously' });
    await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/contest/4/submit'));

    const form = dom.window.document.querySelector('form.submitForm') as HTMLFormElement;
    const ta = dom.window.document.getElementById('sourceCodeTextarea') as HTMLTextAreaElement;
    expect(ta.value).toContain('int main()');
    expect(ta.textContent).toContain('int main()');

    // If external script or editor emptied the textarea, submitting form re-populates code
    ta.value = '';
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    expect(ta.value).toContain('int main()');
  });

  it('preserves CSP nonce on injected Ace sync script', async () => {
    await subManager.setPendingSubmission({
      platform: 'codeforces',
      problemId: '4A',
      language: 'cpp',
      code: 'int main(){}',
      timestamp: Date.now()
    });

    const html = `
      <html>
        <head>
          <script nonce="cf-security-nonce-xyz"></script>
        </head>
        <body>
          <div id="header"><a href="/profile/tourist">tourist</a></div>
          <form class="submitForm" action="/contest/4/submit" method="post">
            <input name="submittedProblemCode" value="4A">
            <select name="programTypeId"><option value="89">GNU G++20</option></select>
            <textarea id="sourceCodeTextarea" name="source"></textarea>
            <input class="submit" type="submit" value="Submit">
          </form>
        </body>
      </html>
    `;

    const dom = new JSDOM(html, { url: 'https://codeforces.com/contest/4/submit' });
    const appendSpy = vi.spyOn(dom.window.document.head, 'appendChild');

    await subManager.handleCodeforcesSubmitPage(dom.window.document, new URL('https://codeforces.com/contest/4/submit'));

    expect(appendSpy).toHaveBeenCalled();
    const injectedScript = appendSpy.mock.calls.find(call => (call[0] as HTMLElement).tagName === 'SCRIPT')?.[0] as HTMLScriptElement;
    expect(injectedScript).toBeDefined();
    expect(injectedScript.getAttribute('nonce')).toBe('cf-security-nonce-xyz');
  });
});
