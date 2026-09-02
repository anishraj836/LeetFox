import type { PlatformAdapter } from '../../core/platform/PlatformAdapter';
import type { Problem } from '../../core/models/problem';
import type { CategoryProgress, ProblemState } from '../../core/models/state';
import { CSESParser } from './CSESParser';
import { CSES_SELECTORS } from './selectors';

export class CSESAdapter implements PlatformAdapter {
  public readonly platformId = 'cses';
  public readonly name = 'CSES';
  private parser = new CSESParser();

  public matches(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host === 'cses.fi' || host.endsWith('.cses.fi');
  }

  public isProblemPage(url: URL, doc?: Document): boolean {
    // Only /problemset/task/{id} is a problem page.
    // Homepage (/), course list (/courses), problem list (/problemset/list),
    // login (/login), and submit pages (/problemset/submit/*) are NEVER problem pages.
    const isTaskUrl = /\/problemset\/task\/\d+/i.test(url.pathname);
    if (!isTaskUrl) {
      return false;
    }

    if (doc) {
      return !!doc.querySelector(CSES_SELECTORS.markdownContainer);
    }
    return true;
  }

  public parseProblem(doc: Document, url: URL): Problem | null {
    return this.parser.parse(doc, url);
  }

  public getOriginalContainer(doc: Document): HTMLElement | null {
    return doc.querySelector(CSES_SELECTORS.content) as HTMLElement;
  }

  public getCategoryProgress(doc: Document, solvedMap: Map<string, ProblemState>): CategoryProgress | null {
    return this.parser.getCategoryProgress(doc, solvedMap);
  }
}
