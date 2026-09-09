import type { Problem, ProblemExample, ProblemNavigation } from '../../core/models/problem';
import type { CategoryProgress, ProblemState } from '../../core/models/state';
import { sanitizeHtml } from '../../core/utils/sanitize';
import { CSES_SELECTORS } from './selectors';

export class CSESParser {
  public parse(doc: Document, url: URL): Problem | null {
    const mdContainer = doc.querySelector(CSES_SELECTORS.markdownContainer);
    if (!mdContainer) {
      return null;
    }

    try {
      const id = this.extractId(url);
      const title = this.extractTitle(doc, id);
      const limits = this.extractLimits(doc);
      const { statementHtml, inputSpecificationHtml, outputSpecificationHtml, noteHtml, examples } =
        this.extractSectionsAndExamples(mdContainer, doc.baseURI || url.href);
      const category = this.extractCategory(doc);
      const navigation = this.extractNavigation(doc, url);

      const solutionsUrl = id ? `https://cses.fi/problemset/stats/${id}/` : undefined;
      const submissionsUrl = this.extractSubmissionsUrl(doc, url, id);
      const mySubmissionsUrl = this.extractMySubmissionsUrl(doc, url, id);

      return {
        platform: 'cses',
        id,
        qualifiedId: `cses:${id.toLowerCase()}`,
        title,
        statementHtml,
        inputSpecificationHtml,
        outputSpecificationHtml,
        noteHtml,
        examples,
        tags: category ? [category] : [],
        category,
        limits,
        navigation,
        url: url.href,
        submitUrl: this.extractSubmitUrl(doc, url, id),
        solutionsUrl,
        submissionsUrl,
        mySubmissionsUrl,
        isLiveContest: false
      };
    } catch (err) {
      console.error('[Leetfox CSES] Error parsing problem', err);
      return null;
    }
  }

  public extractId(url: URL): string {
    const match = url.pathname.match(/\/problemset\/task\/(\d+)/i);
    return match ? match[1] : '';
  }

  private extractTitle(doc: Document, fallbackId: string): string {
    const titleEl = doc.querySelector(CSES_SELECTORS.title);
    const text = titleEl?.textContent?.trim();
    return text || (fallbackId ? `Task ${fallbackId}` : 'Problem');
  }

  private extractLimits(doc: Document): { timeLimit?: string; memoryLimit?: string } {
    const constraintsEl = doc.querySelector(CSES_SELECTORS.constraints);
    if (!constraintsEl) return {};

    let timeLimit: string | undefined;
    let memoryLimit: string | undefined;

    const items = constraintsEl.querySelectorAll('li');
    items.forEach(li => {
      const text = li.textContent || '';
      if (text.toLowerCase().includes('time limit')) {
        timeLimit = text.replace(/time limit:?/i, '').trim();
      } else if (text.toLowerCase().includes('memory limit')) {
        memoryLimit = text.replace(/memory limit:?/i, '').trim();
      }
    });

    return { timeLimit, memoryLimit };
  }

  private resolveRelativeUrls(node: Element, baseUri: string): void {
    const imgs: Element[] = [];
    if (node.tagName === "IMG") imgs.push(node);
    imgs.push(...Array.from(node.querySelectorAll("img")));

    imgs.forEach(img => {
      const src = img.getAttribute("src");
      if (src && !src.startsWith("data:") && !src.startsWith("http://") && !src.startsWith("https://")) {
        try {
          img.setAttribute("src", new URL(src, baseUri).href);
        } catch (_) {}
      }
    });

    const links: Element[] = [];
    if (node.tagName === "A") links.push(node);
    links.push(...Array.from(node.querySelectorAll("a")));

    links.forEach(a => {
      const href = a.getAttribute("href");
      if (href && !href.startsWith("#") && !href.startsWith("javascript:") && !href.startsWith("http://") && !href.startsWith("https://")) {
        try {
          a.setAttribute("href", new URL(href, baseUri).href);
        } catch (_) {}
      }
    });
  }

  private extractSectionsAndExamples(mdContainer: Element, baseUri: string): {
    statementHtml: string;
    inputSpecificationHtml?: string;
    outputSpecificationHtml?: string;
    noteHtml?: string;
    examples: ProblemExample[];
  } {
    const children = Array.from(mdContainer.children);

    let currentSection: 'statement' | 'input' | 'output' | 'constraints' | 'example' = 'statement';
    const statementNodes: string[] = [];
    const inputNodes: string[] = [];
    const outputNodes: string[] = [];
    const constraintNodes: string[] = [];
    const exampleNodes: Element[] = [];

    for (const child of children) {
      const id = child.id.toLowerCase();
      const text = (child.textContent || '').trim().toLowerCase();

      if (child.tagName === 'H1') {
        if (id === 'input' || text === 'input') {
          currentSection = 'input';
          continue;
        } else if (id === 'output' || text === 'output') {
          currentSection = 'output';
          continue;
        } else if (id === 'constraints' || text === 'constraints') {
          currentSection = 'constraints';
          continue;
        } else if (id.startsWith('example') || text.startsWith('example')) {
          currentSection = 'example';
          continue;
        }
      }

      const clone = child.cloneNode(true) as HTMLElement;
      this.resolveRelativeUrls(clone, baseUri);

      if (currentSection === 'statement') {
        statementNodes.push(clone.outerHTML);
      } else if (currentSection === 'input') {
        inputNodes.push(clone.outerHTML);
      } else if (currentSection === 'output') {
        outputNodes.push(clone.outerHTML);
      } else if (currentSection === 'constraints') {
        constraintNodes.push(clone.outerHTML);
      } else if (currentSection === 'example') {
        exampleNodes.push(clone);
      }
    }

    // Process examples
    const examples = this.parseExampleNodes(exampleNodes);

    // Note html can include constraints if present
    let noteHtml: string | undefined;
    if (constraintNodes.length > 0) {
      noteHtml = sanitizeHtml(`<h3>Constraints</h3>${constraintNodes.join('')}`);
    }

    return {
      statementHtml: sanitizeHtml(statementNodes.join('')),
      inputSpecificationHtml: inputNodes.length ? sanitizeHtml(inputNodes.join('')) : undefined,
      outputSpecificationHtml: outputNodes.length ? sanitizeHtml(outputNodes.join('')) : undefined,
      noteHtml,
      examples
    };
  }

  private parseExampleNodes(nodes: Element[]): ProblemExample[] {
    const examples: ProblemExample[] = [];
    let currentInput: string | null = null;
    let currentOutput: string | null = null;
    let state: 'waiting' | 'input' | 'output' = 'waiting';

    for (const node of nodes) {
      const text = (node.textContent || '').trim().toLowerCase();

      if (node.tagName === 'P' || node.tagName === 'H2' || node.tagName === 'H3') {
        if (text.includes('input')) {
          state = 'input';
          continue;
        } else if (text.includes('output')) {
          state = 'output';
          continue;
        }
      }

      if (node.tagName === 'PRE') {
        const codeText = (node.textContent || '').trim();
        if (state === 'input') {
          currentInput = codeText;
          state = 'waiting';
        } else if (state === 'output') {
          currentOutput = codeText;
          state = 'waiting';
        }

        if (currentInput !== null && currentOutput !== null) {
          examples.push({
            id: examples.length + 1,
            input: currentInput,
            output: currentOutput
          });
          currentInput = null;
          currentOutput = null;
        }
      }
    }

    // Fallback if odd number or unclosed example
    if (currentInput !== null || currentOutput !== null) {
      examples.push({
        id: examples.length + 1,
        input: currentInput || "",
        output: currentOutput || ""
      });
    }

    return examples;
  }

  public extractCategory(doc: Document): string | undefined {
    const categoryEl = doc.querySelector(CSES_SELECTORS.categoryHeader);
    return categoryEl?.textContent?.trim() || undefined;
  }

  public extractNavigation(doc: Document, currentUrl: URL): ProblemNavigation {
    const nav: ProblemNavigation = {};
    const currentId = this.extractId(currentUrl);

    const sidebarLinks = Array.from(doc.querySelectorAll(CSES_SELECTORS.problemLinks));
    if (sidebarLinks.length > 0) {
      let currentIndex = -1;

      for (let i = 0; i < sidebarLinks.length; i++) {
        const link = sidebarLinks[i];
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/problemset\/task\/(\d+)/i);
        const linkId = match ? match[1] : '';

        if (link.classList.contains('current') || linkId === currentId) {
          currentIndex = i;
          break;
        }
      }

      if (currentIndex > 0) {
        const prev = sidebarLinks[currentIndex - 1];
        const prevHref = prev.getAttribute('href') || '';
        nav.previousUrl = new URL(prevHref, currentUrl).href;
        nav.previousTitle = prev.textContent?.trim() || 'Previous Problem';
      }

      if (currentIndex >= 0 && currentIndex < sidebarLinks.length - 1) {
        const next = sidebarLinks[currentIndex + 1];
        const nextHref = next.getAttribute('href') || '';
        nav.nextUrl = new URL(nextHref, currentUrl).href;
        nav.nextTitle = next.textContent?.trim() || 'Next Problem';
      }
    }

    nav.problemsetUrl = new URL('/problemset/list/', currentUrl).href;
    return nav;
  }

  public getCategoryProgress(doc: Document, solvedMap: Map<string, ProblemState>): CategoryProgress | null {
    const category = this.extractCategory(doc);
    const sidebarLinks = Array.from(doc.querySelectorAll(CSES_SELECTORS.problemLinks));
    if (sidebarLinks.length === 0) return null;

    let solvedCount = 0;
    const taskIds = new Set<string>();

    for (const link of sidebarLinks) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/problemset\/task\/(\d+)/i);
      if (match) {
        const id = match[1];
        taskIds.add(id);
        const state = solvedMap.get(id);
        if (state?.solved) {
          solvedCount++;
        }
      }
    }

    return {
      category: category || 'Problem Set',
      solvedCount,
      totalCount: taskIds.size
    };
  }

  private extractSubmitUrl(doc: Document, currentUrl: URL, taskId?: string): string | undefined {
    const submitTab = doc.querySelector(CSES_SELECTORS.submitTab);
    if (submitTab) {
      const href = submitTab.getAttribute('href');
      if (href) return new URL(href, currentUrl).href;
    }
    if (taskId) {
      return `https://cses.fi/problemset/submit/${taskId}/`;
    }
    return undefined;
  }

  private extractSubmissionsUrl(doc: Document, currentUrl: URL, taskId?: string): string | undefined {
    const statsTab = doc.querySelector('.title-block .nav a[href*="/stats/"]');
    if (statsTab) {
      const href = statsTab.getAttribute('href');
      if (href) return new URL(href, currentUrl).href;
    }
    if (taskId) {
      return `https://cses.fi/problemset/stats/${taskId}/`;
    }
    return undefined;
  }

  private extractMySubmissionsUrl(doc: Document, currentUrl: URL, taskId?: string): string | undefined {
    const resultTab = doc.querySelector('.title-block .nav a[href*="/result/"]');
    if (resultTab) {
      const href = resultTab.getAttribute('href');
      if (href) return new URL(href, currentUrl).href;
    }
    if (taskId) {
      return `https://cses.fi/problemset/result/${taskId}/`;
    }
    return undefined;
  }
}
