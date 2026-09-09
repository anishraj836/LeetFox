export interface ExecutionResult {
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout' | 'error';
  programOutput: string;
  expectedOutput?: string;
  compilerError?: string;
  programError?: string;
  executionTimeMs?: number;
  errorCategory?: 'network' | 'timeout' | 'rate_limit' | 'compilation' | 'runtime' | 'validation' | 'server';
  diagnosticHints?: string[];
  exitCode?: number | string;
}

export const COMPILER_MAP: Record<string, string> = {
  cpp: 'gcc-head',
  cpp20: 'gcc-head',
  cpp17: 'gcc-head',
  cpp23: 'gcc-head',
  python: 'cpython-3.14.0',
  java: 'openjdk-jdk-21+35',
  rust: 'rust-1.82.0',
  go: 'go-1.23.2'
};

export const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  cpp: 105,    // C++ (GCC 14.1.0)
  cpp20: 105,
  cpp17: 105,
  cpp23: 105,
  python: 100, // Python (3.12.5)
  java: 91,    // Java (JDK 17.0.6)
  rust: 108,   // Rust (1.85.0)
  go: 107      // Go (1.23.5)
};

export function normalizeOutput(str: string): string {
  if (!str) return '';
  return str
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Checks for unmatched brackets (), [], {} while ignoring string and comment contents.
 */
export function checkUnbalancedBrackets(code: string): string | null {
  const stack: { char: string; line: number }[] = [];
  const lines = code.split('\n');
  let inString: string | null = null;
  let inMultiLineComment = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNum = lineIdx + 1;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const nextCh = line[i + 1];

      // Handle multi-line comment /* ... */
      if (inMultiLineComment) {
        if (ch === '*' && nextCh === '/') {
          inMultiLineComment = false;
          i++;
        }
        continue;
      }

      // Handle string literals
      if (inString) {
        if (ch === '\\') {
          i++; // Skip escaped character
        } else if (ch === inString) {
          inString = null;
        }
        continue;
      }

      // Check comments start
      if (ch === '/' && nextCh === '/') {
        break; // Single line comment; skip rest of line
      }
      if (ch === '/' && nextCh === '*') {
        inMultiLineComment = true;
        i++;
        continue;
      }

      // Check string start
      if (ch === '"' || ch === "'") {
        inString = ch;
        continue;
      }

      // Match brackets
      if (ch === '(' || ch === '[' || ch === '{') {
        stack.push({ char: ch, line: lineNum });
      } else if (ch === ')' || ch === ']' || ch === '}') {
        const expected = ch === ')' ? '(' : ch === ']' ? '[' : '{';
        if (stack.length === 0) {
          return `Extra closing bracket '${ch}' found at line ${lineNum}`;
        }
        const last = stack.pop()!;
        if (last.char !== expected) {
          return `Mismatched bracket: opened '${last.char}' at line ${last.line} but closed with '${ch}' at line ${lineNum}`;
        }
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return `Unclosed bracket '${unclosed.char}' opened at line ${unclosed.line}`;
  }

  return null;
}

/**
 * Extracts helpful diagnostic hints for compilation errors
 */
export function generateCompilerDiagnostics(compilerError: string, language: string): string[] {
  const hints: string[] = [];
  const lower = compilerError.toLowerCase();

  if (lower.includes('was not declared in this scope') || lower.includes('undeclared')) {
    hints.push('Check for misspelled variable/function names or missing #include headers.');
    if ((language === 'cpp' || language.startsWith('cpp')) && (lower.includes('cin') || lower.includes('cout') || lower.includes('vector'))) {
      hints.push("Include <iostream> or add 'using namespace std;'.");
    }
  }

  if (lower.includes("expected ';'") || lower.includes('missing semicolon')) {
    hints.push("Missing semicolon ';' before or on the indicated line.");
  }

  if (lower.includes("expected '}'") || lower.includes('expected initializer')) {
    hints.push("Possible unclosed brace '{' or missing closing parenthesis.");
  }

  if (lower.includes('indentationerror')) {
    hints.push('Python indentation error: ensure consistent use of 4 spaces and avoid mixing tabs with spaces.');
  }

  if (lower.includes('syntaxerror')) {
    hints.push("Python syntax error: verify missing colons ':', quotes, or parentheses on the marked line.");
  }

  if (lower.includes('cannot find symbol') || lower.includes('class, interface, or enum expected')) {
    hints.push('Java syntax error: ensure class has a public static void main(String[] args) entry point.');
  }

  if (lower.includes('cannot borrow') || lower.includes('borrowed value does not live long enough')) {
    hints.push('Rust borrow error: check mutable references (&mut) and ownership scopes.');
  }

  if (hints.length === 0) {
    hints.push('Review the compiler output above to pinpoint the exact line and column of the syntax issue.');
  }

  return hints;
}

/**
 * Extracts helpful diagnostic hints for runtime errors and signals
 */
export function generateRuntimeDiagnostics(signal: string | undefined, programError: string, _language: string): string[] {
  const hints: string[] = [];
  const lower = (programError + ' ' + (signal || '')).toLowerCase();

  if (signal === 'SIGSEGV' || lower.includes('sigsegv') || lower.includes('segmentation fault')) {
    hints.push('Segmentation Fault (SIGSEGV): attempted to access invalid or unauthorized memory.');
    hints.push('Common causes: out-of-bounds array/vector indexing (0-indexed vs 1-indexed), dereferencing NULL pointers, or stack overflow from deep recursion.');
  } else if (signal === 'SIGFPE' || lower.includes('sigfpe') || lower.includes('floating point exception')) {
    hints.push('Floating Point Exception (SIGFPE): arithmetic operation failed.');
    hints.push('Common causes: division by zero (x / 0), modulo by zero (x % 0), or integer division overflow (INT_MIN / -1).');
  } else if (signal === 'SIGABRT' || lower.includes('sigabrt') || lower.includes('aborted')) {
    hints.push('Process Aborted (SIGABRT): program terminated via abort() or an uncaught exception.');
    hints.push('Common causes: failed assert() statement, std::out_of_range from vector::at(), or memory corruption.');
  } else if (lower.includes('indexerror')) {
    hints.push('Python IndexError: list index out of range.');
    hints.push('Verify array bounds and check if the input data matches your loop range.');
  } else if (lower.includes('recursionerror') || lower.includes('maximum recursion depth')) {
    hints.push('Python RecursionError: maximum recursion depth exceeded.');
    hints.push('Consider using sys.setrecursionlimit() or converting recursion to an iterative loop with a stack.');
  } else if (lower.includes('zerodivisionerror')) {
    hints.push('Python ZeroDivisionError: division or modulo by zero.');
  } else if (lower.includes('arrayindexoutofboundsexception')) {
    hints.push('Java ArrayIndexOutOfBoundsException: index is negative or greater than array length.');
  } else if (lower.includes('nullpointerexception')) {
    hints.push('Java NullPointerException: tried to use an object reference that is null.');
  } else if (lower.includes('numberformatexception')) {
    hints.push('Java NumberFormatException: failed to parse an integer or float from input string.');
  }

  if (hints.length === 0) {
    hints.push('Check the standard error (stderr) output above for tracebacks and exception details.');
  }

  return hints;
}

export class CodeRunner {
  private static instance: CodeRunner;

  public static getInstance(): CodeRunner {
    if (!CodeRunner.instance) {
      CodeRunner.instance = new CodeRunner();
    }
    return CodeRunner.instance;
  }

  public async runTestcase(
    language: string,
    code: string,
    stdin: string,
    expectedOutput?: string
  ): Promise<ExecutionResult> {
    const trimmedCode = code ? code.trim() : '';

    // 1. Pre-flight Validation: Empty Code
    if (!trimmedCode) {
      return {
        status: 'error',
        errorCategory: 'validation',
        programOutput: '',
        programError: 'Source code is empty.',
        diagnosticHints: [
          'Please write your solution code in the editor before running tests.',
          'Choose your preferred language from the selector bar.'
        ]
      };
    }

    // 2. Pre-flight Validation: Compiler mapping
    const langKey = language.toLowerCase();
    const compiler = COMPILER_MAP[langKey];
    if (!compiler) {
      return {
        status: 'error',
        errorCategory: 'validation',
        programOutput: '',
        programError: `Unsupported language: "${language}".`,
        diagnosticHints: [
          `Supported languages: ${Object.keys(COMPILER_MAP).map(k => k.toUpperCase()).join(', ')}.`,
          'Select a supported language from the top toolbar dropdown.'
        ]
      };
    }

    // 3. Pre-flight Syntax Bracket Check
    const bracketError = checkUnbalancedBrackets(trimmedCode);

    // 4. Pre-flight Offline Check
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      return {
        status: 'error',
        errorCategory: 'network',
        programOutput: '',
        programError: 'You appear to be offline.',
        diagnosticHints: [
          'Code execution requires an internet connection to reach the compilation service.',
          'Check your Wi-Fi or local network connection and try again.'
        ]
      };
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      let response: Response;
      try {
        response = await fetch('https://wandbox.org/api/compile.json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            compiler,
            code: trimmedCode,
            stdin: stdin || ''
          }),
          signal: controller.signal
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr?.name === 'AbortError') {
          return {
            status: 'timeout',
            errorCategory: 'timeout',
            programOutput: '',
            programError: 'Execution timed out (> 12 seconds).',
            diagnosticHints: [
              'Check for infinite loops (e.g. while (true) with no exit condition).',
              'Check if your program is waiting for more input (cin / sys.stdin) than provided.',
              'Ensure your algorithmic complexity fits the constraints (typically ≤ 10^8 operations).'
            ]
          };
        }

        // Try failover to Judge0 CE backup runner
        const failover = await this.tryJudge0(langKey, trimmedCode, stdin, expectedOutput, startTime, bracketError);
        if (failover) return failover;

        return {
          status: 'error',
          errorCategory: 'network',
          programOutput: '',
          programError: `Network connection failed: ${fetchErr?.message || 'Unable to reach execution server'}.`,
          diagnosticHints: [
            'Verify that you have an active internet connection.',
            'Firewalls, ad blockers, or CORS extensions might be blocking execution requests.',
            'Try submitting directly on the platform if the test runner is blocked.'
          ]
        };
      }

      clearTimeout(timeoutId);

      // Handle HTTP error responses
      if (!response.ok) {
        if (response.status === 429) {
          return {
            status: 'error',
            errorCategory: 'rate_limit',
            programOutput: '',
            programError: 'Execution rate limit exceeded.',
            diagnosticHints: [
              'The public execution server received too many requests in a short interval.',
              'Please wait 5–10 seconds before clicking Run again.'
            ]
          };
        }
        if (response.status >= 500) {
          // Try failover to Judge0 CE backup runner
          const failover = await this.tryJudge0(langKey, trimmedCode, stdin, expectedOutput, startTime, bracketError);
          if (failover) return failover;

          return {
            status: 'error',
            errorCategory: 'server',
            programOutput: '',
            programError: `Execution server temporarily unavailable (HTTP ${response.status}).`,
            diagnosticHints: [
              'The remote compilation server is experiencing high load or temporary downtime.',
              'Please try again in a few moments or submit directly to the platform.'
            ]
          };
        }
        return {
          status: 'error',
          errorCategory: 'server',
          programOutput: '',
          programError: `Execution server returned HTTP ${response.status}: ${response.statusText}`,
          diagnosticHints: ['The execution server rejected the request.']
        };
      }

      let data: any;
      try {
        data = await response.json();
      } catch (_) {
        return {
          status: 'error',
          errorCategory: 'server',
          programOutput: '',
          programError: 'Failed to parse JSON response from execution server.',
          diagnosticHints: ['The execution server may have returned an HTML error page. Please try again.']
        };
      }

      const elapsed = Date.now() - startTime;
      const programOutput = data.program_output || '';
      const compilerError = data.compiler_error || data.compiler_message || '';
      const programError = data.program_error || '';
      const exitStatus = data.status;
      const signal = data.signal;

      // 5. Check Timeout Signals from Server
      if (signal === 'SIGKILL' || signal === 'SIGXCPU' || exitStatus === '137' || exitStatus === '124') {
        return {
          status: 'timeout',
          errorCategory: 'timeout',
          programOutput,
          programError: 'Time Limit Exceeded: Process was terminated by timeout signal.',
          executionTimeMs: elapsed,
          exitCode: exitStatus,
          diagnosticHints: [
            'Program exceeded execution time limit.',
            'Check for infinite loops or non-terminating recursion.',
            'Ensure the time complexity is appropriate for the input size.'
          ]
        };
      }

      // 6. Check Compilation Error
      if (compilerError && !programOutput && exitStatus !== '0') {
        const hints = generateCompilerDiagnostics(compilerError, langKey);
        if (bracketError) hints.unshift(bracketError);
        return {
          status: 'compile_error',
          errorCategory: 'compilation',
          programOutput: '',
          compilerError,
          executionTimeMs: elapsed,
          exitCode: exitStatus,
          diagnosticHints: hints
        };
      }

      // 7. Check Runtime Error
      if (exitStatus !== '0' && (programError || signal)) {
        const errorDesc = programError || `Process terminated with signal: ${signal}`;
        const hints = generateRuntimeDiagnostics(signal, errorDesc, langKey);
        return {
          status: 'runtime_error',
          errorCategory: 'runtime',
          programOutput,
          programError: errorDesc,
          compilerError,
          executionTimeMs: elapsed,
          exitCode: exitStatus,
          diagnosticHints: hints
        };
      }

      // 8. Output Comparison with Expected
      if (expectedOutput !== undefined) {
        const normActual = normalizeOutput(programOutput);
        const normExpected = normalizeOutput(expectedOutput);

        if (normActual === normExpected) {
          return {
            status: 'accepted',
            programOutput,
            expectedOutput,
            executionTimeMs: elapsed,
            exitCode: exitStatus
          };
        } else {
          const hints: string[] = [];
          if (normActual.length === 0) {
            hints.push('Your program produced no output. Make sure you are printing to standard output (stdout).');
          } else if (normActual.toLowerCase() === normExpected.toLowerCase()) {
            hints.push('Output difference is solely case sensitivity (e.g. "yes" vs "YES"). Check required output casing.');
          }
          return {
            status: 'wrong_answer',
            programOutput,
            expectedOutput,
            executionTimeMs: elapsed,
            exitCode: exitStatus,
            diagnosticHints: hints.length > 0 ? hints : undefined
          };
        }
      }

      return {
        status: 'accepted',
        programOutput,
        executionTimeMs: elapsed,
        exitCode: exitStatus
      };
    } catch (err: any) {
      return {
        status: 'error',
        errorCategory: 'server',
        programOutput: '',
        programError: err?.message || 'Unexpected execution failure.',
        diagnosticHints: ['An unhandled exception occurred while processing the request.']
      };
    }
  }

  public async tryJudge0(
    langKey: string,
    code: string,
    stdin: string,
    expectedOutput: string | undefined,
    startTime: number,
    bracketError: string | null
  ): Promise<ExecutionResult | null> {
    const languageId = JUDGE0_LANGUAGE_MAP[langKey];
    if (!languageId) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const resp = await fetch('https://ce.judge0.com/submissions?wait=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source_code: code,
          language_id: languageId,
          stdin: stdin || ''
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) return null;

      const data = await resp.json();
      const elapsed = Date.now() - startTime;
      const statusId = data.status?.id;
      const stdout = data.stdout || '';
      const stderr = data.stderr || '';
      const compileOutput = data.compile_output || '';
      const timeMs = data.time ? Math.round(parseFloat(data.time) * 1000) : elapsed;

      // Compile error (Judge0 status 6)
      if (statusId === 6 || (compileOutput && !stdout)) {
        const hints = generateCompilerDiagnostics(compileOutput, langKey);
        if (bracketError) hints.unshift(bracketError);
        return {
          status: 'compile_error',
          errorCategory: 'compilation',
          programOutput: '',
          compilerError: compileOutput,
          executionTimeMs: timeMs,
          diagnosticHints: hints
        };
      }

      // Timeout (Judge0 status 5)
      if (statusId === 5 || data.message === 'Time limit exceeded') {
        return {
          status: 'timeout',
          errorCategory: 'timeout',
          programOutput: stdout,
          programError: 'Time Limit Exceeded: Process exceeded execution time limit.',
          executionTimeMs: timeMs,
          diagnosticHints: [
            'Program exceeded execution time limit.',
            'Check for infinite loops or non-terminating recursion.',
            'Ensure the time complexity is appropriate for the input size.'
          ]
        };
      }

      // Runtime error (Judge0 status 7..12)
      if (statusId >= 7 && statusId <= 12) {
        const errDesc = stderr || data.message || `Runtime Error (${data.status?.description || 'NZEC'})`;
        const hints = generateRuntimeDiagnostics(undefined, errDesc, langKey);
        return {
          status: 'runtime_error',
          errorCategory: 'runtime',
          programOutput: stdout,
          programError: errDesc,
          executionTimeMs: timeMs,
          diagnosticHints: hints
        };
      }

      // Output comparison with expected
      if (expectedOutput !== undefined) {
        const normActual = normalizeOutput(stdout);
        const normExpected = normalizeOutput(expectedOutput);
        const isAccepted = normActual === normExpected;

        if (isAccepted) {
          return {
            status: 'accepted',
            programOutput: stdout,
            expectedOutput,
            executionTimeMs: timeMs
          };
        } else {
          const hints: string[] = [];
          if (normActual.length === 0) {
            hints.push('Your program produced no output. Make sure you are printing to standard output (stdout).');
          } else if (normActual.toLowerCase() === normExpected.toLowerCase()) {
            hints.push('Output difference is solely case sensitivity (e.g. "yes" vs "YES"). Check required output casing.');
          }
          return {
            status: 'wrong_answer',
            programOutput: stdout,
            expectedOutput,
            executionTimeMs: timeMs,
            diagnosticHints: hints.length > 0 ? hints : undefined
          };
        }
      }

      return {
        status: 'accepted',
        programOutput: stdout,
        executionTimeMs: timeMs
      };
    } catch (_) {
      return null;
    }
  }
}
