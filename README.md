# 🦊 Leetfox

> A modern, fast, keyboard-friendly competitive programming browser extension for Firefox.

Leetfox unifies the user experience of competitive programming websites (Codeforces and CSES) into a clean, distraction-free, professional developer tool. Instead of fragmented page styles and clunky interfaces, Leetfox provides a consistent design system, instant dark mode, 1-click test case copying, local notes, category progress tracking, and full keyboard navigation with a command palette.

---

## 🚀 Features

- **Cohesive Modern Interface**: Experience both Codeforces and CSES with the same polished, typography-optimized reading environment.
- **Platform-Adapter Architecture**: Platform-specific DOM parsing is completely isolated from the shared UI system. Future platforms like AtCoder can be added without modifying the core UI.
- **Keyboard-Driven Workflow**:
  - `J` / `K` — Navigate between Next and Previous problems in contest or category order.
  - `B` — Toggle problem bookmark status.
  - `N` — Open / close slide-out scratchpad notes (auto-saved).
  - `D` — Toggle Dark / Light theme.
  - `O` — Instantly switch between Leetfox modern view and the original website.
  - `⌘K` / `Ctrl+K` — Open the command palette with fuzzy search.
  - `?` — Display keyboard shortcuts help sheet.
  - **Typing Guard**: Shortcuts never trigger while typing into code editors, form inputs, textareas, or contenteditable fields.
- **1-Click Example Copy**: Copy input/output test cases with immediate visual feedback.
- **CSES Progress Tracking**: Real-time progress bar for CSES problem sets (e.g., `Introductory Problems: 12 / 19 solved`), calculated locally without requiring accounts or backends.
- **Zero Disruption to Underlying Sites**: Submit code directly via preserved forms/links, and toggle back to the original page at any time with a single key (`O`).
- **Private & Local**: Zero backend, zero telemetry. All notes, bookmarks, and solved statuses remain securely stored in your browser's local storage.

---

## 🏗️ Architecture

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
        Problem Header       Statement View     Metadata & Specs
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  ▼
                            Feature Layer
        ┌───────────────────┬───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼
  Keyboard Manager   Command Palette     Notes Drawer       Local Storage
```

### Normalized Problem Model

Platform adapters transform website DOMs into a standardized `Problem` interface:

```typescript
export interface Problem {
  platform: 'codeforces' | 'cses' | string;
  id: string;                         // e.g. "4A", "1068"
  qualifiedId: string;                // e.g. "codeforces:4a", "cses:1068"
  title: string;
  statementHtml: string;
  inputSpecificationHtml?: string;
  outputSpecificationHtml?: string;
  noteHtml?: string;
  examples: ProblemExample[];
  tags: string[];
  difficulty?: number | string;       // e.g. 800
  category?: string;                  // e.g. "Introductory Problems"
  limits: ProblemLimits;
  contest?: ProblemContestInfo;
  navigation: ProblemNavigation;
  url: string;
  submitUrl?: string;
}
```

### Adding a New Platform (e.g. AtCoder)

To add AtCoder, implement the `PlatformAdapter` interface without modifying the UI layer:

```typescript
import { PlatformAdapter } from './core/platform/PlatformAdapter';

export class AtCoderAdapter implements PlatformAdapter {
  readonly platformId = 'atcoder';
  readonly name = 'AtCoder';

  matches(url: URL): boolean {
    return url.hostname.includes('atcoder.jp');
  }

  isProblemPage(url: URL, doc?: Document): boolean {
    return /\/contests\/[^/]+\/tasks\/[^/]+/i.test(url.pathname);
  }

  parseProblem(doc: Document, url: URL): Problem | null {
    // Extract problem statement, constraints, examples
  }

  getOriginalContainer(doc: Document): HTMLElement | null {
    return doc.getElementById('main-container');
  }
}
```

Then register it in `src/content/index.ts`:

```typescript
PlatformRegistry.getInstance().register(new AtCoderAdapter());
```

---

## 📁 Directory Structure

```text
Leetfox/
├── public/
│   ├── manifest.json            # Firefox Manifest V3
│   └── icons/                   # 16x16, 48x48, 128x128 icons
├── src/
│   ├── background/
│   │   └── index.ts             # Background service script
│   ├── content/
│   │   ├── index.ts             # Content script bootstrap & observer
│   │   └── styles/
│   │       └── leetfox.css      # Cohesive design system & theme variables
│   ├── core/
│   │   ├── models/              # Problem, State, and Preference models
│   │   ├── platform/            # PlatformAdapter interface & PlatformRegistry
│   │   ├── storage/             # StorageManager (browser.storage.local)
│   │   ├── keyboard/            # KeyboardManager & shortcut registry
│   │   └── utils/               # Safe DOM helpers & HTML sanitizer
│   ├── platforms/
│   │   ├── codeforces/          # Codeforces adapter, parser & selectors
│   │   └── cses/                # CSES adapter, parser & selectors
│   ├── popup/
│   │   ├── popup.html           # Extension browser action popup
│   │   ├── popup.css
│   │   └── popup.ts
│   └── ui/
│       ├── LeetfoxApp.ts        # Main UI application controller
│       └── components/          # Header, MetadataBar, StatementView,
│                                # ExampleCard, ProgressBar, NotesDrawer,
│                                # CommandPalette, KeyboardCheatSheet
├── tests/
│   ├── fixtures/                # Real HTML fixtures (Codeforces, CSES)
│   ├── platform-detection.test.ts
│   ├── codeforces-parser.test.ts
│   ├── cses-parser.test.ts
│   ├── storage.test.ts
│   ├── keyboard.test.ts
│   ├── command-palette.test.ts
│   ├── sanitizer.test.ts
│   └── app-integration.test.ts
├── build.js                     # Vite multi-bundle build pipeline
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 🛠️ Installation & Development

### Prerequisites

- Node.js (v18+)
- npm (v9+)
- Mozilla Firefox (v109+)

### Build Steps

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Build the extension bundle:
   ```bash
   npm run build
   ```
   The production-ready extension will be output to the `dist/` directory.

3. Run the automated test suite:
   ```bash
   npm test
   ```

4. Type-check the project:
   ```bash
   npm run typecheck
   ```

### Loading into Firefox

1. Open Firefox.
2. In the URL bar, type:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Click the **"Load Temporary Add-on..."** button.
4. Navigate to the project's `dist/` folder and select `manifest.json`.
5. Leetfox is now active! Visit any problem page on:
   - [Codeforces](https://codeforces.com/problemset/problem/4/A)
   - [CSES](https://cses.fi/problemset/task/1068)

---

## ⌨️ Keyboard Shortcuts Reference

| Key | Action | Context |
| :--- | :--- | :--- |
| `J` | Navigate to **Next problem** | Problem view |
| `K` | Navigate to **Previous problem** | Problem view |
| `B` | Toggle **Bookmark** status | Problem view |
| `N` | Open / Close **Notes drawer** | Problem view |
| `D` | Toggle **Dark / Light theme** | Everywhere |
| `O` | Toggle **Original Site** view | Problem view |
| `⌘K` / `Ctrl+K` | Open **Command Palette** | Everywhere |
| `?` | Show **Shortcuts cheat sheet** | Everywhere |
| `Esc` | Close open palette, drawer, or modal | Modals / Drawers |

---

## 🛡️ Security & Privacy

- **DOMPurify Sanitization**: All extracted problem statements and specifications are sanitized to strip any dangerous `<script>`, `<iframe>`, `<object>`, `<form>`, or inline event handlers (`onerror`, `onload`).
- **Zero Network Egress**: Leetfox runs entirely on the client. It makes zero background network requests and sends zero telemetry.
- **Local Isolation**: All user states (notes, bookmarks, solved status) are stored in your browser's private local storage partition keyed by platform ID (`problem:codeforces:...`, `problem:cses:...`).

---

## 📄 License

MIT License. Designed and built with ❤️ for competitive programmers.
