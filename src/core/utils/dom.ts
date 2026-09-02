/**
 * Safe DOM creation and manipulation helpers
 */

export type DOMAttributes = Record<string, string | number | boolean | Function | Record<string, any> | undefined>;

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes?: DOMAttributes,
  children?: (Node | string | null | undefined)[] | string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName);

  if (attributes) {
    for (const [key, val] of Object.entries(attributes)) {
      if (val === undefined || val === false) continue;
      if (key === 'className' || key === 'class') {
        el.className = String(val);
      } else if (key === 'dataset' && typeof val === 'object') {
        Object.assign(el.dataset, val);
      } else if (key.startsWith('on') && typeof val === 'function') {
        const eventName = key.slice(2).toLowerCase();
        el.addEventListener(eventName, val as EventListener);
      } else {
        el.setAttribute(key, String(val));
      }
    }
  }

  if (children !== undefined) {
    if (typeof children === 'string') {
      el.textContent = children;
    } else if (Array.isArray(children)) {
      for (const child of children) {
        if (!child) continue;
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else {
          el.appendChild(child);
        }
      }
    }
  }

  return el;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback using textarea
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

/**
 * Checks if the currently active element or event target is an editable input.
 * Used to prevent keyboard shortcuts while the user is typing code, notes, or form values.
 */
export function isEditableElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;

  const tagName = el.tagName.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  const ceAttr = el.getAttribute('contenteditable');
  if (ceAttr === 'true' || ceAttr === '') {
    return true;
  }

  const ceProp = (el as any).contentEditable;
  if (ceProp === 'true' || ceProp === true) {
    return true;
  }

  if (typeof el.isContentEditable === 'boolean' && el.isContentEditable) {
    return true;
  }

  if (el.closest?.('.monaco-editor, .ace_editor, .CodeMirror, .cm-editor, [contenteditable="true"], [contenteditable=""]')) {
    return true;
  }

  return false;
}
