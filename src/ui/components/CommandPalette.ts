import { createElement } from '../../core/utils/dom';

export interface CommandItem {
  id: string;
  title: string;
  shortcut?: string;
  category?: string;
  run: () => void | Promise<void>;
}

export class CommandPalette {
  private element: HTMLElement;
  private input: HTMLInputElement;
  private listEl: HTMLUListElement;
  private commands: CommandItem[] = [];
  private filteredCommands: CommandItem[] = [];
  private selectedIndex = 0;
  private isOpen = false;
  private boundWindowEscape: (e: KeyboardEvent) => void;

  constructor(commands: CommandItem[]) {
    this.commands = commands;
    this.filteredCommands = [...commands];
    this.boundWindowEscape = (e: KeyboardEvent) => {
      if (this.isOpen && e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    };

    this.element = createElement('div', {
      className: 'lf-palette-overlay',
      style: 'display: none;',
      onClick: (e: MouseEvent) => {
        if (e.target === this.element) {
          this.close();
        }
      }
    });

    const modal = createElement('div', { className: 'lf-palette-modal' });

    // Search bar
    const inputWrapper = createElement('div', { className: 'lf-palette-input-wrapper' });
    const searchIcon = createElement('span', {}, '🔍');
    this.input = createElement('input', {
      className: 'lf-palette-input',
      type: 'text',
      placeholder: 'Type a command or search...'
    });

    inputWrapper.appendChild(searchIcon);
    inputWrapper.appendChild(this.input);

    // Command list
    this.listEl = createElement('ul', { className: 'lf-palette-list' });

    modal.appendChild(inputWrapper);
    modal.appendChild(this.listEl);
    this.element.appendChild(modal);

    this.bindEvents();
    this.renderList();
  }

  public isPaletteOpen(): boolean {
    return this.isOpen;
  }

  public setCommands(commands: CommandItem[]): void {
    this.commands = commands;
    this.filter(this.input.value);
  }

  private bindEvents(): void {
    this.input.addEventListener('input', () => {
      this.filter(this.input.value);
    });

    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectPrev();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  private filter(query: string): void {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.filteredCommands = [...this.commands];
    } else {
      this.filteredCommands = this.commands.filter(cmd =>
        cmd.title.toLowerCase().includes(q) ||
        (cmd.category && cmd.category.toLowerCase().includes(q))
      );
    }
    this.selectedIndex = 0;
    this.renderList();
  }

  private selectNext(): void {
    if (this.filteredCommands.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
    this.updateActiveItem();
  }

  private selectPrev(): void {
    if (this.filteredCommands.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
    this.updateActiveItem();
  }

  private executeSelected(): void {
    const cmd = this.filteredCommands[this.selectedIndex];
    if (cmd) {
      this.close();
      cmd.run();
    }
  }

  private updateActiveItem(): void {
    const items = this.listEl.querySelectorAll('.lf-palette-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedIndex) {
        item.classList.add('active');
        item.scrollIntoView?.({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  private renderList(): void {
    this.listEl.innerHTML = '';

    if (this.filteredCommands.length === 0) {
      const empty = createElement('li', {
        className: 'lf-palette-item',
        style: 'color: var(--lf-text-muted); cursor: default;'
      }, 'No matching commands found');
      this.listEl.appendChild(empty);
      return;
    }

    this.filteredCommands.forEach((cmd, idx) => {
      const item = createElement('li', {
        className: `lf-palette-item ${idx === this.selectedIndex ? 'active' : ''}`
      });

      const left = createElement('div', { className: 'lf-palette-item-left' });
      const title = createElement('span', {}, cmd.title);
      left.appendChild(title);

      item.appendChild(left);

      if (cmd.shortcut) {
        const kbd = createElement('kbd', { className: 'lf-palette-shortcut' }, cmd.shortcut);
        item.appendChild(kbd);
      }

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = idx;
        this.updateActiveItem();
      });

      item.addEventListener('click', () => {
        this.close();
        cmd.run();
      });

      this.listEl.appendChild(item);
    });
  }

  public open(): void {
    this.isOpen = true;
    this.element.style.display = 'flex';
    this.input.value = '';
    this.filter('');
    window.addEventListener('keydown', this.boundWindowEscape);
    setTimeout(() => {
      this.input.focus();
    }, 50);
  }

  public close(): void {
    this.isOpen = false;
    this.element.style.display = 'none';
    this.input.blur();
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
