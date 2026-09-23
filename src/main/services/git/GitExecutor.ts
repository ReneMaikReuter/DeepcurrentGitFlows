import { spawn } from 'child_process'
import * as path from 'path'

export interface GitResult {
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
  command: string[]
  durationMs: number
}

export class GitExecutionError extends Error {
  constructor(
    public readonly result: GitResult,
    message: string,
  ) {
    super(message)
    this.name = 'GitExecutionError'
  }
}

// GitExecutor is the ONLY place in the application that spawns git processes.
// All commands are passed as argument arrays — never as interpolated strings.
// This prevents shell injection and ensures every command is auditable.
export class GitExecutor {
  constructor(
    private readonly repositoryPath: string,
    private readonly gitBinary: string = 'git',
  ) {}

  async git(args: string[], options: { timeoutMs?: number; onStderr?: (chunk: string) => void } = {}): Promise<GitResult> {
    return this.run(this.gitBinary, args, options)
  }

  async lfs(args: string[], options: { timeoutMs?: number } = {}): Promise<GitResult> {
    // git lfs commands run through the git binary with 'lfs' as first arg
    return this.run(this.gitBinary, ['lfs', ...args], options)
  }

  private static buildEnv(): NodeJS.ProcessEnv {
    // On Windows, GUI apps launched from Explorer may not have Git in PATH.
    // Augment PATH with the standard Git installation locations so spawn can
    // find git.exe without shell: true (which we keep false for security).
    const extraPaths = process.platform === 'win32'
      ? [
          'C:\\Program Files\\Git\\bin',
          'C:\\Program Files\\Git\\cmd',
          'C:\\Program Files (x86)\\Git\\bin',
        ]
      : []
    const existingPath = process.env.PATH ?? ''
    const augmentedPath = [...extraPaths, existingPath].join(process.platform === 'win32' ? ';' : ':')
    return {
      ...process.env,
      PATH: augmentedPath,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'echo',
    }
  }

  private run(
    binary: string,
    args: string[],
    options: { timeoutMs?: number; onStderr?: (chunk: string) => void } = {},
  ): Promise<GitResult> {
    const timeoutMs = options.timeoutMs ?? 30_000
    const startedAt = Date.now()
    const command = [binary, ...args]

    return new Promise((resolve, reject) => {
      let stdoutChunks: Buffer[] = []
      let stderrChunks: Buffer[] = []

      // spawn — never exec/execSync — ensures args are never shell-interpreted
      const child = spawn(binary, args, {
        cwd: this.repositoryPath,
        env: GitExecutor.buildEnv(),
        // No shell: true — this is intentional and critical for security
        shell: false,
      })

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk)
        options.onStderr?.(chunk.toString('utf8'))
      })

      const timeout = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(`Git command timed out after ${timeoutMs}ms: ${command.join(' ')}`))
      }, timeoutMs)

      child.on('close', (exitCode) => {
        clearTimeout(timeout)
        const stdout = Buffer.concat(stdoutChunks).toString('utf8').trimEnd()
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trimEnd()

        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
          success: exitCode === 0,
          command,
          durationMs: Date.now() - startedAt,
        })
      })

      child.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  }

  // Validate that git is available and return version string
  static async checkGit(): Promise<string | null> {
    try {
      const result = await new GitExecutor('.').git(['--version'])
      if (result.success) {
        return result.stdout.replace('git version ', '').trim()
      }
      return null
    } catch {
      return null
    }
  }

  static async checkGitLfs(): Promise<string | null> {
    try {
      const result = await new GitExecutor('.').lfs(['version'])
      if (result.success) {
        return result.stdout.replace('git-lfs/', '').split(' ')[0].trim()
      }
      return null
    } catch {
      return null
    }
  }

  // Resolve the repository root even if a subdirectory was opened
  static async resolveRepositoryRoot(startPath: string): Promise<string | null> {
    try {
      const executor = new GitExecutor(startPath)
      const result = await executor.git(['rev-parse', '--show-toplevel'])
      if (result.success) {
        return result.stdout.trim().replace(/\//g, path.sep)
      }
      return null
    } catch {
      return null
    }
  }
}
