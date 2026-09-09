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
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('pending:submission', JSON.stringify(submission));
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

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem('pending:submission');
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
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('pending:submission');
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

  public getMimeTypeForLanguage(lang: string): string {
    switch (lang.toLowerCase()) {
      case 'cpp': return 'text/x-c++src';
      case 'python': return 'text/x-python';
      case 'java': return 'text/x-java-source';
      case 'rust': return 'text/x-rust';
      case 'go': return 'text/x-go';
      default: return 'text/plain';
    }
  }

  /**
   * Converts the user code into a standard File object for submission.
   */
  public createSubmissionFile(code: string, language: string): File {
    const filename = this.getFilenameForLanguage(language);
    const mime = this.getMimeTypeForLanguage(language);
    return new File([code], filename, { type: mime, lastModified: Date.now() });
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
   * Fast synchronous check whether user is authenticated on Codeforces based on page DOM
   */
  public isUserLoggedInOnCodeforces(doc: Document = document): boolean {
    // 1. Explicit profile link or logout link indicates authenticated session
    if (doc.querySelector('a[href*="/logout"], a[href*="/profile/"]')) {
      return true;
    }
    // 2. Explicit enter/login/register links in header indicate unauthenticated session
    if (doc.querySelector('a[href*="/enter"], a[href*="/register"]')) {
      return false;
    }
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

      // Convert code to file for submission
      const file = this.createSubmissionFile(code, language);

      const formData = new FormData();
      formData.append('csrf_token', csrfToken);
      formData.append('file', file, file.name);
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

        // If redirect reached result page, submission was successful!
        if (finalUrl.includes('/result/')) {
          await this.clearPendingSubmission();
          return {
            success: true,
            resultUrl: finalUrl
          };
        }

        // Check if response contains an error message from CSES only if still on submit page
        try {
          const resText = await postRes.text();
          if (typeof DOMParser !== 'undefined') {
            const resDoc = new DOMParser().parseFromString(resText, 'text/html');
            const errorEl = resDoc.querySelector('p.error, .alert-danger');
            if (errorEl && errorEl.textContent?.trim()) {
              return { success: false, error: errorEl.textContent.trim() };
            }
          }
        } catch (_) {}

        await this.clearPendingSubmission();
        return {
          success: true,
          resultUrl: `${origin}/problemset/result/${taskId}/`
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

    const forms = Array.from(doc.querySelectorAll('form'));
    const form = forms.find(f => f.querySelector('input[type="file"]') || (f.getAttribute('action') || '').includes('/submit')) || (forms[0] as HTMLFormElement | undefined);
    if (!form) return false;

    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput) return false;

    // Convert code to file and attach using modern DataTransfer API
    const file = this.createSubmissionFile(codeToSubmit, lang);

    try {
      const DT = (doc.defaultView as any)?.DataTransfer || (globalThis as any).DataTransfer;
      if (typeof DT !== 'undefined') {
        const dt = new DT();
        dt.items.add(file);
        try {
          fileInput.files = dt.files;
        } catch (_) {}
        if (!fileInput.files || fileInput.files.length === 0) {
          Object.defineProperty(fileInput, 'files', { value: dt.files || [file], configurable: true, writable: true });
        }
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        Object.defineProperty(fileInput, 'files', { value: [file], configurable: true, writable: true });
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

      const icon = createElement('a', {
        className: 'lf-banner-icon',
        href: 'https://github.com/anishraj836/Leetfox',
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'Leetfox on GitHub'
      }, '[Leetfox]');
      const textGroup = createElement('div', { className: 'lf-banner-text' });
      const bannerTitle = createElement('strong', {}, `Leetfox ready to submit for Task ${taskId}`);
      
      let secondsLeft = 3;
      const bannerSub = createElement('p', {}, `Attached ${file.name}. Auto-submitting in ${secondsLeft}s...`);

      textGroup.appendChild(bannerTitle);
      textGroup.appendChild(bannerSub);

      let countdownTimer: any = null;

      const triggerSubmit = async () => {
        if (countdownTimer) clearInterval(countdownTimer);
        bannerSub.textContent = 'Submitting code to CSES now...';
        
        // Attempt privileged direct submission via file upload
        const res = await this.submitCSESDirect(taskId, codeToSubmit, lang);
        if (res.success && res.resultUrl) {
          await this.clearPendingSubmission();
          window.location.href = res.resultUrl;
          return;
        }

        // If user is not logged in, direct to login page
        if (res.error && res.error.includes('logged in')) {
          window.location.href = 'https://cses.fi/login';
          return;
        }

        // Fallback to DOM submission
        await this.clearPendingSubmission();
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
      }, 'Submit Now');

      const cancelBtn = createElement('button', {
        className: 'lf-btn',
        type: 'button',
        title: 'Cancel auto-submission to edit or review',
        onClick: () => {
          if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
          }
          bannerSub.textContent = `Attached ${file.name}. Auto-submit paused. Click "Submit Now" when ready.`;
          cancelBtn.style.display = 'none';
        }
      }, 'Cancel');

      countdownTimer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          triggerSubmit();
        } else {
          bannerSub.textContent = `Attached ${file.name}. Auto-submitting in ${secondsLeft}s...`;
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
  private async selectMatchingCodeforcesLanguage(select: HTMLSelectElement, lang: string): Promise<void> {
    const l = lang.toLowerCase();
    const options = Array.from(select.options);
    if (options.length === 0) return;

    // 1. Check if user already has a saved preferred Codeforces compiler in storage matching requested standard
    try {
      const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
      if (storageArea) {
        const res = await (storageArea.get('preferred_cf_compiler') instanceof Promise
          ? storageArea.get('preferred_cf_compiler')
          : new Promise<any>(r => storageArea.get('preferred_cf_compiler', r)));
        const savedId = res?.preferred_cf_compiler;
        if (savedId) {
          const matchingSavedOption = options.find(o => String(o.value) === String(savedId));
          if (matchingSavedOption) {
            const optText = matchingSavedOption.text.toLowerCase();
            let isMatch = false;
            if (l === 'cpp' || l === 'cpp20') {
              isMatch = /g\+\+20|c\+\+20|clang\+\+20/i.test(optText);
            } else if (l === 'cpp17') {
              isMatch = /g\+\+17|c\+\+17/i.test(optText);
            } else if (l === 'cpp23') {
              isMatch = /g\+\+23|c\+\+23/i.test(optText);
            } else if (l === 'python') {
              isMatch = /python|pypy/i.test(optText);
            } else if (l === 'java') {
              isMatch = /java|openjdk/i.test(optText);
            } else if (l === 'rust') {
              isMatch = /rust/i.test(optText);
            } else if (l === 'go') {
              isMatch = /\bgo\b/i.test(optText);
            }

            if (isMatch) {
              select.value = matchingSavedOption.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
          }
        }
      }
    } catch (_) {}

    // 2. Check if the currently selected option already belongs to the requested language family
    const currentOption = select.selectedOptions?.[0] || options[select.selectedIndex];
    if (currentOption && currentOption.value) {
      const curText = currentOption.text.toLowerCase();
      if ((l === 'cpp' || l === 'cpp20') && /g\+\+20|c\+\+20/i.test(curText)) {
        return;
      }
      if (l === 'cpp17' && /g\+\+17|c\+\+17/i.test(curText)) {
        return;
      }
      if (l === 'cpp23' && /g\+\+23|c\+\+23/i.test(curText)) {
        return;
      }
      if (l === 'python' && /python 3|pypy 3/i.test(curText)) {
        return;
      }
      if (l === 'java' && /java/i.test(curText)) {
        return;
      }
      if (l === 'rust' && /rust/i.test(curText)) {
        return;
      }
      if (l === 'go' && /\bgo\b/i.test(curText)) {
        return;
      }
    }

    // 3. Select the best matching compiler with strict priority (G++20 > G++23 > G++17 for cpp/cpp20)
    let matchOption: HTMLOptionElement | undefined;

    if (l === 'cpp' || l === 'cpp20') {
      matchOption = options.find(o => /g\+\+20.*64/i.test(o.text))
        || options.find(o => /g\+\+20/i.test(o.text))
        || options.find(o => /c\+\+20/i.test(o.text))
        || options.find(o => /clang\+\+20/i.test(o.text))
        || options.find(o => /g\+\+23/i.test(o.text))
        || options.find(o => /g\+\+17/i.test(o.text))
        || options.find(o => /gnu c\+\+/i.test(o.text))
        || options.find(o => /c\+\+/i.test(o.text));
    } else if (l === 'cpp17') {
      matchOption = options.find(o => /g\+\+17.*64/i.test(o.text))
        || options.find(o => /g\+\+17/i.test(o.text))
        || options.find(o => /c\+\+17/i.test(o.text))
        || options.find(o => /g\+\+20/i.test(o.text))
        || options.find(o => /c\+\+/i.test(o.text));
    } else if (l === 'cpp23') {
      matchOption = options.find(o => /g\+\+23.*64/i.test(o.text))
        || options.find(o => /g\+\+23/i.test(o.text))
        || options.find(o => /g\+\+20/i.test(o.text))
        || options.find(o => /c\+\+/i.test(o.text));
    } else if (l === 'python') {
      matchOption = options.find(o => /python 3\.\d+/i.test(o.text))
        || options.find(o => /pypy 3/i.test(o.text))
        || options.find(o => /python 3/i.test(o.text))
        || options.find(o => /python/i.test(o.text));
    } else if (l === 'java') {
      matchOption = options.find(o => /java 21/i.test(o.text))
        || options.find(o => /java 17/i.test(o.text))
        || options.find(o => /java 11/i.test(o.text))
        || options.find(o => /openjdk/i.test(o.text))
        || options.find(o => /java/i.test(o.text));
    } else if (l === 'rust') {
      matchOption = options.find(o => /rust 2021/i.test(o.text))
        || options.find(o => /rust/i.test(o.text));
    } else if (l === 'go') {
      matchOption = options.find(o => /\bgo\b/i.test(o.text));
    }

    if (matchOption) {
      select.value = matchOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 4. Auto-detect user manual compiler selection on Codeforces and persist
    select.addEventListener('change', () => {
      try {
        const chosen = select.selectedOptions?.[0] || options[select.selectedIndex];
        if (chosen) {
          const storageArea = (globalThis as any).browser?.storage?.local || (globalThis as any).chrome?.storage?.local;
          if (storageArea) {
            storageArea.set({ 'preferred_cf_compiler': chosen.value });
          }
        }
      } catch (_) {}
    }, { once: true });
  }

  /**
   * Helper to locate the genuine Codeforces submission form (strictly excluding search or login forms)
   */
  public findCodeforcesSubmitForm(doc: Document = document): HTMLFormElement | null {
    // 1. Unique Codeforces submission controls inside a form
    const programTypeSelect = doc.querySelector('select[name="programTypeId"]');
    if (programTypeSelect) {
      const form = programTypeSelect.closest('form');
      if (form && !form.classList.contains('search')) return form as HTMLFormElement;
    }

    const sourceFileInput = doc.querySelector('input[name="sourceFile"], input[type="file"][name*="source"]');
    if (sourceFileInput) {
      const form = sourceFileInput.closest('form');
      if (form && !form.classList.contains('search')) return form as HTMLFormElement;
    }

    const problemInput = doc.querySelector('input[name="submittedProblemCode"], select[name="submittedProblemIndex"]');
    if (problemInput) {
      const form = problemInput.closest('form');
      if (form && !form.classList.contains('search')) return form as HTMLFormElement;
    }

    // 2. Specific submission form classes and action (strictly excluding search/auth/handleForm)
    const forms = Array.from(doc.querySelectorAll('form.submit-form, form.submitForm, form[action*="/submit"]'));
    for (const f of forms) {
      const formEl = f as HTMLFormElement;
      const action = (formEl.getAttribute('action') || '').toLowerCase();
      if (!action.includes('search') && !formEl.classList.contains('search') && !formEl.classList.contains('handleForm')) {
        return formEl;
      }
    }

    return null;
  }

  /**
   * Render an in-page auth warning banner if an unauthenticated user lands on submit page
   */
  public showAuthNoticeBanner(doc: Document, platformName: string, loginUrl: string): void {
    if (doc.getElementById('lf-auth-banner')) return;
    const banner = createElement('div', {
      id: 'lf-auth-banner',
      className: 'lf-submit-page-banner lf-submit-page-banner-warning'
    });

    const icon = createElement('a', {
      className: 'lf-banner-icon',
      href: 'https://github.com/anishraj836/Leetfox',
      target: '_blank',
      rel: 'noopener noreferrer',
      title: 'Leetfox on GitHub'
    }, '[Leetfox]');

    const textGroup = createElement('div', { className: 'lf-banner-text' });
    const title = createElement('strong', {}, `Log In to ${platformName} Required`);
    const sub = createElement('p', {}, `You must be logged into your ${platformName} account to submit solutions.`);
    textGroup.appendChild(title);
    textGroup.appendChild(sub);

    const btnGroup = createElement('div', { style: 'display: flex; gap: 8px; align-items: center;' });
    const loginLink = createElement('a', {
      className: 'lf-btn lf-btn-primary',
      href: loginUrl,
      target: '_blank',
      rel: 'noopener noreferrer'
    }, `Log In to ${platformName}`);

    btnGroup.appendChild(loginLink);
    banner.appendChild(icon);
    banner.appendChild(textGroup);
    banner.appendChild(btnGroup);

    const targetContainer = doc.getElementById('pageContent') || doc.body;
    targetContainer.prepend(banner);
  }

  /**
   * Handles auto-filling and file submission on Codeforces submit page
   */
  public async handleCodeforcesSubmitPage(doc: Document, url: URL): Promise<boolean> {
    const isSubmitPage = url.pathname.includes('/submit');
    if (!isSubmitPage) return false;

    const pending = await this.getPendingSubmission();
    if (!pending || pending.platform !== 'codeforces') return false;

    // Immediately consume and clear pending submission so auto-submit can NEVER retry in a loop
    await this.clearPendingSubmission();

    // Check authentication first: if not logged in, prompt user to log in rather than failing or submitting search
    const isLoggedIn = this.isUserLoggedInOnCodeforces(doc);
    if (!isLoggedIn) {
      this.showAuthNoticeBanner(doc, 'Codeforces', 'https://codeforces.com/enter');
      return true;
    }

    // Locate the genuine Codeforces submission form (strictly avoiding search forms)
    let form = this.findCodeforcesSubmitForm(doc);
    if (!form && typeof window !== 'undefined') {
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 100));
        form = this.findCodeforcesSubmitForm(doc);
        if (form) break;
      }
    }

    if (!form) {
      console.warn('[Leetfox] Genuine Codeforces submission form not found on this page');
      return false;
    }

    // Parse problemId into contestId and index if possible
    // e.g. "4A" -> contestId "4", index "A"; "2260A" -> contestId "2260", index "A"
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
      problemInput.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // 3. Set language dropdown on Codeforces submit form
    const langSelect = form.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
    if (langSelect) {
      await this.selectMatchingCodeforcesLanguage(langSelect, pending.language);
    }

    // 4. Fill and set source code in textarea without breaking Gecko form serialization
    const textarea = (form.querySelector('textarea#sourceCodeTextarea, textarea[name="source"], textarea') || doc.querySelector('textarea#sourceCodeTextarea, textarea[name="source"]')) as HTMLTextAreaElement | null;
    const win = (doc.defaultView || (typeof window !== 'undefined' ? window : null)) as any;
    const pageWin = win?.wrappedJSObject || win;

    const populateTextarea = () => {
      if (!textarea || !textarea.ownerDocument || !doc.defaultView) return;

      try {
        const proto = (win?.HTMLTextAreaElement || HTMLTextAreaElement).prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
          desc.set.call(textarea, pending.code);
        } else {
          textarea.value = pending.code;
        }
      } catch (_) {
        textarea.value = pending.code;
      }

      textarea.textContent = pending.code;
      textarea.defaultValue = pending.code;

      try {
        while (textarea.firstChild) {
          textarea.removeChild(textarea.firstChild);
        }
        textarea.appendChild(doc.createTextNode(pending.code));
      } catch (_) {}

      // In Firefox WebExtension content scripts, also update raw element in page context
      const rawTextarea = (textarea as any)?.wrappedJSObject;
      if (rawTextarea && rawTextarea !== textarea) {
        try {
          const rawProto = pageWin?.HTMLTextAreaElement?.prototype;
          const rawDesc = rawProto ? Object.getOwnPropertyDescriptor(rawProto, 'value') : null;
          if (rawDesc && rawDesc.set) {
            rawDesc.set.call(rawTextarea, pending.code);
          } else {
            rawTextarea.value = pending.code;
          }
          rawTextarea.textContent = pending.code;
          rawTextarea.defaultValue = pending.code;
        } catch (_) {}
      }

      if (pageWin?.$) {
        try {
          pageWin.$('textarea#sourceCodeTextarea, textarea[name="source"]').val(pending.code);
        } catch (_) {}
      }

      const Evt = doc.defaultView?.Event || (typeof Event !== 'undefined' ? Event : null);
      if (Evt) {
        try {
          textarea.dispatchEvent(new Evt('input', { bubbles: true }));
          textarea.dispatchEvent(new Evt('change', { bubbles: true }));
        } catch (_) {}
      }
    };

    populateTextarea();

    // Clear file input so Codeforces processes the textarea (avoiding file upload requirement)
    const fileInput = form.querySelector('input[type="file"][name="sourceFile"], input[type="file"]') as HTMLInputElement | null;
    const clearFileInput = () => {
      if (fileInput) {
        try {
          fileInput.value = '';
          const rawFileInput = (fileInput as any)?.wrappedJSObject;
          if (rawFileInput) {
            try { rawFileInput.value = ''; } catch (_) {}
          }
        } catch (_) {}
      }
    };
    clearFileInput();

    // Enable submit button immediately so it is ready for submission
    const initialSubmitBtn = form.querySelector('input.submit, input[type="submit"], button[type="submit"]') as HTMLInputElement | HTMLButtonElement | null;
    if (initialSubmitBtn) {
      initialSubmitBtn.disabled = false;
      initialSubmitBtn.removeAttribute('disabled');
      const rawInitialBtn = (initialSubmitBtn as any)?.wrappedJSObject;
      if (rawInitialBtn) {
        try {
          rawInitialBtn.disabled = false;
          rawInitialBtn.removeAttribute('disabled');
        } catch (_) {}
      }
    }

    // 5. Update Ace Editor directly via Firefox window.wrappedJSObject and via script injection
    const syncAceDirect = (code: string) => {
      if (!pageWin) return;
      try {
        if (pageWin.editor && typeof pageWin.editor.setValue === 'function') {
          try { pageWin.editor.setValue(code, 1); } catch (_) {}
        }
        if (pageWin.aceEditor && typeof pageWin.aceEditor.setValue === 'function') {
          try { pageWin.aceEditor.setValue(code, 1); } catch (_) {}
        }
        if (pageWin.ace && typeof pageWin.ace.edit === 'function') {
          ['sourceCodeTextarea', 'sourceCodeTextarea_ace', 'editor', 'sourceCode', 'source'].forEach((id: string) => {
            try {
              const el = doc.getElementById(id);
              const rawEl = (el as any)?.wrappedJSObject || el;
              if (rawEl) {
                const ed = pageWin.ace.edit(rawEl);
                if (ed && typeof ed.setValue === 'function') ed.setValue(code, 1);
              }
            } catch (_) {}
          });
          doc.querySelectorAll('.ace_editor').forEach((el: any) => {
            try {
              const rawEl = (el as any)?.wrappedJSObject || el;
              const ed = pageWin.ace.edit(rawEl);
              if (ed && typeof ed.setValue === 'function') ed.setValue(code, 1);
            } catch (_) {}
          });
        }
        doc.querySelectorAll('.ace_editor, #sourceCodeTextarea_ace').forEach((el: any) => {
          try {
            const rawEl = (el as any)?.wrappedJSObject || el;
            if (rawEl?.env?.editor && typeof rawEl.env.editor.setValue === 'function') {
              rawEl.env.editor.setValue(code, 1);
            }
          } catch (_) {}
        });
        if (pageWin.$) {
          try {
            pageWin.$('textarea#sourceCodeTextarea, textarea[name="source"]').val(code);
          } catch (_) {}
        }
      } catch (_) {}
    };

    syncAceDirect(pending.code);
    [50, 150, 300, 600, 1000].forEach(delay => {
      setTimeout(() => {
        populateTextarea();
        clearFileInput();
        syncAceDirect(pending.code);
      }, delay);
    });

    // Capture submit on form to ensure code is synced right before Codeforces handlers
    const onFormSubmit = () => {
      populateTextarea();
      clearFileInput();
      syncAceDirect(pending.code);
    };
    form.addEventListener('submit', onFormSubmit, true);
    form.addEventListener('submit', onFormSubmit, false);

    try {
      const script = doc.createElement('script');
      const existingNonce = doc.querySelector('script[nonce]')?.getAttribute('nonce');
      if (existingNonce) {
        script.setAttribute('nonce', existingNonce);
      }
      script.textContent = `
        (function() {
          var code = ${JSON.stringify(pending.code)};

          function syncPage() {
            var ta = document.getElementById('sourceCodeTextarea') || document.querySelector('textarea[name="source"]');
            if (ta) {
              try {
                var proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
                if (proto && proto.set) proto.set.call(ta, code); else ta.value = code;
              } catch (_) {
                ta.value = code;
              }
              ta.textContent = code;
              ta.defaultValue = code;
            }

            var fi = document.querySelector('input[type="file"][name="sourceFile"], input[type="file"]');
            if (fi) {
              try { fi.value = ''; } catch(_) {}
            }

            if (window.ace && typeof window.ace.edit === 'function') {
              ['sourceCodeTextarea', 'sourceCodeTextarea_ace', 'editor', 'sourceCode', 'source'].forEach(function(id) {
                try {
                  var el = document.getElementById(id);
                  if (el) {
                    var ed = window.ace.edit(el);
                    if (ed && typeof ed.setValue === 'function') ed.setValue(code, 1);
                  }
                } catch (_) {}
              });
              document.querySelectorAll('.ace_editor').forEach(function(el) {
                try {
                  var ed = window.ace.edit(el);
                  if (ed && typeof ed.setValue === 'function') ed.setValue(code, 1);
                } catch (_) {}
              });
            }

            if (window.editor && typeof window.editor.setValue === 'function') {
              try { window.editor.setValue(code, 1); } catch(_) {}
            }
            if (window.aceEditor && typeof window.aceEditor.setValue === 'function') {
              try { window.aceEditor.setValue(code, 1); } catch(_) {}
            }
            if (window.$) {
              try { window.$('textarea#sourceCodeTextarea, textarea[name="source"]').val(code); } catch(_) {}
            }
          }

          syncPage();
          [50, 150, 300, 600, 1000].forEach(function(delay) {
            setTimeout(syncPage, delay);
          });

          var forms = document.querySelectorAll('form.submitForm, form.submit-form, form[action*="/submit"]');
          forms.forEach(function(f) {
            f.addEventListener('submit', syncPage, true);
          });
        })();
      `;
      (doc.head || doc.documentElement || doc.body).appendChild(script);
      setTimeout(() => {
        try { script.remove(); } catch (_) {}
      }, 1000);
    } catch (_) {}

    // 6. Inject Leetfox Confirmation Banner with smooth auto-submit countdown
    if (!doc.getElementById('lf-cf-submit-banner')) {
      const banner = createElement('div', {
        id: 'lf-cf-submit-banner',
        className: 'lf-submit-page-banner'
      });

      const icon = createElement('a', {
        className: 'lf-banner-icon',
        href: 'https://github.com/anishraj836/Leetfox',
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'Leetfox on GitHub'
      }, '[Leetfox]');
      const textGroup = createElement('div', { className: 'lf-banner-text' });
      const bannerTitle = createElement('strong', {}, `Leetfox loaded your solution for ${pending.problemId}`);
      
      let secondsLeft = 1;
      const bannerSub = createElement('p', {}, `Loaded solution (${pending.language.toUpperCase()}). Auto-submitting in ${secondsLeft}s...`);

      textGroup.appendChild(bannerTitle);
      textGroup.appendChild(bannerSub);

      let countdownTimer: any = null;

      const triggerSubmit = async () => {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        bannerSub.textContent = 'Submitting solution to Codeforces now...';

        // 1. Ensure action=submitSolutionFormSubmitted is set
        let actionInput = form.querySelector('input[name="action"]') as HTMLInputElement;
        if (!actionInput) {
          actionInput = doc.createElement('input');
          actionInput.type = 'hidden';
          actionInput.name = 'action';
          actionInput.value = 'submitSolutionFormSubmitted';
          form.appendChild(actionInput);
        } else {
          actionInput.value = 'submitSolutionFormSubmitted';
        }

        // 2. Clear file input
        clearFileInput();

        // 3. Final guarantee on textarea content right before clicking
        populateTextarea();

        // 4. Synchronize Ace in Firefox page context
        syncAceDirect(pending.code);

        // 5. Submit the form via submit button so Codeforces calculates anti-bot security tokens (_tta, etc.)
        const submitBtn = form.querySelector('input.submit, input[type="submit"], button[type="submit"]') as HTMLInputElement | HTMLButtonElement | null;
        if (submitBtn) {
          const rawSubmitBtn = (submitBtn as any)?.wrappedJSObject || submitBtn;
          try {
            rawSubmitBtn.disabled = false;
            rawSubmitBtn.removeAttribute('disabled');
          } catch (_) {}
          try {
            rawSubmitBtn.click();
          } catch (_) {
            try {
              submitBtn.click();
            } catch (_) {
              HTMLFormElement.prototype.submit.call(form);
            }
          }
        } else {
          HTMLFormElement.prototype.submit.call(form);
        }
      };

      const submitNowBtn = createElement('button', {
        className: 'lf-btn lf-btn-primary',
        type: 'button',
        title: 'Submit this code immediately',
        onClick: triggerSubmit
      }, 'Submit Now');

      const cancelBtn = createElement('button', {
        className: 'lf-btn',
        type: 'button',
        title: 'Cancel auto-submission to review code',
        onClick: () => {
          if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
          }
          bannerSub.textContent = `Loaded solution (${pending.language.toUpperCase()}). Auto-submit paused. Click "Submit Now" when ready.`;
          cancelBtn.style.display = 'none';
        }
      }, 'Cancel');

      countdownTimer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          triggerSubmit();
        } else {
          bannerSub.textContent = `Loaded solution (${pending.language.toUpperCase()}). Auto-submitting in ${secondsLeft}s...`;
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
   * Helper to select matching compiler on AtCoder submit form
   */
  private selectMatchingAtCoderLanguage(select: HTMLSelectElement, lang: string): void {
    const l = lang.toLowerCase();
    const options = Array.from(select.options);
    let matchOption: HTMLOptionElement | undefined;

    if (l === 'cpp') {
      matchOption = options.find(o => /c\+\+.*23|c\+\+.*20|gnu c\+\+|gcc/i.test(o.text))
        || options.find(o => /c\+\+/i.test(o.text));
    } else if (l === 'python') {
      matchOption = options.find(o => /python.*3|pypy.*3/i.test(o.text))
        || options.find(o => /python/i.test(o.text));
    } else if (l === 'java') {
      matchOption = options.find(o => /java.*21|java.*17|openjdk/i.test(o.text))
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
   * Handles auto-filling and file submission on AtCoder submit page
   */
  public async handleAtCoderSubmitPage(doc: Document, url: URL): Promise<boolean> {
    const isSubmit = url.pathname.includes('/submit') || url.pathname.includes('/tasks/');
    if (!isSubmit) return false;

    const pending = await this.getPendingSubmission();
    if (!pending || pending.platform !== 'atcoder') return false;

    const forms = Array.from(doc.querySelectorAll('form'));
    const form = forms.find(f => (f.getAttribute('action') || '').includes('/submit') || f.querySelector('select[name="data.LanguageId"]') || f.querySelector('select[name="data.TaskScreenName"]')) || (forms[0] as HTMLFormElement | undefined);
    if (!form) return false;

    // 1. Task select
    const taskSelect = form.querySelector('select[name="data.TaskScreenName"]') as HTMLSelectElement;
    if (taskSelect && pending.problemId) {
      const option = Array.from(taskSelect.options).find(o =>
        o.value.toLowerCase() === pending.problemId.toLowerCase() ||
        o.text.toLowerCase().includes(pending.problemId.toLowerCase())
      );
      if (option) {
        taskSelect.value = option.value;
        taskSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 2. Language select
    const langSelect = form.querySelector('select[name="data.LanguageId"]') as HTMLSelectElement;
    if (langSelect) {
      this.selectMatchingAtCoderLanguage(langSelect, pending.language);
    }

    // 3. Convert code to file and attach to file input if available
    const file = this.createSubmissionFile(pending.code, pending.language);
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      try {
        const DT = (doc.defaultView as any)?.DataTransfer || (globalThis as any).DataTransfer;
        if (typeof DT !== 'undefined') {
          const dt = new DT();
          dt.items.add(file);
          try {
            fileInput.files = dt.files;
          } catch (_) {}
          if (!fileInput.files || fileInput.files.length === 0) {
            Object.defineProperty(fileInput, 'files', { value: dt.files || [file], configurable: true, writable: true });
          }
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          Object.defineProperty(fileInput, 'files', { value: [file], configurable: true, writable: true });
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (_) {}
    }

    // 4. Set sourceCode textarea and CodeMirror editor if active
    const textarea = form.querySelector('textarea[name="sourceCode"], textarea.plain-textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = pending.code;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    try {
      const script = doc.createElement('script');
      script.textContent = `
        (function() {
          try {
            var cm = document.querySelector('.CodeMirror');
            if (cm && cm.CodeMirror) {
              cm.CodeMirror.setValue(${JSON.stringify(pending.code)});
            }
          } catch (_) {}
        })();
      `;
      (doc.head || doc.documentElement || doc.body).appendChild(script);
      script.remove();
    } catch (_) {}

    // 5. Confirmation banner
    if (!doc.getElementById('lf-atcoder-submit-banner')) {
      const banner = createElement('div', {
        id: 'lf-atcoder-submit-banner',
        className: 'lf-submit-page-banner'
      });

      const icon = createElement('a', {
        className: 'lf-banner-icon',
        href: 'https://github.com/anishraj836/Leetfox',
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'Leetfox on GitHub'
      }, '[Leetfox]');
      const textGroup = createElement('div', { className: 'lf-banner-text' });
      const bannerTitle = createElement('strong', {}, `Leetfox loaded your solution for ${pending.problemId}`);
      
      let secondsLeft = 3;
      const bannerSub = createElement('p', {}, `Attached ${file.name}. Auto-submitting in ${secondsLeft}s...`);

      textGroup.appendChild(bannerTitle);
      textGroup.appendChild(bannerSub);

      let countdownTimer: any = null;

      const triggerSubmit = async () => {
        if (countdownTimer) clearInterval(countdownTimer);
        bannerSub.textContent = 'Submitting solution to AtCoder now...';
        await this.clearPendingSubmission();
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement;
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
      }, 'Submit Now');

      const cancelBtn = createElement('button', {
        className: 'lf-btn',
        type: 'button',
        title: 'Cancel auto-submission to review code',
        onClick: () => {
          if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
          }
          bannerSub.textContent = `Attached ${file.name}. Auto-submit paused. Click "Submit Now" when ready.`;
          cancelBtn.style.display = 'none';
        }
      }, 'Cancel');

      countdownTimer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          triggerSubmit();
        } else {
          bannerSub.textContent = `Attached ${file.name}. Auto-submitting in ${secondsLeft}s...`;
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
