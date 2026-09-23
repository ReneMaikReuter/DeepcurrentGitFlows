import { create } from 'zustand'
import { ipc, IPC } from '../hooks/useIpc'
import type {
  Branch,
  ChangedFile,
  LfsStatus,
  Repository,
  RepositoryHealth,
  SyncState,
  TeamMember,
} from '../../shared/types'

interface RepoState {
  // Repository
  currentRepo: Repository | null
  savedRepos: Repository[]
  health: RepositoryHealth | null

  // Branch
  currentBranch: string | null
  branches: Branch[]

  // Changes
  changedFiles: ChangedFile[]
  selectedFiles: Set<string>

  // LFS
  lfsStatus: LfsStatus | null

  // Sync
  syncState: SyncState | null
  isSyncing: boolean
  isCommitting: boolean

  // Team
  team: TeamMember[]

  // UI State
  isLoading: boolean
  error: string | null

  // Actions
  loadSavedRepos: () => Promise<void>
  openRepository: (repoPath: string) => Promise<boolean>
  closeRepository: () => void
  refreshStatus: () => Promise<void>
  refreshBranches: () => Promise<void>
  switchBranch: (name: string, skipUeCheck?: boolean, stashFirst?: boolean) => Promise<{ requiresAction: string | null; error: string | null }>
  createBranch: (name: string, from: string) => Promise<{ success: boolean; error: string | null }>
  stageFiles: (paths: string[]) => Promise<void>
  unstageFiles: (paths: string[]) => Promise<void>
  toggleFileSelection: (path: string) => void
  selectAllFiles: () => void
  deselectAllFiles: () => void
  commit: (message: string, pushAfter: boolean) => Promise<{ success: boolean; error: string | null }>
  startSync: () => Promise<void>
  cancelSync: () => Promise<void>
  loadTeam: () => Promise<void>
  clearError: () => void
}

export const useRepoStore = create<RepoState>((set, get) => ({
  currentRepo: null,
  savedRepos: [],
  health: null,
  currentBranch: null,
  branches: [],
  changedFiles: [],
  selectedFiles: new Set(),
  lfsStatus: null,
  syncState: null,
  isSyncing: false,
  isCommitting: false,
  team: [],
  isLoading: false,
  error: null,

  loadSavedRepos: async () => {
    const repos = await ipc.invoke<Repository[]>(IPC.REPO_LIST_SAVED)
    set({ savedRepos: repos })
  },

  openRepository: async (repoPath) => {
    set({ isLoading: true, error: null })
    const result = await ipc.invoke<{ success: boolean; repository?: Repository; health?: RepositoryHealth; error?: string }>(
      IPC.REPO_OPEN,
      repoPath,
    )

    if (!result.success || !result.repository) {
      set({ isLoading: false, error: result.error ?? 'Failed to open repository.' })
      return false
    }

    set({ currentRepo: result.repository, health: result.health ?? null, isLoading: false })

    // Subscribe to sync status updates
    ipc.on(IPC.SYNC_STATUS, (...args) => {
      const [, state] = args as [string, SyncState]
      set({ syncState: state })
    })

    await get().refreshStatus()
    await get().refreshBranches()
    await get().loadTeam()
    return true
  },

  closeRepository: () => {
    set({ currentRepo: null, health: null, currentBranch: null, branches: [], changedFiles: [], lfsStatus: null, syncState: null, team: [] })
  },

  refreshStatus: async () => {
    const { currentRepo } = get()
    if (!currentRepo) return

    const result = await ipc.invoke<{ files: ChangedFile[]; branch: string | null; health: RepositoryHealth; lfsStatus: LfsStatus }>(
      IPC.STATUS_GET,
      currentRepo.path,
    )
    set({
      changedFiles: result.files,
      currentBranch: result.branch,
      health: result.health,
      lfsStatus: result.lfsStatus,
    })
  },

  refreshBranches: async () => {
    const { currentRepo } = get()
    if (!currentRepo) return
    const branches = await ipc.invoke<Branch[]>(IPC.BRANCH_LIST, currentRepo.path)
    set({ branches })
  },

  switchBranch: async (name, skipUeCheck = false, stashFirst = false) => {
    const { currentRepo } = get()
    if (!currentRepo) return { requiresAction: null, error: 'No repository open.' }

    const result = await ipc.invoke<{ success: boolean; requiresAction: string | null; error: string | null }>(
      IPC.BRANCH_SWITCH,
      currentRepo.path,
      name,
      stashFirst,
      skipUeCheck,
    )

    if (result.success) {
      await get().refreshStatus()
      await get().refreshBranches()
    }

    return { requiresAction: result.requiresAction, error: result.error }
  },

  createBranch: async (name, from) => {
    const { currentRepo } = get()
    if (!currentRepo) return { success: false, error: 'No repository open.' }

    const result = await ipc.invoke<{ success: boolean; error: string | null }>(
      IPC.BRANCH_CREATE,
      currentRepo.path,
      name,
      from,
    )

    if (result.success) {
      await get().refreshBranches()
      await get().refreshStatus()
    }

    return result
  },

  stageFiles: async (paths) => {
    const { currentRepo } = get()
    if (!currentRepo) return
    await ipc.invoke(IPC.CHANGES_STAGE, currentRepo.path, paths)
    await get().refreshStatus()
  },

  unstageFiles: async (paths) => {
    const { currentRepo } = get()
    if (!currentRepo) return
    await ipc.invoke(IPC.CHANGES_UNSTAGE, currentRepo.path, paths)
    await get().refreshStatus()
  },

  toggleFileSelection: (filePath) => {
    const { selectedFiles } = get()
    const next = new Set(selectedFiles)
    if (next.has(filePath)) next.delete(filePath)
    else next.add(filePath)
    set({ selectedFiles: next })
  },

  selectAllFiles: () => {
    const paths = get().changedFiles.map((f) => f.path)
    set({ selectedFiles: new Set(paths) })
  },

  deselectAllFiles: () => set({ selectedFiles: new Set() }),

  commit: async (message, pushAfter) => {
    const { currentRepo, selectedFiles, changedFiles } = get()
    if (!currentRepo) return { success: false, error: 'No repository open.' }
    set({ isCommitting: true })

    const files = selectedFiles.size > 0 ? [...selectedFiles] : changedFiles.map((f) => f.path)

    // If partial selection: unstage files that are currently staged but NOT in selection
    if (selectedFiles.size > 0) {
      const stagedNotSelected = changedFiles
        .filter((f) => f.isStaged && !selectedFiles.has(f.path))
        .map((f) => f.path)
      if (stagedNotSelected.length > 0) {
        await ipc.invoke(IPC.CHANGES_UNSTAGE, currentRepo.path, stagedNotSelected)
      }
    }

    const result = await ipc.invoke<{ success: boolean; hash: string | null; error: string | null }>(
      IPC.COMMIT,
      currentRepo.path,
      { message, files, pushAfter },
    )

    if (result.success) {
      set({ selectedFiles: new Set() })
      await get().refreshStatus()
      await get().refreshBranches()
    }

    set({ isCommitting: false })
    return result
  },

  startSync: async () => {
    const { currentRepo } = get()
    if (!currentRepo) return

    set({ isSyncing: true, syncState: null })
    const result = await ipc.invoke<{ success: boolean; state: SyncState; error?: string }>(
      IPC.SYNC_START,
      currentRepo.path,
    )
    set({ isSyncing: false, syncState: result.state ?? null })

    if (result.success) {
      await get().refreshStatus()
      await get().refreshBranches()
    }
  },

  cancelSync: async () => {
    const { currentRepo } = get()
    if (!currentRepo) return
    await ipc.invoke(IPC.SYNC_CANCEL, currentRepo.path)
  },

  loadTeam: async () => {
    const { currentRepo } = get()
    if (!currentRepo) return
    const team = await ipc.invoke<TeamMember[]>(IPC.TEAM_GET, currentRepo.path)
    set({ team })
  },

  clearError: () => set({ error: null }),
}))
