import { StorageManager } from '../core/storage/StorageManager';

async function initPopup(): Promise<void> {
  const storage = StorageManager.getInstance();

  // Load preferences
  const prefs = await storage.getPreferences();
  const themeToggle = document.getElementById('theme-toggle') as HTMLInputElement | null;
  if (themeToggle) {
    themeToggle.checked = prefs.theme === 'dark';
    themeToggle.addEventListener('change', async () => {
      await storage.savePreferences({ theme: themeToggle.checked ? 'dark' : 'light' });
    });
  }

  // Load stats
  const cfStates = await storage.getAllProblemStatesForPlatform('codeforces');
  let cfSolved = 0;
  cfStates.forEach(s => { if (s.solved) cfSolved++; });
  const cfCountEl = document.getElementById('cf-solved-count');
  if (cfCountEl) cfCountEl.textContent = String(cfSolved);

  const csesStates = await storage.getAllProblemStatesForPlatform('cses');
  let csesSolved = 0;
  csesStates.forEach(s => { if (s.solved) csesSolved++; });
  const csesCountEl = document.getElementById('cses-solved-count');
  if (csesCountEl) csesCountEl.textContent = String(csesSolved);
}

document.addEventListener('DOMContentLoaded', () => {
  initPopup().catch(console.error);
});
