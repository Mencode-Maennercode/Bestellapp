import { ArrowLeft } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { mount } from './mount';

// Texts taken unchanged from the previous app (legacy/src/pages/impressum.tsx, datenschutz.tsx).

const Address = () => (
  <p>
    Dennis Heidenreich
    <br />
    PräsenzWert
    <br />
    Josef-Martin-Weg 4
    <br />
    53501 Grafschaft
  </p>
);

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-bold text-ink">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function Legal() {
  return (
    <main className="mx-auto max-w-[68ch] gutter pt-[calc(var(--safe-top)+1.25rem)] pb-[calc(var(--safe-bottom)+4rem)] text-ink-2">
      <button
        type="button"
        onClick={() => (history.length > 1 ? history.back() : location.assign(import.meta.env.BASE_URL))}
        className="-ml-2 inline-flex min-h-12 items-center gap-2 rounded-[12px] px-2 font-bold text-ink hover:bg-surface-1"
      >
        <ArrowLeft size={20} weight="bold" /> Zurück
      </button>

      <h1 id="impressum" className="mt-6 scroll-mt-6 font-display text-[3rem] leading-none font-extrabold text-ink uppercase">Impressum</h1>
      <Block title="Angaben gemäß § 5 TMG">
        <Address />
      </Block>
      <Block title="Kontakt">
        <p>E-Mail: <a href="mailto:Kontakt@PraesenzWert.de">Kontakt@PraesenzWert.de</a><br />Webseite: <a href="https://www.praesenzwert.de">www.praesenzwert.de</a></p>
      </Block>
      <Block title="Bereitstellung der App und Verantwortlichkeit">
        <p>
          Diese App wird Veranstaltern zur eigenverantwortlichen Nutzung bereitgestellt. Für Inhalte, Preise, Bestellungen und die Durchführung der
          Veranstaltung ist der jeweilige Veranstalter verantwortlich. PräsenzWert stellt ausschließlich die technische Plattform zur Verfügung. Es werden
          durch diese App keine personenbezogenen Daten der Besteller gespeichert. Personenbezogene Daten fallen nur an, wenn freiwillig über das
          Kontaktfeld eine Nachricht gesendet wird (Name und E-Mail) und werden ausschließlich zur Bearbeitung der Anfrage verwendet.
        </p>
      </Block>
      <Block title="EU-Streitschlichtung">
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr</a>
        </p>
      </Block>
      <Block title="Verantwortlich für den Inhalt">
        <Address />
      </Block>
      <Block title="Haftung für Inhalte">
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis
          10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach
          Umständen zu forschen, die auf rechtswidrige Tätigkeiten hinweisen.
        </p>
        <p>
          Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine
          diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von
          entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
        </p>
      </Block>
      <Block title="Haftung für Links">
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden
          Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten
          verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum
          Zeitpunkt der Verlinkung nicht erkennbar.
        </p>
        <p>
          Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei
          Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
        </p>
      </Block>
      <Block title="Urheberrecht">
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
          Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen
          Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
        </p>
        <p>
          Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte
          Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden
          Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
        </p>
      </Block>
      <Block title="Haftungsausschluss">
        <p>Die Nutzung dieser App erfolgt auf eigene Gefahr. Wir übernehmen keine Haftung für:</p>
        <ul className="list-disc pl-5">
          <li>Die Richtigkeit, Vollständigkeit und Aktualität der bereitgestellten Informationen</li>
          <li>Technische Störungen, Ausfälle oder Datenverluste</li>
          <li>Schäden, die durch die Nutzung oder Nichtnutzung der App entstehen</li>
          <li>Fehlerhafte Bestellungen oder Übermittlungsfehler</li>
        </ul>
        <p>Diese Haftungsbeschränkung gilt nicht bei Vorsatz oder grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit.</p>
      </Block>
      <Block title="Kooperation">
        <p>Diese App wird präsentiert von PräsenzWert in Kooperation mit Dorfgarde Nierendorf.</p>
      </Block>
      <Block title="Streitschlichtung">
        <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </Block>

      <h1 id="datenschutz" className="mt-16 scroll-mt-6 font-display text-[3rem] leading-none font-extrabold text-ink uppercase">Datenschutz</h1>
      <Block title="1. Datenschutz auf einen Blick">
        <p>
          Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.
          Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
        </p>
        <p>Der Websitebetreiber erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt.</p>
      </Block>
      <Block title="2. Hosting und Dienstleister">
        <p>
          Diese Website nutzt Firebase, einen Dienst von Google LLC. Firebase speichert Bestelldaten temporär für die Verarbeitung der Getränkebestellungen.
          Datenverarbeitungszweck: Verarbeitung von Bestellungen in Echtzeit. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          Speicherdauer: Bestellungen werden nach 3 Tagen automatisch gelöscht.
        </p>
        <p>
          Diese App wird Veranstaltern zur eigenverantwortlichen Nutzung bereitgestellt. Für Inhalte, Preise, Bestellungen und die Durchführung der
          Veranstaltung ist der jeweilige Veranstalter verantwortlich. PräsenzWert stellt ausschließlich die technische Plattform bereit. Es werden durch
          diese App keine personenbezogenen Daten der Besteller gespeichert. Personenbezogene Daten fallen nur an, wenn Sie freiwillig über das Kontaktfeld
          eine Nachricht senden (Name und E-Mail).
        </p>
      </Block>
      <Block title="3. Cookies">
        <p>Diese Website verwendet keine Cookies für Tracking-Zwecke. Es werden ausschließlich technische Cookies für die Firebase-Funktionalität verwendet.</p>
      </Block>
      <Block title="4. Ihre Rechte als betroffene Person">
        <p>
          Auskunftsrecht: Sie haben das Recht, Auskunft über die Sie betreffenden personenbezogenen Daten zu verlangen. Recht auf Berichtigung: Sie haben das
          Recht, die Berichtigung unrichtiger personenbezogener Daten zu verlangen. Recht auf Löschung: Sie haben das Recht, die Löschung Ihrer
          personenbezogenen Daten zu verlangen. Widerspruchsrecht: Sie haben das Recht, der Verarbeitung Ihrer Daten zu widersprechen.
        </p>
      </Block>
      <Block title="5. Datenanalyse">
        <p>Diese Website verwendet keine Analyse-Tools zur Erstellung von Nutzerprofilen. Es finden keine automatisierten Entscheidungsprozesse statt.</p>
      </Block>
      <Block title="6. Speicherdauer">
        <p>
          Bestelldaten werden für 3 Tage gespeichert und können als Excel-Statistik exportiert werden. Nach 3 Tagen werden die Daten automatisch gelöscht. Es
          findet keine dauerhafte Speicherung personenbezogener Daten statt. Personenbezogene Daten (optional Name und E-Mail) fallen nur bei freiwilliger
          Kontaktaufnahme über das Kontaktfeld an und werden ausschließlich zur Bearbeitung der Anfrage verwendet.
        </p>
      </Block>
      <Block title="7. Kontakt für Datenschutzfragen">
        <Address />
        <p>E-Mail: <a href="mailto:Kontakt@PraesenzWert.de">Kontakt@PraesenzWert.de</a></p>
      </Block>
      <Block title="8. Rechtsgrundlage der Datenverarbeitung">
        <p>Rechtsgrundlage für die Verarbeitung von Bestelldaten ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Vertrags über die Getränkebestellung).</p>
      </Block>
      <Block title="9. Bewertungen und Kontaktformular">
        <p>Wenn Sie eine Bewertung abgeben oder das Kontaktformular nutzen, werden folgende Daten erhoben:</p>
        <ul className="list-disc pl-5">
          <li>Bewertung (Sterne-Rating)</li>
          <li>Optional: Name und E-Mail-Adresse (nur bei Kontaktaufnahme)</li>
          <li>Zeitstempel der Bewertung</li>
        </ul>
        <p>
          Zweck: Verbesserung unseres Services und Kontaktaufnahme auf Wunsch. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) bzw. lit. f DSGVO
          (berechtigtes Interesse). Speicherdauer: Bewertungen werden dauerhaft gespeichert, Kontaktdaten nur bei ausdrücklichem Wunsch.
        </p>
      </Block>
      <Block title="10. Progressive Web App (PWA)">
        <p>Diese Website kann als Progressive Web App (PWA) auf Ihrem Gerät installiert werden. Die Installation erfolgt lokal auf Ihrem Gerät und überträgt keine zusätzlichen Daten an uns.</p>
      </Block>
      <Block title="11. SSL- bzw. TLS-Verschlüsselung">
        <p>
          Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte, wie zum Beispiel Bestellungen oder Anfragen, die Sie
          an uns als Seitenbetreiber senden, eine SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile des
          Browsers von „http://“ auf „https://“ wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
        </p>
      </Block>
      <Block title="12. Widerspruch gegen Werbe-E-Mails">
        <p>
          Der Nutzung von im Rahmen der Impressumspflicht veröffentlichten Kontaktdaten zur Übersendung von nicht ausdrücklich angeforderter Werbung und
          Informationsmaterialien wird hiermit widersprochen. Die Betreiber der Seiten behalten sich ausdrücklich rechtliche Schritte im Falle der
          unverlangten Zusendung von Werbeinformationen, etwa durch Spam-E-Mails, vor.
        </p>
      </Block>
      <Block title="13. Datenübermittlung bei Vertragsschluss">
        <p>
          Wir übermitteln personenbezogene Daten an Dritte nur dann, wenn dies im Rahmen der Vertragsabwicklung notwendig ist, etwa an das mit der Lieferung
          der Ware beauftragte Unternehmen oder das mit der Zahlungsabwicklung beauftragte Kreditinstitut. Eine weitergehende Übermittlung der Daten erfolgt
          nicht bzw. nur dann, wenn Sie der Übermittlung ausdrücklich zugestimmt haben.
        </p>
      </Block>
      <Block title="14. Datenschutzbeauftragter">
        <p>Verantwortlich für die Datenverarbeitung:</p>
        <Address />
        <p>E-Mail: <a href="mailto:Kontakt@PraesenzWert.de">Kontakt@PraesenzWert.de</a></p>
      </Block>
      <Block title="16. Recht auf Datenübertragbarkeit">
        <p>
          Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfüllung eines Vertrags automatisiert verarbeiten, an sich oder an
          einen Dritten in einem gängigen, maschinenlesbaren Format aushändigen zu lassen. Sofern Sie die direkte Übertragung der Daten an einen anderen
          Verantwortlichen verlangen, erfolgt dies nur, soweit es technisch machbar ist.
        </p>
      </Block>
      <Block title="17. Haftungsausschluss">
        <p>
          Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind
          ausschließlich deren Betreiber verantwortlich. Die Datenverarbeitung erfolgt nach bestem Wissen und Gewissen. Eine Haftung für Schäden, die durch
          die Nutzung der bereitgestellten Informationen entstehen, ist ausgeschlossen, soweit gesetzlich zulässig.
        </p>
      </Block>
      <p className="mt-12 text-[0.9375rem] text-ink-3">© 2026 PräsenzWert. Alle Rechte vorbehalten. Stand: Januar 2026, letzte Aktualisierung: 19.01.2026</p>
    </main>
  );
}

mount(<Legal />);
