import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

const Datenschutz: NextPage = () => {
  return (
    <>
      <Head>
        <title>Datenschutzerklärung - Karneval Bestellsystem</title>
        <meta name="description" content="Datenschutzerklärung nach DSGVO" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
            ← Zurück zur Startseite
          </Link>
          
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
          </div>
        </div>
      </div>
    </>
  );
};

export default Datenschutz;
