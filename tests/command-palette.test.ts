import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandPalette, type CommandItem } from '../src/ui/components/CommandPalette';

describe('CommandPalette', () => {
  let palette: CommandPalette;
  let cmd1Run: any;
  let cmd2Run: any;
  let commands: CommandItem[];

  beforeEach(() => {
    cmd1Run = vi.fn();
    cmd2Run = vi.fn();

    commands = [
      { id: 'next', title: 'Next Problem', shortcut: 'J', category: 'Navigation', run: cmd1Run },
      { id: 'prev', title: 'Previous Problem', shortcut: 'K', category: 'Navigation', run: cmd2Run },
      { id: 'bookmark', title: 'Bookmark Problem', shortcut: 'B', category: 'Status', run: vi.fn() },
      { id: 'notes', title: 'Open Notes', shortcut: 'N', category: 'Actions', run: vi.fn() }
    ];

    palette = new CommandPalette(commands);
    document.body.innerHTML = '';
    document.body.appendChild(palette.getElement());
  });

  it('opens and focuses input', () => {
    const el = palette.getElement();
    expect(el.style.display).toBe('none');

    palette.open();
    expect(el.style.display).toBe('flex');
  });

  it('filters commands when typing in search input', () => {
    palette.open();
    const input = palette.getElement().querySelector('.lf-palette-input') as HTMLInputElement;

    input.value = 'book';
    input.dispatchEvent(new Event('input'));

    const items = palette.getElement().querySelectorAll('.lf-palette-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('Bookmark Problem');
  });

  it('navigates with ArrowDown and ArrowUp and executes with Enter', () => {
    palette.open();
    const input = palette.getElement().querySelector('.lf-palette-input') as HTMLInputElement;

    // Initially first item (Next Problem) is active
    let activeItem = palette.getElement().querySelector('.lf-palette-item.active');
    expect(activeItem?.textContent).toContain('Next Problem');

    // Press ArrowDown -> moves to second item (Previous Problem)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    activeItem = palette.getElement().querySelector('.lf-palette-item.active');
    expect(activeItem?.textContent).toContain('Previous Problem');

    // Press Enter -> executes Previous Problem command and closes palette
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(cmd2Run).toHaveBeenCalledTimes(1);
    expect(palette.getElement().style.display).toBe('none');
  });

  it('closes on Escape', () => {
    palette.open();
    const input = palette.getElement().querySelector('.lf-palette-input') as HTMLInputElement;

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(palette.getElement().style.display).toBe('none');
  });
});
