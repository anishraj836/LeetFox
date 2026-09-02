import type { Problem } from '../../core/models/problem';
import type { ProblemState } from '../../core/models/state';
import type { UserPreferences } from '../../core/models/preferences';
import { createElement } from '../../core/utils/dom';

export interface HeaderCallbacks {
  onToggleSolved: () => void;
  onToggleBookmark: () => void;
  onToggleNotes: () => void;
  onToggleTheme: () => void;
  onToggleViewOriginal: () => void;
  onToggleSplitMode: () => void;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
}

export class Header {
  private element: HTMLElement;
  private solvedBtn: HTMLButtonElement;
  private bookmarkBtn: HTMLButtonElement;
  private notesBtn: HTMLButtonElement;
  private themeBtn: HTMLButtonElement;
  private originalToggleBtn: HTMLButtonElement;
  private splitToggleBtn: HTMLButtonElement;
  private solutionsBtn: HTMLButtonElement;
  private isSplitMode = true;

  constructor(
    private problem: Problem,
    private state: ProblemState,
    private prefs: UserPreferences,
    private callbacks: HeaderCallbacks
  ) {
    this.element = createElement('header', { className: 'lf-header' });

    // Inner container
    const inner = createElement('div', { className: 'lf-header-inner' });

    // Left brand & title group
    const leftGroup = createElement('div', { className: 'lf-brand-group' });

    const logo = createElement('a', {
      className: 'lf-brand-logo',
      href: this.problem.navigation.problemsetUrl || '#',
      title: 'Leetfox'
    }, '🦊 Leetfox');

    const platformBadge = createElement('span', {
      className: 'lf-platform-badge'
    }, this.problem.platform);

    const titleGroup = createElement('div', { className: 'lf-header-title-container' });
    const idSpan = createElement('span', { className: 'lf-header-id' }, this.problem.id);
    const titleHeader = createElement('h2', {
      className: 'lf-header-title',
      title: this.problem.title
    }, this.problem.title);

    titleGroup.appendChild(idSpan);
    titleGroup.appendChild(titleHeader);

    leftGroup.appendChild(logo);
    leftGroup.appendChild(platformBadge);
    leftGroup.appendChild(titleGroup);

    // Right actions group
    const actionsGroup = createElement('div', { className: 'lf-header-actions' });

    // Navigation (prev / next)
    const navGroup = createElement('div', { className: 'lf-nav-group' });
    const prevLink = createElement('a', {
      className: `lf-nav-btn ${!this.problem.navigation.previousUrl ? 'disabled' : ''}`,
      href: this.problem.navigation.previousUrl || '#',
      title: this.problem.navigation.previousTitle ? `Previous: ${this.problem.navigation.previousTitle} (K)` : 'Previous Problem (K)'
    }, '‹ Prev');

    const nextLink = createElement('a', {
      className: `lf-nav-btn ${!this.problem.navigation.nextUrl ? 'disabled' : ''}`,
      href: this.problem.navigation.nextUrl || '#',
      title: this.problem.navigation.nextTitle ? `Next: ${this.problem.navigation.nextTitle} (J)` : 'Next Problem (J)'
    }, 'Next ›');

    navGroup.appendChild(prevLink);
    navGroup.appendChild(nextLink);

    // Action buttons
    this.solvedBtn = createElement('button', {
      className: `lf-btn lf-btn-solved ${this.state.solved ? 'active' : ''}`,
      title: 'Toggle Solved',
      onClick: () => this.callbacks.onToggleSolved()
    }, this.state.solved ? '✓ Solved' : '○ Solve');

    this.bookmarkBtn = createElement('button', {
      className: `lf-btn lf-btn-icon lf-btn-bookmark ${this.state.bookmarked ? 'active' : ''}`,
      title: 'Toggle Bookmark (B)',
      onClick: () => this.callbacks.onToggleBookmark()
    }, this.state.bookmarked ? '★' : '☆');

    this.notesBtn = createElement('button', {
      className: `lf-btn lf-btn-icon lf-btn-notes ${this.state.notes ? 'active' : ''}`,
      title: 'Problem Notes (N)',
      onClick: () => this.callbacks.onToggleNotes()
    }, '📝');

    // Split View Toggle
    this.splitToggleBtn = createElement('button', {
      className: 'lf-btn',
      title: 'Toggle Code Editor Split Screen',
      onClick: () => this.callbacks.onToggleSplitMode()
    }, '◫ Split');

    // Solutions / Submissions Button with Live Contest Anti-Cheat Guard
    if (this.problem.isLiveContest) {
      this.solutionsBtn = createElement('button', {
        className: 'lf-btn lf-btn-locked',
        title: 'Solutions & Submissions are hidden during active contests to comply with contest rules.',
        disabled: true
      }, '🔒 Solutions');
    } else {
      const solUrl = this.problem.editorialUrl || this.problem.solutionsUrl;
      this.solutionsBtn = createElement('button', {
        className: `lf-btn ${!solUrl ? 'disabled' : ''}`,
        title: solUrl ? 'View Problem Solutions & Editorial' : 'No public solutions found for this problem',
        onClick: () => {
          if (solUrl) window.open(solUrl, '_blank');
        }
      }, '💡 Solutions');
    }

    const paletteBtn = createElement('button', {
      className: 'lf-btn',
      title: 'Command Palette (Cmd+K / Ctrl+K)',
      onClick: () => this.callbacks.onOpenPalette()
    }, '⌘K');

    this.themeBtn = createElement('button', {
      className: 'lf-btn lf-btn-icon',
      title: 'Toggle Dark/Light Mode (D)',
      onClick: () => this.callbacks.onToggleTheme()
    }, this.prefs.theme === 'dark' ? '☀️' : '🌙');

    const helpBtn = createElement('button', {
      className: 'lf-btn lf-btn-icon',
      title: 'Keyboard Shortcuts (?)',
      onClick: () => this.callbacks.onOpenShortcuts()
    }, '?');

    this.originalToggleBtn = createElement('button', {
      className: 'lf-btn',
      title: 'Toggle Original Site View (O)',
      onClick: () => this.callbacks.onToggleViewOriginal()
    }, this.prefs.hideOriginalPage ? 'Original (O)' : 'Leetfox View');

    actionsGroup.appendChild(navGroup);
    actionsGroup.appendChild(this.solvedBtn);
    actionsGroup.appendChild(this.bookmarkBtn);
    actionsGroup.appendChild(this.notesBtn);
    actionsGroup.appendChild(this.splitToggleBtn);
    actionsGroup.appendChild(this.solutionsBtn);
    actionsGroup.appendChild(paletteBtn);
    actionsGroup.appendChild(this.themeBtn);
    actionsGroup.appendChild(helpBtn);
    actionsGroup.appendChild(this.originalToggleBtn);

    inner.appendChild(leftGroup);
    inner.appendChild(actionsGroup);
    this.element.appendChild(inner);
  }

  public updateSplitMode(isSplit: boolean): void {
    this.isSplitMode = isSplit;
    this.splitToggleBtn.textContent = this.isSplitMode ? '◫ Split' : '▢ Full';
  }

  public updateState(state: ProblemState): void {
    this.state = state;
    if (this.state.solved) {
      this.solvedBtn.className = 'lf-btn lf-btn-solved active';
      this.solvedBtn.textContent = '✓ Solved';
    } else {
      this.solvedBtn.className = 'lf-btn lf-btn-solved';
      this.solvedBtn.textContent = '○ Solve';
    }

    if (this.state.bookmarked) {
      this.bookmarkBtn.className = 'lf-btn lf-btn-icon lf-btn-bookmark active';
      this.bookmarkBtn.textContent = '★';
    } else {
      this.bookmarkBtn.className = 'lf-btn lf-btn-icon lf-btn-bookmark';
      this.bookmarkBtn.textContent = '☆';
    }

    if (this.state.notes && this.state.notes.trim()) {
      this.notesBtn.className = 'lf-btn lf-btn-icon lf-btn-notes active';
    } else {
      this.notesBtn.className = 'lf-btn lf-btn-icon lf-btn-notes';
    }
  }

  public updatePreferences(prefs: UserPreferences): void {
    this.prefs = prefs;
    this.themeBtn.textContent = this.prefs.theme === 'dark' ? '☀️' : '🌙';
    this.originalToggleBtn.textContent = this.prefs.hideOriginalPage ? 'Original (O)' : 'Leetfox View';
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
