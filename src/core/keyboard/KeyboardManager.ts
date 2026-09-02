import { isEditableElement } from '../utils/dom';
import type { ShortcutAction } from './shortcuts';

export class KeyboardManager {
  private actions: Map<string, ShortcutAction> = new Map();
  private boundHandler: (e: KeyboardEvent) => void;
  private isListening = false;

  constructor() {
    this.boundHandler = this.handleKeyDown.bind(this);
  }

  public registerAction(action: ShortcutAction): void {
    this.actions.set(action.id, action);
  }

  public unregisterAction(actionId: string): void {
    this.actions.delete(actionId);
  }

  public getActions(): ShortcutAction[] {
    return Array.from(this.actions.values());
  }

  public start(): void {
    if (this.isListening) return;
    window.addEventListener('keydown', this.boundHandler, true); // capture phase
    this.isListening = true;
  }

  public stop(): void {
    if (!this.isListening) return;
    window.removeEventListener('keydown', this.boundHandler, true);
    this.isListening = false;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Cmd+K or Ctrl+K opens Command Palette even if typing, unless escape is pressed
    const isCmdK = (e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k');
    if (isCmdK) {
      const paletteAction = this.actions.get('open-command-palette');
      if (paletteAction) {
        e.preventDefault();
        e.stopPropagation();
        paletteAction.handler();
        return;
      }
    }

    // Never trigger ordinary single-key shortcuts while typing in editable elements
    if (isEditableElement(e.target) || isEditableElement(document.activeElement)) {
      return;
    }

    // Avoid triggering when modifier keys (Ctrl, Alt, Meta) are held, unless specified
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    const key = e.key.toLowerCase();

    for (const action of this.actions.values()) {
      if (action.keyCombination.toLowerCase() === key) {
        e.preventDefault();
        e.stopPropagation();
        action.handler();
        return;
      }
    }
  }
}
