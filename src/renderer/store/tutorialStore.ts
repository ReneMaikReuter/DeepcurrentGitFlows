import { create } from 'zustand'
import type { Repository, RepositoryHealth, ChangedFile } from '../../shared/types'

export const DEMO_REPO: Repository = {
  id: 'tutorial-demo',
  name: 'EchoesOfMyran-Demo',
  path: 'C:/Demo/EchoesOfMyran-Demo',
  remote: 'https://github.com/deepcurrent/EchoesOfMyran-Demo',
  lastOpened: Date.now(),
}

export const DEMO_BRANCHES = [
  { name: 'feature/tutorial', isCurrent: true, isRemote: false, upstream: null, aheadBy: 1, behindBy: 0, lastCommitHash: null, lastCommitMessage: 'Update demo character animations', lastCommitAuthor: 'Demo Developer', lastCommitDate: Date.now() },
  { name: 'main', isCurrent: false, isRemote: false, upstream: null, aheadBy: 0, behindBy: 0, lastCommitHash: null, lastCommitMessage: 'Initial commit', lastCommitAuthor: 'Demo Developer', lastCommitDate: Date.now() - 86400000 },
  { name: 'dev', isCurrent: false, isRemote: false, upstream: null, aheadBy: 0, behindBy: 0, lastCommitHash: null, lastCommitMessage: 'Dev branch init', lastCommitAuthor: 'Demo Developer', lastCommitDate: Date.now() - 172800000 },
]

export const DEMO_FILES: ChangedFile[] = [
  { path: 'Content/Characters/DemoHero.uasset', oldPath: null, status: 'modified', isUnrealAsset: true, assetType: null, isLfsTracked: true, isLfsPointer: false, fileSizeBytes: null, isStaged: true },
  { path: 'Content/Maps/DemoMap.umap', oldPath: null, status: 'added', isUnrealAsset: true, assetType: null, isLfsTracked: true, isLfsPointer: false, fileSizeBytes: null, isStaged: true },
  { path: 'Config/DefaultGame.ini', oldPath: null, status: 'modified', isUnrealAsset: false, assetType: null, isLfsTracked: false, isLfsPointer: false, fileSizeBytes: null, isStaged: false },
]

export const DEMO_HEALTH: RepositoryHealth = {
  isValid: true,
  isUnrealProject: true,
  gitVersion: 'git version 2.47.0',
  lfsVersion: 'git-lfs/3.4.0',
  gitOk: true,
  lfsOk: true,
  gitAttributesOk: true,
  errors: [],
  warnings: [],
}

interface TutorialState {
  active: boolean
  step: number
  totalSteps: number
  wasCompactMode: boolean

  // Transient UI state driven by steps
  branchMenuOpen: boolean
  activeTab: 'changes' | 'team'
  commitMessage: string
  selectedFilePaths: Set<string>
  ueRunning: boolean

  startTutorial: (wasCompact: boolean) => void
  nextStep: () => void
  prevStep: () => void
  setStep: (n: number) => void
  exit: (onExit: (wasCompact: boolean) => void) => void

  setBranchMenuOpen: (v: boolean) => void
  setActiveTab: (t: 'changes' | 'team') => void
  setCommitMessage: (m: string) => void
  setSelectedFilePaths: (s: Set<string>) => void
  setUeRunning: (v: boolean) => void
}

export const TUTORIAL_TOTAL_STEPS = 12

export const useTutorialStore = create<TutorialState>((set, get) => ({
  active: false,
  step: 0,
  totalSteps: TUTORIAL_TOTAL_STEPS,
  wasCompactMode: false,

  branchMenuOpen: false,
  activeTab: 'changes',
  commitMessage: '',
  selectedFilePaths: new Set(),
  ueRunning: false,

  startTutorial: (wasCompact) => set({
    active: true,
    step: 0,
    wasCompactMode: wasCompact,
    branchMenuOpen: false,
    activeTab: 'changes',
    commitMessage: '',
    selectedFilePaths: new Set(),
    ueRunning: true,
  }),

  nextStep: () => {
    const { step, totalSteps } = get()
    if (step < totalSteps - 1) set({ step: step + 1 })
  },

  prevStep: () => {
    const { step } = get()
    if (step > 0) set({ step: step - 1 })
  },

  setStep: (n) => set({ step: n }),

  exit: (onExit) => {
    const { wasCompactMode } = get()
    set({
      active: false,
      step: 0,
      branchMenuOpen: false,
      activeTab: 'changes',
      commitMessage: '',
      selectedFilePaths: new Set(),
      ueRunning: false,
    })
    onExit(wasCompactMode)
  },

  setBranchMenuOpen: (v) => set({ branchMenuOpen: v }),
  setActiveTab: (t) => set({ activeTab: t }),
  setCommitMessage: (m) => set({ commitMessage: m }),
  setSelectedFilePaths: (s) => set({ selectedFilePaths: s }),
  setUeRunning: (v) => set({ ueRunning: v }),
}))
