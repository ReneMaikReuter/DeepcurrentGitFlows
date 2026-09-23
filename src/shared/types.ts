// ─── GitHub ───────────────────────────────────────────────────────────────────

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  clone_url: string
  ssh_url: string
  description: string | null
  private: boolean
  updated_at: string
  language: string | null
}

// ─── Repository ───────────────────────────────────────────────────────────────

export interface Repository {
  id: string
  name: string
  path: string
  remote: string | null
  lastOpened: number
}

export interface RepositoryHealth {
  isValid: boolean
  gitVersion: string | null
  lfsVersion: string | null
  gitOk: boolean
  lfsOk: boolean
  gitAttributesOk: boolean
  isUnrealProject: boolean
  errors: string[]
  warnings: string[]
}

// ─── Branch ───────────────────────────────────────────────────────────────────

export interface Branch {
  name: string
  isCurrent: boolean
  isRemote: boolean
  upstream: string | null
  aheadBy: number
  behindBy: number
  lastCommitHash: string | null
  lastCommitMessage: string | null
  lastCommitAuthor: string | null
  lastCommitDate: number | null
}

// ─── File Changes ──────────────────────────────────────────────────────────────

export type FileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'conflicted'
  | 'ignored'

export interface ChangedFile {
  path: string
  oldPath: string | null // for renames
  status: FileStatus
  isUnrealAsset: boolean
  assetType: UnrealAssetType | null
  isLfsTracked: boolean
  isLfsPointer: boolean
  fileSizeBytes: number | null
  isStaged: boolean
}

export type UnrealAssetType = 'uasset' | 'umap' | 'ubulk' | 'uexp' | 'uproject'

// ─── Conflicts ────────────────────────────────────────────────────────────────

export interface Conflict {
  path: string
  isUnrealAsset: boolean
  ourBranch: string
  theirBranch: string
  canAutoMerge: boolean // always false for Unreal assets
}

// ─── LFS ──────────────────────────────────────────────────────────────────────

export interface LfsStatus {
  isInstalled: boolean
  isInitialized: boolean
  trackedPatterns: string[]
  pointerFiles: LfsPointerFile[]
  missingObjects: string[]
  errors: string[]
}

export interface LfsPointerFile {
  path: string
  oid: string
  expectedSizeBytes: number
  actualSizeBytes: number
  isRestored: boolean
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncStepStatus = 'pending' | 'running' | 'success' | 'warning' | 'failed' | 'skipped'

export interface SyncStep {
  id: string
  label: string
  status: SyncStepStatus
  detail: string | null
  startedAt: number | null
  finishedAt: number | null
}

export type SyncPhase =
  | 'idle'
  | 'pre-check'
  | 'fetch'
  | 'conflict-check'
  | 'pull'
  | 'lfs-check'
  | 'integrity'
  | 'done'
  | 'failed'

export interface SyncState {
  phase: SyncPhase
  steps: SyncStep[]
  conflicts: Conflict[]
  lfsProblems: LfsPointerFile[]
  error: SyncError | null
  completedAt: number | null
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export type SyncErrorCode =
  | 'UNREAL_RUNNING'
  | 'UNCOMMITTED_CHANGES'
  | 'UNREAL_CONFLICT'
  | 'LFS_POINTER_DETECTED'
  | 'LFS_OBJECT_MISSING'
  | 'NETWORK_ERROR'
  | 'PUSH_REJECTED'
  | 'PROTECTED_BRANCH'
  | 'CORRUPT_REPOSITORY'
  | 'GIT_NOT_FOUND'
  | 'LFS_NOT_FOUND'
  | 'BACKUP_FAILED'
  | 'UNKNOWN'

export interface SyncError {
  code: SyncErrorCode
  humanMessage: string
  affectedFiles: string[]
  canRestore: boolean
  technicalDetail: string | null
}

// ─── Commit ───────────────────────────────────────────────────────────────────

export interface CommitRequest {
  message: string
  files: string[] // staged file paths; empty = all staged
  pushAfter: boolean
}

export interface CommitResult {
  success: boolean
  hash: string | null
  error: string | null
  pushSuccess?: boolean
}

// ─── Push/Pull ────────────────────────────────────────────────────────────────

export interface PushResult {
  success: boolean
  branch: string
  commitsCount: number
  error: string | null
  wasRejected: boolean
  remoteHasNewCommits: boolean
}

// ─── Backup ───────────────────────────────────────────────────────────────────

export interface Backup {
  id: string
  path: string
  createdAt: number
  triggeredBy: string
  fileCount: number
  repositoryPath: string
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export interface TeamMember {
  name: string
  email: string
  branch: string
  changesCount: number | null
  lastActivity: number | null
  avatarUrl: string | null
  lastFiles: string[]
}

export interface LfsLock {
  id: string
  path: string
  owner: string
  lockedAt: number | null
}

// ─── IPC Channel Names ────────────────────────────────────────────────────────
// All IPC channels are listed here to prevent typos and ensure type safety.

export const IPC = {
  // Repository
  REPO_CLONE: 'repo:clone',
  REPO_OPEN: 'repo:open',
  REPO_CLOSE: 'repo:close',
  REPO_GET_HEALTH: 'repo:get-health',
  REPO_LIST_SAVED: 'repo:list-saved',
  REPO_SAVE: 'repo:save',
  REPO_REMOVE_SAVED: 'repo:remove-saved',

  // Status
  STATUS_GET: 'status:get',
  STATUS_SUBSCRIBE: 'status:subscribe',

  // Branches
  BRANCH_LIST: 'branch:list',
  BRANCH_SWITCH: 'branch:switch',
  BRANCH_CREATE: 'branch:create',
  BRANCH_DELETE: 'branch:delete',
  BRANCH_DELETE_REMOTE: 'branch:delete-remote',
  BRANCH_PUSH: 'branch:push',
  BRANCH_MERGE: 'branch:merge',
  BRANCH_AHEAD_FILES: 'branch:ahead-files',

  // Unreal
  UNREAL_IS_RUNNING: 'unreal:is-running',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // LFS Locks
  LFS_LIST_LOCKS: 'lfs:list-locks',
  LFS_LOCK: 'lfs:lock',
  LFS_UNLOCK: 'lfs:unlock',

  // Changes
  CHANGES_GET: 'changes:get',
  CHANGES_STAGE: 'changes:stage',
  CHANGES_UNSTAGE: 'changes:unstage',
  CHANGES_DISCARD: 'changes:discard', // requires explicit confirmation

  // Commit
  COMMIT: 'commit:create',

  // Sync
  SYNC_START: 'sync:start',
  SYNC_CANCEL: 'sync:cancel',
  SYNC_STATUS: 'sync:status',

  // LFS
  LFS_STATUS: 'lfs:status',
  LFS_FETCH: 'lfs:fetch',

  // Conflicts
  CONFLICT_RESOLVE: 'conflict:resolve',

  // Backup
  BACKUP_LIST: 'backup:list',
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_DELETE: 'backup:delete',

  // Team
  TEAM_GET: 'team:get',

  // Logs
  LOG_GET: 'log:get',

  // Gitignore
  GITIGNORE_GET: 'gitignore:get',
  GITIGNORE_SET: 'gitignore:set',

  // Dialog
  DIALOG_PICK_PATH: 'dialog:pick-path',

  // Fetch
  FETCH: 'fetch:run',

  // Auto-updater (main → renderer push)
  UPDATE_AVAILABLE: 'updater:update-available',
  UPDATE_DOWNLOADED: 'updater:update-downloaded',
  UPDATE_INSTALL_NOW: 'updater:install-now',

  // GitHub OAuth Device Flow
  GITHUB_DEVICE_START: 'github:device-start',
  GITHUB_DEVICE_POLL: 'github:device-poll',
  GITHUB_CLEAR_TOKEN: 'github:clear-token',
  GITHUB_LIST_REPOS: 'github:list-repos',
  GITHUB_GET_USER: 'github:get-user',

  // Push / Fetch progress (main → renderer)
  PUSH_PROGRESS: 'push:progress',
  FETCH_PROGRESS: 'fetch:progress',

  // History
  HISTORY_GET: 'history:get',
  HISTORY_RESTORE_FILES: 'history:restore-files',
  HISTORY_UNDO_COMMIT: 'history:undo-commit',
  HISTORY_UNDO_ALL_UNPUSHED: 'history:undo-all-unpushed',
  HISTORY_REVERT_COMMIT: 'history:revert-commit',

  // Remote
  REMOTE_ADD: 'remote:add',
  REMOTE_REMOVE: 'remote:remove',
  REMOTE_CREATE_GITHUB: 'remote:create-github',
  REMOTE_PUSH_INITIAL: 'remote:push-initial',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryFile {
  path: string
  status: 'A' | 'M' | 'D' | 'R'  // Added, Modified, Deleted, Renamed
  oldPath?: string
}

export interface HistoryCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: number   // unix ms
  message: string
  files: HistoryFile[]
  pushedToRemote: boolean
  branches: string[]  // local + remote refs pointing to this commit
}

// ─── Conflict Resolution ──────────────────────────────────────────────────────

export type ConflictResolution = 'keep-mine' | 'keep-remote' | 'abort'

export interface ConflictResolveRequest {
  path: string
  resolution: ConflictResolution
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  savedRepositories: Repository[]
  lastOpenedRepositoryId: string | null
  backupRetentionCount: number
  backupAutoDelete: boolean
  protectedBranches: string[]
  theme: 'dark' | 'light'
  fontSize: 'small' | 'normal' | 'large'
  language: 'de' | 'en'
  defaultBranch: string
  lfsAutoLock: boolean
  gitignorePatterns: string[]
  githubTokenEncrypted: string | null
  termsAccepted: boolean
  lastSeenVersion: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  savedRepositories: [],
  lastOpenedRepositoryId: null,
  backupRetentionCount: 10,
  backupAutoDelete: true,
  protectedBranches: [],
  theme: 'dark',
  fontSize: 'normal',
  language: 'de',
  defaultBranch: 'main',
  lfsAutoLock: false,
  gitignorePatterns: [],
  githubTokenEncrypted: null,
  termsAccepted: false,
  lastSeenVersion: null,
}
