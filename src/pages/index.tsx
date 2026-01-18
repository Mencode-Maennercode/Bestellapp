import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-evm-green flex flex-col items-center justify-center p-8">
      <div className="text-center text-white mb-12">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">🎭 Fastelovend 2026</h1>
        <p className="text-xl opacity-90">Bestellsystem</p>
      </div>
      
      <div className="grid gap-6 w-full max-w-md">
        <Link href="/bar" className="btn-secondary text-center text-2xl py-6">
          🍺 Theke / Bar
        </Link>
      </div>
      
      <p className="text-white/60 mt-12 text-sm">
        Gäste scannen den QR-Code am Tisch
      </p>
    </div>
  );
}
