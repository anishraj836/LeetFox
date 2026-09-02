import type { PlatformAdapter } from '../core/platform/PlatformAdapter';
import type { Problem } from '../core/models/problem';
import type { ProblemState } from '../core/models/state';
import type { UserPreferences } from '../core/models/preferences';
import { StorageManager } from '../core/storage/StorageManager';
import { KeyboardManager } from '../core/keyboard/KeyboardManager';
import { createElement } from '../core/utils/dom';

import { Header } from './components/Header';
import { MetadataBar } from './components/MetadataBar';
import { StatementView } from './components/StatementView';
import { ProgressBar } from './components/ProgressBar';
import { NotesDrawer } from './components/NotesDrawer';
import { CommandPalette, type CommandItem } from './components/CommandPalette';
import { KeyboardCheatSheet } from './components/KeyboardCheatSheet';

export class LeetfoxApp {
  private rootElement: HTMLElement;
  private originalContainer: HTMLElement | null = null;
  private header!: Header;
  private progressBar: ProgressBar | null = null;
  private notesDrawer!: NotesDrawer;
  private commandPalette!: CommandPalette;
  private cheatSheet!: KeyboardCheatSheet;
  private keyboardManager: KeyboardManager;
  private storage: StorageManager;

  constructor(
    private adapter: PlatformAdapter,
    private problem: Problem,
    private state: ProblemState,
    private prefs: UserPreferences
  ) {
    this.storage = StorageManager.getInstance();
    this.keyboardManager = new KeyboardManager();
    this.rootElement = createElement('div', {
      id: 'leetfox-app',
      dataset: { lfTheme: this.prefs.theme }
    });
  }

  public async mount(doc: Document): Promise<void> {
    this.originalContainer = this.adapter.getOriginalContainer(doc);

    // Build subcomponents
    this.header = new Header(
      this.problem,
      this.state,
      this.prefs,
      {
        onToggleSolved: () => this.toggleSolved(),
        onToggleBookmark: () => this.toggleBookmark(),
        onToggleNotes: () => this.notesDrawer.toggle(),
        onToggleTheme: () => this.toggleTheme(),
        onToggleViewOriginal: () => this.toggleViewOriginal(),
        onOpenPalette: () => this.commandPalette.open(),
        onOpenShortcuts: () => this.cheatSheet.open()
      }
    );

    const main = createElement('main', { className: 'lf-main' });
    const metadataBar = new MetadataBar(this.problem);
    main.appendChild(metadataBar.getElement());

    // Category progress for CSES or any platform supporting it
    if (this.adapter.getCategoryProgress) {
      const allStates = await this.storage.getAllProblemStatesForPlatform(this.problem.platform);
      const progress = this.adapter.getCategoryProgress(doc, allStates);
      if (progress) {
        this.progressBar = new ProgressBar(progress);
        main.appendChild(this.progressBar.getElement());
      }
    }

    const statementView = new StatementView(this.problem);
    main.appendChild(statementView.getElement());

    // Modals and Drawers
    this.notesDrawer = new NotesDrawer(
      this.problem.id,
      this.problem.title,
      this.state.notes,
      {
        onSaveNotes: (notes: string) => this.saveNotes(notes),
        onClose: () => {}
      }
    );

    this.cheatSheet = new KeyboardCheatSheet();

    this.commandPalette = new CommandPalette(this.buildCommands());

    this.rootElement.appendChild(this.header.getElement());
    this.rootElement.appendChild(main);
    this.rootElement.appendChild(this.notesDrawer.getElement());
    this.rootElement.appendChild(this.commandPalette.getElement());
    this.rootElement.appendChild(this.cheatSheet.getElement());

    // Insert into host DOM
    if (this.originalContainer && this.originalContainer.parentNode) {
      this.originalContainer.parentNode.insertBefore(this.rootElement, this.originalContainer);
      if (this.prefs.hideOriginalPage) {
        this.originalContainer.style.display = 'none';
      }
    } else {
      doc.body.prepend(this.rootElement);
    }

    this.setupKeyboardShortcuts();
    this.setupStorageListeners(doc);
  }

  private buildCommands(): CommandItem[] {
    const commands: CommandItem[] = [];

    if (this.problem.navigation.nextUrl) {
      commands.push({
        id: 'next-problem',
        title: `Next Problem: ${this.problem.navigation.nextTitle || ''}`,
        shortcut: 'J',
        category: 'Navigation',
        run: () => this.navigateNext()
      });
    }

    if (this.problem.navigation.previousUrl) {
      commands.push({
        id: 'previous-problem',
        title: `Previous Problem: ${this.problem.navigation.previousTitle || ''}`,
        shortcut: 'K',
        category: 'Navigation',
        run: () => this.navigatePrevious()
      });
    }

    commands.push({
      id: 'toggle-solved',
      title: this.state.solved ? 'Mark as Unsolved' : 'Mark as Solved',
      category: 'Status',
      run: () => this.toggleSolved()
    });

    commands.push({
      id: 'toggle-bookmark',
      title: this.state.bookmarked ? 'Remove Bookmark' : 'Bookmark Problem',
      shortcut: 'B',
      category: 'Status',
      run: () => this.toggleBookmark()
    });

    commands.push({
      id: 'open-notes',
      title: 'Open Notes',
      shortcut: 'N',
      category: 'Actions',
      run: () => this.notesDrawer.open()
    });

    commands.push({
      id: 'toggle-theme',
      title: `Switch to ${this.prefs.theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      shortcut: 'D',
      category: 'Appearance',
      run: () => this.toggleTheme()
    });

    commands.push({
      id: 'toggle-original-view',
      title: this.prefs.hideOriginalPage ? 'View Original Site' : 'View Leetfox Interface',
      shortcut: 'O',
      category: 'View',
      run: () => this.toggleViewOriginal()
    });

    commands.push({
      id: 'shortcuts-help',
      title: 'Keyboard Shortcuts Help',
      shortcut: '?',
      category: 'Help',
      run: () => this.cheatSheet.open()
    });

    if (this.problem.submitUrl) {
      commands.push({
        id: 'submit-problem',
        title: 'Go to Submit Page',
        category: 'Navigation',
        run: () => { window.location.href = this.problem.submitUrl!; }
      });
    }

    return commands;
  }

  private setupKeyboardShortcuts(): void {
    // Cmd+K
    this.keyboardManager.registerAction({
      id: 'open-command-palette',
      name: 'Command Palette',
      description: 'Open Command Palette',
      keyCombination: 'k',
      handler: () => this.commandPalette.open()
    });

    // J
    this.keyboardManager.registerAction({
      id: 'next-problem',
      name: 'Next Problem',
      description: 'Go to next problem',
      keyCombination: 'j',
      handler: () => this.navigateNext()
    });

    // K
    this.keyboardManager.registerAction({
      id: 'prev-problem',
      name: 'Previous Problem',
      description: 'Go to previous problem',
      keyCombination: 'k',
      handler: () => this.navigatePrevious()
    });

    // B
    this.keyboardManager.registerAction({
      id: 'toggle-bookmark',
      name: 'Bookmark',
      description: 'Toggle bookmark status',
      keyCombination: 'b',
      handler: () => this.toggleBookmark()
    });

    // N
    this.keyboardManager.registerAction({
      id: 'toggle-notes',
      name: 'Notes',
      description: 'Toggle notes drawer',
      keyCombination: 'n',
      handler: () => this.notesDrawer.toggle()
    });

    // D
    this.keyboardManager.registerAction({
      id: 'toggle-theme',
      name: 'Theme',
      description: 'Toggle dark / light theme',
      keyCombination: 'd',
      handler: () => this.toggleTheme()
    });

    // O
    this.keyboardManager.registerAction({
      id: 'toggle-view-original',
      name: 'Toggle Original View',
      description: 'Toggle original site view',
      keyCombination: 'o',
      handler: () => this.toggleViewOriginal()
    });

    // ?
    this.keyboardManager.registerAction({
      id: 'shortcuts-help',
      name: 'Keyboard Shortcuts',
      description: 'Show keyboard shortcuts',
      keyCombination: '?',
      handler: () => this.cheatSheet.toggle()
    });

    this.keyboardManager.start();
  }

  private setupStorageListeners(doc: Document): void {
    const qualifiedKey = this.storage.getQualifiedKey(this.problem.platform, this.problem.id);

    this.storage.onStateChange(async (key, updatedState) => {
      if (key === qualifiedKey) {
        this.state = updatedState;
        this.header.updateState(this.state);
        this.notesDrawer.updateNotes(this.state.notes);
        this.commandPalette.setCommands(this.buildCommands());

        // Update progress if applicable
        if (this.progressBar && this.adapter.getCategoryProgress) {
          const allStates = await this.storage.getAllProblemStatesForPlatform(this.problem.platform);
          const progress = this.adapter.getCategoryProgress(doc, allStates);
          if (progress) {
            this.progressBar.update(progress);
          }
        }
      }
    });

    this.storage.onPreferencesChange((prefs) => {
      this.prefs = prefs;
      this.rootElement.dataset.lfTheme = this.prefs.theme;
      this.header.updatePreferences(this.prefs);
      this.commandPalette.setCommands(this.buildCommands());
    });
  }

  public async toggleSolved(): Promise<void> {
    const newState = await this.storage.saveProblemState(this.problem.platform, this.problem.id, {
      solved: !this.state.solved
    });
    this.state = newState;
    this.header.updateState(this.state);
    this.commandPalette.setCommands(this.buildCommands());
  }

  public async toggleBookmark(): Promise<void> {
    const newState = await this.storage.saveProblemState(this.problem.platform, this.problem.id, {
      bookmarked: !this.state.bookmarked
    });
    this.state = newState;
    this.header.updateState(this.state);
    this.commandPalette.setCommands(this.buildCommands());
  }

  public async saveNotes(notes: string): Promise<void> {
    const newState = await this.storage.saveProblemState(this.problem.platform, this.problem.id, {
      notes
    });
    this.state = newState;
    this.header.updateState(this.state);
  }

  public async toggleTheme(): Promise<void> {
    const newTheme = this.prefs.theme === 'dark' ? 'light' : 'dark';
    const newPrefs = await this.storage.savePreferences({ theme: newTheme });
    this.prefs = newPrefs;
    this.rootElement.dataset.lfTheme = this.prefs.theme;
    this.header.updatePreferences(this.prefs);
    this.commandPalette.setCommands(this.buildCommands());
  }

  public async toggleViewOriginal(): Promise<void> {
    const nextHide = !this.prefs.hideOriginalPage;
    await this.storage.savePreferences({ hideOriginalPage: nextHide });
    this.prefs.hideOriginalPage = nextHide;

    if (this.originalContainer) {
      this.originalContainer.style.display = nextHide ? 'none' : '';
    }
    this.rootElement.style.display = nextHide ? 'block' : 'none';
    this.header.updatePreferences(this.prefs);
    this.commandPalette.setCommands(this.buildCommands());
  }

  private navigateNext(): void {
    if (this.problem.navigation.nextUrl) {
      window.location.href = this.problem.navigation.nextUrl;
    }
  }

  private navigatePrevious(): void {
    if (this.problem.navigation.previousUrl) {
      window.location.href = this.problem.navigation.previousUrl;
    }
  }

  public getRootElement(): HTMLElement {
    return this.rootElement;
  }
}
