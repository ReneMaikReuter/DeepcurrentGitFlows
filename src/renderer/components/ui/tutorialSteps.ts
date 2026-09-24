export interface TutorialStep {
  id: string
  title: string
  description: string
  /** data-tid attribute value of the target element; null = centered overlay */
  targetId: string | null
  /** preferred panel position relative to target */
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /** UI state to apply when this step becomes active */
  uiState?: {
    branchMenuOpen?: boolean
    activeTab?: 'changes' | 'team'
    commitMessage?: string
    selectAllFiles?: boolean
    ueRunning?: boolean
  }
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen bei Deepcurrent Git Flows',
    description:
      'Dieses Tutorial zeigt dir die wichtigsten Funktionen im Kompakt-Modus. ' +
      'Du arbeitest dabei in einer sicheren Demo-Umgebung — keine echten Repositories werden verändert.\n\n' +
      'Demo-Projekt: EchoesOfMyran-Demo · Unreal Engine 5.7',
    targetId: null,
    position: 'center',
    uiState: { branchMenuOpen: false, activeTab: 'changes', selectAllFiles: false },
  },
  {
    id: 'repo-name',
    title: 'Dein Repository',
    description:
      'Die Titelleiste zeigt immer den Namen des geöffneten Repositories. ' +
      'So weißt du jederzeit, in welchem Projekt du arbeitest.',
    targetId: 'repo-name',
    position: 'bottom',
  },
  {
    id: 'branch-btn',
    title: 'Aktueller Branch',
    description:
      'Hier siehst du deinen aktuellen Branch. Klicke darauf, um alle verfügbaren Branches anzuzeigen und zu wechseln.',
    targetId: 'branch-btn',
    position: 'bottom',
    uiState: { branchMenuOpen: false },
  },
  {
    id: 'branch-dropdown',
    title: 'Branch wechseln',
    description:
      'Das Dropdown zeigt alle lokalen Branches. Der aktive Branch ist hervorgehoben. ' +
      'Du kannst jederzeit zwischen Branches wechseln — Git speichert alle Änderungen sicher.',
    targetId: 'branch-dropdown',
    position: 'bottom',
    uiState: { branchMenuOpen: true },
  },
  {
    id: 'sync-btn',
    title: 'Sync mit Remote',
    description:
      'Sync holt neue Commits vom Server (Pull) und sendet deine Commits (Push) in einem Schritt. ' +
      'Nutze Sync regelmäßig, um mit dem Team synchron zu bleiben.',
    targetId: 'sync-btn',
    position: 'bottom',
    uiState: { branchMenuOpen: false },
  },
  {
    id: 'health-bar',
    title: 'Repository-Gesundheit',
    description:
      'Der Gesundheitsbalken zeigt auf einen Blick, ob Git LFS aktiv ist, ' +
      'ob ein Remote vorhanden ist und ob Probleme erkannt wurden.',
    targetId: 'health-bar',
    position: 'bottom',
  },
  {
    id: 'safe-mode',
    title: 'Unreal Engine Integration',
    description:
      'Deepcurrent erkennt Unreal-Projekte automatisch und aktiviert den Safe Mode, ' +
      'wenn der Unreal Editor läuft. Das verhindert Konflikte durch geöffnete .uasset-Dateien.\n\n' +
      'Demo: EchoesOfMyran-Demo · Unreal Engine 5.7 · LFS: 42 Dateien',
    targetId: 'safe-mode',
    position: 'bottom',
    uiState: { ueRunning: true },
  },
  {
    id: 'file-list',
    title: 'Geänderte Dateien',
    description:
      'Alle geänderten Dateien erscheinen hier. Das Symbol links zeigt den Status:\n' +
      'M = Modified, A = Added, D = Deleted.\n\n' +
      'Wähle die Dateien aus, die du in den nächsten Commit aufnehmen möchtest.',
    targetId: 'file-list',
    position: 'top',
    uiState: { activeTab: 'changes', selectAllFiles: false },
  },
  {
    id: 'file-select',
    title: 'Dateien für den Commit wählen',
    description:
      'Markiere die Dateien, die du committen möchtest. Du kannst auch einzelne Dateien ' +
      'gezielt auswählen, um Commits klar und übersichtlich zu halten.',
    targetId: 'file-list',
    position: 'top',
    uiState: { selectAllFiles: true },
  },
  {
    id: 'commit-area',
    title: 'Commit erstellen',
    description:
      'Schreibe eine kurze, aussagekräftige Commit-Nachricht. ' +
      'Gute Nachrichten beschreiben, WAS geändert wurde und WARUM.\n\n' +
      'Beispiel: „Update demo character animations"',
    targetId: 'commit-area',
    position: 'top',
    uiState: { commitMessage: 'Update demo character animations' },
  },
  {
    id: 'team-tab',
    title: 'Team-Übersicht',
    description:
      'Im Team-Tab siehst du, wer gerade welchen Branch bearbeitet, ' +
      'wer Dateien via LFS gesperrt hat und wer zuletzt aktiv war.',
    targetId: 'team-tab',
    position: 'bottom',
    uiState: { activeTab: 'team', branchMenuOpen: false },
  },
  {
    id: 'done',
    title: 'Du bist startklar.',
    description:
      'Das Tutorial ist abgeschlossen. Du kennst jetzt die wichtigsten Funktionen von Deepcurrent Git Flows.\n\n' +
      'Öffne ein echtes Repository über das Startmenü und lege los.',
    targetId: null,
    position: 'center',
    uiState: { activeTab: 'changes' },
  },
]
