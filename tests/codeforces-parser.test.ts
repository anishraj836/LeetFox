import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { CodeforcesParser } from '../src/platforms/codeforces/CodeforcesParser';

describe('CodeforcesParser', () => {
  const parser = new CodeforcesParser();
  const fixturePath = path.resolve(__dirname, 'fixtures/codeforces/problem_4a.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

  it('parses real Codeforces 4A problem fixture accurately', () => {
    const dom = new JSDOM(fixtureHtml, { url: 'https://codeforces.com/contest/4/problem/A' });
    const problem = parser.parse(dom.window.document, new URL('https://codeforces.com/contest/4/problem/A'));

    expect(problem).not.toBeNull();
    if (!problem) return;

    expect(problem.platform).toBe('codeforces');
    expect(problem.id).toBe('4A');
    expect(problem.qualifiedId).toBe('codeforces:4a');
    expect(problem.title).toBe('Watermelon');
    expect(problem.difficulty).toBe(800);
    expect(problem.tags).toEqual(['brute force', 'math']);

    // Limits
    expect(problem.limits.timeLimit).toBe('1.0 s');
    expect(problem.limits.memoryLimit).toBe('64 MB');

    // Sections
    expect(problem.statementHtml).toContain('Pete and his friend Billy decided to buy a watermelon');
    expect(problem.inputSpecificationHtml).toContain('weight of the watermelon');
    expect(problem.outputSpecificationHtml).toContain('YES');
    expect(problem.noteHtml).toContain('2 and 6 kilos');

    // Examples
    expect(problem.examples).toHaveLength(1);
    expect(problem.examples[0].input).toBe('8');
    expect(problem.examples[0].output).toBe('YES');

    // Contest & Navigation
    expect(problem.contest?.name).toBe('Codeforces Beta Round 4 (Div. 2 Only)');
    expect(problem.navigation.nextUrl).toContain('/contest/4/problem/B');
    expect(problem.navigation.nextTitle).toBe('Before an Exam');

    // Submit & Submissions URLs
    expect(problem.submitUrl).toContain('/contest/4/submit?submittedProblemIndex=A');
    expect(problem.mySubmissionsUrl).toBe('https://codeforces.com/contest/4/my');
    expect(problem.submissionsUrl).toBe('https://codeforces.com/contest/4/status/A');
  });

  it('handles problem pages with missing optional fields without throwing', () => {
    const minimalHtml = `
      <div class="problem-statement">
        <div class="header">
          <div class="title">B. Simple Task</div>
        </div>
        <div><p>Simple statement.</p></div>
      </div>
    `;
    const dom = new JSDOM(minimalHtml, { url: 'https://codeforces.com/problemset/problem/100/B' });
    const problem = parser.parse(dom.window.document, new URL('https://codeforces.com/problemset/problem/100/B'));

    expect(problem).not.toBeNull();
    expect(problem?.id).toBe('100B');
    expect(problem?.title).toBe('Simple Task');
    expect(problem?.tags).toEqual([]);
    expect(problem?.difficulty).toBeUndefined();
    expect(problem?.examples).toEqual([]);
    expect(problem?.noteHtml).toBeUndefined();
    expect(problem?.mySubmissionsUrl).toBe('https://codeforces.com/problemset/status?my=on');
    expect(problem?.submissionsUrl).toBe('https://codeforces.com/problemset/status/100/problem/B');
  });

  it('gracefully returns null on non-problem pages', () => {
    const nonProblemHtml = `<html><body><div id="pageContent">Not a problem</div></body></html>`;
    const dom = new JSDOM(nonProblemHtml, { url: 'https://codeforces.com/problemset' });
    const problem = parser.parse(dom.window.document, new URL('https://codeforces.com/problemset'));

    expect(problem).toBeNull();
  });
});
