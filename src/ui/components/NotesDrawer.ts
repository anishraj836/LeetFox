import { createElement } from '../../core/utils/dom';

export interface NotesDrawerCallbacks {
  onSaveNotes: (notes: string) => Promise<void> | void;
  onClose: () => void;
}

export class NotesDrawer {
  private element: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private statusLabel: HTMLElement;
  private saveTimeout: any = null;
  private isOpen = false;
  private boundWindowEscape: (e: KeyboardEvent) => void;

  constructor(
    private problemId: string,
    private problemTitle: string,
    initialNotes: string,
    private callbacks: NotesDrawerCallbacks
  ) {
    this.boundWindowEscape = (e: KeyboardEvent) => {
      if (this.isOpen && e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    };

    this.element = createElement('div', {
      className: 'lf-notes-overlay',
      style: 'display: none !important;'
    });

    this.element.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.element) {
        this.close();
      }
    });

    const drawer = createElement('div', { className: 'lf-notes-drawer' });

    // Header
    const header = createElement('div', { className: 'lf-notes-header' });
    const titleGroup = createElement('div');
    const title = createElement('h3', { className: 'lf-notes-title' }, `Notes: ${this.problemId} - ${this.problemTitle}`);
    this.statusLabel = createElement('span', { className: 'lf-notes-status' }, initialNotes ? 'Saved' : '');

    titleGroup.appendChild(title);
    titleGroup.appendChild(this.statusLabel);

    const closeBtn = createElement('button', {
      className: 'lf-btn lf-btn-icon',
      type: 'button',
      title: 'Close (Esc)'
    }, '✕');

    closeBtn.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });

    header.appendChild(titleGroup);
    header.appendChild(closeBtn);

    // Body
    const body = createElement('div', { className: 'lf-notes-body' });
    this.textarea = createElement('textarea', {
      className: 'lf-notes-textarea',
      placeholder: 'Write notes, approach, time/space complexity, and edge cases here...\n(Automatically saved)'
    });
    this.textarea.value = initialNotes;

    this.textarea.addEventListener('input', () => {
      this.statusLabel.textContent = 'Saving...';
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.callbacks.onSaveNotes(this.textarea.value);
        this.statusLabel.textContent = 'Saved';
      }, 300);
    });

    this.textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    });

    body.appendChild(this.textarea);
    drawer.appendChild(header);
    drawer.appendChild(body);
    this.element.appendChild(drawer);
  }

  public isDrawerOpen(): boolean {
    return this.isOpen;
  }

  public open(): void {
    this.isOpen = true;
    this.element.classList.add('open');
    this.element.style.setProperty('display', 'flex', 'important');
    window.addEventListener('keydown', this.boundWindowEscape);
    setTimeout(() => {
      this.textarea.focus();
    }, 50);
  }

  public close(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.callbacks.onSaveNotes(this.textarea.value);
    }
    this.isOpen = false;
    this.element.classList.remove('open');
    this.element.style.setProperty('display', 'none', 'important');
    window.removeEventListener('keydown', this.boundWindowEscape);
    this.callbacks.onClose();
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public updateNotes(notes: string): void {
    if (document.activeElement !== this.textarea) {
      this.textarea.value = notes;
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
