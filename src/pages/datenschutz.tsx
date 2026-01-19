import { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

const Datenschutz: NextPage = () => {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Datenschutzerklärung - Karneval Bestellsystem</title>
        <meta name="description" content="Datenschutzerklärung nach DSGVO" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => router.back()} 
            className="text-blue-600 hover:text-blue-800 mb-6 inline-block cursor-pointer"
          >
            ← Zurück
          </button>
          
          <h1 className="text-3xl font-bold mb-6">Datenschutzerklärung</h1>
          
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Datenschutz auf einen Blick</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Allgemeine Hinweise</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren 
                    personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene 
                    Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Datenerfassung auf dieser Website</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Der Websitebetreiber erhebt und speichert automatisch Informationen in so genannten 
                    Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt.
                  </p>
                </div>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">2. Hosting und Dienstleister</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Firebase (Google LLC)</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Diese Website nutzt Firebase, einen Dienst von Google LLC. Firebase speichert 
                    Bestelldaten temporär für die Verarbeitung der Getränkebestellungen.
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-2">
                    <strong>Datenverarbeitungszweck:</strong> Verarbeitung von Bestellungen in Echtzeit<br/>
                    <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)<br/>
                    <strong>Speicherdauer:</strong> Bestellungen werden nach 24 Stunden automatisch gelöscht
                  </p>
                </div>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">3. Cookies</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Diese Website verwendet keine Cookies für Tracking-Zwecke. Es werden ausschließlich 
                technische Cookies für die Firebase-Funktionalität verwendet.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">4. Ihre Rechte als betroffene Person</h2>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Auskunftsrecht:</strong> Sie haben das Recht, Auskunft über die Sie betreffenden personenbezogenen Daten zu verlangen.</p>
                <p><strong>Recht auf Berichtigung:</strong> Sie haben das Recht, die Berichtigung unrichtiger personenbezogener Daten zu verlangen.</p>
                <p><strong>Recht auf Löschung:</strong> Sie haben das Recht, die Löschung Ihrer personenbezogenen Daten zu verlangen.</p>
                <p><strong>Widerspruchsrecht:</strong> Sie haben das Recht, der Verarbeitung Ihrer Daten zu widersprechen.</p>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">5. Datenanalyse</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Diese Website verwendet keine Analyse-Tools zur Erstellung von Nutzerprofilen. 
                Es finden keine automatisierten Entscheidungsprozesse statt.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">6. Speicherdauer</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Bestelldaten werden für 3 Tage gespeichert und können als Excel-Statistik exportiert werden. 
                Nach 3 Tagen werden die Daten automatisch gelöscht. Es findet keine dauerhafte Speicherung 
                personenbezogener Daten statt.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">7. Kontakt für Datenschutzfragen</h2>
              <div className="space-y-2">
                <p><strong>Dennis Heidenreich</strong></p>
                <p>PraesenzWert</p>
                <p>Josef-Martin-Weg 4</p>
                <p>53501 Grafschaft</p>
                <p>E-Mail: Kontakt@PraesenzWert.de</p>
                <p>Telefon: [Ihre Telefonnummer]</p>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">8. Rechtsgrundlage der Datenverarbeitung</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Rechtsgrundlage für die Verarbeitung von Bestelldaten ist Art. 6 Abs. 1 lit. b DSGVO 
                (Erfüllung des Vertrags über die Getränkebestellung).
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">9. Bewertungen und Kontaktformular</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Wenn Sie eine Bewertung abgeben oder das Kontaktformular nutzen, werden folgende Daten erhoben:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mt-2">
                <li>Bewertung (Sterne-Rating)</li>
                <li>Optional: Name und E-Mail-Adresse (nur bei Kontaktaufnahme)</li>
                <li>Zeitstempel der Bewertung</li>
              </ul>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                <strong>Zweck:</strong> Verbesserung unseres Services und Kontaktaufnahme auf Wunsch<br/>
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) bzw. lit. f DSGVO (berechtigtes Interesse)<br/>
                <strong>Speicherdauer:</strong> Bewertungen werden dauerhaft gespeichert, Kontaktdaten nur bei ausdrücklichem Wunsch
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">10. Progressive Web App (PWA)</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Diese Website kann als Progressive Web App (PWA) auf Ihrem Gerät installiert werden. 
                Die Installation erfolgt lokal auf Ihrem Gerät und überträgt keine zusätzlichen Daten an uns.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">11. SSL- bzw. TLS-Verschlüsselung</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte, 
                wie zum Beispiel Bestellungen oder Anfragen, die Sie an uns als Seitenbetreiber senden, eine 
                SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie daran, dass die 
                Adresszeile des Browsers von „http://" auf „https://" wechselt und an dem Schloss-Symbol in 
                Ihrer Browserzeile.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">12. Widerspruch gegen Werbe-E-Mails</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Der Nutzung von im Rahmen der Impressumspflicht veröffentlichten Kontaktdaten zur Übersendung 
                von nicht ausdrücklich angeforderter Werbung und Informationsmaterialien wird hiermit widersprochen. 
                Die Betreiber der Seiten behalten sich ausdrücklich rechtliche Schritte im Falle der unverlangten 
                Zusendung von Werbeinformationen, etwa durch Spam-E-Mails, vor.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">13. Datenübermittlung bei Vertragsschluss</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Wir übermitteln personenbezogene Daten an Dritte nur dann, wenn dies im Rahmen der Vertragsabwicklung 
                notwendig ist, etwa an das mit der Lieferung der Ware beauftragte Unternehmen oder das mit der 
                Zahlungsabwicklung beauftragte Kreditinstitut. Eine weitergehende Übermittlung der Daten erfolgt nicht 
                bzw. nur dann, wenn Sie der Übermittlung ausdrücklich zugestimmt haben.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">14. Datenschutzbeauftragter</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Verantwortlich für die Datenverarbeitung:<br/>
                <strong>Dennis Heidenreich</strong><br/>
                PräsenzWert<br/>
                Josef-Martin-Weg 4<br/>
                53501 Grafschaft<br/>
                E-Mail: Kontakt@PraesenzWert.de
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">15. Beschwerderecht bei der Aufsichtsbehörde</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein Beschwerderecht bei einer 
                Aufsichtsbehörde, insbesondere in dem Mitgliedstaat ihres gewöhnlichen Aufenthalts, ihres 
                Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes zu. Das Beschwerderecht besteht 
                unbeschadet anderweitiger verwaltungsrechtlicher oder gerichtlicher Rechtsbehelfe.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                <strong>Zuständige Aufsichtsbehörde:</strong><br/>
                Die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen<br/>
                Kavalleriestraße 2-4<br/>
                40213 Düsseldorf<br/>
                Telefon: 0211/38424-0<br/>
                E-Mail: poststelle@ldi.nrw.de
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">16. Recht auf Datenübertragbarkeit</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfüllung eines 
                Vertrags automatisiert verarbeiten, an sich oder an einen Dritten in einem gängigen, 
                maschinenlesbaren Format aushändigen zu lassen. Sofern Sie die direkte Übertragung der Daten 
                an einen anderen Verantwortlichen verlangen, erfolgt dies nur, soweit es technisch machbar ist.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">17. Haftungsausschluss</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. 
                Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich. Die 
                Datenverarbeitung erfolgt nach bestem Wissen und Gewissen. Eine Haftung für Schäden, die durch 
                die Nutzung der bereitgestellten Informationen entstehen, ist ausgeschlossen, soweit gesetzlich zulässig.
              </p>
            </section>
            
            <section className="border-t pt-4">
              <p className="text-sm text-gray-500 text-center">
                © 2026 PräsenzWert - Alle Rechte vorbehalten
              </p>
              <p className="text-xs text-gray-400 text-center mt-2">
                Stand: Januar 2026 | Letzte Aktualisierung: 19.01.2026
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default Datenschutz;
