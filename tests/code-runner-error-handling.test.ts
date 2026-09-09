import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CodeRunner,
  checkUnbalancedBrackets,
  generateCompilerDiagnostics,
  generateRuntimeDiagnostics
} from '../src/core/runner/CodeRunner';

describe('Code Runner Error Handling & Diagnostics', () => {
  let runner: CodeRunner;

  beforeEach(() => {
    runner = CodeRunner.getInstance();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bracket & Syntax Pre-flight Checking', () => {
    it('returns null for balanced code with nested brackets', () => {
      const code = `
        #include <iostream>
        int main() {
          int arr[5] = {1, (2 + 3), 4, 5};
          std::cout << arr[0] << std::endl;
          return 0;
        }
      `;
      expect(checkUnbalancedBrackets(code)).toBeNull();
    });

    it('ignores brackets inside string literals and comments', () => {
      const code = `
        // Unmatched comment bracket: { ( [
        /* Multi-line comment ( { [ */
        string s = "Unmatched string bracket: { ( [";
        string escaped = "Escaped \\" { ( [";
        int main() { return 0; }
      `;
      expect(checkUnbalancedBrackets(code)).toBeNull();
    });

    it('detects unclosed brackets with line numbers', () => {
      const code = `int main() {\n  if (true) {\n    return 0;\n`;
      const err = checkUnbalancedBrackets(code);
      expect(err).not.toBeNull();
      expect(err).toContain("Unclosed bracket '{'");
    });

    it('detects mismatched brackets', () => {
      const code = `int main() {\n  int x = (5 + 3];\n}`;
      const err = checkUnbalancedBrackets(code);
      expect(err).not.toBeNull();
      expect(err).toContain("Mismatched bracket");
      expect(err).toContain("opened '('");
      expect(err).toContain("closed with ']'");
    });
  });

  describe('Compiler Error Diagnostics Generator', () => {
    it('provides C++ diagnostic hints for undeclared identifiers and missing namespace', () => {
      const errorMsg = "prog.cc:5:5: error: 'cout' was not declared in this scope";
      const hints = generateCompilerDiagnostics(errorMsg, 'cpp');
      expect(hints.some(h => h.includes('misspelled') || h.includes('<iostream>') || h.includes('namespace'))).toBe(true);
    });

    it('provides diagnostic hints for missing semicolons', () => {
      const errorMsg = "prog.cc:6:1: error: expected ';' before '}' token";
      const hints = generateCompilerDiagnostics(errorMsg, 'cpp');
      expect(hints.some(h => h.includes("semicolon ';'") || h.includes('before or on'))).toBe(true);
    });

    it('provides Python diagnostic hints for IndentationError and SyntaxError', () => {
      const indentMsg = "IndentationError: unexpected indent";
      const indentHints = generateCompilerDiagnostics(indentMsg, 'python');
      expect(indentHints.some(h => h.includes('spaces'))).toBe(true);

      const syntaxMsg = "SyntaxError: invalid syntax";
      const syntaxHints = generateCompilerDiagnostics(syntaxMsg, 'python');
      expect(syntaxHints.some(h => h.includes("colons ':") || h.includes('parentheses'))).toBe(true);
    });
  });

  describe('Runtime Error Diagnostics Generator', () => {
    it('provides detailed diagnostic hints for SIGSEGV segmentation faults', () => {
      const hints = generateRuntimeDiagnostics('SIGSEGV', '', 'cpp');
      expect(hints.some(h => h.includes('Segmentation Fault') || h.includes('out-of-bounds'))).toBe(true);
    });

    it('provides diagnostic hints for SIGFPE floating point exceptions', () => {
      const hints = generateRuntimeDiagnostics('SIGFPE', '', 'cpp');
      expect(hints.some(h => h.includes('Floating Point') || h.includes('division by zero'))).toBe(true);
    });

    it('provides diagnostic hints for SIGABRT assertion failures', () => {
      const hints = generateRuntimeDiagnostics('SIGABRT', '', 'cpp');
      expect(hints.some(h => h.includes('Aborted') || h.includes('assert()'))).toBe(true);
    });

    it('provides diagnostic hints for Python runtime exceptions', () => {
      const hints = generateRuntimeDiagnostics(undefined, 'IndexError: list index out of range', 'python');
      expect(hints.some(h => h.includes('IndexError') || h.includes('list index'))).toBe(true);

      const recHints = generateRuntimeDiagnostics(undefined, 'RecursionError: maximum recursion depth exceeded', 'python');
      expect(recHints.some(h => h.includes('RecursionError') || h.includes('recursion'))).toBe(true);
    });
  });

  describe('Pre-flight CodeRunner Validations', () => {
    it('returns validation error if source code is empty or whitespace', async () => {
      const res = await runner.runTestcase('cpp', '   \n\t  ', '1 2');
      expect(res.status).toBe('error');
      expect(res.errorCategory).toBe('validation');
      expect(res.programError).toContain('empty');
      expect(res.diagnosticHints).toBeDefined();
    });

    it('returns validation error if language is unsupported', async () => {
      const res = await runner.runTestcase('brainfuck', '+++++.', '');
      expect(res.status).toBe('error');
      expect(res.errorCategory).toBe('validation');
      expect(res.programError).toContain('Unsupported language');
    });

    it('returns network error if browser is detected as offline', async () => {
      const originalOnLine = navigator.onLine;
      try {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        const res = await runner.runTestcase('cpp', 'int main(){}', '');
        expect(res.status).toBe('error');
        expect(res.errorCategory).toBe('network');
        expect(res.programError).toContain('offline');
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });
  });

  describe('HTTP & Server Error Handling', () => {
    it('handles HTTP 429 rate limit with friendly diagnostic message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as any);

      const res = await runner.runTestcase('cpp', 'int main(){ return 0; }', '');
      expect(res.status).toBe('error');
      expect(res.errorCategory).toBe('rate_limit');
      expect(res.programError).toContain('rate limit');
    });

    it('handles HTTP 500/503 server error gracefully when all execution services fail', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      } as any);

      const res = await runner.runTestcase('cpp', 'int main(){ return 0; }', '');
      expect(res.status).toBe('error');
      expect(res.errorCategory).toBe('server');
      expect(res.programError).toContain('unavailable');
    });

    it('automatically fails over to Judge0 CE when Wandbox fails with 500', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: { id: 3, description: 'Accepted' },
            stdout: '42\n'
          })
        } as any);

      const res = await runner.runTestcase('cpp', 'int main(){ return 0; }', '', '42');
      expect(res.status).toBe('accepted');
      expect(res.programOutput).toBe('42\n');
    });

    it('handles server timeout signal SIGKILL as timeout status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: '137',
          signal: 'SIGKILL',
          program_output: ''
        })
      } as any);

      const res = await runner.runTestcase('cpp', 'while(1);', '');
      expect(res.status).toBe('timeout');
      expect(res.errorCategory).toBe('timeout');
      expect(res.programError).toContain('Time Limit Exceeded');
    });

    it('handles compilation errors and attaches bracket error if present', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: '1',
          compiler_error: "prog.cc:3:1: error: expected ';' before '}' token",
          program_output: ''
        })
      } as any);

      const res = await runner.runTestcase('cpp', 'int main() { return 0\n}', '');
      expect(res.status).toBe('compile_error');
      expect(res.errorCategory).toBe('compilation');
      expect(res.compilerError).toContain("expected ';'");
      expect(res.diagnosticHints).toBeDefined();
    });

    it('handles runtime error with SIGSEGV and attaches diagnostics', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: '139',
          signal: 'SIGSEGV',
          program_error: 'Segmentation fault (core dumped)',
          program_output: ''
        })
      } as any);

      const res = await runner.runTestcase('cpp', 'int main() { int* p = 0; *p = 1; }', '');
      expect(res.status).toBe('runtime_error');
      expect(res.errorCategory).toBe('runtime');
      expect(res.diagnosticHints?.some(h => h.includes('Segmentation Fault'))).toBe(true);
    });
  });
});
