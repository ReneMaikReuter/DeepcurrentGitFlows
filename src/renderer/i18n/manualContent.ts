export interface ManualSection {
  id: string
  title: string
  intro?: string
  items?: { label?: string; text: string }[]
  subsections?: {
    title: string
    intro?: string
    items?: { label?: string; text: string }[]
  }[]
}

export interface ManualContent {
  sections: ManualSection[]
}

export const manualContent: Record<'de' | 'en', ManualContent> = {
  de: {
    sections: [
      {
        id: 'overview',
        title: 'Willkommen',
        intro:
          'Deepcurrent Git Flows ist ein Git-Client, der speziell für Unreal Engine Teams entwickelt wurde. Er hilft dir dabei, Dateien sicher zu versionieren, mit deinem Team synchron zu bleiben und Änderungen nachzuvollziehen. Tiefes Git-Wissen wird nicht vorausgesetzt.',
        items: [
          {
            label: 'Was ist Git?',
            text: 'Git protokolliert alle Änderungen an deinen Dateien. Du kannst jederzeit nachsehen, wer was geändert hat. Im Zweifelsfall lässt sich alles rückgängig machen.',
          },
          {
            label: 'Was ist ein Repository?',
            text: 'Ein Repository (kurz: Repo) ist dein Projektordner, der von Git überwacht wird. Alle Versionen, Commits und Branches werden darin gespeichert.',
          },
        ],
      },
      {
        id: 'getting-started',
        title: 'Erste Schritte',
        items: [
          {
            label: '1. Projekt öffnen',
            text: 'Klicke auf der Startseite auf "Repository öffnen" und wähle deinen Projektordner. Das Projekt erscheint danach unter "Zuletzt geöffnet".',
          },
          {
            label: '2. Branch auswählen',
            text: 'In der linken Seitenleiste siehst du alle verfügbaren Branches. Dein aktueller Branch ist hervorgehoben. Klicke auf einen anderen Branch, um dorthin zu wechseln. Es erscheint vorher eine kurze Sicherheitsabfrage.',
          },
          {
            label: '3. Status verstehen',
            text: 'Der Tab "Änderungen" zeigt, welche Dateien du seit dem letzten Commit verändert hast. "Sync" hält dein Projekt aktuell. "History" zeigt alle vergangenen Commits.',
          },
        ],
      },
      {
        id: 'functions',
        title: 'Die wichtigsten Funktionen',
        subsections: [
          {
            title: 'Fetch',
            intro:
              'Fetch holt den aktuellen Stand vom Server, ohne deine lokalen Dateien zu verändern. Du siehst was andere gemacht haben, ohne ihre Änderungen sofort zu übernehmen.',
            items: [
              {
                label: 'Wann benutzen?',
                text: 'Wenn du wissen willst ob es Neuigkeiten auf dem Server gibt, bevor du synchronisierst.',
              },
            ],
          },
          {
            title: 'Sync',
            intro:
              'Sync holt alle Änderungen deiner Teammitglieder vom Server und gleicht dein lokales Projekt ab. Benutze Sync am Anfang jeder Arbeitssitzung.',
            items: [
              {
                label: 'Ablauf',
                text: 'Fetch, dann Pull, dann LFS-Prüfung. Bei einem Unreal-Projekt wird zusätzlich geprüft ob die Engine geöffnet ist.',
              },
              {
                label: 'Unterschied zu Fetch',
                text: 'Fetch schaut nur. Sync übernimmt die Änderungen tatsächlich in deine Dateien.',
              },
            ],
          },
          {
            title: 'Änderungen',
            intro:
              'Zeigt alle Dateien, die du seit dem letzten Commit verändert hast.',
            items: [
              {
                label: 'Staged / Unstaged',
                text: '"Staged" bedeutet: bereit für den nächsten Commit. "Unstaged" bedeutet: die Änderungen werden noch nicht mitgenommen. Du kannst einzelne Dateien ein- oder ausschliessen.',
              },
              {
                label: 'Änderung zurücksetzen',
                text: 'Über das Zurücksetzen-Symbol neben einer Datei kannst du deine Änderungen rückgängig machen und den Stand des letzten Commits wiederherstellen.',
              },
            ],
          },
          {
            title: 'Commit',
            intro:
              'Speichert einen Snapshot deiner gestagen Änderungen. Du gibst eine kurze Beschreibung an, was du gemacht hast.',
            items: [
              {
                label: 'Wann committen?',
                text: 'Nachdem du eine Aufgabe abgeschlossen hast. Nicht jede kleine Änderung, aber auch nicht zu selten. Faustregel: ein Commit pro abgeschlossener Aufgabe.',
              },
              {
                label: 'Gute Commit-Nachrichten',
                text: 'Kurz und beschreibend. Beispiele: "Hauptmenü Layout überarbeitet", "Audio für Waffe A hinzugefügt", "Bug beim Levelwechsel behoben".',
              },
              {
                label: 'Commit und Push',
                text: 'Der Button "Commit & Push" führt beides in einem Schritt aus. Spart Zeit wenn du sofort hochladen willst.',
              },
            ],
          },
          {
            title: 'Push',
            intro:
              'Lädt deine lokalen Commits auf den Server hoch, damit andere sie sehen und herunterladen können.',
            items: [
              {
                label: 'Reihenfolge',
                text: 'Erst committen, dann pushen. Ohne Commit gibt es nichts zu pushen.',
              },
              {
                label: 'Fortschrittsanzeige',
                text: 'Beim Push wird ein Fortschrittsbalken angezeigt, der zeigt wie weit der Upload ist. Bei grossen Dateien (LFS) kann das länger dauern.',
              },
            ],
          },
          {
            title: 'Pull',
            intro:
              'Holt Commits anderer Teammitglieder vom Server und integriert sie in deinen aktuellen Branch.',
            items: [
              {
                label: 'Unterschied zu Sync',
                text: 'Pull ist ein Teil von Sync. Wenn du den vollen Ablauf inklusive LFS-Prüfung möchtest, benutze den Sync-Button.',
              },
              {
                label: 'Konflikte',
                text: 'Wenn du und ein Teammitglied dieselbe Datei geändert haben, entsteht ein Konflikt. Die App zeigt dir die betroffenen Dateien und bietet Optionen zur Auflösung an.',
              },
            ],
          },
          {
            title: 'Branches',
            intro:
              'Ein Branch ist eine unabhängige Arbeitskopie des Projekts. Branches ermöglichen es, parallel an verschiedenen Features zu arbeiten ohne sich gegenseitig zu stören.',
            items: [
              {
                label: 'Eigener Branch',
                text: 'Arbeite immer auf deinem eigenen Branch. Nie direkt auf "main" oder "master". Diese Branches sind oft als geschützt markiert und können nicht versehentlich gelöscht werden.',
              },
              {
                label: 'Branch wechseln',
                text: 'Klicke in der Seitenleiste auf einen anderen Branch. Es erscheint eine kurze Bestätigungsabfrage. Ungespeicherte Änderungen werden vorher gesichert (Stash).',
              },
              {
                label: 'Branch mergen',
                text: 'Beim Mergen werden zwei Branches zusammengeführt. Rechtsklick auf einen Branch zeigt die Merge-Optionen. Bei Unreal-Projekten wird geprüft ob du auf deinen aktuellen Branch mergst und die Engine dabei offen ist.',
              },
              {
                label: 'Branch veröffentlichen',
                text: 'Neue Branches existieren zunächst nur lokal. Über "Branch veröffentlichen" wird er auf den Server hochgeladen, damit andere ihn sehen können.',
              },
              {
                label: 'Branches vs. Origin',
                text: 'In der Seitenleiste gibt es zwei Kategorien: "Branches" zeigt deine lokalen Arbeitskopien, auf denen du aktiv arbeitest und Commits erstellen kannst. "Origin" zeigt die Spiegelkopien dieser Branches vom Server (Read-only). Origin-Branches aktualisieren sich beim Fetch/Sync und zeigen was auf dem Server liegt. Du kannst nicht direkt auf Origin-Branches wechseln oder committen, sie dienen nur zur Übersicht.',
              },
            ],
          },
          {
            title: 'History',
            intro:
              'Die History zeigt alle vergangenen Commits mit Autor, Zeitstempel und geänderten Dateien. Du kannst einzelne Dateien wiederherstellen oder ganze Commits rückgängig machen.',
            items: [
              {
                label: 'Dateien wiederherstellen',
                text: 'Öffne einen Commit durch Klick darauf. Du siehst alle Dateien die darin verändert wurden. Setze Häkchen bei den Dateien die du zurücksetzen willst, und klicke "Wiederherstellen". Die Dateien werden auf den Stand vor diesem Commit zurückgesetzt und landen als ungespeicherte Änderungen in deinem Arbeitsverzeichnis. Du musst sie danach neu committen.',
              },
              {
                label: 'Commit rückgängig (Undo)',
                text: 'Bei Commits die noch nicht gepusht wurden und an HEAD stehen erscheint ein "Undo"-Button. Undo macht den Commit vollständig rückgängig und legt die Änderungen als unstaged zurück in dein Arbeitsverzeichnis. Der Commit verschwindet aus der History.',
              },
              {
                label: 'Commit umkehren (Revert)',
                text: 'Revert ist für bereits gepushte Commits. Es wird ein neuer Commit erstellt der alle Änderungen des gewählten Commits umkehrt. Der ursprüngliche Commit bleibt in der History sichtbar, zusätzlich erscheint ein neuer Revert-Commit. Das ist die sichere Methode um Remote-History nicht zu überschreiben.',
              },
              {
                label: 'Unterschied: Wiederherstellen vs. Revert',
                text: '"Wiederherstellen" setzt einzelne Dateien zurück und erstellt keinen Commit. "Revert" erstellt einen neuen Commit der den gesamten Commit umkehrt. Beides lässt die ursprüngliche History unangetastet.',
              },
            ],
          },
          {
            title: 'Git LFS (Large File Storage)',
            intro:
              'LFS ist eine Erweiterung für grosse Binärdateien wie Texturen, Meshes, Sounds und Videos. Grosse Dateien werden separat gespeichert, damit das Repository schnell und handhabbar bleibt.',
            items: [
              {
                label: 'Dateisperren (Locks)',
                text: 'Wenn LFS Auto-Lock aktiv ist, wird eine LFS-Datei beim Committen automatisch gesperrt und nach dem Push wieder freigegeben. Das verhindert, dass zwei Personen dieselbe binäre Datei gleichzeitig ändern, was unweigerlich zu Konflikten führt.',
              },
              {
                label: 'Manuell sperren und entsperren',
                text: 'Im Team-Tab unter "Gesperrte Assets" siehst du alle aktiven Locks mit dem Besitzer und dem Zeitstempel. Deine eigenen Locks kannst du dort per Klick auf das Schloss-Symbol aufheben. Locks anderer Teammitglieder kannst du mit "Force Unlock" überschreiben, wenn du Admin-Rechte hast.',
              },
              {
                label: 'Entsperren mit ungespeicherten Änderungen',
                text: 'Wenn du lokale Änderungen an einer gesperrten Datei hast, die noch nicht committed sind, fragt die App nach einer Bestätigung bevor sie die Sperre aufhebt. So vermeidest du versehentlich, dass jemand anderes deine unfertige Arbeit überschreibt.',
              },
              {
                label: 'Was sehen andere in Unreal Engine?',
                text: 'Dateien, die von jemandem gesperrt sind, erscheinen für andere Teammitglieder in Unreal Engine als schreibgeschützt. Sie können die Datei öffnen, aber nicht speichern. Unreal zeigt dabei den Namen der sperrenden Person an.',
              },
              {
                label: 'Hinweis',
                text: 'LFS-Dateien sind binär. Sie können nicht automatisch gemergt werden. Deshalb sind Locks so wichtig.',
              },
            ],
          },
          {
            title: 'Repository-Gesundheit (Health)',
            intro:
              'Der Health-Status zeigt auf einen Blick, ob dein Repository in einem guten Zustand ist.',
            items: [
              {
                label: 'Grün (Healthy)',
                text: 'Alles in Ordnung. Git, LFS und alle Verbindungen funktionieren korrekt.',
              },
              {
                label: 'Gelb (Warnung)',
                text: 'Ein Problem wurde erkannt, das den Betrieb noch nicht blockiert, aber beachtet werden sollte. Zum Beispiel fehlende LFS-Konfiguration oder ausstehende Konflikte.',
              },
              {
                label: 'Rot (Fehler)',
                text: 'Ein kritisches Problem verhindert den normalen Betrieb. Zum Beispiel ein ungültiges Repository, fehlende Verbindung zum Server oder beschädigte Git-Daten.',
              },
            ],
          },
        ],
      },
      {
        id: 'unreal-safe-mode',
        title: 'Unreal Engine Safe Mode',
        intro:
          'Der Safe Mode ist ein Schutzmechanismus, der verhindert dass du synchronisierst während Unreal Engine geöffnet ist. Er wird automatisch aktiv sobald ein Unreal-Projekt erkannt wurde.',
        items: [
          {
            label: 'Warum ist das wichtig?',
            text: 'Unreal Engine hält viele Projektdateien im Arbeitsspeicher. Wenn sich diese Dateien während eines Syncs oder Pulls auf der Festplatte ändern, kann das zu beschädigten Assets oder Abstürzen führen.',
          },
          {
            label: 'Welche Dateien sind betroffen?',
            text: 'Alle Unreal-spezifischen Binärdateien: .uasset, .umap, .uproject sowie abgeleitete Dateien in den Ordnern Saved/, Intermediate/ und DerivedDataCache/.',
          },
          {
            label: 'Was tun?',
            text: 'Schliesse Unreal Engine vollständig, bevor du "Sync" oder "Pull" ausführst. Die App erkennt automatisch ob die Engine noch läuft und zeigt eine Warnung an.',
          },
          {
            label: 'Ausnahme beim Mergen',
            text: 'Deinen aktuellen Branch in einen anderen zu mergen ist auch bei geöffneter Engine möglich, solange keine Dateien von anderen Teammitgliedern gesperrt sind. Einen anderen Branch in deinen aktuellen zu mergen ist dagegen nur bei geschlossener Engine erlaubt.',
          },
          {
            label: 'Safe Mode deaktivieren?',
            text: 'Der Safe Mode lässt sich nicht manuell deaktivieren. Er ist eine Sicherheitsmassnahme und kein optionales Feature. Bei Fragen wende dich an deinen Lead oder Administrator.',
          },
        ],
      },
    ],
  },

  en: {
    sections: [
      {
        id: 'overview',
        title: 'Welcome',
        intro:
          'Deepcurrent Git Flows is a Git client built for Unreal Engine teams. It helps you version files safely, stay in sync with your team, and track changes. No deep Git knowledge required.',
        items: [
          {
            label: 'What is Git?',
            text: 'Git records all changes to your files. You can always see who changed what. If something goes wrong, everything can be rolled back.',
          },
          {
            label: 'What is a repository?',
            text: 'A repository (or repo) is your project folder as tracked by Git. All versions, commits and branches are stored within it.',
          },
        ],
      },
      {
        id: 'getting-started',
        title: 'Getting Started',
        items: [
          {
            label: '1. Open a project',
            text: 'On the start screen, click "Open repository" and select your project folder. The project will then appear under "Recently opened".',
          },
          {
            label: '2. Select a branch',
            text: 'The left sidebar shows all available branches. Your current branch is highlighted. Click another branch to switch. A short confirmation prompt appears first.',
          },
          {
            label: '3. Understand the status',
            text: 'The "Changes" tab shows files you have modified since the last commit. "Sync" keeps your project up to date. "History" shows all past commits.',
          },
        ],
      },
      {
        id: 'functions',
        title: 'Key Features',
        subsections: [
          {
            title: 'Fetch',
            intro:
              'Fetch downloads the current server state without changing your local files. You can see what others have done without applying their changes yet.',
            items: [
              {
                label: 'When to use?',
                text: 'When you want to check whether there are updates on the server before you sync.',
              },
            ],
          },
          {
            title: 'Sync',
            intro:
              'Sync downloads all changes from your teammates and updates your local project. Use Sync at the start of every work session.',
            items: [
              {
                label: 'Process',
                text: 'Fetch, then pull, then LFS check. For Unreal projects, the app also checks whether the editor is open.',
              },
              {
                label: 'Difference to Fetch',
                text: 'Fetch only looks. Sync actually applies the changes to your files.',
              },
            ],
          },
          {
            title: 'Changes',
            intro:
              'Shows all files you have modified since the last commit.',
            items: [
              {
                label: 'Staged / Unstaged',
                text: '"Staged" means ready for the next commit. "Unstaged" means the changes will not be included yet. You can include or exclude individual files.',
              },
              {
                label: 'Revert a change',
                text: 'Use the revert icon next to a file to undo your changes and restore the state from the last commit.',
              },
            ],
          },
          {
            title: 'Commit',
            intro:
              'Saves a snapshot of your staged changes. You add a short description of what you did.',
            items: [
              {
                label: 'When to commit?',
                text: 'After completing a task. Not every tiny change, but not too rarely either. Rule of thumb: one commit per completed task.',
              },
              {
                label: 'Good commit messages',
                text: 'Short and descriptive. Examples: "Reworked main menu layout", "Added audio for weapon A", "Fixed bug on level transition".',
              },
              {
                label: 'Commit and Push',
                text: 'The "Commit & Push" button does both in one step. Saves time when you want to upload immediately.',
              },
            ],
          },
          {
            title: 'Push',
            intro:
              'Uploads your local commits to the server so others can see and download them.',
            items: [
              {
                label: 'Order',
                text: 'Commit first, then push. Without a commit there is nothing to push.',
              },
              {
                label: 'Progress indicator',
                text: 'A progress bar appears during the push showing how far the upload has gone. Large LFS files can take longer.',
              },
            ],
          },
          {
            title: 'Pull',
            intro:
              'Downloads commits from other team members and integrates them into your current branch.',
            items: [
              {
                label: 'Difference to Sync',
                text: 'Pull is part of Sync. If you want the full process including LFS checks, use the Sync button.',
              },
              {
                label: 'Conflicts',
                text: 'If you and a teammate both changed the same file, a conflict occurs. The app shows the affected files and offers resolution options.',
              },
            ],
          },
          {
            title: 'Branches',
            intro:
              'A branch is an independent copy of the project. Branches let you work on different features in parallel without getting in each other\'s way.',
            items: [
              {
                label: 'Your own branch',
                text: 'Always work on your own branch. Never directly on "main" or "master". These branches are often marked as protected and cannot be accidentally deleted.',
              },
              {
                label: 'Switch branch',
                text: 'Click another branch in the sidebar. A short confirmation prompt appears. Unsaved changes are stashed beforehand.',
              },
              {
                label: 'Merge branch',
                text: 'Merging combines two branches. Right-click a branch to see merge options. For Unreal projects, the app checks whether you are merging into your current branch with the engine open.',
              },
              {
                label: 'Publish branch',
                text: 'New branches exist locally only. "Publish branch" uploads it to the server so others can see it.',
              },
              {
                label: 'Branches vs. Origin',
                text: 'The sidebar has two categories: "Branches" shows your local working copies where you actively commit and make changes. "Origin" shows read-only mirror copies of branches from the server. Origin branches update on Fetch/Sync and show what is on the server. You cannot switch to or commit on origin branches directly, they are for reference only.',
              },
            ],
          },
          {
            title: 'History',
            intro:
              'History shows all past commits with author, timestamp and changed files. You can restore individual files or undo entire commits.',
            items: [
              {
                label: 'Restore files',
                text: 'Open a commit by clicking it. You see all files that were changed in it. Check the files you want to restore and click "Wiederherstellen". The files are reset to their state before that commit and land as unsaved changes in your working directory. You need to commit them again afterwards.',
              },
              {
                label: 'Undo commit',
                text: 'For commits that have not been pushed yet and are at HEAD, an "Undo" button appears. Undo fully reverts the commit and places the changes back into your working directory as unstaged. The commit disappears from history.',
              },
              {
                label: 'Revert commit',
                text: 'Revert is for commits that have already been pushed. A new commit is created that reverses all changes of the selected commit. The original commit stays visible in history, and a new revert commit appears on top. This is the safe method to not overwrite remote history.',
              },
              {
                label: 'Difference: Restore vs. Revert',
                text: '"Restore" resets individual files and creates no commit. "Revert" creates a new commit that reverses the entire commit. Both leave the original history untouched.',
              },
            ],
          },
          {
            title: 'Git LFS (Large File Storage)',
            intro:
              'LFS is an extension for large binary files like textures, meshes, sounds and videos. Large files are stored separately so the repository stays fast and manageable.',
            items: [
              {
                label: 'File locks',
                text: 'When LFS Auto-Lock is enabled, an LFS file is automatically locked on commit and released after the push. This prevents two people from modifying the same binary file at the same time, which would inevitably cause conflicts.',
              },
              {
                label: 'Lock and unlock manually',
                text: 'The Team tab under "Locked Assets" shows all active locks with their owner and timestamp. You can release your own locks by clicking the lock icon. Locks from other team members can be overridden with "Force Unlock" if you have admin rights.',
              },
              {
                label: 'Unlocking with uncommitted changes',
                text: 'If you have local changes to a locked file that are not yet committed, the app asks for confirmation before releasing the lock. This prevents accidentally letting someone else overwrite your unfinished work.',
              },
              {
                label: 'What do others see in Unreal Engine?',
                text: 'Files locked by someone else appear as read-only in Unreal Engine for other team members. They can open the file but not save it. Unreal shows the name of the person who holds the lock.',
              },
              {
                label: 'Note',
                text: 'LFS files are binary. They cannot be auto-merged. That is why locks are so important.',
              },
            ],
          },
          {
            title: 'Repository Health',
            intro:
              'The health status gives you an at-a-glance view of your repository\'s condition.',
            items: [
              {
                label: 'Green (Healthy)',
                text: 'Everything is fine. Git, LFS and all connections are working correctly.',
              },
              {
                label: 'Yellow (Warning)',
                text: 'An issue was detected that does not block operation yet but should be addressed. For example a missing LFS configuration or pending conflicts.',
              },
              {
                label: 'Red (Error)',
                text: 'A critical problem is preventing normal operation. For example an invalid repository, no connection to the server, or corrupted Git data.',
              },
            ],
          },
        ],
      },
      {
        id: 'unreal-safe-mode',
        title: 'Unreal Engine Safe Mode',
        intro:
          'Safe Mode is a protection mechanism that prevents you from syncing while Unreal Engine is open. It activates automatically when an Unreal project is detected.',
        items: [
          {
            label: 'Why does this matter?',
            text: 'Unreal Engine keeps many project files loaded in memory. If those files change on disk during a sync or pull, it can result in corrupted assets or crashes.',
          },
          {
            label: 'Which files are affected?',
            text: 'All Unreal-specific binary files: .uasset, .umap, .uproject and derived files in the Saved/, Intermediate/ and DerivedDataCache/ folders.',
          },
          {
            label: 'What to do?',
            text: 'Close Unreal Engine completely before running "Sync" or "Pull". The app automatically detects whether the editor is still running and shows a warning.',
          },
          {
            label: 'Exception: merging',
            text: 'Merging your current branch into another is allowed even when the engine is open, as long as no files are locked by other team members. Merging another branch into your current one is only allowed with the engine closed.',
          },
          {
            label: 'Can Safe Mode be disabled?',
            text: 'Safe Mode cannot be disabled manually. It is a safety measure, not an optional feature. Contact your lead or administrator if you have questions.',
          },
        ],
      },
    ],
  },
}
