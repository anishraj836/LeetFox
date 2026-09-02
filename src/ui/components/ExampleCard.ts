import type { ProblemExample } from '../../core/models/problem';
import { createElement, copyToClipboard } from '../../core/utils/dom';

export class ExampleCard {
  private element: HTMLElement;

  constructor(private example: ProblemExample) {
    this.element = createElement('div', { className: 'lf-example-card' });

    // Header
    const header = createElement('div', { className: 'lf-example-header' });
    const headerTitle = createElement('span', {}, `Example ${this.example.id}`);
    header.appendChild(headerTitle);
    this.element.appendChild(header);

    // Grid (Input | Output)
    const grid = createElement('div', { className: 'lf-example-grid' });

    // Input Pane
    const inputPane = createElement('div', { className: 'lf-example-pane' });
    const inputTitleRow = createElement('div', { className: 'lf-example-pane-title' });
    const inputLabel = createElement('span', {}, 'Input');

    const copyInputBtn = createElement('button', {
      className: 'lf-example-copy-btn',
      type: 'button',
      title: 'Copy Input'
    }, '📋 Copy');

    copyInputBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(this.example.input);
      if (ok) {
        copyInputBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyInputBtn.textContent = '📋 Copy'; }, 1500);
      }
    });

    inputTitleRow.appendChild(inputLabel);
    inputTitleRow.appendChild(copyInputBtn);

    const inputPre = createElement('pre', { className: 'lf-example-pre' }, this.example.input);
    inputPane.appendChild(inputTitleRow);
    inputPane.appendChild(inputPre);

    // Output Pane
    const outputPane = createElement('div', { className: 'lf-example-pane' });
    const outputTitleRow = createElement('div', { className: 'lf-example-pane-title' });
    const outputLabel = createElement('span', {}, 'Output');

    const copyOutputBtn = createElement('button', {
      className: 'lf-example-copy-btn',
      type: 'button',
      title: 'Copy Output'
    }, '📋 Copy');

    copyOutputBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(this.example.output);
      if (ok) {
        copyOutputBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyOutputBtn.textContent = '📋 Copy'; }, 1500);
      }
    });

    outputTitleRow.appendChild(outputLabel);
    outputTitleRow.appendChild(copyOutputBtn);

    const outputPre = createElement('pre', { className: 'lf-example-pre' }, this.example.output);
    outputPane.appendChild(outputTitleRow);
    outputPane.appendChild(outputPre);

    grid.appendChild(inputPane);
    grid.appendChild(outputPane);

    this.element.appendChild(grid);
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
