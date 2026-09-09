import type { Problem, ProblemExample } from '../../core/models/problem';
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
  cpp17: {
    name: 'C++ (17)',
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
  cpp23: {
    name: 'C++ (23)',
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

    var t int
    if _, err := fmt.Fscan(in, &t); err != nil {
        t = 1
    }

    for i := 0; i < t; i++ {
        // Your solution here
    }
}
`
  }
};

// Language extension factory
function getLanguageExtension(lang: string): Extension {
  switch (lang) {
    case 'cpp':
    case 'cpp20':
    case 'cpp17':
    case 'cpp23':
      return cpp();
    case 'python': return python();
    case 'java': return java();
    case 'rust': return rust();
    case 'go': return go();
    default: return cpp();
  }
}

// Custom Leetfox dark theme (matches our CSS variables)
export const leetfoxDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--lf-code-bg, #141720)',
    color: 'var(--lf-text-main, #f1f5f9)',
    fontSize: '13px',
    fontFamily: 'var(--lf-font-mono, "Fira Code", "JetBrains Mono", "Cascadia Code", "SF Mono", Menlo, monospace)',
  },
  '.cm-content': {
    caretColor: 'var(--lf-accent, #6366f1)',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--lf-accent, #6366f1)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    color: 'var(--lf-accent, #6366f1)',
  },
  '.cm-gutters': {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    color: 'var(--lf-text-muted, #64748b)',
    border: 'none',
    borderRight: '1px solid var(--lf-code-border, #262b3a)',
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
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    outline: '1px solid rgba(99, 102, 241, 0.5)',
    color: 'inherit',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    outline: '1px solid rgba(245, 158, 11, 0.5)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--lf-bg-card, #202431)',
    border: '1px solid var(--lf-border, #2e3447)',
    borderRadius: '8px',
    color: 'var(--lf-text-main, #f1f5f9)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 8px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    color: 'var(--lf-text-main, #f1f5f9)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-panels': {
    backgroundColor: 'var(--lf-bg-card, #202431)',
    color: 'var(--lf-text-main, #f1f5f9)',
  },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': {
    backgroundColor: 'var(--lf-bg-surface, #181b24)',
    color: 'var(--lf-text-main, #f1f5f9)',
    border: '1px solid var(--lf-border, #2e3447)',
    borderRadius: '4px',
  },
}, { dark: true });

// Custom Leetfox light theme (high-contrast, clean, crisp)
export const leetfoxLightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--lf-code-bg, #ffffff)',
    color: 'var(--lf-text-main, #0f172a)',
    fontSize: '13px',
    fontFamily: 'var(--lf-font-mono, "Fira Code", "JetBrains Mono", "Cascadia Code", "SF Mono", Menlo, monospace)',
  },
  '.cm-content': {
    caretColor: 'var(--lf-accent, #4f46e5)',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--lf-accent, #4f46e5)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(79, 70, 229, 0.04)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    color: 'var(--lf-accent, #4f46e5)',
    fontWeight: '600',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--lf-bg-base, #f8fafc)',
    color: 'var(--lf-text-muted, #94a3b8)',
    border: 'none',
    borderRight: '1px solid var(--lf-code-border, #e2e8f0)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '32px',
    fontSize: '13px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    color: 'var(--lf-text-muted, #94a3b8)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    outline: '1px solid rgba(79, 70, 229, 0.4)',
    color: 'inherit',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    outline: '1px solid rgba(245, 158, 11, 0.5)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--lf-bg-card, #ffffff)',
    border: '1px solid var(--lf-border, #e2e8f0)',
    borderRadius: '8px',
    boxShadow: 'var(--lf-shadow-md, 0 4px 6px -1px rgba(0,0,0,0.08))',
    color: 'var(--lf-text-main, #0f172a)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 8px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    color: 'var(--lf-text-main, #0f172a)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-panels': {
    backgroundColor: 'var(--lf-bg-card, #f8fafc)',
    color: 'var(--lf-text-main, #0f172a)',
    borderBottom: '1px solid var(--lf-border, #e2e8f0)',
  },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': {
    backgroundColor: 'var(--lf-bg-surface, #ffffff)',
    color: 'var(--lf-text-main, #0f172a)',
    border: '1px solid var(--lf-border, #e2e8f0)',
    borderRadius: '4px',
  },
}, { dark: false });

// Catppuccin-inspired syntax highlight style for Dark Mode
export const leetfoxDarkHighlightStyle = HighlightStyle.define([
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

// High-contrast, rich syntax highlight style for Light Mode (WCAG AAA compliant)
export const leetfoxLightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c3aed', fontWeight: '600' },          // vivid violet
  { tag: tags.controlKeyword, color: '#7c3aed', fontWeight: '600' },
  { tag: tags.moduleKeyword, color: '#7c3aed', fontWeight: '600' },
  { tag: tags.operatorKeyword, color: '#0284c7' },                       // deep sky/cyan
  { tag: tags.operator, color: '#0284c7' },
  { tag: tags.typeName, color: '#0369a1', fontWeight: '500' },          // deep ocean/teal
  { tag: tags.className, color: '#0369a1', fontWeight: '500' },
  { tag: tags.function(tags.variableName), color: '#1d4ed8' },          // deep royal blue
  { tag: tags.definition(tags.function(tags.variableName)), color: '#1d4ed8' },
  { tag: tags.function(tags.propertyName), color: '#1d4ed8' },
  { tag: tags.variableName, color: '#0f172a' },                          // dark slate main text
  { tag: tags.propertyName, color: '#0369a1' },
  { tag: tags.bool, color: '#c2410c' },                                  // deep amber/burnt orange
  { tag: tags.number, color: '#c2410c' },
  { tag: tags.string, color: '#15803d' },                                // rich forest green
  { tag: tags.character, color: '#15803d' },
  { tag: tags.escape, color: '#be185d' },                                // deep magenta
  { tag: tags.regexp, color: '#be185d' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },          // readable slate gray
  { tag: tags.blockComment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.docComment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.meta, color: '#b91c1c', fontWeight: '500' },               // deep ruby crimson (preprocessor)
  { tag: tags.processingInstruction, color: '#b91c1c' },
  { tag: tags.macroName, color: '#b91c1c' },
  { tag: tags.annotation, color: '#92400e' },
  { tag: tags.bracket, color: '#334155' },                               // deep dark slate
  { tag: tags.paren, color: '#334155' },
  { tag: tags.squareBracket, color: '#334155' },
  { tag: tags.brace, color: '#334155' },
  { tag: tags.angleBracket, color: '#334155' },
  { tag: tags.separator, color: '#475569' },
  { tag: tags.punctuation, color: '#475569' },
  { tag: tags.self, color: '#b91c1c' },
  { tag: tags.null, color: '#c2410c' },
  { tag: tags.atom, color: '#c2410c' },
  { tag: tags.labelName, color: '#0369a1' },
  { tag: tags.namespace, color: '#0369a1' },
  { tag: tags.heading, color: '#1d4ed8', fontWeight: 'bold' },
  { tag: tags.invalid, color: '#dc2626', textDecoration: 'line-through' },
]);

export const leetfoxHighlightStyle = leetfoxDarkHighlightStyle;

export function getEditorThemeExtensions(theme: 'dark' | 'light'): Extension[] {
  return theme === 'light'
    ? [leetfoxLightTheme, syntaxHighlighting(leetfoxLightHighlightStyle)]
    : [leetfoxDarkTheme, syntaxHighlighting(leetfoxDarkHighlightStyle)];
}

export class CodeEditorPane {
  private element: HTMLElement;
  private langSelect: HTMLSelectElement;
  private editorView: EditorView | null = null;
  private cmHost: HTMLElement;
  private consoleCard?: HTMLElement;
  private consoleResizer?: HTMLElement;
  private consoleToggleBtn?: HTMLElement;
  private isConsoleCollapsed = false;
  private savedConsoleHeight = 270;
  private testcaseTabContainer: HTMLElement;
  private testcaseBody: HTMLElement;
  private consoleStatusBadge: HTMLElement;
  private activeExampleIndex = 0;
  private storage: StorageManager;
  private runner: CodeRunner;
  private currentLanguage = 'cpp';
  private saveTimeout: any = null;
  private saveTestCasesTimeout: any = null;
  private testResults: Map<number, ExecutionResult> = new Map();
  private customExamples: ProblemExample[] = [];
  private isRunning = false;

  // Trie-based Autocomplete & Theme Compartments
  private trie: CompletionTrie;
  private completionCompartment: Compartment = new Compartment();
  private currentTheme: 'dark' | 'light' = 'dark';
  private themeCompartment: Compartment = new Compartment();
  private suggestionsEnabled = true;
  private suggestionsBtn!: HTMLButtonElement;
  private submitBtn!: HTMLButtonElement;

  constructor(private problem: Problem, initialTheme?: 'dark' | 'light') {
    if (initialTheme) {
      this.currentTheme = initialTheme;
    } else if (typeof document !== 'undefined') {
      const rootTheme = document.getElementById('leetfox-app')?.dataset.lfTheme
        || document.querySelector('[data-lf-theme]')?.getAttribute('data-lf-theme');
      if (rootTheme === 'light' || rootTheme === 'dark') {
        this.currentTheme = rootTheme;
      }
    }
    this.storage = StorageManager.getInstance();
    this.runner = CodeRunner.getInstance();
    this.trie = createTrieForLanguage(this.currentLanguage);
    this.customExamples = (this.problem.examples || []).map((ex, i) => ({
      id: ex.id || i + 1,
      input: ex.input || '',
      output: ex.output || ''
    }));
    if (this.customExamples.length === 0) {
      this.customExamples.push({ id: 1, input: '', output: '' });
    }
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
    }, 'Suggestions: ON');
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
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        }
      }
    }, 'Copy');

    // Submissions button with Live Contest Anti-Cheat Guard
    let submissionsBtn: HTMLButtonElement;
    if (this.problem.isLiveContest) {
      submissionsBtn = createElement('button', {
        className: 'lf-btn lf-btn-locked',
        type: 'button',
        title: 'Submissions are disabled during active contests to comply with contest rules.',
        disabled: true
      }, 'Submissions');
    } else {
      const submissionsUrl = this.problem.mySubmissionsUrl || this.problem.submissionsUrl;
      submissionsBtn = createElement('button', {
        className: `lf-btn ${!submissionsUrl ? 'disabled' : ''}`,
        type: 'button',
        title: submissionsUrl ? 'View submissions' : 'No submissions found',
        onClick: () => {
          if (submissionsUrl) window.open(submissionsUrl, '_blank');
        }
      }, 'Submissions');
    }

    // Solutions button
    let solBtn: HTMLButtonElement;
    if (this.problem.isLiveContest) {
      solBtn = createElement('button', {
        className: 'lf-btn lf-btn-locked',
        type: 'button',
        title: 'Solutions & Editorial are hidden during active contests to comply with contest rules.',
        disabled: true
      }, 'Solutions');
    } else {
      const solUrl = this.problem.editorialUrl || this.problem.solutionsUrl;
      solBtn = createElement('button', {
        className: `lf-btn ${!solUrl ? 'disabled' : ''}`,
        type: 'button',
        title: solUrl ? 'View problem solutions, editorial, or accepted submissions' : 'No public solutions found',
        onClick: () => {
          if (solUrl) window.open(solUrl, '_blank');
        }
      }, 'Solutions');
    }

    // Run Code Button (LeetCode-style)
    const runBtn = createElement('button', {
      className: 'lf-btn lf-btn-run',
      type: 'button',
      title: 'Run code against example testcases',
      onClick: () => this.runTestcases(runBtn)
    }, 'Run');

    // Submit Button
    const submitBtn = createElement('button', {
      className: 'lf-btn lf-btn-primary',
      type: 'button',
      title: 'Submit solution on platform',
      onClick: () => this.handleSubmission(submitBtn)
    }, 'Submit');
    this.submitBtn = submitBtn;

    rightTools.appendChild(resetBtn);
    rightTools.appendChild(copyBtn);
    rightTools.appendChild(submissionsBtn);
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
    this.consoleCard = consoleCard;

    const consoleResizer = createElement('div', {
      className: 'lf-resizer-horizontal',
      title: 'Drag to adjust console height (Double-click to reset)'
    });
    this.consoleResizer = consoleResizer;
    this.setupConsoleResizer(consoleResizer, consoleCard);

    const consoleHeader = createElement('div', { className: 'lf-console-header' });

    const titleGroup = createElement('div', { style: 'display: flex; align-items: center; gap: 8px;' });
    const consoleTitle = createElement('span', { className: 'lf-console-title' }, 'Test Cases');
    this.consoleStatusBadge = createElement('span', { className: 'lf-console-status-badge' });

    const collapseBtn = createElement('button', {
      className: 'lf-btn-console-toggle',
      type: 'button',
      title: 'Collapse / Expand test cases console',
      onClick: () => this.toggleConsoleCollapse()
    }, '▾');
    this.consoleToggleBtn = collapseBtn;

    titleGroup.appendChild(consoleTitle);
    titleGroup.appendChild(this.consoleStatusBadge);
    titleGroup.appendChild(collapseBtn);

    const tabsWrapper = createElement('div', { className: 'lf-console-tabs-wrapper' });
    this.testcaseTabContainer = createElement('div', { className: 'lf-console-tabs' });

    const runAllBtn = createElement('button', {
      className: 'lf-btn-run-all',
      type: 'button',
      title: 'Run code against all test cases in sequence',
      onClick: () => this.runAllTestcases(runAllBtn)
    }, 'Run All');

    tabsWrapper.appendChild(this.testcaseTabContainer);
    tabsWrapper.appendChild(runAllBtn);

    consoleHeader.appendChild(titleGroup);
    consoleHeader.appendChild(tabsWrapper);
    consoleCard.appendChild(consoleHeader);

    this.testcaseBody = createElement('div', { className: 'lf-console-body' });
    consoleCard.appendChild(this.testcaseBody);

    this.element.appendChild(consoleResizer);
    this.element.appendChild(consoleCard);

    // Initialize CodeMirror with default language
    this.initCodeMirror(SUPPORTED_LANGUAGES[this.currentLanguage]?.defaultCode || '');

    // Load preferred language and saved code asynchronously
    this.initLanguageAndCode();
    this.loadCustomTestCases();
    this.renderTestcaseTabs();
  }

  private initCodeMirror(initialCode: string): void {
    // If an editor already exists, destroy it safely
    if (this.editorView) {
      try { this.editorView.destroy(); } catch (_) { /* JSDOM compat */ }
      this.editorView = null;
    }
    this.cmHost.innerHTML = '';
    this.completionCompartment = new Compartment();
    this.themeCompartment = new Compartment();

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
        {
          key: 'Mod-Enter',
          run: () => {
            if (this.submitBtn && !this.submitBtn.disabled) {
              this.handleSubmission(this.submitBtn);
              return true;
            }
            return false;
          }
        },
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

      // Dynamic theme & high-contrast syntax highlighting compartment
      this.themeCompartment.of(getEditorThemeExtensions(this.currentTheme)),

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
   * Switch editor theme dynamically between dark and light mode
   */
  public setTheme(theme: 'dark' | 'light'): void {
    if (this.currentTheme === theme && this.editorView) return;
    this.currentTheme = theme;
    if (this.editorView) {
      this.editorView.dispatch({
        effects: this.themeCompartment.reconfigure(getEditorThemeExtensions(theme))
      });
    }
  }

  /**
   * Get current editor theme
   */
  public getTheme(): 'dark' | 'light' {
    return this.currentTheme;
  }

  /**
   * Toggle Trie-based autocompletion on/off dynamically
   */
  public toggleSuggestions(): void {
    this.suggestionsEnabled = !this.suggestionsEnabled;

    if (this.suggestionsEnabled) {
      this.suggestionsBtn.className = 'lf-btn lf-btn-suggestions active';
      this.suggestionsBtn.textContent = 'Suggestions: ON';
    } else {
      this.suggestionsBtn.className = 'lf-btn lf-btn-suggestions inactive';
      this.suggestionsBtn.textContent = 'Suggestions: OFF';
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
      const errRes: ExecutionResult = {
        status: 'error',
        errorCategory: 'validation',
        programOutput: '',
        programError: 'Source code is empty.',
        diagnosticHints: [
          'Please write your solution code in the editor before running tests.',
          'Choose your preferred language from the selector bar.'
        ]
      };
      this.consoleStatusBadge.className = 'lf-console-status-badge error';
      this.consoleStatusBadge.textContent = 'Code is empty';
      this.testResults.set(this.activeExampleIndex, errRes);
      this.renderTestcaseTabs();
      return;
    }

    if (this.customExamples.length === 0) {
      const errRes: ExecutionResult = {
        status: 'error',
        errorCategory: 'validation',
        programOutput: '',
        programError: 'No test cases available. Click "+ Add Case" to create one.',
        diagnosticHints: ['Click "+ Add Case" to enter your test case input.']
      };
      this.consoleStatusBadge.className = 'lf-console-status-badge error';
      this.consoleStatusBadge.textContent = 'No testcases';
      this.testResults.set(this.activeExampleIndex, errRes);
      this.renderTestcaseTabs();
      return;
    }

    if (this.isConsoleCollapsed) {
      this.toggleConsoleCollapse();
    }

    this.isRunning = true;
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';
    this.consoleStatusBadge.className = 'lf-console-status-badge running';
    this.consoleStatusBadge.textContent = `Running Case ${this.activeExampleIndex + 1}...`;

    try {
      // Run the currently active testcase with its edited input and output
      const currentEx = this.customExamples[this.activeExampleIndex] || this.customExamples[0];
      const result = await this.runner.runTestcase(
        this.currentLanguage,
        code,
        currentEx.input,
        currentEx.output
      );

      this.testResults.set(this.activeExampleIndex, result);
      this.updateStatusBadge(result);
      this.renderTestcaseTabs();

      // Ensure console body is reset to top and visible in view
      if (this.testcaseBody) {
        this.testcaseBody.scrollTop = 0;
      }
      if (this.consoleCard) {
        this.consoleCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err: any) {
      const errorResult: ExecutionResult = {
        status: 'error',
        errorCategory: 'server',
        programOutput: '',
        programError: err?.message || 'Unexpected error occurred while running tests.',
        diagnosticHints: [
          'Check your internet connection.',
          'The execution server might be temporarily unreachable.'
        ]
      };
      this.testResults.set(this.activeExampleIndex, errorResult);
      this.updateStatusBadge(errorResult);
      this.renderTestcaseTabs();
      if (this.testcaseBody) {
        this.testcaseBody.scrollTop = 0;
      }
      if (this.consoleCard) {
        this.consoleCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } finally {
      this.isRunning = false;
      runBtn.disabled = false;
      runBtn.textContent = 'Run';
    }
  }

  public async runAllTestcases(runAllBtn: HTMLButtonElement): Promise<void> {
    if (this.isRunning) return;
    const code = this.getCode().trim();
    if (!code) {
      this.consoleStatusBadge.className = 'lf-console-status-badge error';
      this.consoleStatusBadge.textContent = 'Code is empty';
      return;
    }

    if (this.customExamples.length === 0) return;

    if (this.isConsoleCollapsed) {
      this.toggleConsoleCollapse();
    }

    this.isRunning = true;
    runAllBtn.disabled = true;
    runAllBtn.textContent = 'Running All...';

    let firstFailedIndex = -1;

    try {
      for (let i = 0; i < this.customExamples.length; i++) {
        this.consoleStatusBadge.className = 'lf-console-status-badge running';
        this.consoleStatusBadge.textContent = `Running ${i + 1} of ${this.customExamples.length}...`;
        const ex = this.customExamples[i];
        const res = await this.runner.runTestcase(
          this.currentLanguage,
          code,
          ex.input,
          ex.output
        );
        this.testResults.set(i, res);
        this.renderTestcaseTabs();

        if (res.status !== 'accepted' && firstFailedIndex === -1) {
          firstFailedIndex = i;
        }
      }

      if (firstFailedIndex !== -1) {
        this.activeExampleIndex = firstFailedIndex;
      }
      const activeRes = this.testResults.get(this.activeExampleIndex);
      if (activeRes) {
        this.updateStatusBadge(activeRes);
      }
      this.renderTestcaseTabs();
    } catch (err: any) {
      this.consoleStatusBadge.className = 'lf-console-status-badge error';
      this.consoleStatusBadge.textContent = 'Run Failed';
    } finally {
      this.isRunning = false;
      runAllBtn.disabled = false;
      runAllBtn.textContent = 'Run All';
    }
  }

  private updateStatusBadge(result: ExecutionResult): void {
    const timeStr = result.executionTimeMs !== undefined ? ` (${result.executionTimeMs}ms)` : '';
    if (result.status === 'accepted') {
      this.consoleStatusBadge.className = 'lf-console-status-badge accepted';
      this.consoleStatusBadge.textContent = `Accepted${timeStr}`;
    } else if (result.status === 'wrong_answer') {
      this.consoleStatusBadge.className = 'lf-console-status-badge wrong-answer';
      this.consoleStatusBadge.textContent = `Wrong Answer${timeStr}`;
    } else if (result.status === 'compile_error') {
      this.consoleStatusBadge.className = 'lf-console-status-badge compile-error';
      this.consoleStatusBadge.textContent = `Compilation Error${timeStr}`;
    } else if (result.status === 'runtime_error') {
      this.consoleStatusBadge.className = 'lf-console-status-badge runtime-error';
      this.consoleStatusBadge.textContent = `Runtime Error${timeStr}`;
    } else if (result.status === 'timeout') {
      this.consoleStatusBadge.className = 'lf-console-status-badge timeout';
      this.consoleStatusBadge.textContent = 'Time Limit Exceeded';
    } else if (result.errorCategory === 'network') {
      this.consoleStatusBadge.className = 'lf-console-status-badge network-error';
      this.consoleStatusBadge.textContent = 'Network Error';
    } else if (result.errorCategory === 'rate_limit') {
      this.consoleStatusBadge.className = 'lf-console-status-badge rate-limit';
      this.consoleStatusBadge.textContent = 'Rate Limited';
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

    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    if (this.problem.platform === 'cses') {
      submitBtn.textContent = 'Sending file to CSES...';
      const res = await subManager.submitCSESDirect(this.problem.id, this.getCode(), this.currentLanguage);
      if (res.success && res.resultUrl) {
        submitBtn.textContent = 'Submitted!';
        if (typeof window !== 'undefined' && window.open) {
          window.open(res.resultUrl, '_blank');
        }
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
        }, 1500);
        return;
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';

        // Check if user is not logged in
        if (res.error && res.error.includes('logged in')) {
          this.showNotLoggedInModal('CSES', 'https://cses.fi/login');
          return;
        }

        // Show the actual error message from CSES
        alert(`CSES Submission Error:\n\n${res.error || 'Failed to submit solution.'}\n\nPlease check your login status and try again.`);
      }
      return;
    }

    if (this.problem.platform === 'codeforces') {
      if (!subManager.isUserLoggedInOnCodeforces(document)) {
        this.showNotLoggedInModal('Codeforces', 'https://codeforces.com/enter');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
        return;
      }
    }

    // Codeforces / other platforms flow: Open submit page in a new tab with solution attached
    submitBtn.textContent = 'Opening Submit Page...';
    
    let targetUrl = this.problem.submitUrl;
    if (!targetUrl && this.problem.platform === 'codeforces') {
      try {
        const parsedUrl = new URL(this.problem.url);
        const host = parsedUrl.hostname;
        const cMatch = parsedUrl.pathname.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
        if (cMatch) {
          targetUrl = `https://${host}/contest/${cMatch[1]}/submit?submittedProblemIndex=${cMatch[2]}`;
        } else {
          const gMatch = parsedUrl.pathname.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
          if (gMatch) {
            targetUrl = `https://${host}/gym/${gMatch[1]}/submit?submittedProblemIndex=${gMatch[2]}`;
          } else {
            targetUrl = `https://${host}/problemset/submit`;
          }
        }
      } catch (_) {
        targetUrl = `https://codeforces.com/problemset/submit`;
      }
    } else if (!targetUrl) {
      targetUrl = `https://${new URL(this.problem.url).hostname}/problemset/submit`;
    }

    const newTab = typeof window !== 'undefined' && window.open ? window.open(targetUrl, '_blank') : null;
    if (!newTab && typeof window !== 'undefined') {
      window.location.href = targetUrl;
      return;
    }

    submitBtn.textContent = 'Opened in New Tab!';
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }, 1500);
  }

  private showNotLoggedInModal(platformName: string = 'CSES', loginUrl: string = 'https://cses.fi/login'): void {
    const existing = document.getElementById('lf-auth-warning-modal');
    if (existing) existing.remove();

    const overlay = createElement('div', {
      id: 'lf-auth-warning-modal',
      className: 'lf-auth-modal-overlay'
    });

    const modal = createElement('div', { className: 'lf-auth-modal' });

    const title = createElement('h3', {}, `Log In to ${platformName} Required`);
    const msg = createElement('p', {}, `You must be logged into your ${platformName} account to submit code.`);
    const hint = createElement('p', { style: 'font-size: 13px; color: var(--lf-text-muted);' }, `Click below to open the ${platformName} login page. Once logged in, return here and click "Submit" to send your solution instantly.`);

    const btnRow = createElement('div', { className: 'lf-auth-modal-actions' });
    const loginLink = createElement('a', {
      className: 'lf-btn lf-btn-primary',
      href: loginUrl,
      target: '_blank',
      onClick: () => { overlay.remove(); }
    }, `Log In to ${platformName}`);

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
        this.suggestionsBtn.textContent = 'Suggestions: OFF';
      }
    }

    // Load console height preference
    if (prefs.consoleHeightPx && this.consoleCard) {
      this.savedConsoleHeight = prefs.consoleHeightPx;
      this.consoleCard.style.height = `${prefs.consoleHeightPx}px`;
      this.consoleCard.style.maxHeight = 'none';
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

  private async loadCustomTestCases(): Promise<void> {
    try {
      const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
      const key = `custom_testcases:${this.problem.platform}:${this.problem.id}`;
      let saved: ProblemExample[] | null = null;
      if (storageArea) {
        const res = await (storageArea.get(key) instanceof Promise ? storageArea.get(key) : new Promise<any>(r => storageArea.get(key, r)));
        if (res && Array.isArray(res[key]) && res[key].length > 0) {
          saved = res[key];
        }
      }
      if (!saved && typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) saved = parsed;
        }
      }
      if (saved && saved.length > 0) {
        this.customExamples = saved;
        if (this.activeExampleIndex >= this.customExamples.length) {
          this.activeExampleIndex = 0;
        }
        this.renderTestcaseTabs();
      }
    } catch (_) {}
  }

  private saveCustomTestCasesDebounced(): void {
    if (this.saveTestCasesTimeout) clearTimeout(this.saveTestCasesTimeout);
    this.saveTestCasesTimeout = setTimeout(() => {
      try {
        const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
        const key = `custom_testcases:${this.problem.platform}:${this.problem.id}`;
        if (storageArea) {
          storageArea.set({ [key]: this.customExamples });
        }
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, JSON.stringify(this.customExamples));
        }
      } catch (_) {}
    }, 300);
  }

  public isCustomExamplesModified(): boolean {
    const original = this.problem.examples || [];
    if (this.customExamples.length !== original.length) return true;
    for (let i = 0; i < original.length; i++) {
      if (this.customExamples[i].input !== original[i].input || this.customExamples[i].output !== original[i].output) {
        return true;
      }
    }
    return false;
  }

  public addNewTestCase(initialInput: string = '', initialOutput: string = ''): void {
    const newId = this.customExamples.length + 1;
    this.customExamples.push({
      id: newId,
      input: initialInput,
      output: initialOutput
    });
    this.activeExampleIndex = this.customExamples.length - 1;
    this.saveCustomTestCasesDebounced();
    this.updateStatusBadgeForActive();
    this.renderTestcaseTabs();

    setTimeout(() => {
      const ta = this.testcaseBody.querySelector('.lf-console-textarea') as HTMLTextAreaElement;
      if (ta) ta.focus();
    }, 50);
  }

  public removeTestCase(index: number): void {
    if (this.customExamples.length <= 1) {
      if (this.customExamples[0]) {
        this.customExamples[0].input = '';
        this.customExamples[0].output = '';
      }
      this.testResults.clear();
      this.saveCustomTestCasesDebounced();
      this.updateStatusBadgeForActive();
      this.renderTestcaseTabs();
      return;
    }
    this.customExamples.splice(index, 1);
    this.testResults.delete(index);

    const reindexed = new Map<number, ExecutionResult>();
    let targetIdx = 0;
    for (let i = 0; i <= this.customExamples.length; i++) {
      if (i === index) continue;
      const r = this.testResults.get(i);
      if (r) reindexed.set(targetIdx, r);
      targetIdx++;
    }
    this.testResults = reindexed;

    this.activeExampleIndex = Math.max(0, Math.min(this.activeExampleIndex, this.customExamples.length - 1));
    this.saveCustomTestCasesDebounced();
    this.updateStatusBadgeForActive();
    this.renderTestcaseTabs();
  }

  public resetToDefaultTestCases(): void {
    this.customExamples = (this.problem.examples || []).map((ex, i) => ({
      id: ex.id || i + 1,
      input: ex.input || '',
      output: ex.output || ''
    }));
    if (this.customExamples.length === 0) {
      this.customExamples.push({ id: 1, input: '', output: '' });
    }
    this.testResults.clear();
    this.activeExampleIndex = 0;
    this.saveCustomTestCasesDebounced();
    this.updateStatusBadgeForActive();
    this.renderTestcaseTabs();
  }

  private updateStatusBadgeForActive(): void {
    const res = this.testResults.get(this.activeExampleIndex);
    if (res) {
      this.updateStatusBadge(res);
    } else {
      this.consoleStatusBadge.className = 'lf-console-status-badge';
      this.consoleStatusBadge.textContent = '';
    }
  }

  public getCustomExamples(): ProblemExample[] {
    return this.customExamples;
  }

  private renderTestcaseTabs(): void {
    this.testcaseTabContainer.innerHTML = '';

    if (this.customExamples.length === 0) {
      this.testcaseTabContainer.textContent = 'No testcases';
      this.testcaseBody.innerHTML = '';
      const emptyMsg = createElement('div', { style: 'padding: 10px; color: var(--lf-text-muted); font-size: 13px;' }, 'No test cases defined.');
      const addFirstBtn = createElement('button', {
        className: 'lf-console-tab lf-btn-add-case',
        type: 'button',
        onClick: () => this.addNewTestCase()
      }, '+ Add Case');
      emptyMsg.appendChild(addFirstBtn);
      this.testcaseBody.appendChild(emptyMsg);
      return;
    }

    this.customExamples.forEach((_, idx) => {
      const res = this.testResults.get(idx);
      let statusIcon = '';
      if (res) {
        statusIcon = res.status === 'accepted' ? ' ✓' : ' ✕';
      }

      const tab = createElement('button', {
        className: `lf-console-tab ${idx === this.activeExampleIndex ? 'active' : ''} ${res ? res.status : ''}`,
        type: 'button',
        title: `Test Case ${idx + 1}`,
        onClick: () => {
          this.activeExampleIndex = idx;
          this.updateStatusBadgeForActive();
          this.renderTestcaseTabs();
        }
      });

      const tabLabel = createElement('span', { className: 'lf-console-tab-label' }, `Case ${idx + 1}${statusIcon}`);
      tab.appendChild(tabLabel);

      if (this.customExamples.length > 1) {
        const removeTabBtn = createElement('span', {
          className: 'lf-console-tab-close',
          title: `Remove Case ${idx + 1}`,
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            this.removeTestCase(idx);
          }
        }, '×');
        tab.appendChild(removeTabBtn);
      }

      this.testcaseTabContainer.appendChild(tab);
    });

    const addCaseBtn = createElement('button', {
      className: 'lf-console-tab lf-btn-add-case',
      type: 'button',
      title: 'Add a new test case',
      onClick: () => this.addNewTestCase()
    }, '+ Add Case');
    this.testcaseTabContainer.appendChild(addCaseBtn);

    const activeExample = this.customExamples[this.activeExampleIndex];
    if (activeExample) {
      this.testcaseBody.innerHTML = '';

      // Sub-toolbar for current case
      const caseToolbar = createElement('div', { className: 'lf-console-case-toolbar' });
      const caseLabel = createElement('span', { className: 'lf-console-case-label' }, `Case ${this.activeExampleIndex + 1} of ${this.customExamples.length}`);

      const caseActions = createElement('div', { className: 'lf-console-case-actions' });

      const copyInputBtn = createElement('button', {
        className: 'lf-console-action-btn',
        type: 'button',
        title: 'Copy input to clipboard',
        onClick: async () => {
          await copyToClipboard(activeExample.input);
          copyInputBtn.textContent = 'Copied!';
          setTimeout(() => { copyInputBtn.textContent = 'Copy Input'; }, 1500);
        }
      }, 'Copy Input');
      caseActions.appendChild(copyInputBtn);

      if (this.customExamples.length > 1) {
        const deleteBtn = createElement('button', {
          className: 'lf-console-action-btn lf-btn-delete delete',
          type: 'button',
          title: 'Delete this test case',
          onClick: () => this.removeTestCase(this.activeExampleIndex)
        }, 'Delete Case');
        caseActions.appendChild(deleteBtn);
      } else {
        const clearBtn = createElement('button', {
          className: 'lf-console-action-btn lf-btn-clear',
          type: 'button',
          title: 'Clear input and expected output for this case',
          onClick: () => this.removeTestCase(0)
        }, 'Clear Case');
        caseActions.appendChild(clearBtn);
      }

      if (this.isCustomExamplesModified()) {
        const resetBtn = createElement('button', {
          className: 'lf-console-action-btn lf-btn-reset reset',
          type: 'button',
          title: 'Reset test cases to original problem defaults',
          onClick: () => this.resetToDefaultTestCases()
        }, 'Reset Cases');
        caseActions.appendChild(resetBtn);
      }

      caseToolbar.appendChild(caseLabel);
      caseToolbar.appendChild(caseActions);
      this.testcaseBody.appendChild(caseToolbar);

      // Responsive 2 or 3-column grid for Input, Your Output, Expected Output
      const grid = createElement('div', { className: 'lf-console-grid' });

      // 1. Input Block (Editable Textarea)
      const inputBlock = createElement('div', { className: 'lf-console-io-block' });
      const inputTitle = createElement('div', { className: 'lf-console-io-title' }, 'Input');
      const inputTextarea = createElement('textarea', {
        className: 'lf-console-textarea',
        spellcheck: 'false',
        placeholder: 'Enter test case input...'
      }) as HTMLTextAreaElement;
      inputTextarea.value = activeExample.input;
      inputTextarea.textContent = activeExample.input;
      inputTextarea.addEventListener('input', () => {
        activeExample.input = inputTextarea.value;
        inputTextarea.textContent = inputTextarea.value;
        this.testResults.delete(this.activeExampleIndex);
        this.saveCustomTestCasesDebounced();
        this.updateStatusBadgeForActive();
      });
      inputBlock.appendChild(inputTitle);
      inputBlock.appendChild(inputTextarea);
      grid.appendChild(inputBlock);

      // Check if test has been run
      const testResult = this.testResults.get(this.activeExampleIndex);

      // 2. Your Output Block (always shown if test has run!)
      if (testResult) {
        const actualBlock = createElement('div', { className: 'lf-console-io-block' });
        const actualTitle = createElement('div', { className: 'lf-console-io-title' }, 'Your Output');
        
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

      // 3. Expected Output Block (Editable Textarea)
      const outputBlock = createElement('div', { className: 'lf-console-io-block' });
      const outputTitle = createElement('div', { className: 'lf-console-io-title' }, 'Expected Output');
      const outputTextarea = createElement('textarea', {
        className: 'lf-console-textarea',
        spellcheck: 'false',
        placeholder: 'Expected output (optional)...'
      }) as HTMLTextAreaElement;
      outputTextarea.value = activeExample.output || '';
      outputTextarea.textContent = activeExample.output || '';
      outputTextarea.addEventListener('input', () => {
        activeExample.output = outputTextarea.value;
        outputTextarea.textContent = outputTextarea.value;
        this.testResults.delete(this.activeExampleIndex);
        this.saveCustomTestCasesDebounced();
        this.updateStatusBadgeForActive();
      });
      outputBlock.appendChild(outputTitle);
      outputBlock.appendChild(outputTextarea);
      grid.appendChild(outputBlock);

      this.testcaseBody.appendChild(grid);

      // 4. Compiler Errors / Runtime Diagnostics (if any)
      if (testResult && (testResult.compilerError || testResult.programError)) {
        const errorBlock = createElement('div', { className: 'lf-console-io-block', style: 'margin-top: 6px;' });
        const titleText = testResult.status === 'compile_error'
          ? 'Compiler Diagnostics'
          : testResult.status === 'runtime_error'
          ? 'Runtime Diagnostics (Stderr)'
          : testResult.status === 'timeout'
          ? 'Execution Timeout'
          : 'Error Diagnostics';
        const errorTitle = createElement('div', { className: 'lf-console-io-title' }, titleText);
        const errorText = testResult.compilerError || testResult.programError || '';
        const errorPre = createElement('pre', {
          className: 'lf-console-pre output-error'
        }, errorText);
        errorBlock.appendChild(errorTitle);
        errorBlock.appendChild(errorPre);
        this.testcaseBody.appendChild(errorBlock);
      }

      // 5. Intelligent Diagnostic Hints & Tips
      if (testResult && testResult.diagnosticHints && testResult.diagnosticHints.length > 0) {
        const hintsCard = createElement('div', { className: 'lf-console-hints-card' });
        const hintsHeader = createElement('div', { className: 'lf-console-hints-title' }, 'Diagnostic Hints & Troubleshooting');
        const hintsList = createElement('ul', { className: 'lf-console-hints-list' });

        testResult.diagnosticHints.forEach(hint => {
          const li = createElement('li', {}, hint);
          hintsList.appendChild(li);
        });

        hintsCard.appendChild(hintsHeader);
        hintsCard.appendChild(hintsList);

        // Quick Retry Button if error or timeout
        if (testResult.status !== 'accepted') {
          const retryBtn = createElement('button', {
            className: 'lf-btn-retry-run',
            type: 'button',
            onClick: () => {
              const runBtn = this.element.querySelector('.lf-btn-run') as HTMLButtonElement;
              if (runBtn) this.runTestcases(runBtn);
            }
          }, 'Retry Run');
          hintsCard.appendChild(retryBtn);
        }

        this.testcaseBody.appendChild(hintsCard);
      }
    }
  }

  private toggleConsoleCollapse(): void {
    if (!this.consoleCard) return;
    this.isConsoleCollapsed = !this.isConsoleCollapsed;
    if (this.isConsoleCollapsed) {
      this.savedConsoleHeight = parseInt(this.consoleCard.style.height || '270', 10) || 270;
      this.consoleCard.classList.add('collapsed');
      this.consoleCard.style.setProperty('height', '38px', 'important');
      if (this.consoleToggleBtn) this.consoleToggleBtn.textContent = '▴';
      if (this.consoleResizer) this.consoleResizer.style.display = 'none';
    } else {
      this.consoleCard.classList.remove('collapsed');
      this.consoleCard.style.setProperty('height', `${this.savedConsoleHeight}px`, 'important');
      this.consoleCard.style.setProperty('max-height', 'none', 'important');
      if (this.consoleToggleBtn) this.consoleToggleBtn.textContent = '▾';
      if (this.consoleResizer) this.consoleResizer.style.display = 'flex';
    }
    window.dispatchEvent(new Event('resize'));
  }

  private setupConsoleResizer(resizer: HTMLElement, card: HTMLElement): void {
    let isDragging = false;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      document.body.classList.add('lf-resizing-v');
      card.style.setProperty('transition', 'none', 'important');

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging) return;
        const paneRect = this.element.getBoundingClientRect();
        if (paneRect.height <= 0) return;
        let heightPx = paneRect.bottom - moveEvent.clientY;
        const minHeight = 80;
        const maxHeight = Math.max(minHeight, paneRect.height - 140);
        heightPx = Math.max(minHeight, Math.min(maxHeight, heightPx));

        card.style.setProperty('height', `${heightPx}px`, 'important');
        card.style.setProperty('max-height', 'none', 'important');
        this.savedConsoleHeight = Math.round(heightPx);
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.classList.remove('lf-resizing-v');
        card.style.removeProperty('transition');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        const currentHeight = parseInt(card.style.height, 10);
        if (!isNaN(currentHeight)) {
          this.storage.savePreferences({ consoleHeightPx: currentHeight });
        }
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    resizer.addEventListener('mousedown', onMouseDown);

    // Double-click to reset to default 270px
    resizer.addEventListener('dblclick', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      card.style.setProperty('height', '270px', 'important');
      card.style.setProperty('max-height', 'none', 'important');
      this.savedConsoleHeight = 270;
      this.storage.savePreferences({ consoleHeightPx: 270 });
      window.dispatchEvent(new Event('resize'));
    });

    // Touch support for tablets and touch displays
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isDragging = true;
      document.body.classList.add('lf-resizing-v');
      card.style.setProperty('transition', 'none', 'important');

      const onTouchMove = (moveEvent: TouchEvent) => {
        if (!isDragging || moveEvent.touches.length !== 1) return;
        const paneRect = this.element.getBoundingClientRect();
        if (paneRect.height <= 0) return;
        let heightPx = paneRect.bottom - moveEvent.touches[0].clientY;
        const minHeight = 80;
        const maxHeight = Math.max(minHeight, paneRect.height - 140);
        heightPx = Math.max(minHeight, Math.min(maxHeight, heightPx));
        card.style.setProperty('height', `${heightPx}px`, 'important');
        card.style.setProperty('max-height', 'none', 'important');
        this.savedConsoleHeight = Math.round(heightPx);
      };

      const onTouchEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.classList.remove('lf-resizing-v');
        card.style.removeProperty('transition');
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);

        const currentHeight = parseInt(card.style.height, 10);
        if (!isNaN(currentHeight)) {
          this.storage.savePreferences({ consoleHeightPx: currentHeight });
        }
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    };

    resizer.addEventListener('touchstart', onTouchStart, { passive: true });
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
