// Test setup for jsdom environment and browser WebExtension APIs

class MemoryStorageArea {
  private store: Map<string, any> = new Map();

  async get(keys?: string | string[] | Record<string, any> | null): Promise<Record<string, any>> {
    if (!keys) {
      const all: Record<string, any> = {};
      this.store.forEach((v, k) => { all[k] = JSON.parse(JSON.stringify(v)); });
      return all;
    }
    if (typeof keys === 'string') {
      const val = this.store.get(keys);
      return val !== undefined ? { [keys]: JSON.parse(JSON.stringify(val)) } : {};
    }
    if (Array.isArray(keys)) {
      const res: Record<string, any> = {};
      for (const k of keys) {
        if (this.store.has(k)) {
          res[k] = JSON.parse(JSON.stringify(this.store.get(k)));
        }
      }
      return res;
    }
    if (typeof keys === 'object') {
      const res: Record<string, any> = { ...keys };
      for (const k of Object.keys(keys)) {
        if (this.store.has(k)) {
          res[k] = JSON.parse(JSON.stringify(this.store.get(k)));
        }
      }
      return res;
    }
    return {};
  }

  async set(items: Record<string, any>): Promise<void> {
    for (const [k, v] of Object.entries(items)) {
      this.store.set(k, JSON.parse(JSON.stringify(v)));
    }
  }

  async remove(keys: string | string[]): Promise<void> {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      this.store.delete(k);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

const mockStorage = {
  local: new MemoryStorageArea(),
  sync: new MemoryStorageArea()
};

(globalThis as any).browser = {
  storage: mockStorage,
  runtime: {
    getURL: (path: string) => `moz-extension://mock-id/${path}`,
    sendMessage: async () => ({})
  }
};

(globalThis as any).chrome = {
  storage: mockStorage,
  runtime: {
    getURL: (path: string) => `chrome-extension://mock-id/${path}`,
    sendMessage: (_msg: any, cb?: (res: any) => void) => {
      if (cb) cb({});
    }
  }
};

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

// CodeMirror 6 requires requestAnimationFrame/cancelAnimationFrame.
// JSDOM may have requestAnimationFrame (via timers) but NOT cancelAnimationFrame.
// CodeMirror accesses these via `this.win` which is `document.defaultView` (JSDOM's Window).
// We must patch ALL possible window references.

const rafPolyfill = (cb: FrameRequestCallback): number => {
  return setTimeout(() => cb(Date.now()), 0) as unknown as number;
};
const cafPolyfill = (id: number): void => {
  clearTimeout(id);
};

// Patch globalThis
if (typeof globalThis.requestAnimationFrame !== 'function') {
  (globalThis as any).requestAnimationFrame = rafPolyfill;
}
if (typeof globalThis.cancelAnimationFrame !== 'function') {
  (globalThis as any).cancelAnimationFrame = cafPolyfill;
}

// Patch window
if (typeof window !== 'undefined') {
  if (typeof window.requestAnimationFrame !== 'function') {
    (window as any).requestAnimationFrame = rafPolyfill;
  }
  if (typeof window.cancelAnimationFrame !== 'function') {
    (window as any).cancelAnimationFrame = cafPolyfill;
  }
}

// Patch document.defaultView (this is the one CodeMirror actually uses as `this.win`)
if (typeof document !== 'undefined' && document.defaultView) {
  const dv = document.defaultView as any;
  if (typeof dv.requestAnimationFrame !== 'function') {
    dv.requestAnimationFrame = rafPolyfill;
  }
  if (typeof dv.cancelAnimationFrame !== 'function') {
    dv.cancelAnimationFrame = cafPolyfill;
  }
}

// CodeMirror needs createRange in JSDOM
if (typeof document !== 'undefined') {
  if (typeof document.createRange !== 'function') {
    (document as any).createRange = () => ({
      setStart: () => {},
      setEnd: () => {},
      getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }),
      getClientRects: () => [],
      commonAncestorContainer: document.body,
    });
  }
}
