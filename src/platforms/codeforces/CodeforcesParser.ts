import type { Problem, ProblemExample, ProblemNavigation } from '../../core/models/problem';
import { sanitizeHtml } from '../../core/utils/sanitize';
import { CODEFORCES_SELECTORS } from './selectors';

export class CodeforcesParser {
  public parse(doc: Document, url: URL): Problem | null {
    const container = doc.querySelector(CODEFORCES_SELECTORS.container);
    if (!container) {
      return null;
    }

    try {
      const urlInfo = this.extractUrlInfo(url, doc);
      const title = this.extractTitle(container, urlInfo.index);
      const limits = this.extractLimits(container);
      const statementHtml = this.extractStatementHtml(container, doc.baseURI || url.href);
      const inputSpecificationHtml = this.extractSectionHtml(container, CODEFORCES_SELECTORS.inputSpecification, doc.baseURI || url.href);
      const outputSpecificationHtml = this.extractSectionHtml(container, CODEFORCES_SELECTORS.outputSpecification, doc.baseURI || url.href);
      const interactionSpecificationHtml = this.extractSectionHtml(container, CODEFORCES_SELECTORS.interaction, doc.baseURI || url.href);
      const noteHtml = this.extractSectionHtml(container, CODEFORCES_SELECTORS.note, doc.baseURI || url.href);
      const examples = this.extractExamples(container);
      const { tags, difficulty } = this.extractTagsAndRating(doc);
      const contest = this.extractContestInfo(doc, urlInfo);
      const navigation = this.extractNavigation(doc, url);
      const isLiveContest = this.detectLiveContest(doc, url);
      const solutionsUrl = this.extractSolutionsUrl(doc, url, urlInfo);
      const editorialUrl = this.extractEditorialUrl(doc, url);

      const id = `${urlInfo.contestId}${urlInfo.index}`;

      return {
        platform: 'codeforces',
        id,
        qualifiedId: `codeforces:${id.toLowerCase()}`,
        title,
        statementHtml,
        inputSpecificationHtml,
        outputSpecificationHtml,
        interactionSpecificationHtml,
        noteHtml,
        examples,
        tags,
        difficulty,
        category: contest?.name,
        limits,
        contest,
        navigation,
        url: url.href,
        submitUrl: this.extractSubmitUrl(doc, url),
        solutionsUrl,
        editorialUrl,
        isLiveContest
      };
    } catch (err) {
      console.error('[Leetfox Codeforces] Error parsing problem', err);
      return null;
    }
  }

  public extractUrlInfo(url: URL, doc?: Document): { contestId: string; index: string } {
    const pathname = url.pathname;
    const match = pathname.match(/(?:problemset\/problem|contest|gym|group\/[^/]+\/contest)\/([^/]+)\/problem\/([^/]+)/i)
      || pathname.match(/\/problemset\/problem\/([^/]+)\/([^/]+)/i)
      || pathname.match(/\/contest\/([^/]+)\/problem\/([^/]+)/i);

    let contestId = '';
    let index = '';

    if (match) {
      contestId = match[1];
      index = match[2].replace(/\/+$/, '').toUpperCase();
    }

    if (!index && doc) {
      const holder = doc.querySelector('.problemindexholder');
      const idxAttr = holder?.getAttribute('problemindex');
      if (idxAttr) index = idxAttr.toUpperCase();
    }

    return { contestId, index };
  }

  private extractTitle(container: Element, fallbackIndex: string): string {
    const titleEl = container.querySelector(CODEFORCES_SELECTORS.title);
    if (!titleEl) return fallbackIndex ? `Problem ${fallbackIndex}` : 'Problem';

    const raw = titleEl.textContent?.trim() || '';
    const dotIndex = raw.indexOf('.');
    if (dotIndex > 0 && dotIndex <= 4) {
      return raw.slice(dotIndex + 1).trim();
    }
    return raw || `Problem ${fallbackIndex}`;
  }

  private extractLimits(container: Element): { timeLimit?: string; memoryLimit?: string } {
    const timeEl = container.querySelector(CODEFORCES_SELECTORS.timeLimit);
    const memoryEl = container.querySelector(CODEFORCES_SELECTORS.memoryLimit);

    let timeLimit: string | undefined;
    let memoryLimit: string | undefined;

    if (timeEl) {
      const text = timeEl.textContent || '';
      const match = text.replace(/time limit per test:?/i, '').trim();
      timeLimit = match || undefined;
    }

    if (memoryEl) {
      const text = memoryEl.textContent || '';
      const match = text.replace(/memory limit per test:?/i, '').trim();
      memoryLimit = match || undefined;
    }

    return { timeLimit, memoryLimit };
  }

  private resolveRelativeUrls(node: Element, baseUri: string): void {
    const imgs: Element[] = [];
    if (node.tagName === 'IMG') imgs.push(node);
    imgs.push(...Array.from(node.querySelectorAll('img')));

    imgs.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        try {
          img.setAttribute('src', new URL(src, baseUri).href);
        } catch (_) {}
      }
    });

    const links: Element[] = [];
    if (node.tagName === 'A') links.push(node);
    links.push(...Array.from(node.querySelectorAll('a')));

    links.forEach(a => {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('http://') && !href.startsWith('https://')) {
        try {
          a.setAttribute('href', new URL(href, baseUri).href);
        } catch (_) {}
      }
    });
  }

  private extractStatementHtml(container: Element, baseUri: string): string {
    const header = container.querySelector(CODEFORCES_SELECTORS.header);
    if (!header) return '';

    const parts: string[] = [];
    let current = header.nextElementSibling;

    while (current) {
      if (
        current.classList.contains('input-specification') ||
        current.classList.contains('output-specification') ||
        current.classList.contains('interaction') ||
        current.classList.contains('sample-tests') ||
        current.classList.contains('sample-test') ||
        current.classList.contains('note')
      ) {
        break;
      }
      const clone = current.cloneNode(true) as HTMLElement;
      this.resolveRelativeUrls(clone, baseUri);
      parts.push(clone.outerHTML);
      current = current.nextElementSibling;
    }

    return sanitizeHtml(parts.join(''));
  }

  private extractSectionHtml(container: Element, selector: string, baseUri: string): string | undefined {
    const section = container.querySelector(selector);
    if (!section) return undefined;

    const clone = section.cloneNode(true) as HTMLElement;
    const titleEl = clone.querySelector('.section-title');
    if (titleEl) {
      titleEl.remove();
    }

    this.resolveRelativeUrls(clone, baseUri);
    const html = clone.innerHTML.trim();
    return html ? sanitizeHtml(html) : undefined;
  }

  private extractExamples(container: Element): ProblemExample[] {
    const examples: ProblemExample[] = [];

    // Strategy 1: Multiple .sample-test blocks
    const sampleTests = container.querySelectorAll(CODEFORCES_SELECTORS.sampleTestItem);
    if (sampleTests.length > 1) {
      sampleTests.forEach((test, idx) => {
        const inputEl = test.querySelector('.input');
        const outputEl = test.querySelector('.output');
        const input = this.extractPreText(inputEl?.querySelector('pre'));
        const output = this.extractPreText(outputEl?.querySelector('pre'));
        if (input || output) {
          examples.push({ id: idx + 1, input, output });
        }
      });
      if (examples.length > 0) return examples;
    }

    // Strategy 2: Codeforces standard: single .sample-test with multiple .input and .output pairs
    const inputs = container.querySelectorAll('.sample-test .input, .sample-tests .input');
    const outputs = container.querySelectorAll('.sample-test .output, .sample-tests .output');
    const count = Math.min(inputs.length, outputs.length);

    for (let i = 0; i < count; i++) {
      const input = this.extractPreText(inputs[i].querySelector('pre'));
      const output = this.extractPreText(outputs[i].querySelector('pre'));
      examples.push({
        id: i + 1,
        input,
        output
      });
    }

    return examples;
  }

  private extractPreText(pre: Element | null | undefined): string {
    if (!pre) return '';

    const lines = pre.querySelectorAll('.test-example-line');
    if (lines.length > 0) {
      const lineTexts: string[] = [];
      lines.forEach(line => {
        lineTexts.push(line.textContent || '');
      });
      return lineTexts.join('\n').trim();
    }

    return (pre.textContent || '').trim();
  }

  private extractTagsAndRating(doc: Document): { tags: string[]; difficulty?: number | string } {
    const tags: string[] = [];
    let difficulty: number | string | undefined;

    const sideboxes = doc.querySelectorAll(CODEFORCES_SELECTORS.sideboxes);
    sideboxes.forEach(box => {
      const caption = box.querySelector('.caption')?.textContent || '';
      if (caption.toLowerCase().includes('tag')) {
        const tagElements = box.querySelectorAll(CODEFORCES_SELECTORS.tagBox);
        tagElements.forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text.startsWith('*')) {
            const num = parseInt(text.slice(1).trim(), 10);
            if (!isNaN(num)) {
              difficulty = num;
            } else {
              difficulty = text;
            }
          } else if (text) {
            tags.push(text);
          }
        });
      }
    });

    if (difficulty === undefined) {
      const ratingEl = doc.querySelector(CODEFORCES_SELECTORS.ratingTag);
      if (ratingEl) {
        const text = ratingEl.textContent?.trim() || '';
        const num = parseInt(text.replace('*', '').trim(), 10);
        if (!isNaN(num)) {
          difficulty = num;
        }
      }
    }

    return { tags, difficulty };
  }

  private extractContestInfo(doc: Document, urlInfo: { contestId: string }): { id?: string; name?: string; url?: string } | undefined {
    const contestEl = doc.querySelector(CODEFORCES_SELECTORS.contestTitle);
    const contestName = contestEl?.textContent?.trim();
    const contestHref = contestEl?.getAttribute('href');

    if (!contestName && !urlInfo.contestId) return undefined;

    return {
      id: urlInfo.contestId,
      name: contestName || (urlInfo.contestId ? `Contest ${urlInfo.contestId}` : undefined),
      url: contestHref ? new URL(contestHref, doc.baseURI).href : undefined
    };
  }

  private extractNavigation(doc: Document, currentUrl: URL): ProblemNavigation {
    const nav: ProblemNavigation = {};

    const rows = Array.from(doc.querySelectorAll(CODEFORCES_SELECTORS.problemListTable));
    if (rows.length > 0) {
      let currentIndex = -1;
      const problemLinks: { url: string; title: string }[] = [];

      for (const row of rows) {
        const links = row.querySelectorAll('a[href*="/problem/"]');
        if (links.length > 0) {
          const titleLink = links.length > 1 ? links[1] : links[0];
          const href = titleLink.getAttribute('href') || links[0].getAttribute('href') || '';
          const absUrl = new URL(href, currentUrl).href;
          const label = titleLink.textContent?.trim() || links[0].textContent?.trim() || '';
          problemLinks.push({ url: absUrl, title: label });

          if (absUrl === currentUrl.href || currentUrl.pathname.endsWith(href)) {
            currentIndex = problemLinks.length - 1;
          }
        }
      }

      if (currentIndex > 0) {
        nav.previousUrl = problemLinks[currentIndex - 1].url;
        nav.previousTitle = problemLinks[currentIndex - 1].title;
      }
      if (currentIndex >= 0 && currentIndex < problemLinks.length - 1) {
        nav.nextUrl = problemLinks[currentIndex + 1].url;
        nav.nextTitle = problemLinks[currentIndex + 1].title;
      }
    }

    return nav;
  }

  private extractSubmitUrl(doc: Document, currentUrl: URL): string | undefined {
    const submitLink = doc.querySelector(CODEFORCES_SELECTORS.submitLink);
    if (submitLink) {
      const href = submitLink.getAttribute('href');
      if (href) return new URL(href, currentUrl).href;
    }
    return undefined;
  }

  public detectLiveContest(doc: Document, url: URL): boolean {
    // Problemset archive pages are never live contests
    if (url.pathname.includes('/problemset/')) {
      return false;
    }

    // Check for countdown timer (indicates running or upcoming live contest)
    const countdownEl = doc.querySelector('#countdown, .countdown, [id*="countdown"]');
    if (countdownEl && (countdownEl.textContent || '').trim().length > 0) {
      return true;
    }

    // Check contest state phase indicator
    const stateEl = doc.querySelector('.contest-state-phase, .contest-state, .contest-status');
    if (stateEl) {
      const text = (stateEl.textContent || '').toLowerCase();
      if (text.includes('running') || text.includes('coding') || text.includes('before') || text.includes('remain')) {
        return true;
      }
    }

    return false;
  }

  public extractSolutionsUrl(doc: Document, url: URL, urlInfo: { contestId: string; index: string }): string | undefined {
    // Check if status link is available in the sidebar
    const statusLink = doc.querySelector('a[href*="/status"], a[href*="/problemset/status"]');
    if (statusLink) {
      const href = statusLink.getAttribute('href');
      if (href) return new URL(href, url).href;
    }

    if (urlInfo.contestId && urlInfo.index) {
      return `https://codeforces.com/problemset/status/${urlInfo.contestId}/problem/${urlInfo.index}`;
    }

    return undefined;
  }

  public extractEditorialUrl(doc: Document, url: URL): string | undefined {
    // Look for tutorial/editorial link in sidebar sideboxes
    const sideboxes = doc.querySelectorAll(CODEFORCES_SELECTORS.sideboxes);
    for (const box of Array.from(sideboxes)) {
      const caption = (box.querySelector('.caption')?.textContent || '').toLowerCase();
      if (caption.includes('material') || caption.includes('tutorial') || caption.includes('announcement')) {
        const links = box.querySelectorAll('a[href*="/blog/entry/"]');
        for (const link of Array.from(links)) {
          const text = (link.textContent || '').toLowerCase();
          if (text.includes('tutorial') || text.includes('editorial') || text.includes('solution') || text.includes('analysis')) {
            const href = link.getAttribute('href');
            if (href) return new URL(href, url).href;
          }
        }
        // Fallback: first blog entry in materials box
        if (links.length > 0) {
          const href = links[0].getAttribute('href');
          if (href) return new URL(href, url).href;
        }
      }
    }

    return undefined;
  }
}
