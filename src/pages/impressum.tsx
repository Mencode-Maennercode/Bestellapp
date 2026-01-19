import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

const Impressum: NextPage = () => {
  return (
    <>
      <Head>
        <title>Impressum - Karneval Bestellsystem</title>
        <meta name="description" content="Impressum nach § 5 TMG" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
            ← Zurück zur Startseite
          </Link>
          
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
                <p><strong>Telefon:</strong> [Ihre Telefonnummer]</p>
                <p><strong>E-Mail:</strong> Kontakt@PraesenzWert.de</p>
                <p><strong>Webseite:</strong> www.praesenzwert.de</p>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Umsatzsteuer-Identifikationsnummer</h2>
              <p>USt-IdNr.: folgt (in Bearbeitung)</p>
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
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Urheberrecht</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten 
                unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung 
                und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der 
                schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold mb-3">Kooperation</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Diese App wird präsentiert von PräsenzWert in Kooperation mit Dorfgarde Nierendorf.
              </p>
            </section>
            
            <section className="border-t pt-4">
              <p className="text-sm text-gray-500 text-center">
                © 2026 PräsenzWert - Alle Rechte vorbehalten
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default Impressum;
