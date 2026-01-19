import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-4 px-4 mt-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center text-sm">
        <div className="mb-2 sm:mb-0">
          © 2026 Karneval Bestellsystem
        </div>
        <div className="flex space-x-4">
          <Link href="/impressum" className="hover:text-gray-300 transition-colors">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-gray-300 transition-colors">
            Datenschutz
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
