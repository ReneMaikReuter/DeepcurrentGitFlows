import { Sparkles } from 'lucide-react'
import { Modal } from './Modal'

interface ChangeEntry {
  version: string
  date: string
  changes: string[]
}

const CHANGELOG: ChangeEntry[] = [
  {
    version: '0.2.1',
    date: '23. September 2026',
    changes: [
      'Kompakt-Modus: reduzierte Ansicht mit Dateiliste, Commit und Sync',
      'Pro-Modus: vollstaendige Ansicht mit Sidebar, Tabs, History und Team',
      'Modus-Umschalter oben rechts in der Titelleiste',
      'Auswahl wird gespeichert und beim naechsten Start beibehalten',
    ],
  },
  {
    version: '0.2.0',
    date: '23. September 2026',
    changes: [
      'Nutzungsbedingungen und Datenschutzhinweis beim ersten Programmstart',
      'Was-ist-neu-Anzeige nach jedem Update mit Versionshistorie',
      'Update-Download wird zuverlaessig per Polling erkannt',
    ],
  },
  {
    version: '0.1.9',
    date: '23. September 2026',
    changes: [
      'Update-Download wird jetzt zuverlaessig erkannt (Polling alle 2 Sekunden)',
      'Neustart-Button funktioniert nur wenn der Download wirklich abgeschlossen ist',
      'Abbrechen-Button im Update-Fenster hinzugefuegt',
    ],
  },
  {
    version: '0.1.8',
    date: '23. September 2026',
    changes: [
      'Download-Fortschritt wird simuliert und zeigt Bewegung auch ohne echte Progress-Events',
      'Download- und Installations-Phase werden getrennt angezeigt',
      'Textlesbarkeit im Update-Fenster verbessert',
    ],
  },
  {
    version: '0.1.7',
    date: '23. September 2026',
    changes: [
      'Updater-Status wird beim Programmstart abgefragt (Race Condition behoben)',
      'IPC-Listener-Cleanup-Fehler im Preload behoben',
    ],
  },
  {
    version: '0.1.5',
    date: '23. September 2026',
    changes: [
      'Automatischer Update-Check beim Programmstart',
      'Update-Fenster mit Download-Fortschritt und Countdown',
      'Updates-suchen-Button in den Einstellungen',
    ],
  },
  {
    version: '0.1.4',
    date: '23. September 2026',
    changes: [
      'History-Panel aktualisiert sich beim Branch-Wechsel',
      'Fortschrittsbalken einheitlich fuer alle Aktionen (Commit, Sync)',
      'Schaltflaechen-Tooltips im History-Panel',
    ],
  },
]

interface Props {
  version: string
  onClose: () => void
}

export function WhatsNewModal({ version, onClose }: Props) {
  const current = CHANGELOG.find((e) => e.version === version) ?? CHANGELOG[0]
  const previous = CHANGELOG.filter((e) => e.version !== current.version).slice(0, 3)

  return (
    <Modal title="" onClose={onClose} width={500}>
      <div className="whatsnew-header">
        <Sparkles size={22} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
        <div>
          <div className="whatsnew-title">Was ist neu in Version {current.version}</div>
          <div className="whatsnew-date">{current.date}</div>
        </div>
      </div>

      <div className="whatsnew-body">
        <ul className="whatsnew-list">
          {current.changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>

        {previous.length > 0 && (
          <div className="whatsnew-previous">
            <div className="whatsnew-previous-title">Aeltere Versionen</div>
            {previous.map((entry) => (
              <div key={entry.version} className="whatsnew-previous-entry">
                <div className="whatsnew-previous-version">v{entry.version}</div>
                <ul className="whatsnew-list whatsnew-list--small">
                  {entry.changes.slice(0, 2).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                  {entry.changes.length > 2 && (
                    <li className="whatsnew-more">+{entry.changes.length - 2} weitere</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="whatsnew-footer">
        <button className="btn btn-primary" onClick={onClose}>
          Verstanden
        </button>
      </div>
    </Modal>
  )
}
