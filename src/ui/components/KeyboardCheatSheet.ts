import { createElement } from '../../core/utils/dom';

export class KeyboardCheatSheet {
  private element: HTMLElement;
  private isOpen = false;
  private boundWindowEscape: (e: KeyboardEvent) => void;

  private shortcuts = [
    { key: 'J', desc: 'Next problem' },
    { key: 'K', desc: 'Previous problem' },
    { key: 'B', desc: 'Toggle bookmark' },
    { key: 'N', desc: 'Open / close notes' },
    { key: 'D', desc: 'Toggle dark / light theme' },
    { key: 'O', desc: 'Toggle original site view' },
    { key: '⌘K / Ctrl+K', desc: 'Command palette' },
    { key: '?', desc: 'Keyboard shortcuts help' },
    { key: 'Esc', desc: 'Close dialog or drawer' }
  ];

  constructor() {
    this.boundWindowEscape = (e: KeyboardEvent) => {
      if (this.isOpen && e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    };

    this.element = createElement('div', {
      className: 'lf-modal-overlay',
      style: 'display: none !important;'
    });

    this.element.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.element) {
        this.close();
      }
    });

    const modal = createElement('div', { className: 'lf-modal-content' });

    // Header
    const header = createElement('div', { className: 'lf-modal-header' });
    const title = createElement('h3', { className: 'lf-section-header', style: 'margin: 0;' }, '⌨️ Keyboard Shortcuts');
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

    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Shortcuts grid
    const grid = createElement('div', { className: 'lf-shortcuts-grid' });
    for (const item of this.shortcuts) {
      const row = createElement('div', { className: 'lf-shortcut-row' });
      const label = createElement('span', {}, item.desc);
      const kbd = createElement('kbd', { className: 'lf-kbd' }, item.key);
      row.appendChild(label);
      row.appendChild(kbd);
      grid.appendChild(row);
    }

    modal.appendChild(grid);
    this.element.appendChild(modal);
  }

  public isModalOpen(): boolean {
    return this.isOpen;
  }

  public open(): void {
    this.isOpen = true;
    this.element.classList.add('open');
    this.element.style.setProperty('display', 'flex', 'important');
    window.addEventListener('keydown', this.boundWindowEscape);
  }

  public close(): void {
    this.isOpen = false;
    this.element.classList.remove('open');
    this.element.style.setProperty('display', 'none', 'important');
    window.removeEventListener('keydown', this.boundWindowEscape);
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
