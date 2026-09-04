function getFilenameForLanguage(lang: string): string {
  switch (lang.toLowerCase()) {
    case 'cpp': return 'solution.cpp';
    case 'python': return 'solution.py';
    case 'java': return 'Solution.java';
    case 'rust': return 'solution.rs';
    case 'go': return 'solution.go';
    default: return 'solution.txt';
  }
}

async function handleCsesSubmit(
  taskId: string,
  code: string,
  language: string
): Promise<{ success: boolean; resultUrl?: string; error?: string }> {
  try {
    const submitPageUrl = `https://cses.fi/problemset/submit/${taskId}/`;
    const pageRes = await fetch(submitPageUrl, { credentials: 'include' });
    if (!pageRes.ok || pageRes.url.includes('/login')) {
      return {
        success: false,
        error: 'You must be logged in to CSES to submit. Please log in to your CSES account.'
      };
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
    const filename = getFilenameForLanguage(language);
    const blob = new Blob([code], { type: 'text/plain' });

    const formData = new FormData();
    formData.append('csrf_token', csrfToken);
    formData.append('file', blob, filename);

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

// WebExtension background message listener
const runtime = (globalThis as any).browser?.runtime || (globalThis as any).chrome?.runtime;
if (runtime && runtime.onMessage) {
  runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (res: any) => void) => {
    if (message?.type === 'CSES_DIRECT_SUBMIT') {
      handleCsesSubmit(message.taskId, message.code, message.language)
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ success: false, error: err?.message }));
      return true; // asynchronous response
    }
    return false;
  });
}

console.log('[Leetfox] Background service started with CSES submit handler');
