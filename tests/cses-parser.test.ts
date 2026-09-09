import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { CSESParser } from '../src/platforms/cses/CSESParser';
import type { ProblemState } from '../src/core/models/state';

describe('CSESParser', () => {
  const parser = new CSESParser();
  const fixturePath = path.resolve(__dirname, 'fixtures/cses/task_1068.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

  it('parses real CSES 1068 problem fixture accurately', () => {
    const dom = new JSDOM(fixtureHtml, { url: 'https://cses.fi/problemset/task/1068' });
    const problem = parser.parse(dom.window.document, new URL('https://cses.fi/problemset/task/1068'));

    expect(problem).not.toBeNull();
    if (!problem) return;

    expect(problem.platform).toBe('cses');
    expect(problem.id).toBe('1068');
    expect(problem.qualifiedId).toBe('cses:1068');
    expect(problem.title).toBe('Weird Algorithm');
    expect(problem.category).toBe('Introductory Problems');

    // Limits
    expect(problem.limits.timeLimit).toBe('1.00 s');
    expect(problem.limits.memoryLimit).toBe('512 MB');

    // Sections
    expect(problem.statementHtml).toContain('takes as input a positive integer');
    expect(problem.inputSpecificationHtml).toContain('only input line contains an integer');
    expect(problem.outputSpecificationHtml).toContain('Print a line that contains all values');
    expect(problem.noteHtml).toContain('Constraints');

    // Examples
    expect(problem.examples).toHaveLength(1);
    expect(problem.examples[0].input).toBe('3');
    expect(problem.examples[0].output).toBe('3 10 5 16 8 4 2 1');

    // Navigation
    expect(problem.navigation.nextUrl).toContain('/problemset/task/1083');
    expect(problem.navigation.nextTitle).toBe('Missing Number');

    // Submit & Submissions URLs
    expect(problem.submitUrl).toContain('/problemset/submit/1068/');
    expect(problem.submissionsUrl).toBe('https://cses.fi/problemset/stats/1068/');
    expect(problem.mySubmissionsUrl).toBe('https://cses.fi/problemset/result/1068/');
  });

  it('calculates category progress correctly based on solved states', () => {
    const dom = new JSDOM(fixtureHtml, { url: 'https://cses.fi/problemset/task/1068' });

    const solvedMap = new Map<string, ProblemState>([
      ['1068', { solved: true, attempted: false, bookmarked: false, notes: '', lastVisited: 0 }],
      ['1083', { solved: true, attempted: false, bookmarked: false, notes: '', lastVisited: 0 }],
      ['1069', { solved: false, attempted: false, bookmarked: false, notes: '', lastVisited: 0 }]
    ]);

    const progress = parser.getCategoryProgress(dom.window.document, solvedMap);
    expect(progress).not.toBeNull();
    expect(progress?.category).toBe('Introductory Problems');
    expect(progress?.totalCount).toBe(4); // 1068, 1083, 1069, 1094
    expect(progress?.solvedCount).toBe(2); // 1068, 1083
  });

  it('handles pages with missing constraints and degrades gracefully', () => {
    const minimalHtml = `
      <div class="content">
        <div class="title-block"><h1>Simple Math</h1></div>
        <div class="md"><p>Solve 2+2.</p></div>
      </div>
    `;
    const dom = new JSDOM(minimalHtml, { url: 'https://cses.fi/problemset/task/9999' });
    const problem = parser.parse(dom.window.document, new URL('https://cses.fi/problemset/task/9999'));

    expect(problem).not.toBeNull();
    expect(problem?.id).toBe('9999');
    expect(problem?.title).toBe('Simple Math');
    expect(problem?.examples).toEqual([]);
  });

  it('returns null on non-task pages', () => {
    const nonTaskHtml = `<div class="content"><h1>CSES Problem Set</h1></div>`;
    const dom = new JSDOM(nonTaskHtml, { url: 'https://cses.fi/problemset/list/' });
    const problem = parser.parse(dom.window.document, new URL('https://cses.fi/problemset/list/'));

    expect(problem).toBeNull();
  });
});
