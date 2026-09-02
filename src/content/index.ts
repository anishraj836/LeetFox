import { SubmissionManager } from '../core/submission/SubmissionManager';
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
let bootstrapDebounceTimer: any = null;

async function bootstrap(): Promise<void> {
  if (isBootstrapping) return;
  isBootstrapping = true;

  try {
    const currentUrlStr = window.location.href;
    const currentUrl = new URL(currentUrlStr);
    const normalizedUrl = currentUrl.origin + currentUrl.pathname;

    // Handle submit pages for CSES and Codeforces
    const subManager = SubmissionManager.getInstance();
    if (currentUrl.hostname.includes('cses.fi') && currentUrl.pathname.includes('/submit/')) {
      const handled = await subManager.handleCSESSubmitPage(document, currentUrl);
      if (handled) return;
    }
    if ((currentUrl.hostname.includes('codeforces.com') || currentUrl.hostname.includes('codeforces.net')) && currentUrl.pathname.includes('/submit')) {
      const handled = await subManager.handleCodeforcesSubmitPage(document, currentUrl);
      if (handled) return;
    }

    // Check if already cleanly mounted for this problem URL
    if (normalizedUrl === lastProcessedUrl && document.getElementById('leetfox-app')) {
      return;
    }

    const adapter = registry.detectAdapter(currentUrl);
    if (!adapter || !adapter.isProblemPage(currentUrl, document)) {
      if (currentApp) {
        currentApp.destroy();
        currentApp = null;
      }
      document.body.classList.remove('lf-active');
      document.querySelectorAll('#leetfox-app, #lf-floating-switcher').forEach(el => el.remove());
      return;
    }

    const problem = adapter.parseProblem(document, currentUrl);
    if (!problem) {
      console.info('[Leetfox] Problem parsing did not find required elements. Original page preserved.');
      return;
    }

    // Clean up previous app instance and purge any rogue duplicates in DOM
    if (currentApp) {
      currentApp.destroy();
      currentApp = null;
    }
    document.querySelectorAll('#leetfox-app, #lf-floating-switcher').forEach(el => el.remove());

    const storage = StorageManager.getInstance();
    const state = await storage.getProblemState(problem.platform, problem.id);
    const prefs = await storage.getPreferences();

    // Mark last visited
    await storage.saveProblemState(problem.platform, problem.id, {
      lastVisited: Date.now()
    });

    currentApp = new LeetfoxApp(adapter, problem, state, prefs);
    await currentApp.mount(document);
    lastProcessedUrl = normalizedUrl;
    console.log(`[Leetfox] Initialized modern view for ${adapter.name}: ${problem.id} - ${problem.title}`);
  } catch (err) {
    console.error('[Leetfox] Failed to mount application', err);
  } finally {
    isBootstrapping = false;
  }
}

function scheduleBootstrap(): void {
  if (bootstrapDebounceTimer) clearTimeout(bootstrapDebounceTimer);
  bootstrapDebounceTimer = setTimeout(() => {
    bootstrap();
  }, 40);
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    scheduleBootstrap();
  });
} else {
  scheduleBootstrap();
}

// Intercept SPA navigation cleanly
window.addEventListener('popstate', scheduleBootstrap);

const originalPushState = history.pushState;
history.pushState = function (data: any, unused: string, url?: string | URL | null) {
  originalPushState.call(this, data, unused, url);
  scheduleBootstrap();
};

const originalReplaceState = history.replaceState;
history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
  originalReplaceState.call(this, data, unused, url);
  scheduleBootstrap();
};
