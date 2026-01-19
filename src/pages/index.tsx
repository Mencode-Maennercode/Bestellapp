export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f1419 0%, #1a1f26 100%)' }}>
      <div className="text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-white text-2xl font-bold mb-2">Zugang verweigert</h1>
        <p className="text-gray-400">Bitte verwenden Sie den korrekten Zugangslink.</p>
      </div>
    </div>
  );
}
