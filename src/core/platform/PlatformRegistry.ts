import type { PlatformAdapter } from './PlatformAdapter';

export class PlatformRegistry {
  private static instance: PlatformRegistry;
  private adapters: PlatformAdapter[] = [];

  private constructor() {}

  public static getInstance(): PlatformRegistry {
    if (!PlatformRegistry.instance) {
      PlatformRegistry.instance = new PlatformRegistry();
    }
    return PlatformRegistry.instance;
  }

  public register(adapter: PlatformAdapter): void {
    const exists = this.adapters.some(a => a.platformId === adapter.platformId);
    if (!exists) {
      this.adapters.push(adapter);
    }
  }

  public detectAdapter(url: URL): PlatformAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.matches(url)) {
        return adapter;
      }
    }
    return null;
  }

  public getAll(): readonly PlatformAdapter[] {
    return this.adapters;
  }

  public clear(): void {
    this.adapters = [];
  }
}
