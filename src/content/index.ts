import './styles/leetfox.css';

import { PlatformRegistry } from '../core/platform/PlatformRegistry';
import { StorageManager } from '../core/storage/StorageManager';
import { CodeforcesAdapter } from '../platforms/codeforces/CodeforcesAdapter';
import { CSESAdapter } from '../platforms/cses/CSESAdapter';
import { LeetfoxApp } from '../ui/LeetfoxApp';

// Initialize and register all platform adapters
const registry = PlatformRegistry.getInstance();
registry.register(new CodeforcesAdapter());
registry.register(new CSESAdapter());

let currentApp: LeetfoxApp | null = null;
let lastProcessedUrl = '';
let isBootstrapping = false;

async function bootstrap(): Promise<void> {
  if (isBootstrapping) return;
  isBootstrapping = true;

  try {
    const currentUrlStr = window.location.href;
    if (currentUrlStr === lastProcessedUrl && document.getElementById('leetfox-app')) {
      return;
    }

    const url = new URL(currentUrlStr);
    const adapter = registry.detectAdapter(url);
    if (!adapter) {
      if (currentApp) {
        currentApp.destroy();
        currentApp = null;
      }
      return;
    }

    if (!adapter.isProblemPage(url, document)) {
      if (currentApp) {
        currentApp.destroy();
        currentApp = null;
      }
      return;
    }

    const problem = adapter.parseProblem(document, url);
    if (!problem) {
      console.info('[Leetfox] Problem parsing did not find required elements. Original page preserved.');
      return;
    }

    // Clean up previous app instance
    if (currentApp) {
      currentApp.destroy();
      currentApp = null;
    }

    const storage = StorageManager.getInstance();
    const state = await storage.getProblemState(problem.platform, problem.id);
    const prefs = await storage.getPreferences();

    // Mark last visited
    await storage.saveProblemState(problem.platform, problem.id, {
      lastVisited: Date.now()
    });

    currentApp = new LeetfoxApp(adapter, problem, state, prefs);
    await currentApp.mount(document);
    lastProcessedUrl = currentUrlStr;
    console.log(`[Leetfox] Initialized modern view for ${adapter.name}: ${problem.id} - ${problem.title}`);
  } catch (err) {
    console.error('[Leetfox] Failed to mount application', err);
  } finally {
    isBootstrapping = false;
  }
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap();
  });
} else {
  bootstrap();
}

// Intercept SPA navigation without expensive subtree MutationObservers
window.addEventListener('popstate', () => {
  bootstrap();
});

const originalPushState = history.pushState;
history.pushState = function (data: any, unused: string, url?: string | URL | null) {
  originalPushState.call(this, data, unused, url);
  setTimeout(bootstrap, 50);
};

const originalReplaceState = history.replaceState;
history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
  originalReplaceState.call(this, data, unused, url);
  setTimeout(bootstrap, 50);
};
