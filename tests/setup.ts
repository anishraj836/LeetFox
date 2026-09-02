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
