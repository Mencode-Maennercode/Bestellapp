import Image from 'next/image';
import Link from 'next/link';

export default function PraesenzWertBanner() {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-500 py-1.5 px-3">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center gap-2 text-center">
          <Link href="https://www.praesenzwert.de" target="_blank" rel="noopener noreferrer">
            <Image 
              src="/praesenzwert-logo.png" 
              alt="PräsenzWert" 
              width={50} 
              height={25}
              className="hover:opacity-80 transition-opacity"
            />
          </Link>
          <p className="text-xs text-white">
            Präsentiert von{' '}
            <Link 
              href="https://www.praesenzwert.de" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-blue-100"
            >
              PräsenzWert
            </Link>
            {' '}× Dorfgarde Nierendorf
          </p>
        </div>
      </div>
    </div>
  );
}
