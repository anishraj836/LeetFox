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
  
  private constructor() {
      }

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
  public async submitCSESDirect(
    taskId: string,
    code: string,
    language: string
  ): Promise<{ success: boolean; resultUrl?: string; error?: string }> {
    try {
      const submitPageUrl = `https://cses.fi/problemset/submit/${taskId}/`;
      const pageRes = await fetch(submitPageUrl, { credentials: 'include' });
      if (!pageRes.ok) {
        if (pageRes.status === 404 || pageRes.status === 403) {
          return {
            success: false,
            error: 'You must be logged in to CSES to submit. Please log in to your CSES account.'
          };
        }
        return { success: false, error: `Failed to load CSES submit page (status ${pageRes.status}).` };
      }

      const html = await pageRes.text();
      const tokenMatch = html.match(/name=["']csrf_token["'][^>]*value=["']([^"']+)["']/i)
        || html.match(/value=["']([^"']+)["'][^>]*name=["']csrf_token["']/i);

      if (!tokenMatch) {
        return {
          success: false,
          error: 'Could not find CSRF token on CSES. Please ensure you are logged in.'
        };
      }

      const csrfToken = tokenMatch[1];
      const filename = this.getFilenameForLanguage(language);
      const file = new File([code], filename, { type: 'text/plain' });

      const formData = new FormData();
      formData.append('csrf_token', csrfToken);
      formData.append('file', file);

      const postRes = await fetch(submitPageUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        redirect: 'follow'
      });

      if (postRes.ok) {
        const finalUrl = postRes.url;
        return {
          success: true,
          resultUrl: finalUrl.includes('/result/') ? finalUrl : `https://cses.fi/problemset/result/${taskId}/`
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
      const key = `code:cses:${taskId}:cpp`;
      if (storageArea) {
        const res = await (storageArea.get(key) instanceof Promise ? storageArea.get(key) : new Promise<any>(r => storageArea.get(key, r)));
        if (res && res[key]) codeToSubmit = res[key];
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
      }
      
    } catch (e) {
      console.warn('[Leetfox] Could not set DataTransfer files on CSES file input', e);
    }

    // Inject modern Leetfox confirmation banner
    if (!doc.getElementById('lf-cses-submit-banner')) {
      const banner = createElement('div', {
        id: 'lf-cses-submit-banner',
        className: 'lf-submit-page-banner'
      });

      const icon = createElement('span', { className: 'lf-banner-icon' }, '🦊');
      const textGroup = createElement('div', { className: 'lf-banner-text' });
      const bannerTitle = createElement('strong', {}, `Leetfox ready to submit for Task ${taskId}`);
      const bannerSub = createElement('p', {}, `Attached ${filename} (${codeToSubmit.split('\n').length} lines). Click "Submit Now" below!`);

      textGroup.appendChild(bannerTitle);
      textGroup.appendChild(bannerSub);

      const submitNowBtn = createElement('button', {
        className: 'lf-btn lf-btn-primary',
        type: 'button',
        title: 'Submit this code now',
        onClick: () => {
          const actualSubmitBtn = form.querySelector('input[type="submit"], button[type="submit"]') as HTMLElement;
          if (actualSubmitBtn) {
            actualSubmitBtn.click();
          } else {
            form.submit();
          }
        }
      }, 'Submit Now 🚀');

      banner.appendChild(icon);
      banner.appendChild(textGroup);
      banner.appendChild(submitNowBtn);

      form.parentNode?.insertBefore(banner, form);
    }

    return true;
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

    // Set problem code if field is present
    const problemInput = form.querySelector('input[name="submittedProblemCode"]') as HTMLInputElement;
    if (problemInput && !problemInput.value) {
      problemInput.value = pending.problemId;
    }

    // Fill source code
    const textarea = form.querySelector('textarea#sourceCodeTextarea, textarea[name="source"]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = pending.code;
    }

    // Attach file if file input exists
    const fileInput = form.querySelector('input[type="file"][name="sourceFile"]') as HTMLInputElement;
    if (fileInput) {
      const filename = this.getFilenameForLanguage(pending.language);
      const file = new File([pending.code], filename, { type: 'text/plain' });
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
      } catch (_) {}
    }

    // Inject Leetfox Banner
    if (!doc.getElementById('lf-cf-submit-banner')) {
      const banner = createElement('div', {
        id: 'lf-cf-submit-banner',
        className: 'lf-submit-page-banner'
      });

      const icon = createElement('span', { className: 'lf-banner-icon' }, '🦊');
      const textGroup = createElement('div', { className: 'lf-banner-text' });
      const bannerTitle = createElement('strong', {}, `Leetfox loaded your solution for ${pending.problemId}`);
      const bannerSub = createElement('p', {}, `Code filled (${pending.code.split('\n').length} lines). Ready to submit!`);

      textGroup.appendChild(bannerTitle);
      textGroup.appendChild(bannerSub);

      const submitNowBtn = createElement('button', {
        className: 'lf-btn lf-btn-primary',
        type: 'button',
        onClick: () => {
          const submitBtn = form.querySelector('input[type="submit"]') as HTMLElement;
          if (submitBtn) submitBtn.click();
          else form.submit();
        }
      }, 'Submit Now 🚀');

      banner.appendChild(icon);
      banner.appendChild(textGroup);
      banner.appendChild(submitNowBtn);

      form.parentNode?.insertBefore(banner, form);
    }

    return true;
  }
}
