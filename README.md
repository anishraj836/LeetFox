# Leetfox

> Modern, fast, and keyboard-driven competitive programming browser extension for Firefox.

Leetfox transforms competitive programming platforms (Codeforces and CSES) into a unified, distraction-free, professional developer workspace. Instead of fragmented page layouts, mismatched styling, and manual copy-pasting, Leetfox delivers a cohesive IDE-grade interface directly inside Firefox—featuring an integrated CodeMirror 6 editor, multi-language test runner, custom test case manager, intelligent autocompletion, persistent notes, and automated submission pipelines.

Repository: [https://github.com/anishraj836/Leetfox](https://github.com/anishraj836/Leetfox)

---

## Key Features

### Integrated CodeMirror 6 Editor
- Multi-language syntax highlighting and language support for C++, Python, Java, Rust, and Go.
- Code folding, line numbers, active line highlighting, and automatic bracket closing.
- Customizable font size and responsive typography tuned for readability in both dark and light modes.
- Code auto-saved per problem and per language in local storage.

### Interactive Test Runner & Console Grid
- One-click execution of sample tests with parallel comparison grid:
  - Input
  - Your Output (with distinct empty state indicator when no output is produced)
  - Expected Output
  - Diagnostics and Stderr with exit code reporting
- Add, edit, run, and remove custom test cases on the fly.
- Visual execution status indicators (Passed, Failed, Running, Error).

### Trie-Based Autocomplete Engine
- Client-side Prefix Trie containing common Competitive Programming standard library symbols, algorithms, containers, and boilerplate snippets.
- Real-time token indexing of user-defined functions and variable names within the editor.
- Configurable autocompletion toggle with persisted preferences.

### Automated Submission Pipeline
- One-click submission from the editor tab:
  - Automatic language and compiler standard matching (e.g., C++20, C++17, Python 3, PyPy, Java, Rust, Go).
  - Background handoff with auto-submit countdown banner and one-click Cancel / Submit Now controls.
  - Same-origin authentication verification and robust form submission handling across Codeforces, CSES, and AtCoder.

### Keyboard-First Navigation
- Full keyboard workflow designed for speed:
  - J / K — Navigate to Next / Previous problem in contest or category order.
  - B — Toggle problem bookmark status.
  - N — Open / close slide-out scratchpad notes (auto-saved per problem).
  - D — Toggle Dark / Light theme.
  - O — Instantly switch between Leetfox view and the original platform page.
  - Ctrl + Enter / Cmd + Enter — Run all test cases in the editor.
  - Ctrl + Alt + Enter — Submit current code to platform.
  - Ctrl + K / Cmd + K — Open the command palette with fuzzy action search.
  - ? — Open keyboard shortcuts cheat sheet.
  - Context-aware typing guards prevent shortcuts from firing while typing in the editor, inputs, or textareas.

### Resizable Split-Screen Workspace
- Draggable divider between problem statement and code editor.
- Persistent split ratio saved in browser storage.
- Double-click divider to reset to default 50/50 balance.

### Local-First and Privacy-Preserving
- Zero telemetry, zero external trackers, and no external user accounts.
- All code drafts, notes, bookmarks, settings, and test cases remain private inside your browser storage.

---

## Architecture

```text
                        Firefox WebExtension
                                  │
                          Platform Detection
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
            CodeforcesAdapter              CSESAdapter
         (DOM selectors & parsing)   (DOM selectors & parsing)
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                           Normalized Models
                      (Problem, Limits, Examples)
                                  │
                                  ▼
                           Shared UI System
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        Problem Header       Statement View     Code Editor Pane
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  ▼
                            Feature Layer
        ┌───────────────────┬───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼
   CodeRunner        CompletionTrie     SubmissionManager    StorageManager
  (Test execution)   (Autocomplete)    (Pipeline automation) (Local storage)
```

### Modular Platform Adapter Interface

Adding new platforms (such as AtCoder) requires implementing the PlatformAdapter interface without modifying UI components:

```typescript
import { PlatformAdapter } from "./core/platform/PlatformAdapter";
import { Problem } from "./core/models/problem";

export class CustomAdapter implements PlatformAdapter {
  readonly platformId = "custom";
  readonly name = "Custom Platform";

  matches(url: URL): boolean {
    return url.hostname.includes("example.com");
  }

  isProblemPage(url: URL, doc?: Document): boolean {
    return url.pathname.includes("/problem/");
  }

  parseProblem(doc: Document, url: URL): Problem | null {
    // Extract metadata, statement HTML, input/output limits, sample test cases
  }

  getOriginalContainer(doc: Document): HTMLElement | null {
    return doc.getElementById("main-content");
  }
}
```

---

## Directory Structure

```text
Leetfox/
├── public/
│   ├── manifest.json            # Firefox WebExtension Manifest V3
│   └── icons/                   # 16x16, 48x48, 128x128 extension icons
├── src/
│   ├── background/
│   │   └── index.ts             # Background script for cross-context tasks
│   ├── content/
│   │   ├── index.ts             # Content script bootstrap and observer
│   │   └── styles/
│   │       └── leetfox.css      # Design system, CSS variables, dark/light themes
│   ├── core/
│   │   ├── editor/
│   │   │   └── CompletionTrie.ts# Fast prefix trie for CP autocomplete
│   │   ├── models/              # Problem, State, and Preferences models
│   │   ├── platform/            # PlatformAdapter interface and PlatformRegistry
│   │   ├── runner/              # Code execution engine and output parser
│   │   ├── storage/             # StorageManager (browser.storage.local wrapper)
│   │   ├── submission/          # SubmissionManager for Codeforces and CSES
│   │   ├── keyboard/            # KeyboardManager and shortcut registry
│   │   └── utils/               # Safe DOM builders, sanitize utilities
│   ├── platforms/
│   │   ├── codeforces/          # Codeforces adapter, parser, and selectors
│   │   └── cses/                # CSES adapter, parser, and selectors
│   ├── popup/
│   │   ├── popup.html           # Toolbar popup interface
│   │   ├── popup.css
│   │   └── popup.ts
│   └── ui/
│       ├── LeetfoxApp.ts        # Main UI coordinator and split layout manager
│       └── components/          # Header, StatementView, CodeEditorPane,
│                                # ExampleCard, ConsoleOutputGrid,
│                                # NotesDrawer, CommandPalette, CheatSheet
├── tests/
│   ├── fixtures/                # Platform DOM snapshots
│   ├── app-integration.test.ts
│   ├── codeforces-parser.test.ts
│   ├── cses-parser.test.ts
│   ├── file-submission-pipeline.test.ts
│   ├── refactor-enhancements.test.ts
│   └── resizable-split-borders.test.ts
├── build.js                     # Multi-bundle build configuration
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Installation & Development

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- Mozilla Firefox (v109 or higher)

### Build Instructions

1. Clone repository and install dependencies:
   ```bash
   git clone https://github.com/anishraj836/Leetfox.git
   cd Leetfox
   npm install
   ```

2. Compile TypeScript and build extension artifacts:
   ```bash
   npm run build
   ```
   Production artifacts are generated in the `dist/` directory.

3. Run automated tests:
   ```bash
   npm test
   ```

4. Typecheck codebase:
   ```bash
   npm run typecheck
   ```

### Loading into Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` located inside the project `dist/` folder.
4. Open any problem page on:
   - [Codeforces Problemset](https://codeforces.com/problemset/problem/4/A)
   - [CSES Problem Set](https://cses.fi/problemset/task/1068)

---

## Keyboard Shortcuts Reference

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| J | Navigate to Next Problem | Problem View |
| K | Navigate to Previous Problem | Problem View |
| B | Toggle Problem Bookmark | Problem View |
| N | Toggle Notes Drawer | Problem View |
| D | Toggle Dark / Light Theme | Global |
| O | Toggle Original Site View | Problem View |
| Ctrl + Enter / Cmd + Enter | Run Code with Test Cases | Code Editor |
| Ctrl + Alt + Enter | Submit Code to Platform | Code Editor |
| Ctrl + K / Cmd + K | Open Command Palette | Global |
| ? | Open Shortcuts Cheat Sheet | Global |
| Esc | Close Active Modal / Drawer / Palette | Global |

---

## Security & Reliability

- **HTML Sanitization**: All incoming HTML from problem descriptions and limits is sanitized via DOMPurify before insertion to neutralize malicious tags and event handlers.
- **Form Integrity**: Submission flows preserve platform-native authentication, session cookies, and security tokens.
- **Local Storage Isolation**: User code, notes, and preferences are partitioned by platform and problem ID, preventing collisions.

---

## License

MIT License. Designed and engineered for competitive programming developers.
