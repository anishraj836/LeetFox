export interface ExecutionResult {
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout' | 'error';
  programOutput: string;
  expectedOutput?: string;
  compilerError?: string;
  programError?: string;
  executionTimeMs?: number;
}

export const COMPILER_MAP: Record<string, string> = {
  cpp: 'gcc-head',
  python: 'cpython-3.14.0',
  java: 'openjdk-jdk-21+35',
  rust: 'rust-1.82.0',
  go: 'go-1.23.2'
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
    const compiler = COMPILER_MAP[language.toLowerCase()] || 'gcc-head';
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const response = await fetch('https://wandbox.org/api/compile.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          compiler,
          code,
          stdin
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          status: 'error',
          programOutput: '',
          programError: `Execution server returned status ${response.status}`
        };
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;

      const programOutput = data.program_output || '';
      const compilerError = data.compiler_error || data.compiler_message || '';
      const programError = data.program_error || '';
      const exitStatus = data.status;

      // Check compilation error
      if (compilerError && !programOutput && exitStatus !== '0') {
        return {
          status: 'compile_error',
          programOutput: '',
          compilerError,
          executionTimeMs: elapsed
        };
      }

      // Check runtime error
      if (exitStatus !== '0' && (programError || data.signal)) {
        return {
          status: 'runtime_error',
          programOutput,
          programError: programError || `Process terminated with signal: ${data.signal}`,
          compilerError,
          executionTimeMs: elapsed
        };
      }

      // Compare output with expected if provided
      if (expectedOutput !== undefined) {
        const normActual = normalizeOutput(programOutput);
        const normExpected = normalizeOutput(expectedOutput);

        if (normActual === normExpected) {
          return {
            status: 'accepted',
            programOutput,
            expectedOutput,
            executionTimeMs: elapsed
          };
        } else {
          return {
            status: 'wrong_answer',
            programOutput,
            expectedOutput,
            executionTimeMs: elapsed
          };
        }
      }

      return {
        status: 'accepted',
        programOutput,
        executionTimeMs: elapsed
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          status: 'timeout',
          programOutput: '',
          programError: 'Execution timed out (> 12 seconds).'
        };
      }
      return {
        status: 'error',
        programOutput: '',
        programError: err?.message || 'Failed to connect to execution engine.'
      };
    }
  }
}
