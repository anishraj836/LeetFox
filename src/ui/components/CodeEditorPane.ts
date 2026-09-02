import type { Problem } from '../../core/models/problem';
import { createElement, copyToClipboard } from '../../core/utils/dom';
import { StorageManager } from '../../core/storage/StorageManager';
import { SubmissionManager } from '../../core/submission/SubmissionManager';
import { CodeRunner, type ExecutionResult } from '../../core/runner/CodeRunner';

export interface CodeTemplate {
  name: string;
  extension: string;
  defaultCode: string;
}

export const SUPPORTED_LANGUAGES: Record<string, CodeTemplate> = {
  cpp: {
    name: 'C++ (20)',
    extension: 'cpp',
    defaultCode: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

void solve() {
    // Your solution here
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int t = 1;
    // cin >> t;
    while (t--) {
        solve();
    }

    return 0;
}
`
  },
  python: {
    name: 'Python 3',
    extension: 'py',
    defaultCode: `import sys

def solve():
    # Read all tokens from standard input
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Your solution here

if __name__ == '__main__':
    solve()
`
  },
  java: {
    name: 'Java (21)',
    extension: 'java',
    defaultCode: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st;

        // Your solution here
    }
}
`
  },
  rust: {
    name: 'Rust',
    extension: 'rs',
    defaultCode: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    // Your solution here
}
`
  },
  go: {
    name: 'Go',
    extension: 'go',
    defaultCode: `package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    in := bufio.NewReader(os.Stdin)
    out := bufio.NewWriter(os.Stdout)
    defer out.Flush()

    // Your solution here
}
`
  }
};

export class CodeEditorPane {
  private element: HTMLElement;
  private langSelect: HTMLSelectElement;
  private editorTextarea: HTMLTextAreaElement;
  private lineNumbers: HTMLElement;
  private testcaseTabContainer: HTMLElement;
  private testcaseBody: HTMLElement;
  private consoleStatusBadge: HTMLElement;
  private activeExampleIndex = 0;
  private storage: StorageManager;
  private runner: CodeRunner;
  private currentLanguage = 'cpp';
  private saveTimeout: any = null;
  private testResults: Map<number, ExecutionResult> = new Map();
  private isRunning = false;

  constructor(private problem: Problem) {
    this.storage = StorageManager.getInstance();
    this.runner = CodeRunner.getInstance();
    this.element = createElement('div', { className: 'lf-code-pane' });

    // 1. Editor Toolbar
    const toolbar = createElement('div', { className: 'lf-editor-toolbar' });

    const leftTools = createElement('div', { className: 'lf-editor-tools-left' });
    this.langSelect = createElement('select', { className: 'lf-lang-select' });
    for (const [key, lang] of Object.entries(SUPPORTED_LANGUAGES)) {
      const opt = createElement('option', { value: key }, lang.name);
      this.langSelect.appendChild(opt);
    }
    this.langSelect.addEventListener('change', () => {
      this.switchLanguage(this.langSelect.value);
    });

    leftTools.appendChild(this.langSelect);

    const rightTools = createElement('div', { className: 'lf-editor-tools-right' });

    const resetBtn = createElement('button', {
      className: 'lf-btn lf-btn-icon',
      type: 'button',
      title: 'Reset code template',
      onClick: () => this.resetTemplate()
    }, '↺');

    const copyBtn = createElement('button', {
      className: 'lf-btn',
      type: 'button',
      title: 'Copy code to clipboard',
      onClick: async () => {
        const ok = await copyToClipboard(this.editorTextarea.value);
        if (ok) {
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
        }
      }
    }, '📋 Copy');

    // Solutions button
    let solBtn: HTMLButtonElement;
    if (this.problem.isLiveContest) {
      solBtn = createElement('button', {
        className: 'lf-btn lf-btn-locked',
        type: 'button',
        title: 'Solutions & Submissions are hidden during active contests to comply with contest rules.',
        disabled: true
      }, '🔒 Solutions');
    } else {
      const solUrl = this.problem.editorialUrl || this.problem.solutionsUrl;
      solBtn = createElement('button', {
        className: `lf-btn ${!solUrl ? 'disabled' : ''}`,
        type: 'button',
        title: solUrl ? 'View problem solutions, editorial, or accepted submissions' : 'No public solutions found',
        onClick: () => {
          if (solUrl) window.open(solUrl, '_blank');
        }
      }, '💡 Solutions');
    }

    // Run Code Button (LeetCode-style)
    const runBtn = createElement('button', {
      className: 'lf-btn lf-btn-run',
      type: 'button',
      title: 'Run code against example testcases',
      onClick: () => this.runTestcases(runBtn)
    }, '▶ Run');

    // Submit Button
    const submitBtn = createElement('button', {
      className: 'lf-btn lf-btn-primary',
      type: 'button',
      title: 'Submit solution on platform',
      onClick: () => this.handleSubmission(submitBtn)
    }, '🚀 Submit');

    rightTools.appendChild(resetBtn);
    rightTools.appendChild(copyBtn);
    rightTools.appendChild(solBtn);
    rightTools.appendChild(runBtn);
    rightTools.appendChild(submitBtn);

    toolbar.appendChild(leftTools);
    toolbar.appendChild(rightTools);
    this.element.appendChild(toolbar);

    // 2. Editor Container (Line Numbers + Textarea)
    const editorWrapper = createElement('div', { className: 'lf-editor-wrapper' });
    this.lineNumbers = createElement('div', { className: 'lf-line-numbers' }, '1');
    this.editorTextarea = createElement('textarea', {
      className: 'lf-editor-textarea',
      spellcheck: 'false',
      placeholder: '// Write your solution here...'
    });

    this.bindEditorEvents();

    editorWrapper.appendChild(this.lineNumbers);
    editorWrapper.appendChild(this.editorTextarea);
    this.element.appendChild(editorWrapper);

    // 3. Testcase Console Pane (Examples Preview & Runner)
    const consoleCard = createElement('div', { className: 'lf-console-card' });
    const consoleHeader = createElement('div', { className: 'lf-console-header' });

    const titleGroup = createElement('div', { style: 'display: flex; align-items: center; gap: 8px;' });
    const consoleTitle = createElement('span', { className: 'lf-console-title' }, '🧪 Test Cases');
    this.consoleStatusBadge = createElement('span', { className: 'lf-console-status-badge' });
    titleGroup.appendChild(consoleTitle);
    titleGroup.appendChild(this.consoleStatusBadge);

    this.testcaseTabContainer = createElement('div', { className: 'lf-console-tabs' });

    consoleHeader.appendChild(titleGroup);
    consoleHeader.appendChild(this.testcaseTabContainer);
    consoleCard.appendChild(consoleHeader);

    this.testcaseBody = createElement('div', { className: 'lf-console-body' });
    consoleCard.appendChild(this.testcaseBody);
    this.element.appendChild(consoleCard);

    // Set initial default template synchronously
    this.editorTextarea.value = SUPPORTED_LANGUAGES[this.currentLanguage]?.defaultCode || '';
    this.updateLineNumbers();

    // Load preferred language and saved code asynchronously
    this.initLanguageAndCode();
    this.renderTestcaseTabs();
  }

  public async runTestcases(runBtn: HTMLButtonElement): Promise<void> {
    if (this.isRunning) return;
    const code = this.editorTextarea.value.trim();
    if (!code) {
      alert('Please write code before running tests.');
      return;
    }

    const examples = this.problem.examples || [];
    if (examples.length === 0) {
      alert('No example test cases found to run for this problem.');
      return;
    }

    this.isRunning = true;
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running...';
    this.consoleStatusBadge.className = 'lf-console-status-badge running';
    this.consoleStatusBadge.textContent = 'Running tests...';

    try {
      // Run the currently active testcase first
      const currentEx = examples[this.activeExampleIndex] || examples[0];
      const result = await this.runner.runTestcase(
        this.currentLanguage,
        code,
        currentEx.input,
        currentEx.output
      );

      this.testResults.set(this.activeExampleIndex, result);
      this.updateStatusBadge(result);
      this.renderTestcaseTabs();
    } catch (err: any) {
      this.consoleStatusBadge.className = 'lf-console-status-badge error';
      this.consoleStatusBadge.textContent = 'Error executing code';
    } finally {
      this.isRunning = false;
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run';
    }
  }

  private updateStatusBadge(result: ExecutionResult): void {
    if (result.status === 'accepted') {
      this.consoleStatusBadge.className = 'lf-console-status-badge accepted';
      this.consoleStatusBadge.textContent = `✓ Accepted (${result.executionTimeMs || 0}ms)`;
    } else if (result.status === 'wrong_answer') {
      this.consoleStatusBadge.className = 'lf-console-status-badge wrong-answer';
      this.consoleStatusBadge.textContent = '✕ Wrong Answer';
    } else if (result.status === 'compile_error') {
      this.consoleStatusBadge.className = 'lf-console-status-badge compile-error';
      this.consoleStatusBadge.textContent = '⚠️ Compilation Error';
    } else if (result.status === 'runtime_error') {
      this.consoleStatusBadge.className = 'lf-console-status-badge error';
      this.consoleStatusBadge.textContent = '⚠️ Runtime Error';
    } else if (result.status === 'timeout') {
      this.consoleStatusBadge.className = 'lf-console-status-badge error';
      this.consoleStatusBadge.textContent = '⏱️ Time Limit Exceeded';
    } else {
      this.consoleStatusBadge.className = 'lf-console-status-badge error';
      this.consoleStatusBadge.textContent = 'Execution Failed';
    }
  }

  private async handleSubmission(submitBtn: HTMLButtonElement): Promise<void> {
    const code = this.editorTextarea.value.trim();
    if (!code) {
      alert('Please write some code before submitting.');
      return;
    }

    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: this.problem.platform,
      problemId: this.problem.id,
      language: this.currentLanguage,
      code: this.editorTextarea.value,
      timestamp: Date.now()
    });

    submitBtn.textContent = '⏳ Submitting...';
    submitBtn.disabled = true;

    if (this.problem.platform === 'cses') {
      const res = await subManager.submitCSESDirect(this.problem.id, this.editorTextarea.value, this.currentLanguage);
      if (res.success && res.resultUrl) {
        submitBtn.textContent = '✓ Submitted!';
        setTimeout(() => {
          window.location.href = res.resultUrl!;
        }, 500);
        return;
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Submit';

        // Check if user is not logged in
        if (res.error && res.error.includes('logged in')) {
          this.showNotLoggedInModal();
          return;
        }

        // Direct failed for other reasons, navigate to submit page with pending auto-fill
        if (this.problem.submitUrl) {
          window.location.href = this.problem.submitUrl;
          return;
        }
      }
    }

    // Codeforces flow: Navigate to submit page with auto-fill pending
    if (this.problem.submitUrl) {
      window.location.href = this.problem.submitUrl;
    } else {
      window.location.href = this.problem.url;
    }
  }

  private showNotLoggedInModal(): void {
    const existing = document.getElementById('lf-auth-warning-modal');
    if (existing) existing.remove();

    const overlay = createElement('div', {
      id: 'lf-auth-warning-modal',
      className: 'lf-auth-modal-overlay'
    });

    const modal = createElement('div', { className: 'lf-auth-modal' });

    const title = createElement('h3', {}, '⚠️ Log in to CSES Required');
    const msg = createElement('p', {}, 'You must be logged into your CSES account to submit code.');
    const hint = createElement('p', { style: 'font-size: 13px; color: var(--lf-text-muted);' }, 'Click below to open the CSES login page. Once logged in, return here and click "Submit" to send your solution instantly.');

    const btnRow = createElement('div', { className: 'lf-auth-modal-actions' });
    const loginLink = createElement('a', {
      className: 'lf-btn lf-btn-primary',
      href: 'https://cses.fi/login',
      target: '_blank',
      onClick: () => { overlay.remove(); }
    }, 'Log In to CSES ↗');

    const closeBtn = createElement('button', {
      className: 'lf-btn',
      type: 'button',
      onClick: () => overlay.remove()
    }, 'Cancel');

    btnRow.appendChild(closeBtn);
    btnRow.appendChild(loginLink);

    modal.appendChild(title);
    modal.appendChild(msg);
    modal.appendChild(hint);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
  }

  private async initLanguageAndCode(): Promise<void> {
    const prefs = await this.storage.getPreferences();
    const preferredLang = (prefs as any).defaultLanguage || 'cpp';
    this.currentLanguage = SUPPORTED_LANGUAGES[preferredLang] ? preferredLang : 'cpp';
    this.langSelect.value = this.currentLanguage;
    await this.loadCodeForCurrentLanguage();
  }

  private getCodeStorageKey(lang: string): string {
    return `code:${this.problem.platform.toLowerCase()}:${this.problem.id.toLowerCase()}:${lang}`;
  }

  private async loadCodeForCurrentLanguage(): Promise<void> {
    const key = this.getCodeStorageKey(this.currentLanguage);
    let code: string | null = null;

    try {
      const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
      if (storageArea) {
        const res = await (storageArea.get(key) instanceof Promise ? storageArea.get(key) : new Promise<any>(r => storageArea.get(key, r)));
        if (res && res[key]) {
          code = res[key];
        }
      }
    } catch (_) {}

    if (code === null) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          code = window.localStorage.getItem(key);
        }
      } catch (_) {}
    }

    if (code === null) {
      code = SUPPORTED_LANGUAGES[this.currentLanguage]?.defaultCode || '';
    }

    this.editorTextarea.value = code;
    this.updateLineNumbers();
  }

  private async saveCurrentCode(): Promise<void> {
    const key = this.getCodeStorageKey(this.currentLanguage);
    const code = this.editorTextarea.value;
    try {
      const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
      if (storageArea) {
        const res = storageArea.set({ [key]: code });
        if (res instanceof Promise) await res;
      }
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, code);
      }
    } catch (_) {}
  }

  private async switchLanguage(newLang: string): Promise<void> {
    await this.saveCurrentCode();
    this.currentLanguage = newLang;
    await this.loadCodeForCurrentLanguage();
  }

  private resetTemplate(): void {
    if (confirm(`Reset ${SUPPORTED_LANGUAGES[this.currentLanguage]?.name} code to default template?`)) {
      this.editorTextarea.value = SUPPORTED_LANGUAGES[this.currentLanguage]?.defaultCode || '';
      this.updateLineNumbers();
      this.saveCurrentCode();
    }
  }

  private bindEditorEvents(): void {
    // Sync line numbers on scroll
    this.editorTextarea.addEventListener('scroll', () => {
      this.lineNumbers.scrollTop = this.editorTextarea.scrollTop;
    });

    // Auto-indent, Tab key support, and auto-bracket close
    this.editorTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
      const start = this.editorTextarea.selectionStart;
      const end = this.editorTextarea.selectionEnd;
      const value = this.editorTextarea.value;

      // 1. Auto-bracket pair closing
      const pairs: Record<string, string> = {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'"
      };

      if (pairs[e.key]) {
        e.preventDefault();
        const selected = value.substring(start, end);
        const closeChar = pairs[e.key];
        this.editorTextarea.value = value.substring(0, start) + e.key + selected + closeChar + value.substring(end);
        this.editorTextarea.selectionStart = start + 1;
        this.editorTextarea.selectionEnd = start + 1 + selected.length;
        this.updateLineNumbers();
        this.scheduleAutoSave();
        return;
      }

      // 2. Tab key indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        this.editorTextarea.value = value.substring(0, start) + '    ' + value.substring(end);
        this.editorTextarea.selectionStart = this.editorTextarea.selectionEnd = start + 4;
        this.updateLineNumbers();
        this.scheduleAutoSave();
        return;
      }

      // 3. Enter key with smart indentation
      if (e.key === 'Enter') {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.substring(lineStart, start);
        const match = currentLine.match(/^\s*/);
        const indent = match ? match[0] : '';

        // Check if cursor is between { and }
        const isBetweenBraces = value[start - 1] === '{' && value[end] === '}';

        e.preventDefault();
        if (isBetweenBraces) {
          const insertion = '\n' + indent + '    \n' + indent;
          this.editorTextarea.value = value.substring(0, start) + insertion + value.substring(end);
          this.editorTextarea.selectionStart = this.editorTextarea.selectionEnd = start + indent.length + 5;
        } else {
          const extraIndent = currentLine.trim().endsWith('{') ? '    ' : '';
          const insertion = '\n' + indent + extraIndent;
          this.editorTextarea.value = value.substring(0, start) + insertion + value.substring(end);
          this.editorTextarea.selectionStart = this.editorTextarea.selectionEnd = start + insertion.length;
        }

        this.updateLineNumbers();
        this.scheduleAutoSave();
        return;
      }
    });

    this.editorTextarea.addEventListener('input', () => {
      this.updateLineNumbers();
      this.scheduleAutoSave();
    });
  }

  private scheduleAutoSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentCode();
    }, 400);
  }

  private updateLineNumbers(): void {
    const lines = (this.editorTextarea.value || '').split('\n').length;
    let numbersStr = '';
    for (let i = 1; i <= lines; i++) {
      numbersStr += `${i}\n`;
    }
    this.lineNumbers.textContent = numbersStr;
  }

  private renderTestcaseTabs(): void {
    this.testcaseTabContainer.innerHTML = '';
    const examples = this.problem.examples || [];

    if (examples.length === 0) {
      this.testcaseTabContainer.textContent = 'No testcases found';
      this.testcaseBody.innerHTML = '<span style="color: var(--lf-text-muted); font-size: 13px;">No parsed test cases for this problem.</span>';
      return;
    }

    examples.forEach((_, idx) => {
      const res = this.testResults.get(idx);
      let statusIcon = '';
      if (res) {
        statusIcon = res.status === 'accepted' ? ' ✓' : ' ✕';
      }

      const tab = createElement('button', {
        className: `lf-console-tab ${idx === this.activeExampleIndex ? 'active' : ''} ${res ? res.status : ''}`,
        type: 'button',
        onClick: () => {
          this.activeExampleIndex = idx;
          const currentRes = this.testResults.get(idx);
          if (currentRes) this.updateStatusBadge(currentRes);
          this.renderTestcaseTabs();
        }
      }, `Case ${idx + 1}${statusIcon}`);

      this.testcaseTabContainer.appendChild(tab);
    });

    const activeExample = examples[this.activeExampleIndex];
    if (activeExample) {
      this.testcaseBody.innerHTML = '';

      const inputBlock = createElement('div', { className: 'lf-console-io-block' });
      const inputTitle = createElement('div', { className: 'lf-console-io-title' }, 'Input:');
      const inputPre = createElement('pre', { className: 'lf-console-pre' }, activeExample.input);
      inputBlock.appendChild(inputTitle);
      inputBlock.appendChild(inputPre);

      const outputBlock = createElement('div', { className: 'lf-console-io-block' });
      const outputTitle = createElement('div', { className: 'lf-console-io-title' }, 'Expected Output:');
      const outputPre = createElement('pre', { className: 'lf-console-pre' }, activeExample.output);
      outputBlock.appendChild(outputTitle);
      outputBlock.appendChild(outputPre);

      this.testcaseBody.appendChild(inputBlock);
      this.testcaseBody.appendChild(outputBlock);

      // If test has been run, show Program Output or Error
      const testResult = this.testResults.get(this.activeExampleIndex);
      if (testResult) {
        if (testResult.programOutput) {
          const actualBlock = createElement('div', { className: 'lf-console-io-block' });
          const actualTitle = createElement('div', { className: 'lf-console-io-title' }, 'Your Output:');
          const actualPre = createElement('pre', {
            className: `lf-console-pre ${testResult.status === 'accepted' ? 'output-accepted' : 'output-wrong'}`
          }, testResult.programOutput);
          actualBlock.appendChild(actualTitle);
          actualBlock.appendChild(actualPre);
          this.testcaseBody.appendChild(actualBlock);
        }

        if (testResult.compilerError || testResult.programError) {
          const errorBlock = createElement('div', { className: 'lf-console-io-block' });
          const errorTitle = createElement('div', { className: 'lf-console-io-title' }, 'Diagnostics / Errors:');
          const errorPre = createElement('pre', {
            className: 'lf-console-pre output-error'
          }, testResult.compilerError || testResult.programError || '');
          errorBlock.appendChild(errorTitle);
          errorBlock.appendChild(errorPre);
          this.testcaseBody.appendChild(errorBlock);
        }
      }
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
