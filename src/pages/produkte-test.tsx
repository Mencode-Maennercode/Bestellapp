import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

const ProdukteTest: NextPage = () => {
  return (
    <>
      <Head>
        <title>Produkte & Preise - Test</title>
        <meta name="description" content="Test page for products" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
                ← Zurück zur Startseite
              </Link>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">🍺 Produkte & Preise</h1>
              <p className="text-gray-600">Test page - Produkte werden geladen...</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🧪</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Test-Modus</h3>
            <p className="text-gray-600">Die Produkte-Seite funktioniert!</p>
            <p className="text-sm text-gray-500 mt-4">
              Wenn du diese Seite siehst, ist das Routing in Ordnung.
              Das Problem liegt bei den Komponenten in der originalen produkte.tsx.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProdukteTest;
