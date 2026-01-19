import Image from 'next/image';
import Link from 'next/link';

export default function PraesenzWertBanner() {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-t-2 border-blue-200 py-4 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center md:text-left">
          <div className="flex-shrink-0">
            <Link href="https://www.praesenzwert.de" target="_blank" rel="noopener noreferrer">
              <Image 
                src="/praesenzwert-logo.png" 
                alt="PräsenzWert Logo" 
                width={120} 
                height={60}
                className="hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700 leading-relaxed">
              Diese App wird präsentiert von{' '}
              <Link 
                href="https://www.praesenzwert.de" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 hover:text-blue-800 underline"
              >
                PräsenzWert
              </Link>
              {' '}in Kooperation mit{' '}
              <span className="font-semibold text-purple-600">Dorfgarde Nierendorf</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
