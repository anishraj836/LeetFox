import type { CategoryProgress } from '../../core/models/state';
import { createElement } from '../../core/utils/dom';

export class ProgressBar {
  private element: HTMLElement;
  private countLabel: HTMLElement;
  private fillBar: HTMLElement;

  constructor(private progress: CategoryProgress) {
    this.element = createElement('div', { className: 'lf-progress-card' });

    const header = createElement('div', { className: 'lf-progress-header' });
    const title = createElement('span', { className: 'lf-progress-title' }, `${this.progress.category} Progress`);

    const pct = this.progress.totalCount > 0
      ? Math.round((this.progress.solvedCount / this.progress.totalCount) * 100)
      : 0;

    this.countLabel = createElement('span', { className: 'lf-progress-count' },
      `${this.progress.solvedCount} / ${this.progress.totalCount} (${pct}%)`
    );

    header.appendChild(title);
    header.appendChild(this.countLabel);

    const barBg = createElement('div', { className: 'lf-progress-bar-bg' });
    this.fillBar = createElement('div', {
      className: 'lf-progress-bar-fill',
      style: `width: ${pct}%`
    });

    barBg.appendChild(this.fillBar);

    this.element.appendChild(header);
    this.element.appendChild(barBg);
  }

  public update(progress: CategoryProgress): void {
    this.progress = progress;
    const pct = this.progress.totalCount > 0
      ? Math.round((this.progress.solvedCount / this.progress.totalCount) * 100)
      : 0;

    this.countLabel.textContent = `${this.progress.solvedCount} / ${this.progress.totalCount} (${pct}%)`;
    this.fillBar.style.width = `${pct}%`;
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
