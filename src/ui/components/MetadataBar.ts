import type { Problem } from '../../core/models/problem';
import { createElement } from '../../core/utils/dom';

export class MetadataBar {
  private element: HTMLElement;

  constructor(private problem: Problem) {
    this.element = createElement('div', { className: 'lf-metadata-card' });

    // Row 1: Title & ID & Quick Submit
    const titleRow = createElement('div', { className: 'lf-metadata-row' });
    const titleEl = createElement('h1', { className: 'lf-problem-title-large' });

    const idBadge = createElement('span', { className: 'lf-problem-id-badge' }, this.problem.id);
    const titleText = createElement('span', {}, this.problem.title);

    titleEl.appendChild(idBadge);
    titleEl.appendChild(titleText);
    titleRow.appendChild(titleEl);

    // Quick Submit button if submitUrl exists
    if (this.problem.submitUrl) {
      const submitBtn = createElement('a', {
        className: 'lf-btn lf-btn-primary',
        href: this.problem.submitUrl,
        target: '_self',
        title: 'Submit Code'
      }, '🚀 Submit Code');
      titleRow.appendChild(submitBtn);
    }

    this.element.appendChild(titleRow);

    // Row 2: Specifications, Limits, Rating, Contest
    const specsRow = createElement('div', { className: 'lf-metadata-row' });
    const specsGroup = createElement('div', { className: 'lf-specs-group' });

    if (this.problem.difficulty !== undefined) {
      const diffBadge = createElement('span', {
        className: 'lf-spec-badge difficulty'
      }, `★ Rating: ${this.problem.difficulty}`);
      specsGroup.appendChild(diffBadge);
    }

    if (this.problem.limits.timeLimit) {
      const timeBadge = createElement('span', {
        className: 'lf-spec-badge'
      }, `⏱ ${this.problem.limits.timeLimit}`);
      specsGroup.appendChild(timeBadge);
    }

    if (this.problem.limits.memoryLimit) {
      const memBadge = createElement('span', {
        className: 'lf-spec-badge'
      }, `💾 ${this.problem.limits.memoryLimit}`);
      specsGroup.appendChild(memBadge);
    }

    if (this.problem.contest?.name) {
      const contestBadge = createElement('span', {
        className: 'lf-spec-badge'
      }, `🏆 ${this.problem.contest.name}`);
      specsGroup.appendChild(contestBadge);
    }

    specsRow.appendChild(specsGroup);

    // Tags
    if (this.problem.tags && this.problem.tags.length > 0) {
      const tagsContainer = createElement('div', { className: 'lf-tags-container' });
      for (const tag of this.problem.tags) {
        const tagPill = createElement('span', { className: 'lf-tag-pill' }, tag);
        tagsContainer.appendChild(tagPill);
      }
      specsRow.appendChild(tagsContainer);
    }

    this.element.appendChild(specsRow);
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
