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
    const path = url.pathname.toLowerCase();
    const isProblemUrl = (
      path.includes('/problemset/problem/') ||
      /\/contest\/\d+\/problem\/[a-z0-9]/i.test(path) ||
      /\/gym\/\d+\/problem\/[a-z0-9]/i.test(path) ||
      /\/group\/[^/]+\/contest\/\d+\/problem\/[a-z0-9]/i.test(path)
    );

    // Explicitly exclude non-problem pages that might contain the pattern
    if (path.includes('/submit') || path.includes('/status') || path.includes('/standings') || path.includes('/hack') || path.includes('/customtest')) {
      return false;
    }

    // If it is not a problem URL (e.g. homepage, contests list, login /enter), return false
    if (!isProblemUrl) {
      return false;
    }

    if (doc) {
      return !!doc.querySelector(CODEFORCES_SELECTORS.container);
    }

    return true;
  }

  public parseProblem(doc: Document, url: URL): Problem | null {
    return this.parser.parse(doc, url);
  }

  public getOriginalContainer(doc: Document): HTMLElement | null {
    const content = doc.querySelector('#pageContent') as HTMLElement;
    if (content) return content;

    const problemStatement = doc.querySelector(CODEFORCES_SELECTORS.container) as HTMLElement;
    if (problemStatement) return problemStatement;

    return null;
  }
}
