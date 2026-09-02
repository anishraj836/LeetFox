import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardManager } from '../src/core/keyboard/KeyboardManager';

describe('KeyboardManager', () => {
  let keyboard: KeyboardManager;

  beforeEach(() => {
    keyboard = new KeyboardManager();
    keyboard.start();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    keyboard.stop();
  });

  it('triggers registered actions on normal key press', () => {
    const nextFn = vi.fn();
    const bookmarkFn = vi.fn();

    keyboard.registerAction({
      id: 'next-problem',
      name: 'Next Problem',
      description: 'Go to next problem',
      keyCombination: 'j',
      handler: nextFn
    });

    keyboard.registerAction({
      id: 'toggle-bookmark',
      name: 'Bookmark',
      description: 'Toggle bookmark',
      keyCombination: 'b',
      handler: bookmarkFn
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(bookmarkFn).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    expect(bookmarkFn).toHaveBeenCalledTimes(1);
  });

  it('DOES NOT trigger shortcuts when focused in an <input>', () => {
    const nextFn = vi.fn();
    keyboard.registerAction({
      id: 'next-problem',
      name: 'Next Problem',
      description: 'Go to next problem',
      keyCombination: 'j',
      handler: nextFn
    });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('DOES NOT trigger shortcuts when focused in a <textarea>', () => {
    const bookmarkFn = vi.fn();
    keyboard.registerAction({
      id: 'toggle-bookmark',
      name: 'Bookmark',
      description: 'Toggle bookmark',
      keyCombination: 'b',
      handler: bookmarkFn
    });

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    expect(bookmarkFn).not.toHaveBeenCalled();
  });

  it('DOES NOT trigger shortcuts in contenteditable elements', () => {
    const notesFn = vi.fn();
    keyboard.registerAction({
      id: 'toggle-notes',
      name: 'Notes',
      description: 'Toggle notes',
      keyCombination: 'n',
      handler: notesFn
    });

    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    div.focus();

    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(notesFn).not.toHaveBeenCalled();
  });

  it('DOES NOT trigger shortcuts inside code editors like Monaco or CodeMirror', () => {
    const themeFn = vi.fn();
    keyboard.registerAction({
      id: 'toggle-theme',
      name: 'Theme',
      description: 'Toggle theme',
      keyCombination: 'd',
      handler: themeFn
    });

    const editorContainer = document.createElement('div');
    editorContainer.className = 'monaco-editor';
    const editorChild = document.createElement('div');
    editorContainer.appendChild(editorChild);
    document.body.appendChild(editorContainer);

    editorChild.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    expect(themeFn).not.toHaveBeenCalled();
  });

  it('triggers Cmd+K or Ctrl+K for command palette even if focused in input', () => {
    const paletteFn = vi.fn();
    keyboard.registerAction({
      id: 'open-command-palette',
      name: 'Command Palette',
      description: 'Open palette',
      keyCombination: 'k',
      handler: paletteFn
    });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    expect(paletteFn).toHaveBeenCalledTimes(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    expect(paletteFn).toHaveBeenCalledTimes(2);
  });
});
