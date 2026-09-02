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

async function bootstrap(): Promise<void> {
  const currentUrlStr = window.location.href;
  if (currentUrlStr === lastProcessedUrl && document.getElementById('leetfox-app')) {
    return;
  }

  const url = new URL(currentUrlStr);
  const adapter = registry.detectAdapter(url);
  if (!adapter) {
    return;
  }

  if (!adapter.isProblemPage(url, document)) {
    return;
  }

  // Prevent multiple injections
  const existingApp = document.getElementById('leetfox-app');
  if (existingApp) {
    existingApp.remove();
  }

  const problem = adapter.parseProblem(document, url);
  if (!problem) {
    console.info('[Leetfox] Problem parsing did not find required elements. Original page preserved.');
    return;
  }

  try {
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

// Watch for SPA / dynamic navigation
let prevUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== prevUrl) {
    prevUrl = window.location.href;
    bootstrap();
  }
});

urlObserver.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener('popstate', () => {
  bootstrap();
});
