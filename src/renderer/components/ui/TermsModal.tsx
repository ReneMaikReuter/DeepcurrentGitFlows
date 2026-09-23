import { useState } from 'react'
import { Shield } from 'lucide-react'
import './TermsModal.css'

interface Props {
  onAccept: () => void
  onDecline: () => void
}

export function TermsModal({ onAccept, onDecline }: Props) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolledToBottom(true)
    }
  }

  return (
    <div className="terms-backdrop">
      <div className="terms-dialog">
        <div className="terms-header">
          <Shield size={20} strokeWidth={1.5} />
          <div>
            <div className="terms-title">Nutzungsbedingungen & Datenschutz</div>
            <div className="terms-subtitle">Deepcurrent Git Flows — Interne Betriebssoftware</div>
          </div>
        </div>

        <div className="terms-body" onScroll={handleScroll}>
          <section>
            <h3>§ 1 Geltungsbereich und Zugang</h3>
            <p>
              Die vorliegende Software „Deepcurrent Git Flows" (nachfolgend „Software") ist ausschließlich für den internen Gebrauch durch Mitarbeiterinnen und Mitarbeiter sowie autorisierte Auftragnehmer der Deepcurrent Studio UG (haftungsbeschränkt) (nachfolgend „Deepcurrent Studio") bestimmt. Jede Nutzung durch unbefugte Dritte ist strikt untersagt und stellt eine Verletzung des Urheberrechts sowie gegebenenfalls weiterer Schutzrechte dar.
            </p>
            <p>
              Der Zugang zu dieser Software setzt die ausdrückliche schriftliche oder digitale Autorisierung durch die Geschäftsführung von Deepcurrent Studio voraus. Eine Weitergabe von Zugangsdaten, Installationsdateien oder sonstigen zur Nutzung der Software erforderlichen Ressourcen an Dritte ist ohne vorherige schriftliche Genehmigung der Geschäftsführung verboten.
            </p>
          </section>

          <section>
            <h3>§ 2 Zweckbindung</h3>
            <p>
              Die Software dient ausschließlich der internen Verwaltung von Versionskontrollprozessen im Rahmen der Spieleentwicklungsprojekte von Deepcurrent Studio. Eine Nutzung zu anderen Zwecken — insbesondere zu gewerblichen Zwecken außerhalb des Unternehmens, zu wettbewerbswidrigen Zwecken oder zur Verarbeitung von Daten Dritter ohne ausdrückliche Genehmigung — ist unzulässig.
            </p>
          </section>

          <section>
            <h3>§ 3 Datenschutz und Datenverarbeitung</h3>
            <p>
              Deepcurrent Git Flows erhebt, speichert oder übermittelt keinerlei personenbezogene Daten an externe Dritte oder Dienste. Sämtliche Verarbeitungsvorgänge finden ausschließlich lokal auf dem Gerät des autorisierten Nutzers sowie im Rahmen der unternehmenseigenen Git-Infrastruktur statt.
            </p>
            <p>
              Folgende Daten werden lokal gespeichert und ausschließlich zur Sicherstellung der Funktionsfähigkeit der Software verwendet:
            </p>
            <ul>
              <li>Anwendungseinstellungen (Darstellung, Sprache, Standardbranch)</li>
              <li>Zuletzt geöffnete Repository-Pfade auf dem lokalen Dateisystem</li>
              <li>Verschlüsselte GitHub-Zugangsdaten (ausschließlich lokal, kein Cloud-Transfer)</li>
            </ul>
            <p>
              Es werden keine Nutzungsdaten, Telemetrie, Fehlerberichte oder sonstige analytische Daten erhoben. Die Software kommuniziert ausschließlich mit GitHub.com im Rahmen der Git-Operationen sowie zwecks Prüfung auf Softwareaktualisierungen — ausschließlich über die offizielle GitHub API.
            </p>
          </section>

          <section>
            <h3>§ 4 Vertraulichkeit und Geheimhaltung</h3>
            <p>
              Informationen, Quellcode, Assets, Projektstrukturen und sonstige Inhalte, auf die über diese Software zugegriffen wird, unterliegen der strengen Vertraulichkeit. Autorisierte Nutzer sind verpflichtet, diese Informationen gemäß den unternehmensinternen Geheimhaltungsvereinbarungen zu behandeln und vor dem Zugriff durch unbefugte Dritte zu schützen.
            </p>
            <p>
              Insbesondere ist es untersagt, mittels dieser Software auf Repositories zuzugreifen oder Daten zu verarbeiten, die nicht dem Tätigkeitsbereich von Deepcurrent Studio zuzuordnen sind.
            </p>
          </section>

          <section>
            <h3>§ 5 Haftung und Gewährleistung</h3>
            <p>
              Die Software wird für den internen Betrieb bereitgestellt. Deepcurrent Studio übernimmt keine Haftung für Schäden, die durch unsachgemäße Nutzung, Fehlbedienung oder den Betrieb auf nicht freigegebenen Systemen entstehen. Der autorisierte Nutzer trägt die Verantwortung für die ordnungsgemäße Anwendung der Software im Rahmen der unternehmensinternen Prozesse.
            </p>
          </section>

          <section>
            <h3>§ 6 Sanktionen bei Verstößen</h3>
            <p>
              Verstöße gegen diese Nutzungsbedingungen — insbesondere unbefugte Weitergabe, missbräuchliche Nutzung oder Verletzung der Vertraulichkeitspflichten — werden arbeitsrechtlich, zivilrechtlich und gegebenenfalls strafrechtlich geahndet. Deepcurrent Studio behält sich vor, bei festgestellten Verstößen sofortige Konsequenzen einzuleiten, einschließlich der sofortigen Sperrung des Zugangs sowie der Geltendmachung von Schadensersatzansprüchen.
            </p>
            <p>
              Bei begründetem Verdacht eines Verstoßes ist Deepcurrent Studio berechtigt, den Zugang zur Software ohne Vorankündigung zu entziehen.
            </p>
          </section>

          <section>
            <h3>§ 7 Änderungen dieser Bedingungen</h3>
            <p>
              Deepcurrent Studio behält sich vor, diese Nutzungsbedingungen jederzeit anzupassen. Wesentliche Änderungen werden den autorisierten Nutzern in geeigneter Form mitgeteilt. Die weitere Nutzung der Software nach Bekanntgabe von Änderungen gilt als Zustimmung zu den aktualisierten Bedingungen.
            </p>
          </section>

          <section>
            <h3>§ 8 Anwendbares Recht</h3>
            <p>
              Es gilt ausschließlich das Recht der Bundesrepublik Deutschland. Gerichtsstand für alle Streitigkeiten im Zusammenhang mit dieser Software ist, soweit gesetzlich zulässig, der Sitz von Deepcurrent Studio.
            </p>
          </section>

          <div className="terms-scroll-hint">
            {!scrolledToBottom && <span>↓ Bitte bis zum Ende scrollen, um fortzufahren</span>}
          </div>
        </div>

        <div className="terms-footer">
          <p className="terms-confirm-text">
            Mit Klick auf „Akzeptieren" bestätige ich, dass ich die vorstehenden Nutzungsbedingungen vollständig gelesen und verstanden habe und diesen ausdrücklich zustimme.
          </p>
          <div className="terms-actions">
            <button className="btn btn-ghost" onClick={onDecline}>
              Ablehnen &amp; Beenden
            </button>
            <button
              className="btn btn-primary"
              onClick={onAccept}
              disabled={!scrolledToBottom}
              title={!scrolledToBottom ? 'Bitte bis zum Ende scrollen' : undefined}
            >
              Akzeptieren
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
