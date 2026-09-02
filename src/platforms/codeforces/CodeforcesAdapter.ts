import type { PlatformAdapter } from '../../core/platform/PlatformAdapter';
import type { Problem } from '../../core/models/problem';
import { CodeforcesParser } from './CodeforcesParser';
import { CODEFORCES_SELECTORS } from './selectors';

export class CodeforcesAdapter implements PlatformAdapter {
  public readonly platformId = 'codeforces';
  public readonly name = 'Codeforces';
  private parser = new CodeforcesParser();

  public matches(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return (
      host === 'codeforces.com' ||
      host.endsWith('.codeforces.com') ||
      host === 'codeforces.net' ||
      host.endsWith('.codeforces.net')
    );
  }

  public isProblemPage(url: URL, doc?: Document): boolean {
    if (doc) {
      if (doc.querySelector(CODEFORCES_SELECTORS.container)) {
        return true;
      }
    }

    const path = url.pathname.toLowerCase();
    return (
      path.includes('/problemset/problem/') ||
      path.includes('/problem/') ||
      /\/contest\/\d+\/problem\/[a-z0-9]/i.test(path) ||
      /\/gym\/\d+\/problem\/[a-z0-9]/i.test(path)
    );
  }

  public parseProblem(doc: Document, url: URL): Problem | null {
    return this.parser.parse(doc, url);
  }

  public getOriginalContainer(doc: Document): HTMLElement | null {
    // Return the element that Leetfox should replace / hide when active
    const content = doc.querySelector('#pageContent') as HTMLElement;
    if (content) return content;

    const problemStatement = doc.querySelector(CODEFORCES_SELECTORS.container) as HTMLElement;
    if (problemStatement) return problemStatement;

    return null;
  }
}
