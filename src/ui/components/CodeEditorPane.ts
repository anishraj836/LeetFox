import type { Problem } from '../../core/models/problem';
import { createElement, copyToClipboard } from '../../core/utils/dom';
import { StorageManager } from '../../core/storage/StorageManager';
import { SubmissionManager } from '../../core/submission/SubmissionManager';
import { CodeRunner, type ExecutionResult } from '../../core/runner/CodeRunner';
import { CompletionTrie, createTrieForLanguage, createTrieCompletionSource } from '../../core/editor/CompletionTrie';

// CodeMirror 6 imports
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from '@codemirror/view';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { tags } from '@lezer/highlight';

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

// Language extension factory
function getLanguageExtension(lang: string): Extension {
  switch (lang) {
    case 'cpp': return cpp();
    case 'python': return python();
    case 'java': return java();
    case 'rust': return rust();
    case 'go': return go();
    default: return cpp();
  }
}

// Custom Leetfox dark theme (matches our CSS variables)
const leetfoxDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--lf-code-bg, #1e1e2e)',
    color: 'var(--lf-text-main, #cdd6f4)',
    fontSize: '13px',
    fontFamily: 'var(--lf-font-mono, "Fira Code", "JetBrains Mono", "Cascadia Code", "SF Mono", Menlo, monospace)',
  },
  '.cm-content': {
    caretColor: 'var(--lf-accent, #89b4fa)',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--lf-accent, #89b4fa)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(137, 180, 250, 0.2)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(137, 180, 250, 0.06)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(137, 180, 250, 0.06)',
    color: 'var(--lf-accent, #89b4fa)',
  },
  '.cm-gutters': {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    color: 'var(--lf-text-muted, #6c7086)',
    border: 'none',
    borderRight: '1px solid var(--lf-code-border, rgba(255,255,255,0.06))',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '32px',
    fontSize: '13px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(137, 180, 250, 0.25)',
    outline: '1px solid rgba(137, 180, 250, 0.5)',
    color: 'inherit',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(249, 226, 175, 0.2)',
    outline: '1px solid rgba(249, 226, 175, 0.4)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(166, 227, 161, 0.15)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--lf-bg-card, #313244)',
    border: '1px solid var(--lf-border, rgba(255,255,255,0.1))',
    borderRadius: '8px',
    color: 'var(--lf-text-main, #cdd6f4)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 8px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgba(137, 180, 250, 0.15)',
    color: 'var(--lf-text-main, #cdd6f4)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-panels': {
    backgroundColor: 'var(--lf-bg-card, #313244)',
    color: 'var(--lf-text-main, #cdd6f4)',
  },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': {
    backgroundColor: 'var(--lf-bg-surface, #1e1e2e)',
    color: 'var(--lf-text-main, #cdd6f4)',
    border: '1px solid var(--lf-border, rgba(255,255,255,0.1))',
    borderRadius: '4px',
  },
}, { dark: true });

// Catppuccin-inspired syntax highlight style
const leetfoxHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#cba6f7' },           // mauve
  { tag: tags.controlKeyword, color: '#cba6f7' },
  { tag: tags.moduleKeyword, color: '#cba6f7' },
  { tag: tags.operatorKeyword, color: '#89dceb' },    // sky
  { tag: tags.operator, color: '#89dceb' },
  { tag: tags.typeName, color: '#f9e2af' },           // yellow
  { tag: tags.className, color: '#f9e2af' },
  { tag: tags.function(tags.variableName), color: '#89b4fa' },  // blue
  { tag: tags.definition(tags.function(tags.variableName)), color: '#89b4fa' },
  { tag: tags.function(tags.propertyName), color: '#89b4fa' },
  { tag: tags.variableName, color: '#cdd6f4' },       // text
  { tag: tags.propertyName, color: '#89b4fa' },
  { tag: tags.bool, color: '#fab387' },                // peach
  { tag: tags.number, color: '#fab387' },
  { tag: tags.string, color: '#a6e3a1' },              // green
  { tag: tags.character, color: '#a6e3a1' },
  { tag: tags.escape, color: '#f5c2e7' },              // pink
  { tag: tags.regexp, color: '#f5c2e7' },
  { tag: tags.comment, color: '#6c7086', fontStyle: 'italic' }, // overlay0
  { tag: tags.blockComment, color: '#6c7086', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#6c7086', fontStyle: 'italic' },
  { tag: tags.docComment, color: '#6c7086', fontStyle: 'italic' },
  { tag: tags.meta, color: '#f38ba8' },                // red (preprocessor)
  { tag: tags.processingInstruction, color: '#f38ba8' },
  { tag: tags.macroName, color: '#f38ba8' },
  { tag: tags.annotation, color: '#f9e2af' },
  { tag: tags.bracket, color: '#9399b2' },             // overlay2
  { tag: tags.paren, color: '#9399b2' },
  { tag: tags.squareBracket, color: '#9399b2' },
  { tag: tags.brace, color: '#9399b2' },
  { tag: tags.angleBracket, color: '#9399b2' },
  { tag: tags.separator, color: '#9399b2' },
  { tag: tags.punctuation, color: '#9399b2' },
  { tag: tags.self, color: '#f38ba8' },
  { tag: tags.null, color: '#fab387' },
  { tag: tags.atom, color: '#fab387' },
  { tag: tags.labelName, color: '#89dceb' },
  { tag: tags.namespace, color: '#f9e2af' },
  { tag: tags.heading, color: '#89b4fa', fontWeight: 'bold' },
  { tag: tags.invalid, color: '#f38ba8', textDecoration: 'line-through' },
]);

export class CodeEditorPane {
  private element: HTMLElement;
  private langSelect: HTMLSelectElement;
  private editorView: EditorView | null = null;
  private cmHost: HTMLElement;
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

  // Trie-based Autocomplete & Compartment
  private trie: CompletionTrie;
  private completionCompartment: Compartment = new Compartment();
  private suggestionsEnabled = true;
  private suggestionsBtn!: HTMLButtonElement;

  constructor(private problem: Problem) {
    this.storage = StorageManager.getInstance();
    this.runner = CodeRunner.getInstance();
    this.trie = createTrieForLanguage(this.currentLanguage);
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

    // Suggestions Toggle Button
    this.suggestionsBtn = createElement('button', {
      className: 'lf-btn lf-btn-suggestions active',
      type: 'button',
      title: 'Toggle Trie-based Autocomplete Suggestions (vector, map, stl, snippets)',
      onClick: () => this.toggleSuggestions()
    }, '✨ Suggestions: ON');
    leftTools.appendChild(this.suggestionsBtn);

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
        const ok = await copyToClipboard(this.getCode());
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

    // 2. CodeMirror Editor Host
    this.cmHost = createElement('div', { className: 'lf-cm-host' });
    this.element.appendChild(this.cmHost);

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

    // Initialize CodeMirror with default language
    this.initCodeMirror(SUPPORTED_LANGUAGES[this.currentLanguage]?.defaultCode || '');

    // Load preferred language and saved code asynchronously
    this.initLanguageAndCode();
    this.renderTestcaseTabs();
  }

  private initCodeMirror(initialCode: string): void {
    // If an editor already exists, destroy it safely
    if (this.editorView) {
      try { this.editorView.destroy(); } catch (_) { /* JSDOM compat */ }
      this.editorView = null;
    }
    this.cmHost.innerHTML = '';

    // Ensure the host element's window has requestAnimationFrame/cancelAnimationFrame for CodeMirror
    const hostWin = this.cmHost.ownerDocument?.defaultView as any;
    if (hostWin) {
      if (typeof hostWin.requestAnimationFrame !== 'function') {
        hostWin.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
      }
      if (typeof hostWin.cancelAnimationFrame !== 'function') {
        hostWin.cancelAnimationFrame = (id: number) => clearTimeout(id);
      }
    }

    // Index initial code tokens into the Trie
    this.trie.indexDocumentTokens(initialCode);

    const extensions = this.buildExtensions();

    const state = EditorState.create({
      doc: initialCode,
      extensions,
    });

    this.editorView = new EditorView({
      state,
      parent: this.cmHost,
    });
  }

  private buildExtensions(): Extension[] {
    const autocompleteExtension = this.suggestionsEnabled
      ? autocompletion({
          override: [createTrieCompletionSource(this.trie)],
          activateOnTyping: true,
          defaultKeymap: true
        })
      : [];

    return [
      // Line numbers & active line
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      foldGutter(),

      // Editor behavior
      drawSelection(),
      rectangularSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      history(),

      // Trie Autocompletion compartment for dynamic toggling
      this.completionCompartment.of(autocompleteExtension),

      // Keymaps
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),

      // Language mode
      getLanguageExtension(this.currentLanguage),

      // Theme: our custom dark theme + syntax highlighting
      leetfoxDarkTheme,
      syntaxHighlighting(leetfoxHighlightStyle),

      // Tab size
      EditorState.tabSize.of(4),

      // Auto-save on document changes and index words dynamically
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const docText = update.state.doc.toString();
          this.trie.indexDocumentTokens(docText);
          this.scheduleAutoSave();
        }
      }),
    ];
  }

  /**
   * Toggle Trie-based autocompletion on/off dynamically
   */
  public toggleSuggestions(): void {
    this.suggestionsEnabled = !this.suggestionsEnabled;

    if (this.suggestionsEnabled) {
      this.suggestionsBtn.className = 'lf-btn lf-btn-suggestions active';
      this.suggestionsBtn.textContent = '✨ Suggestions: ON';
    } else {
      this.suggestionsBtn.className = 'lf-btn lf-btn-suggestions inactive';
      this.suggestionsBtn.textContent = '💤 Suggestions: OFF';
    }

    if (this.editorView) {
      const newExtension = this.suggestionsEnabled
        ? autocompletion({
            override: [createTrieCompletionSource(this.trie)],
            activateOnTyping: true,
            defaultKeymap: true
          })
        : [];

      this.editorView.dispatch({
        effects: this.completionCompartment.reconfigure(newExtension)
      });
    }

    // Persist preference
    this.storage.savePreferences({ editorSuggestions: this.suggestionsEnabled }).catch(() => {});
  }

  /** Get the current code from the editor */
  public getCode(): string {
    if (this.editorView) {
      return this.editorView.state.doc.toString();
    }
    return '';
  }

  /** Set code in the editor */
  public setCode(code: string): void {
    if (this.editorView) {
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: this.editorView.state.doc.length,
          insert: code,
        },
      });
      this.trie.indexDocumentTokens(code);
    }
  }

  public async runTestcases(runBtn: HTMLButtonElement): Promise<void> {
    if (this.isRunning) return;
    const code = this.getCode().trim();
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
      // Run the currently active testcase
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

      // Scroll console body to top so the output grid is immediately visible
      if (this.testcaseBody) {
        this.testcaseBody.scrollTop = 0;
      }
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
      this.consoleStatusBadge.textContent = `✕ Wrong Answer (${result.executionTimeMs || 0}ms)`;
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
    const code = this.getCode().trim();
    if (!code) {
      alert('Please write some code before submitting.');
      return;
    }

    const subManager = SubmissionManager.getInstance();
    await subManager.setPendingSubmission({
      platform: this.problem.platform,
      problemId: this.problem.id,
      language: this.currentLanguage,
      code: this.getCode(),
      timestamp: Date.now()
    });

    submitBtn.textContent = '⏳ Submitting...';
    submitBtn.disabled = true;

    if (this.problem.platform === 'cses') {
      // Check login status upfront from the page DOM
      if (!subManager.isUserLoggedInOnCSES(document)) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Submit';
        this.showNotLoggedInModal();
        return;
      }

      submitBtn.textContent = '⏳ Sending to CSES...';
      const res = await subManager.submitCSESDirect(this.problem.id, this.getCode(), this.currentLanguage);
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

        // Show the actual error message from CSES
        alert(`CSES Submission Error:\n\n${res.error || 'Failed to submit solution.'}\n\nPlease check your login status and try again.`);
      }
      return;
    }

    // Codeforces flow: Navigate to submit page with auto-fill & auto-submit pending
    submitBtn.textContent = '⏳ Opening Submit...';
    const targetUrl = this.problem.submitUrl || `https://${new URL(this.problem.url).hostname}/problemset/submit`;
    window.location.href = targetUrl;
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

    // Load suggestions preference
    if (prefs.editorSuggestions !== undefined) {
      this.suggestionsEnabled = prefs.editorSuggestions;
      if (!this.suggestionsEnabled) {
        this.suggestionsBtn.className = 'lf-btn lf-btn-suggestions inactive';
        this.suggestionsBtn.textContent = '💤 Suggestions: OFF';
      }
    }

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

    // Recreate editor with correct language mode and code
    this.initCodeMirror(code);
  }

  private async saveCurrentCode(): Promise<void> {
    const key = this.getCodeStorageKey(this.currentLanguage);
    const code = this.getCode();
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
    this.trie = createTrieForLanguage(newLang);
    await this.loadCodeForCurrentLanguage();
  }

  private resetTemplate(): void {
    if (confirm(`Reset ${SUPPORTED_LANGUAGES[this.currentLanguage]?.name} code to default template?`)) {
      this.setCode(SUPPORTED_LANGUAGES[this.currentLanguage]?.defaultCode || '');
      this.saveCurrentCode();
    }
  }

  private scheduleAutoSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentCode();
    }, 400);
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

      // Responsive 2 or 3-column grid for Input, Your Output, Expected Output
      const grid = createElement('div', { className: 'lf-console-grid' });

      // 1. Input Block
      const inputBlock = createElement('div', { className: 'lf-console-io-block' });
      const inputTitle = createElement('div', { className: 'lf-console-io-title' }, '📥 Input');
      const inputPre = createElement('pre', { className: 'lf-console-pre' }, activeExample.input);
      inputBlock.appendChild(inputTitle);
      inputBlock.appendChild(inputPre);
      grid.appendChild(inputBlock);

      // Check if test has been run
      const testResult = this.testResults.get(this.activeExampleIndex);

      // 2. Your Output Block (always shown if test has run!)
      if (testResult) {
        const actualBlock = createElement('div', { className: 'lf-console-io-block' });
        const actualTitle = createElement('div', { className: 'lf-console-io-title' }, '📤 Your Output');
        
        let outputText = testResult.programOutput || '';
        let isOutputEmpty = false;

        if (outputText.trim().length === 0) {
          isOutputEmpty = true;
          if (testResult.status === 'compile_error') {
            outputText = '<compilation failed>';
          } else if (testResult.status === 'timeout') {
            outputText = '<time limit exceeded>';
          } else {
            outputText = '<no output produced>';
          }
        }

        const isAccepted = testResult.status === 'accepted';
        const actualPre = createElement('pre', {
          className: `lf-console-pre ${isAccepted ? 'output-accepted' : 'output-wrong'} ${isOutputEmpty ? 'output-empty' : ''}`
        }, outputText);

        actualBlock.appendChild(actualTitle);
        actualBlock.appendChild(actualPre);
        grid.appendChild(actualBlock);
      }

      // 3. Expected Output Block
      const outputBlock = createElement('div', { className: 'lf-console-io-block' });
      const outputTitle = createElement('div', { className: 'lf-console-io-title' }, '🎯 Expected Output');
      const outputPre = createElement('pre', { className: 'lf-console-pre' }, activeExample.output);
      outputBlock.appendChild(outputTitle);
      outputBlock.appendChild(outputPre);
      grid.appendChild(outputBlock);

      this.testcaseBody.appendChild(grid);

      // 4. Compiler Errors / Runtime Diagnostics (if any)
      if (testResult && (testResult.compilerError || testResult.programError)) {
        const errorBlock = createElement('div', { className: 'lf-console-io-block', style: 'margin-top: 6px;' });
        const errorTitle = createElement('div', { className: 'lf-console-io-title' }, '⚠️ Diagnostics / Stderr');
        const errorText = testResult.compilerError || testResult.programError || '';
        const errorPre = createElement('pre', {
          className: 'lf-console-pre output-error'
        }, errorText);
        errorBlock.appendChild(errorTitle);
        errorBlock.appendChild(errorPre);
        this.testcaseBody.appendChild(errorBlock);
      }
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
