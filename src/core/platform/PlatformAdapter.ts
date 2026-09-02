import type { Problem } from '../models/problem';
import type { CategoryProgress, ProblemState } from '../models/state';

export interface PlatformAdapter {
  readonly platformId: string;
  readonly name: string;

  /**
   * Returns true if this adapter handles URLs from the given domain/origin.
   */
  matches(url: URL): boolean;

  /**
   * Returns true if the given URL corresponds to a problem/task statement page.
   */
  isProblemPage(url: URL, doc?: Document): boolean;

  /**
   * Parses the DOM into a normalized Problem object.
   * Returns null if parsing cannot be performed.
   */
  parseProblem(doc: Document, url: URL): Problem | null;

  /**
   * Returns the primary container on the host page that Leetfox replaces or augments.
   */
  getOriginalContainer(doc: Document): HTMLElement | null;

  /**
   * Optional method to compute category progress based on local solved states.
   */
  getCategoryProgress?(doc: Document, solvedMap: Map<string, ProblemState>): CategoryProgress | null;
}
