import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  ts: number
  level: LogLevel
  action: string
  args: string[]
  detail?: string
}

// LogService writes a local audit log of every git operation.
// IMPORTANT: Never log secrets, tokens, or passwords.
// The log is append-only and rotated when it exceeds MAX_SIZE_BYTES.
export class LogService {
  private static instance: LogService
  private readonly logPath: string
  private readonly MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

  private constructor() {
    const logDir = path.join(os.homedir(), '.deepcurrent', 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    this.logPath = path.join(logDir, 'git-operations.jsonl')
  }

  static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService()
    }
    return LogService.instance
  }

  info(action: string, args: string[], detail?: string): void {
    this.write({ ts: Date.now(), level: 'info', action, args: this.sanitize(args), detail: this.sanitizeDetail(detail) })
  }

  warn(action: string, args: string[], detail?: string): void {
    this.write({ ts: Date.now(), level: 'warn', action, args: this.sanitize(args), detail: this.sanitizeDetail(detail) })
  }

  error(action: string, code: string, detail?: string): void {
    this.write({ ts: Date.now(), level: 'error', action, args: [code], detail: this.sanitizeDetail(detail) })
  }

  getRecentEntries(count: number = 100): LogEntry[] {
    try {
      const raw = fs.readFileSync(this.logPath, 'utf8')
      const lines = raw.trim().split('\n').filter(Boolean)
      return lines
        .slice(-count)
        .map((l) => JSON.parse(l) as LogEntry)
        .reverse()
    } catch {
      return []
    }
  }

  private write(entry: LogEntry): void {
    try {
      this.rotateIfNeeded()
      fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n', 'utf8')
    } catch {
      // Log failures are non-fatal — never crash the app because of logging
    }
  }

  // Scrub tokens, passwords, and credentials from argument arrays.
  private sanitize(args: string[]): string[] {
    const secretPattern = /token|password|secret|credential|auth|bearer/i
    return args.map((arg) => {
      if (secretPattern.test(arg)) return '[REDACTED]'
      return arg.replace(/:\/\/[^:]+:[^@]+@/, '://[REDACTED]@')
    })
  }

  // Scrub the same patterns from the free-form detail string.
  private sanitizeDetail(detail?: string): string | undefined {
    if (!detail) return detail
    const secretPattern = /token|password|secret|credential|auth|bearer/i
    if (secretPattern.test(detail)) return '[REDACTED]'
    return detail.replace(/:\/\/[^:]+:[^@]+@/, '://[REDACTED]@')
  }

  private rotateIfNeeded(): void {
    try {
      const stat = fs.statSync(this.logPath)
      if (stat.size > this.MAX_SIZE_BYTES) {
        const archived = this.logPath.replace('.jsonl', `.${Date.now()}.jsonl`)
        fs.renameSync(this.logPath, archived)
        // Keep only the two most recent rotated logs
        this.pruneRotatedLogs()
      }
    } catch {
      // File doesn't exist yet — that's fine
    }
  }

  private pruneRotatedLogs(): void {
    try {
      const dir = path.dirname(this.logPath)
      const base = path.basename(this.logPath, '.jsonl')
      const rotated = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith(base) && f !== path.basename(this.logPath))
        .sort()
        .reverse()

      for (const old of rotated.slice(2)) {
        fs.unlinkSync(path.join(dir, old))
      }
    } catch {
      // Non-fatal
    }
  }
}
