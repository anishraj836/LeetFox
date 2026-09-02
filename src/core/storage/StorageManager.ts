import { DEFAULT_PROBLEM_STATE, type ProblemState } from '../models/state';
import { DEFAULT_PREFERENCES, type UserPreferences } from '../models/preferences';

type StateChangeListener = (qualifiedId: string, state: ProblemState) => void;
type PreferencesChangeListener = (prefs: UserPreferences) => void;

export class StorageManager {
  private static instance: StorageManager;
  private memoryStore = new Map<string, any>();
  private stateListeners: Set<StateChangeListener> = new Set();
  private prefListeners: Set<PreferencesChangeListener> = new Set();
  private lastNotifiedState = new Map<string, string>();
  private lastNotifiedPrefs = '';

  private constructor() {
    this.setupStorageChangeListener();
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  private setupStorageChangeListener(): void {
    try {
      const onChanged =
        (globalThis as any).browser?.storage?.onChanged ||
        (globalThis as any).chrome?.storage?.onChanged;

      if (onChanged && typeof onChanged.addListener === 'function') {
        onChanged.addListener((changes: Record<string, any>, areaName?: string) => {
          if (!areaName || areaName === 'local') {
            for (const [key, change] of Object.entries(changes)) {
              if (key.startsWith('problem:')) {
                const newState = { ...DEFAULT_PROBLEM_STATE, ...(change.newValue || {}) };
                this.notifyStateListeners(key, newState);
              } else if (key === 'settings:preferences') {
                const newPrefs = { ...DEFAULT_PREFERENCES, ...(change.newValue || {}) };
                this.notifyPrefListeners(newPrefs);
              }
            }
          }
        });
      }
    } catch (e) {
      console.warn('[Leetfox Storage] Could not attach storage.onChanged listener', e);
    }
  }

  private getStorageArea(): any {
    if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser?.storage?.local) {
      return (globalThis as any).browser.storage.local;
    }
    if (typeof (globalThis as any).chrome !== 'undefined' && (globalThis as any).chrome?.storage?.local) {
      return (globalThis as any).chrome.storage.local;
    }
    return null;
  }

  public getQualifiedKey(platform: string, id: string): string {
    return `problem:${platform.toLowerCase()}:${id.trim().toLowerCase()}`;
  }

  public async getProblemState(platform: string, id: string): Promise<ProblemState> {
    const key = this.getQualifiedKey(platform, id);
    try {
      const storage = this.getStorageArea();
      if (storage) {
        let result: any;
        if (typeof storage.get === 'function') {
          const res = storage.get(key);
          result = res instanceof Promise ? await res : await new Promise(r => storage.get(key, r));
        }
        if (result && result[key]) {
          return { ...DEFAULT_PROBLEM_STATE, ...result[key] };
        }
      } else if (this.memoryStore.has(key)) {
        return { ...DEFAULT_PROBLEM_STATE, ...this.memoryStore.get(key) };
      }
    } catch (e) {
      console.warn(`[Leetfox Storage] Failed to get state for ${key}`, e);
    }
    return { ...DEFAULT_PROBLEM_STATE };
  }

  public async saveProblemState(platform: string, id: string, updates: Partial<ProblemState>): Promise<ProblemState> {
    const key = this.getQualifiedKey(platform, id);
    const current = await this.getProblemState(platform, id);
    const updated: ProblemState = {
      ...current,
      ...updates,
      lastVisited: Date.now()
    };

    try {
      const storage = this.getStorageArea();
      if (storage) {
        if (typeof storage.set === 'function') {
          const res = storage.set({ [key]: updated });
          if (res instanceof Promise) {
            await res;
          } else {
            await new Promise<void>(r => storage.set({ [key]: updated }, r));
          }
        }
      } else {
        this.memoryStore.set(key, updated);
      }
    } catch (e) {
      console.warn(`[Leetfox Storage] Failed to save state for ${key}`, e);
      this.memoryStore.set(key, updated);
    }

    // Notify listeners (deduplication prevents double-firing when storage.onChanged triggers)
    this.notifyStateListeners(key, updated);
    return updated;
  }

  public async getAllProblemStatesForPlatform(platform: string): Promise<Map<string, ProblemState>> {
    const prefix = `problem:${platform.toLowerCase()}:`;
    const resultMap = new Map<string, ProblemState>();

    try {
      const storage = this.getStorageArea();
      if (storage) {
        let all: Record<string, any> = {};
        const res = storage.get(null);
        all = res instanceof Promise ? await res : await new Promise(r => storage.get(null, r));
        
        for (const [k, v] of Object.entries(all || {})) {
          if (k.startsWith(prefix)) {
            const rawId = k.slice(prefix.length);
            resultMap.set(rawId, { ...DEFAULT_PROBLEM_STATE, ...v });
          }
        }
      } else {
        for (const [k, v] of this.memoryStore.entries()) {
          if (k.startsWith(prefix)) {
            const rawId = k.slice(prefix.length);
            resultMap.set(rawId, { ...DEFAULT_PROBLEM_STATE, ...v });
          }
        }
      }
    } catch (e) {
      console.warn(`[Leetfox Storage] Failed to get platform states for ${platform}`, e);
    }

    return resultMap;
  }

  public async getPreferences(): Promise<UserPreferences> {
    const key = 'settings:preferences';
    try {
      const storage = this.getStorageArea();
      if (storage) {
        let result: any;
        const res = storage.get(key);
        result = res instanceof Promise ? await res : await new Promise(r => storage.get(key, r));
        if (result && result[key]) {
          return { ...DEFAULT_PREFERENCES, ...result[key] };
        }
      } else if (this.memoryStore.has(key)) {
        return { ...DEFAULT_PREFERENCES, ...this.memoryStore.get(key) };
      }
    } catch (e) {
      console.warn('[Leetfox Storage] Failed to load preferences', e);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  public async savePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const key = 'settings:preferences';
    const current = await this.getPreferences();
    const updated: UserPreferences = { ...current, ...updates };

    try {
      const storage = this.getStorageArea();
      if (storage) {
        const res = storage.set({ [key]: updated });
        if (res instanceof Promise) {
          await res;
        } else {
          await new Promise<void>(r => storage.set({ [key]: updated }, r));
        }
      } else {
        this.memoryStore.set(key, updated);
      }
    } catch (e) {
      console.warn('[Leetfox Storage] Failed to save preferences', e);
      this.memoryStore.set(key, updated);
    }

    this.notifyPrefListeners(updated);
    return updated;
  }

  public onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public onPreferencesChange(listener: PreferencesChangeListener): () => void {
    this.prefListeners.add(listener);
    return () => this.prefListeners.delete(listener);
  }

  private serializeState(state: ProblemState): string {
    return JSON.stringify({
      solved: state.solved,
      attempted: state.attempted,
      bookmarked: state.bookmarked,
      notes: state.notes
    });
  }

  private notifyStateListeners(qualifiedId: string, state: ProblemState): void {
    const serialized = this.serializeState(state);
    if (this.lastNotifiedState.get(qualifiedId) === serialized) {
      return; // Deduplicate identical notification
    }
    this.lastNotifiedState.set(qualifiedId, serialized);

    for (const listener of this.stateListeners) {
      try {
        listener(qualifiedId, state);
      } catch (err) {
        console.error('Error in state change listener', err);
      }
    }
  }

  private notifyPrefListeners(prefs: UserPreferences): void {
    const serialized = JSON.stringify(prefs);
    if (this.lastNotifiedPrefs === serialized) {
      return; // Deduplicate identical notification
    }
    this.lastNotifiedPrefs = serialized;

    for (const listener of this.prefListeners) {
      try {
        listener(prefs);
      } catch (err) {
        console.error('Error in preferences change listener', err);
      }
    }
  }
}
