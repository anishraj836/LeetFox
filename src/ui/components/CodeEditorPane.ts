import type { Problem } from '../../core/models/problem';
import { createElement, copyToClipboard } from '../../core/utils/dom';
import { StorageManager } from '../../core/storage/StorageManager';

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
  private activeExampleIndex = 0;
  private storage: StorageManager;
  private currentLanguage = 'cpp';
  private saveTimeout: any = null;

  constructor(private problem: Problem) {
    this.storage = StorageManager.getInstance();
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

    const submitBtn = createElement('button', {
      className: 'lf-btn lf-btn-primary',
      type: 'button',
      title: 'Submit solution on platform',
      onClick: () => {
        if (this.problem.submitUrl) {
          window.location.href = this.problem.submitUrl;
        } else {
          window.location.href = this.problem.url;
        }
      }
    }, '🚀 Submit');

    rightTools.appendChild(resetBtn);
    rightTools.appendChild(copyBtn);
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
    const consoleTitle = createElement('span', { className: 'lf-console-title' }, '🧪 Test Cases');
    this.testcaseTabContainer = createElement('div', { className: 'lf-console-tabs' });

    consoleHeader.appendChild(consoleTitle);
    consoleHeader.appendChild(this.testcaseTabContainer);
    consoleCard.appendChild(consoleHeader);

    this.testcaseBody = createElement('div', { className: 'lf-console-body' });
    consoleCard.appendChild(this.testcaseBody);
    this.element.appendChild(consoleCard);

    // Set initial default template synchronously
    this.editorTextarea.value = SUPPORTED_LANGUAGES[this.currentLanguage]?.defaultCode || "";
    this.updateLineNumbers();

    // Load preferred language and saved code asynchronously
    this.initLanguageAndCode();
    this.renderTestcaseTabs();
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
        if (typeof window !== "undefined" && window.localStorage) {
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
      if (typeof window !== "undefined" && window.localStorage) {
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
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.editorTextarea.selectionStart;
        const end = this.editorTextarea.selectionEnd;
        const value = this.editorTextarea.value;
        this.editorTextarea.value = value.substring(0, start) + '    ' + value.substring(end);
        this.editorTextarea.selectionStart = this.editorTextarea.selectionEnd = start + 4;
        this.updateLineNumbers();
        this.scheduleAutoSave();
      } else if (e.key === 'Enter') {
        const start = this.editorTextarea.selectionStart;
        const value = this.editorTextarea.value;
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.substring(lineStart, start);
        const match = currentLine.match(/^\s*/);
        const indent = match ? match[0] : '';

        // If line ends with '{', add extra indent
        const extraIndent = currentLine.trim().endsWith('{') ? '    ' : '';

        e.preventDefault();
        const insertion = '\n' + indent + extraIndent;
        this.editorTextarea.value = value.substring(0, start) + insertion + value.substring(start);
        this.editorTextarea.selectionStart = this.editorTextarea.selectionEnd = start + insertion.length;
        this.updateLineNumbers();
        this.scheduleAutoSave();
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
      const tab = createElement('button', {
        className: `lf-console-tab ${idx === this.activeExampleIndex ? 'active' : ''}`,
        type: 'button',
        onClick: () => {
          this.activeExampleIndex = idx;
          this.renderTestcaseTabs();
        }
      }, `Case ${idx + 1}`);

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
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
