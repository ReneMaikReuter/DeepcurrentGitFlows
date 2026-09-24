import { Sparkles } from 'lucide-react'
import { Modal } from './Modal'

interface ChangeEntry {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '0.8.2',
    date: '25. September 2026',
    changes: [
      'Bugfix: Fenster zittert beim Verschieben und Skalieren nicht mehr',
    ],
  },
  {
    version: '0.8.1',
    date: '25. September 2026',
    changes: [
      'Bugfix: Windows Snap Layouts und Fenster-Einrasten funktionieren jetzt korrekt',
      'Ursache: transparent:true verhinderte DWM-Snap-Tracking -- entfernt, Acrylic-Effekt laeuft weiterhin ueber setBackgroundMaterial',
    ],
  },
  {
    version: '0.8.0',
    date: '25. September 2026',
    changes: [
      'Bugfix: Pro-Switch und alle Titelleisten-Elemente wieder vollstaendig sichtbar',
      'Bugfix: Fenster laesst sich wieder maximieren und per Kachel-Popup einrasten (Windows Snap Layouts)',
    ],
  },
  {
    version: '0.7.9',
    date: '25. September 2026',
    changes: [
      'Bugfix: Pro-Switch und Statusleiste in der Titelleiste wieder sichtbar (CSS-Konflikt behoben)',
      'Bugfix: Windows Snap Layouts funktionieren jetzt korrekt — Hover ueber Maximieren-Button zeigt Kachel-Auswahl',
    ],
  },
  {
    version: '0.7.8',
    date: '25. September 2026',
    changes: [
      'Team-Tab: Asset-Zeilen zeigen jetzt den vollstaendigen Dateipfad statt dem Kurznamen',
    ],
  },
  {
    version: '0.7.7',
    date: '25. September 2026',
    changes: [
      'Graph-Tab entfernt — vereinfachte Tab-Leiste mit Aenderungen, Sync, History und Team',
      'Windows Snap Layouts: Snap-Popup erscheint beim Hovern ueber den Maximieren-Button (native Windows 11 Kacheln)',
    ],
  },
  {
    version: '0.7.6',
    date: '24. September 2026',
    changes: [
      'Branch-Sidebar: Namen erscheinen nur noch bei aktiv arbeitenden Mitgliedern, nicht mehr bei jedem letzten Committer',
    ],
  },
  {
    version: '0.7.4',
    date: '24. September 2026',
    changes: [
      'Interaktives Tutorial im Startmenue — zeigt die Anwendung Schritt fuer Schritt in einer sicheren Demo-Umgebung',
      'Tutorial laeuft im Kompakt-Modus mit Demo-Projekt "EchoesOfMyran-Demo" (Unreal Engine 5.7)',
      'Keine echten Git-Aktionen waehrend des Tutorials — alle Aktionen sind isoliert simuliert',
      'Typografie-Update: Inter als primaere Schrift, klarere Gewichtshierarchie, weniger Letter-Spacing',
    ],
  },
  {
    version: '0.7.3',
    date: '24. September 2026',
    changes: [
      'Pro-Modus: Diff-Ansicht direkt im Änderungen-Tab — Datei anklicken zeigt Zeile-fuer-Zeile was sich aendert',
      'Pro-Modus: Blame-Ansicht im Diff — zeigt wer welche Zeile zuletzt geaendert hat',
      'Pro-Modus: Stash-Verwaltung im Aenderungen-Tab (erstellen, anwenden, loeschen)',
      'Pro-Modus: Pull Request auf GitHub direkt aus der App erstellen',
      'Pro-Modus: Branch-Graph als neuer Tab — alle Branches und Commits visuell',
      'Pro-Modus: Cherry-Pick in der History — einzelnen Commit auf aktuellen Branch uebertragen',
    ],
  },
  {
    version: '0.7.2',
    date: '24. September 2026',
    changes: [
      'Bedienungsanleitung: neuer Abschnitt "Team-Workflow" mit Dev_Branch, Push-Regeln, binaeren Konflikten und LFS-Lock-Strategie',
    ],
  },
  {
    version: '0.7.1',
    date: '24. September 2026',
    changes: [
      'App-Icon erscheint jetzt korrekt in Taskleiste, Alt-Tab und Titelleiste',
      'Responsive Layout: Content-Bereich begrenzt auf max. 1400px fuer bessere Lesbarkeit auf Ultrawide-Monitoren',
      'Alle Fehlermeldungen (Push, Lock, Unlock) erscheinen jetzt im Toast unten rechts statt inline',
      'Team-Tab: Asset-Pfade zeigen jetzt Level-Namen (z.B. FirstPerson / Lvl_FirstPerson)',
    ],
  },
  {
    version: '0.6.9',
    date: '24. September 2026',
    changes: [
      'Geschuetzte Branches gelten jetzt fuer alle im Team (gespeichert in .deepcurrent/config.json im Repo)',
      'Einstellungen: Backup-Ordner direkt unter Max. Backups',
      'Auto-Updater: latest.yml wird jetzt korrekt hochgeladen, Updates werden wieder erkannt',
    ],
  },
  {
    version: '0.6.8',
    date: '24. September 2026',
    changes: [
      'Glass Theme: Panels deutlich undurchsichtiger (0.72/0.82) fuer bessere Lesbarkeit',
      'Glass Theme: Blur-Staerke auf 10px reduziert statt 40px, weniger Unschaerfe',
      'Glass Theme: Sekundaertexte und Hilfstexte staerker deckend',
      'Light Theme: Tippfehler in Text-Farbe behoben (war ungueltige CSS-Farbe)',
      'Sidebar-Resize: Min/Max-Grenzen (160px bis 400px) sichern Layout bei kleinen Fenstern',
    ],
  },
  {
    version: '0.6.7',
    date: '24. September 2026',
    changes: [
      'Team-Tab: Aktive Person pro Branch wird jetzt aus dem echten Git-Verlauf (letzte 30 Tage) ermittelt statt aus dem Branch-Ersteller',
      'Team-Tab: Asset-Pfade werden lesbar angezeigt (z.B. "Lvl_FirstPerson (External Actor)" statt kryptischer Hash-Dateinamen)',
    ],
  },
  {
    version: '0.6.6',
    date: '24. September 2026',
    changes: [
      'Team-Tab: alle Teammitglieder sichtbar — auch wenn ihr Branch nur remote existiert',
    ],
  },
  {
    version: '0.6.5',
    date: '24. September 2026',
    changes: [
      'Commit-Sperre: Wenn ein anderes Teammitglied eine Datei gesperrt hat, wird der Commit blockiert mit dem Namen der Person',
    ],
  },
  {
    version: '0.6.4',
    date: '24. September 2026',
    changes: [
      'Team-Tab komplett überarbeitet: aufklappbare Karte pro Person mit Branch, Änderungen und gesperrten Assets',
      'Alle Teammitglieder werden jetzt angezeigt — auch wenn sie keine LFS-Locks haben',
    ],
  },
  {
    version: '0.6.3',
    date: '24. September 2026',
    changes: [
      'LFS-Entsperren funktioniert jetzt ohne Admin-Rechte — eigene Locks werden per ID entsperrt',
      'AutoLock sperrt keine Assets mehr beim Status-Check — nur noch nach einem Commit, damit kein anderer Account versehentlich sperrt',
    ],
  },
  {
    version: '0.6.2',
    date: '24. September 2026',
    changes: [
      'Dateiliste: Schloss-Icon neben LFS-Assets zum manuellen Sperren und Entsperren',
      'Dateiliste: GESPERRT-Badge zeigt jetzt korrekt an wenn ein anderes Teammitglied die Datei gesperrt hat',
      'Team-Tab: LFS-Locks von Teammitgliedern werden jetzt zuverlässig angezeigt',
    ],
  },
  {
    version: '0.6.1',
    date: '24. September 2026',
    changes: [
      'Bugfix: Team-Tab zeigt jetzt Locks aller Teammitglieder korrekt an (JSON-Format von --verify wurde falsch geparst)',
    ],
  },
  {
    version: '0.6.0',
    date: '24. September 2026',
    changes: [
      'Kompakt-Modus: Checkboxen jetzt korrekt im dunklen Theme dargestellt',
    ],
  },
  {
    version: '0.5.9',
    date: '24. September 2026',
    changes: [
      'Gelöschte Branches verschwinden jetzt automatisch — beim Öffnen und beim Aktualisieren werden verwaiste lokale Branches aufgeräumt',
      'Branches können jetzt gesperrt sehen egal auf welchem Branch man selbst gerade ist',
    ],
  },
  {
    version: '0.5.8',
    date: '24. September 2026',
    changes: [
      'Team-Tab: LFS-Locks werden jetzt direkt vom Server gelesen — Locks anderer Teammitglieder erscheinen sofort',
    ],
  },
  {
    version: '0.5.7',
    date: '24. September 2026',
    changes: [
      'Branches-Header: Aktualisieren-Button zum manuellen Refresh der Branch-Liste',
      'Branch löschen: löscht jetzt automatisch auch den Remote-Branch mit',
    ],
  },
  {
    version: '0.5.6',
    date: '24. September 2026',
    changes: [
      'Branch-Listen-Zeilen mehr Luft: Name und Autor nicht mehr gequetscht',
      'Repo öffnen: alle Remote-Branches werden automatisch lokal getrackt — kein manuelles Auschecken mehr nötig',
      'Origin-Branches: Merge-Icon zum direkten Mergen in den aktuellen Branch',
    ],
  },
  {
    version: '0.5.5',
    date: '24. September 2026',
    changes: [
      'Origin-Branches: Merge-Icon zum direkten Mergen in den aktuellen Branch (ohne vorher lokal auschecken)',
    ],
  },
  {
    version: '0.5.4',
    date: '24. September 2026',
    changes: [
      'Einstellungen: Changelog zeigt jetzt immer die aktuelle Version (war fest auf 0.3.0 eingefroren)',
    ],
  },
  {
    version: '0.5.3',
    date: '24. September 2026',
    changes: [
      'Branch erstellen: "von"-Dropdown zeigt jetzt auch Origin-Branches die noch nicht lokal vorhanden sind',
    ],
  },
  {
    version: '0.5.2',
    date: '24. September 2026',
    changes: [
      'Bugfix: Sync-Fehler "no tracking information" wird automatisch behoben — Upstream wird gesetzt und Pull wiederholt',
    ],
  },
  {
    version: '0.5.1',
    date: '24. September 2026',
    changes: [
      'Branch-Anzeige: Zeigt jetzt wer zuletzt auf einem Branch gearbeitet hat (Vorname unter dem Branch-Namen)',
      'FancyZones / Windows Snap: Fenster skaliert jetzt korrekt nach dem Einrasten in eine Zone',
    ],
  },
  {
    version: '0.5.0',
    date: '24. September 2026',
    changes: [
      'Bugfix: "Repo nicht registriert" beim Auschecken von Branches behoben (Pfadvergleich jetzt case-insensitiv)',
    ],
  },
  {
    version: '0.4.9',
    date: '24. September 2026',
    changes: [
      'Origin-Branches: Download-Icon zum lokalen Auschecken — Branch wird erstellt und direkt gewechselt',
    ],
  },
  {
    version: '0.4.8',
    date: '24. September 2026',
    changes: [
      'AutoLock ist jetzt standardmäßig aktiviert: LFS-Dateien werden beim Bearbeiten automatisch gesperrt',
    ],
  },
  {
    version: '0.4.7',
    date: '24. September 2026',
    changes: [
      'Sync-Fehler jetzt mit konkreter Ursache: LFS-Auth, lokale Konflikte, 401/403, Netzwerk',
      'Fetch-Fehler ebenfalls mit praeziser Meldung (Token, Repo nicht gefunden, etc.)',
    ],
  },
  {
    version: '0.4.6',
    date: '24. September 2026',
    changes: [
      'Windows Snap und PowerToys FancyZones: Fenster rastet jetzt korrekt in Zonen ein und passt Groesse an',
    ],
  },
  {
    version: '0.4.5',
    date: '23. September 2026',
    changes: [
      'Deepcurrent Theme: Universum-Hintergrund mit 620 animierten Sternen und Nebel-Overlay',
      'Deepcurrent Theme: Sterne mit Twinkle-Animation und subtilen Glows auf groesseren Sternen',
    ],
  },
  {
    version: '0.4.4',
    date: '23. September 2026',
    changes: [
      'Branch umbenennen: Stift-Icon erscheint beim Hover, Inline-Eingabe mit Enter/Escape',
    ],
  },
  {
    version: '0.4.3',
    date: '23. September 2026',
    changes: [
      'Deepcurrent Theme: Alle Hintergruende jetzt Violet-getönt statt Blau',
      'Deepcurrent Theme: Aktiver Branch und Hover-Zustaende mit saettigerem Violet',
      'Deepcurrent Theme: Aktiver Tab-Underline in Ember-Orange',
    ],
  },
  {
    version: '0.4.2',
    date: '23. September 2026',
    changes: [
      'Glass Theme: Panel-Hintergruende staerker undurchsichtig fuer bessere Lesbarkeit',
      'Glass Theme: Text vollstaendig deckend (kein halbtransparenter Text mehr)',
      'Glass Theme: Starkerer Blur-Effekt auf allen Panels (40px statt 20px)',
    ],
  },
  {
    version: '0.4.1',
    date: '23. September 2026',
    changes: [
      'Konflikt-Warnung: Dateien die von Teammitgliedern gesperrt sind, werden mit GESPERRT-Badge markiert',
      'Branch Status-Ampel: gruener/gelber/roter Punkt zeigt ob ein Branch mit Remote synchron ist',
      'Commit-Templates: Prefix-Dropdown fuer feat, fix, refactor, content, design, wip u.a.',
      'Datei-Historie: History-Icon in der Dateiliste zeigt die letzten 20 Commits fuer eine Datei',
      'Glass Theme: Hintergrund noch transparenter (mehr Milchglas-Effekt)',
    ],
  },
  {
    version: '0.4.0',
    date: '23. September 2026',
    changes: [
      'Glass Theme: Fenster jetzt wirklich transparent (Desktop sichtbar dahinter)',
      'Glass Theme: html/body/root vollstaendig transparent gesetzt',
      'Glass Theme: Acrylic wird beim Start sofort aus gespeichertem Theme geladen',
      'Glass Theme: Wechsel zu anderem Theme macht Fenster sofort wieder opak',
    ],
  },
  {
    version: '0.3.9',
    date: '23. September 2026',
    changes: [
      'Glass Theme: Fenster-Ghost beim Schliessen behoben (Acrylic wird vor Close deaktiviert)',
      'Glass Theme: Modal-Overlay noch staerker abgedunkelt',
    ],
  },
  {
    version: '0.3.8',
    date: '23. September 2026',
    changes: [
      'Glass Theme: Overlay hinter Modals stark abgedunkelt, kaum Transparenz',
      'Glass Theme: Alle Modals (Einstellungen, Was ist neu, etc.) als dickes Milchglas',
    ],
  },
  {
    version: '0.3.7',
    date: '23. September 2026',
    changes: [
      'Glass Theme: Einstellungs-Modal als dickes Milchglas, kaum Transparenz dahinter',
    ],
  },
  {
    version: '0.3.6',
    date: '23. September 2026',
    changes: [
      'Branch-Herkunft ("von X") jetzt auch beim aktiven Branch sichtbar',
      'Glass Theme: Acrylic-Effekt wird beim App-Start korrekt angewendet',
      'Theme und Schriftgroesse werden beim Start sofort geladen',
    ],
  },
  {
    version: '0.3.5',
    date: '23. September 2026',
    changes: [
      'Deepcurrent Theme: Current Violet als Highlight-Farbe fuer aktive Branches und Nav',
      'Deepcurrent Theme: Hintergruende dunkler und mehr Lila-Tiefe',
      'Branch-Drag: ans Ende der Liste ziehen jetzt moeglich',
    ],
  },
  {
    version: '0.3.4',
    date: '23. September 2026',
    changes: [
      'Branch-Drag: ans Ende der Liste ziehen jetzt moeglich',
      'Branch-Drag: Linie erscheint auch beim Ablegen am letzten Platz',
    ],
  },
  {
    version: '0.3.3',
    date: '23. September 2026',
    changes: [
      'Branch-Drag: blaue Linie zeigt an, wo der Branch landen wird',
    ],
  },
  {
    version: '0.3.2',
    date: '23. September 2026',
    changes: [
      'Glass Theme: echtes Windows Acrylic mit Frosted-Glass-Effekt',
      'Theme-Auswahl jetzt als Dropdown (Dark, Light, Deepcurrent Studio, Glass)',
      'Branch-Sortierung: per Drag-and-Drop eigene Reihenfolge festlegen',
    ],
  },
  {
    version: '0.3.1',
    date: '23. September 2026',
    changes: [
      'Deepcurrent Studio Theme: Ember, Void, Deep Blue, Current Violet',
      'Branch-Namen und Sidebar-Navigation: groessere, besser lesbare Schrift',
      'Branch-Herkunft ("von X") sichtbarer',
      'Bedienungsanleitung: Team-Tab, Kompakt-Modus, Backups dokumentiert',
    ],
  },
  {
    version: '0.3.0',
    date: '23. September 2026',
    changes: [
      'Neues App-Icon: minimalistisches Git-Branch-Symbol',
      'Team-Tab: zeigt nur noch Personen mit aktiven LFS-Locks',
      'Team-Tab: LFS-Locks alle 5 Sekunden automatisch aktualisiert',
      'LFS Auto-Lock: Assets direkt beim Status-Check gesperrt',
      'Branch löschen: Remote-Fehlermeldungen verständlich (z.B. aktiver Remote-Branch)',
      'Fenster-Jitter behoben',
    ],
  },
  {
    version: '0.2.5',
    date: '23. September 2026',
    changes: [
      'Branch-Liste: zeigt von welchem Branch ein Branch erstellt wurde',
      'History: origin/*-Refs ausgeblendet, Badges nicht mehr überlappend',
      'Geschützter Branch: Fehlermeldung beim Versuch zu löschen',
    ],
  },
  {
    version: '0.2.4',
    date: '23. September 2026',
    changes: [
      'Backup-Speicherort frei konfigurierbar (Standard AppData, alternativ Netzwerkpfad)',
      'Branch-Erstellung: Basis-Branch visuell wählbar',
      'Branch-Wechsel und Push-Button im Kompakt-Modus',
      'Geschützte Branches können nicht mehr gelöscht werden',
      'AutoLock: LFS-Dateien werden direkt beim Bearbeiten gesperrt',
    ],
  },
  {
    version: '0.2.3',
    date: '23. September 2026',
    changes: [
      'Nutzungsbedingungen: korrekte Bezeichnung als Einzelperson (René-Maik Reuter, Projektbezeichnung Deepcurrent Studio)',
      'Rechtlicher Hinweis auf Unternehmensform entfernt (noch keine GmbH/UG)',
    ],
  },
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
                  {entry.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
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
