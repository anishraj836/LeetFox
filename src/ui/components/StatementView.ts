import type { Problem } from '../../core/models/problem';
import { createElement } from '../../core/utils/dom';
import { ExampleCard } from './ExampleCard';

export class StatementView {
  private element: HTMLElement;

  constructor(private problem: Problem, private autoCopyExampleOnClick = true) {
    this.element = createElement('div', { className: 'lf-statement-wrapper' });

    // 1. Problem Statement
    const statementCard = createElement('div', { className: 'lf-card' });
    const statementHeader = createElement('h3', { className: 'lf-section-header' }, 'Problem Statement');
    const statementBody = createElement('div', { className: 'lf-statement-body' });
    statementBody.innerHTML = this.problem.statementHtml;

    statementCard.appendChild(statementHeader);
    statementCard.appendChild(statementBody);
    this.element.appendChild(statementCard);

    // 2. Input Specification
    if (this.problem.inputSpecificationHtml) {
      const inputCard = createElement('div', { className: 'lf-card' });
      const inputHeader = createElement('h3', { className: 'lf-section-header' }, 'Input');
      const inputBody = createElement('div', { className: 'lf-statement-body' });
      inputBody.innerHTML = this.problem.inputSpecificationHtml;

      inputCard.appendChild(inputHeader);
      inputCard.appendChild(inputBody);
      this.element.appendChild(inputCard);
    }

    // 3. Output Specification
    if (this.problem.outputSpecificationHtml) {
      const outputCard = createElement('div', { className: 'lf-card' });
      const outputHeader = createElement('h3', { className: 'lf-section-header' }, 'Output');
      const outputBody = createElement('div', { className: 'lf-statement-body' });
      outputBody.innerHTML = this.problem.outputSpecificationHtml;

      outputCard.appendChild(outputHeader);
      outputCard.appendChild(outputBody);
      this.element.appendChild(outputCard);
    }

    // 4. Interaction Specification (for interactive problems)
    if (this.problem.interactionSpecificationHtml) {
      const interactionCard = createElement('div', { className: 'lf-card' });
      const interactionHeader = createElement('h3', { className: 'lf-section-header' }, 'Interaction');
      const interactionBody = createElement('div', { className: 'lf-statement-body' });
      interactionBody.innerHTML = this.problem.interactionSpecificationHtml;

      interactionCard.appendChild(interactionHeader);
      interactionCard.appendChild(interactionBody);
      this.element.appendChild(interactionCard);
    }

    // 5. Examples
    if (this.problem.examples && this.problem.examples.length > 0) {
      const examplesCard = createElement('div', { className: 'lf-card' });
      const examplesHeader = createElement('h3', { className: 'lf-section-header' }, 'Examples');
      const examplesContainer = createElement('div', { className: 'lf-example-container' });

      for (const ex of this.problem.examples) {
        const card = new ExampleCard(ex, this.autoCopyExampleOnClick);
        examplesContainer.appendChild(card.getElement());
      }

      examplesCard.appendChild(examplesHeader);
      examplesCard.appendChild(examplesContainer);
      this.element.appendChild(examplesCard);
    }

    // 6. Note / Additional Constraints
    if (this.problem.noteHtml) {
      const noteCard = createElement('div', { className: 'lf-card' });
      const noteHeader = createElement('h3', { className: 'lf-section-header' }, 'Note');
      const noteBody = createElement('div', { className: 'lf-statement-body' });
      noteBody.innerHTML = this.problem.noteHtml;

      noteCard.appendChild(noteHeader);
      noteCard.appendChild(noteBody);
      this.element.appendChild(noteCard);
    }
  }

  public typesetMath(): void {
    const win = window as any;
    if (typeof win.katex !== 'undefined') {
      const mathElements = this.element.querySelectorAll('.math');
      mathElements.forEach((el) => {
        if (!el.querySelector('.katex')) {
          const text = el.textContent || '';
          const isDisplay = el.classList.contains('math-display');
          try {
            win.katex.render(text, el, {
              displayMode: isDisplay,
              throwOnError: false
            });
          } catch (_) {}
        }
      });
    }

    if (typeof win.MathJax?.typesetPromise === 'function') {
      try {
        win.MathJax.typesetPromise([this.element]).catch(() => {});
      } catch (_) {}
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
