import { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

const Impressum: NextPage = () => {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Impressum - Karneval Bestellsystem</title>
        <meta name="description" content="Impressum nach § 5 TMG" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => router.back()} 
            className="text-blue-600 hover:text-blue-800 mb-6 inline-block cursor-pointer"
          >
            ← Zurück
          </button>
          
          <h1 className="text-3xl font-bold mb-6">Impressum</h1>
          
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">Angaben gemäß § 5 TMG</h2>
              <div className="space-y-2">
                <p><strong>Dennis Heidenreich</strong></p>
                <p>PraesenzWert</p>
                <p>Josef-Martin-Weg 4</p>
                <p>53501 Grafschaft</p>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Kontakt</h2>
              <div className="space-y-2">
                <p><strong>E-Mail:</strong> Kontakt@PraesenzWert.de</p>
                <p><strong>Webseite:</strong> www.praesenzwert.de</p>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Bereitstellung der App und Verantwortlichkeit</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Diese App wird Veranstaltern zur eigenverantwortlichen Nutzung bereitgestellt. Für Inhalte,
                Preise, Bestellungen und die Durchführung der Veranstaltung ist der jeweilige Veranstalter
                verantwortlich. PräsenzWert stellt ausschließlich die technische Plattform zur Verfügung.
                Es werden durch diese App keine personenbezogenen Daten der Besteller gespeichert. Personen-
                bezogene Daten fallen nur an, wenn freiwillig über das Kontaktfeld eine Nachricht gesendet wird
                (Name und E-Mail) und werden ausschließlich zur Bearbeitung der Anfrage verwendet.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">EU-Streitschlichtung</h2>
              <p>
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
                <a href="https://ec.europa.eu/consumers/odr" className="text-blue-600 hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                  https://ec.europa.eu/consumers/odr
                </a>
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Verantwortlich für den Inhalt</h2>
              <div className="space-y-2">
                <p><strong>Dennis Heidenreich</strong></p>
                <p>PraesenzWert</p>
                <p>Josef-Martin-Weg 4, 53501 Grafschaft</p>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Haftung für Inhalte</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten 
                nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als 
                Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde 
                Informationen zu überwachen oder nach Umständen zu forschen, die auf rechtswidrige 
                Tätigkeiten hinweisen.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den 
                allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch 
                erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei 
                Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Haftung für Links</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen 
                Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. 
                Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der 
                Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche 
                Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete 
                Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen 
                werden wir derartige Links umgehend entfernen.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Urheberrecht</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten 
                unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung 
                und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der 
                schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien 
                dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die 
                Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. 
                Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen 
                entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte 
                umgehend entfernen.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Haftungsausschluss</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Die Nutzung dieser App erfolgt auf eigene Gefahr. Wir übernehmen keine Haftung für:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mt-2">
                <li>Die Richtigkeit, Vollständigkeit und Aktualität der bereitgestellten Informationen</li>
                <li>Technische Störungen, Ausfälle oder Datenverluste</li>
                <li>Schäden, die durch die Nutzung oder Nichtnutzung der App entstehen</li>
                <li>Fehlerhafte Bestellungen oder Übermittlungsfehler</li>
              </ul>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                Diese Haftungsbeschränkung gilt nicht bei Vorsatz oder grober Fahrlässigkeit sowie bei 
                Verletzung von Leben, Körper oder Gesundheit.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Kooperation</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Diese App wird präsentiert von PräsenzWert in Kooperation mit Dorfgarde Nierendorf.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Streitschlichtung</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
                Verbraucherschlichtungsstelle teilzunehmen.
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

export default Impressum;
