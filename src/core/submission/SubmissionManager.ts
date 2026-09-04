import { createElement } from '../utils/dom';

export interface PendingSubmission {
  platform: string;
  problemId: string;
  language: string;
  code: string;
  timestamp: number;
}

export class SubmissionManager {
  private static instance: SubmissionManager;

  public static getInstance(): SubmissionManager {
    if (!SubmissionManager.instance) {
      SubmissionManager.instance = new SubmissionManager();
    }
    return SubmissionManager.instance;
  }

  public async setPendingSubmission(submission: PendingSubmission): Promise<void> {
    try {
      const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
      if (storageArea) {
        const res = storageArea.set({ 'pending:submission': submission });
        if (res instanceof Promise) await res;
      }
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('pending:submission', JSON.stringify(submission));
      }
    } catch (_) {}
  }

  public async getPendingSubmission(): Promise<PendingSubmission | null> {
    try {
      const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
      if (storageArea) {
        const res = await (storageArea.get('pending:submission') instanceof Promise ? storageArea.get('pending:submission') : new Promise<any>(r => storageArea.get('pending:submission', r)));
        if (res && res['pending:submission']) {
          const sub = res['pending:submission'] as PendingSubmission;
          if (Date.now() - sub.timestamp < 600000) {
            return sub;
          }
        }
      }
    } catch (_) {}

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const raw = sessionStorage.getItem('pending:submission');
        if (raw) {
          const sub = JSON.parse(raw) as PendingSubmission;
          if (Date.now() - sub.timestamp < 600000) {
            return sub;
          }
        }
      }
    } catch (_) {}

    return null;
  }

  public async clearPendingSubmission(): Promise<void> {
    try {
      const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
      if (storageArea) {
        const res = storageArea.remove('pending:submission');
        if (res instanceof Promise) await res;
      }
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem('pending:submission');
      }
    } catch (_) {}
  }

  public getFilenameForLanguage(lang: string): string {
    switch (lang.toLowerCase()) {
      case 'cpp': return 'solution.cpp';
      case 'python': return 'solution.py';
      case 'java': return 'Solution.java';
      case 'rust': return 'solution.rs';
      case 'go': return 'solution.go';
      default: return 'solution.txt';
    }
  }

  /**
   * Submit to CSES seamlessly via in-page fetch using the user's active session.
   */
  /**
   * Fast synchronous check whether user is authenticated on CSES based on page DOM
   */
  public isUserLoggedInOnCSES(doc: Document = document): boolean {
    // If there is an explicit login link in header controls, user is not logged in
    const loginLink = doc.querySelector('.header .controls a[href*="/login"], a.account[href*="/login"], a[href="/login"]');
    if (loginLink) return false;

    // If there is an account link with a username that is not login, user is logged in
    const accountLink = doc.querySelector('.header .controls a.account, .header a.account');
    if (accountLink && !accountLink.getAttribute('href')?.includes('/login')) {
      return true;
    }

    // Check if logout link exists
    const logoutLink = doc.querySelector('a[href*="/logout"]');
    if (logoutLink) return true;

    // Check if submit tab exists in problem navigation
    const submitTab = doc.querySelector('.title-block .nav a[href*="/submit/"], .nav a[href*="/submit/"]');
    if (submitTab) return true;

    return true;
  }

  /**
   * Submit to CSES seamlessly via in-page fetch using the user's active session.
   */
  public async submitCSESDirect(
    taskId: string,
    code: string,
    language: string
  ): Promise<{ success: boolean; resultUrl?: string; error?: string }> {
    const origin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://cses.fi';
    const submitPageUrl = `${origin}/problemset/submit/${taskId}/`;

    try {
      // 1. Fetch submit page to obtain CSRF token and verify active session
      const pageRes = await fetch(submitPageUrl, { credentials: 'include' });
      if (!pageRes.ok || pageRes.url.includes('/login')) {
        return {
          success: false,
          error: 'You must be logged in to CSES to submit. Please log in to your CSES account.'
        };
      }

      const html = await pageRes.text();

      // Extract csrf_token reliably
      let csrfToken = '';
      try {
        if (typeof DOMParser !== 'undefined') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const csrfInput = doc.querySelector('input[name="csrf_token"]') as HTMLInputElement;
          if (csrfInput?.value) {
            csrfToken = csrfInput.value;
          }
        }
      } catch (_) {}

      if (!csrfToken) {
        const tokenMatch = html.match(/name=["']?csrf_token["']?[^>]*value=["']?([a-zA-Z0-9_-]+)["']?/i)
          || html.match(/value=["']?([a-zA-Z0-9_-]+)["']?[^>]*name=["']?csrf_token["']?/i);
        if (tokenMatch) {
          csrfToken = tokenMatch[1];
        }
      }

      if (!csrfToken) {
        return {
          success: false,
          error: 'Could not find CSRF token on CSES. Please ensure you are logged in.'
        };
      }

      const filename = this.getFilenameForLanguage(language);
      const blob = new Blob([code], { type: 'text/plain' });

      const formData = new FormData();
      formData.append('csrf_token', csrfToken);
      formData.append('file', blob, filename);
      formData.append('submit', 'Submit');

      const postRes = await fetch(submitPageUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        redirect: 'follow'
      });

      if (postRes.ok) {
        const finalUrl = postRes.url;
        if (finalUrl.includes('/login')) {
          return { success: false, error: 'You must be logged in to CSES to submit. Please log in to your CSES account.' };
        }

        // Check if response contains an error message from CSES
        try {
          const resText = await postRes.text();
          if (typeof DOMParser !== 'undefined') {
            const resDoc = new DOMParser().parseFromString(resText, 'text/html');
            const errorEl = resDoc.querySelector('p.error, .error, .alert-danger');
            if (errorEl && errorEl.textContent?.trim()) {
              return { success: false, error: errorEl.textContent.trim() };
            }
          }
        } catch (_) {}

        return {
          success: true,
          resultUrl: finalUrl.includes('/result/') ? finalUrl : `${origin}/problemset/result/${taskId}/`
        };
      }

      return { success: false, error: `Submission rejected by CSES (status ${postRes.status}).` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while submitting to CSES.' };
    }
  }

  /**
   * Handles auto-filling and auto-attaching code on CSES submit page (https://cses.fi/problemset/submit/*)
   */
  public async handleCSESSubmitPage(doc: Document, url: URL): Promise<boolean> {
    const match = url.pathname.match(/\/problemset\/submit\/(\d+)/i);
    if (!match) return false;

    const taskId = match[1];
    const pending = await this.getPendingSubmission();

    let codeToSubmit = pending?.problemId === taskId ? pending.code : null;
    let lang = pending?.problemId === taskId ? pending.language : 'cpp';

    if (!codeToSubmit) {
      const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
      const candidateLangs = ['cpp', 'python', 'java', 'rust', 'go'];
      for (const candidate of candidateLangs) {
        const key = `code:cses:${taskId}:${candidate}`;
        if (storageArea) {
          const res = await (storageArea.get(key) instanceof Promise ? storageArea.get(key) : new Promise<any>(r => storageArea.get(key, r)));
          if (res && res[key]) {
            codeToSubmit = res[key];
            lang = candidate;
            break;
          }
        }
        if (typeof window !== 'undefined' && window.localStorage) {
          const localCode = window.localStorage.getItem(key);
          if (localCode) {
            codeToSubmit = localCode;
            lang = candidate;
            break;
          }
        }
      }
    }

    if (!codeToSubmit || codeToSubmit.trim().length === 0) {
      return false;
    }

    const form = doc.querySelector('form[method="post"], form') as HTMLFormElement;
    if (!form) return false;

    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput) return false;

    // Attach file using modern DataTransfer API
    const filename = this.getFilenameForLanguage(lang);
    const file = new File([codeToSubmit], filename, { type: 'text/plain' });

    try {
      if (typeof DataTransfer !== 'undefined') {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (e) {
      console.warn('[Leetfox] Could not set DataTransfer files on CSES file input', e);
    }

    // Inject modern Leetfox confirmation banner with auto-submit countdown
    if (!doc.getElementById('lf-cses-submit-banner')) {
      const banner = createElement('div', {
        id: 'lf-cses-submit-banner',
        className: 'lf-submit-page-banner'
      });

      const icon = createElement('span', { className: 'lf-banner-icon' }, '🦊');
      const textGroup = createElement('div', { className: 'lf-banner-text' });
      const bannerTitle = createElement('strong', {}, `Leetfox ready to submit for Task ${taskId}`);
      
      let secondsLeft = 3;
      const bannerSub = createElement('p', {}, `Attached ${filename}. Auto-submitting in ${secondsLeft}s...`);

      textGroup.appendChild(bannerTitle);
      textGroup.appendChild(bannerSub);

      let countdownTimer: any = null;

      const triggerSubmit = async () => {
        if (countdownTimer) clearInterval(countdownTimer);
        bannerSub.textContent = 'Submitting code to CSES now... 🚀';
        
        // Attempt privileged direct submission via background script
        const res = await this.submitCSESDirect(taskId, codeToSubmit, lang);
        if (res.success && res.resultUrl) {
          window.location.href = res.resultUrl;
          return;
        }

        // If user is not logged in, direct to login page
        if (res.error && res.error.includes('logged in')) {
          window.location.href = 'https://cses.fi/login';
          return;
        }

        // Fallback to DOM submission
        const actualSubmitBtn = form.querySelector('input[type="submit"], button[type="submit"]') as HTMLElement;
        if (actualSubmitBtn) {
          actualSubmitBtn.click();
        } else {
          form.submit();
        }
      };

      const submitNowBtn = createElement('button', {
        className: 'lf-btn lf-btn-primary',
        type: 'button',
        title: 'Submit this code immediately',
        onClick: triggerSubmit
      }, 'Submit Now 🚀');

      const cancelBtn = createElement('button', {
        className: 'lf-btn',
        type: 'button',
        title: 'Cancel auto-submission to edit or review',
        onClick: () => {
          if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
          }
          bannerSub.textContent = `Attached ${filename}. Auto-submit paused. Click "Submit Now" when ready.`;
          cancelBtn.style.display = 'none';
        }
      }, 'Cancel ⏸️');

      countdownTimer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          triggerSubmit();
        } else {
          bannerSub.textContent = `Attached ${filename}. Auto-submitting in ${secondsLeft}s...`;
        }
      }, 1000);

      const btnGroup = createElement('div', { style: 'display: flex; gap: 8px; align-items: center;' });
      btnGroup.appendChild(cancelBtn);
      btnGroup.appendChild(submitNowBtn);

      banner.appendChild(icon);
      banner.appendChild(textGroup);
      banner.appendChild(btnGroup);

      form.parentNode?.insertBefore(banner, form);
    }

    return true;
  }

  /**
   * Helper to select matching compiler on Codeforces submit form
   */
  private selectMatchingCodeforcesLanguage(select: HTMLSelectElement, lang: string): void {
    const l = lang.toLowerCase();
    const options = Array.from(select.options);

    let matchOption: HTMLOptionElement | undefined;

    if (l === 'cpp') {
      matchOption = options.find(o => /g\+\+20|g\+\+17|g\+\+23|gnu c\+\+/i.test(o.text))
        || options.find(o => /c\+\+/i.test(o.text));
    } else if (l === 'python') {
      matchOption = options.find(o => /python 3|pypy 3/i.test(o.text))
        || options.find(o => /python/i.test(o.text));
    } else if (l === 'java') {
      matchOption = options.find(o => /java 21|java 17|java 11|openjdk/i.test(o.text))
        || options.find(o => /java/i.test(o.text));
    } else if (l === 'rust') {
      matchOption = options.find(o => /rust/i.test(o.text));
    } else if (l === 'go') {
      matchOption = options.find(o => /\bgo\b/i.test(o.text));
    }

    if (matchOption) {
      select.value = matchOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Handles auto-filling code on Codeforces submit page
   */
  public async handleCodeforcesSubmitPage(doc: Document, url: URL): Promise<boolean> {
    const isSubmitPage = url.pathname.includes('/submit');
    if (!isSubmitPage) return false;

    const pending = await this.getPendingSubmission();
    if (!pending || pending.platform !== 'codeforces') return false;

    const form = doc.querySelector('form.submitForm, form[action*="/submit"]') as HTMLFormElement;
    if (!form) return false;

    // Parse problemId into contestId and index if possible
    // e.g. "4A" -> contestId "4", index "A"
    const match = pending.problemId.match(/^(\d+)([A-Za-z0-9]+)$/);
    const index = match ? match[2] : pending.problemId;

    // 1. Contest submit pages often have select[name="submittedProblemIndex"]
    const problemSelect = form.querySelector('select[name="submittedProblemIndex"]') as HTMLSelectElement;
    if (problemSelect) {
      const option = Array.from(problemSelect.options).find(o => 
        o.value.toUpperCase() === index.toUpperCase() ||
        o.text.trim().toUpperCase().startsWith(index.toUpperCase())
      );
      if (option) {
        problemSelect.value = option.value;
        problemSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 2. Problemset and contest submit pages with input[name="submittedProblemCode"]
    const problemInput = form.querySelector('input[name="submittedProblemCode"]') as HTMLInputElement;
    if (problemInput) {
      problemInput.value = pending.problemId;
      problemInput.dispatchEvent(new Event('input', { bubbles: true }));
      problemInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 3. Set language dropdown on Codeforces submit form
    const langSelect = form.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
    if (langSelect) {
      this.selectMatchingCodeforcesLanguage(langSelect, pending.language);
    }

    // 4. Fill source code in textarea
    const textarea = form.querySelector('textarea#sourceCodeTextarea, textarea[name="source"]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = pending.code;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 5. Update Ace Editor if active on page
    try {
      const win = doc.defaultView as any;
      if (win && win.ace && typeof win.ace.edit === 'function') {
        const aceEditor = win.ace.edit('editor');
        if (aceEditor && typeof aceEditor.setValue === 'function') {
          aceEditor.setValue(pending.code, 1);
        }
      }
    } catch (_) {}

    // 6. Attach file if file input exists
    const fileInput = form.querySelector('input[type="file"][name="sourceFile"]') as HTMLInputElement;
    if (fileInput) {
      const filename = this.getFilenameForLanguage(pending.language);
      const file = new File([pending.code], filename, { type: 'text/plain' });
      try {
        if (typeof DataTransfer !== 'undefined') {
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (_) {}
    }

    // 7. Inject Leetfox Confirmation Banner with 3s auto-submit countdown
    if (!doc.getElementById('lf-cf-submit-banner')) {
      const banner = createElement('div', {
        id: 'lf-cf-submit-banner',
        className: 'lf-submit-page-banner'
      });

      const icon = createElement('span', { className: 'lf-banner-icon' }, '🦊');
      const textGroup = createElement('div', { className: 'lf-banner-text' });
      const bannerTitle = createElement('strong', {}, `Leetfox loaded your solution for ${pending.problemId}`);
      
      let secondsLeft = 3;
      const bannerSub = createElement('p', {}, `Language: ${pending.language.toUpperCase()}. Auto-submitting in ${secondsLeft}s...`);

      textGroup.appendChild(bannerTitle);
      textGroup.appendChild(bannerSub);

      let countdownTimer: any = null;

      const triggerSubmit = () => {
        if (countdownTimer) clearInterval(countdownTimer);
        bannerSub.textContent = 'Submitting solution to Codeforces now... 🚀';
        const submitBtn = form.querySelector('input[type="submit"]') as HTMLElement;
        if (submitBtn) {
          submitBtn.click();
        } else {
          form.submit();
        }
      };

      const submitNowBtn = createElement('button', {
        className: 'lf-btn lf-btn-primary',
        type: 'button',
        title: 'Submit this code immediately',
        onClick: triggerSubmit
      }, 'Submit Now 🚀');

      const cancelBtn = createElement('button', {
        className: 'lf-btn',
        type: 'button',
        title: 'Cancel auto-submission to review code',
        onClick: () => {
          if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
          }
          bannerSub.textContent = `Language: ${pending.language.toUpperCase()}. Auto-submit paused. Click "Submit Now" when ready.`;
          cancelBtn.style.display = 'none';
        }
      }, 'Cancel ⏸️');

      countdownTimer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          triggerSubmit();
        } else {
          bannerSub.textContent = `Language: ${pending.language.toUpperCase()}. Auto-submitting in ${secondsLeft}s...`;
        }
      }, 1000);

      const btnGroup = createElement('div', { style: 'display: flex; gap: 8px; align-items: center;' });
      btnGroup.appendChild(cancelBtn);
      btnGroup.appendChild(submitNowBtn);

      banner.appendChild(icon);
      banner.appendChild(textGroup);
      banner.appendChild(btnGroup);

      form.parentNode?.insertBefore(banner, form);
    }

    return true;
  }
}
