import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { database, ref, push } from '@/lib/firebase';

interface PraesenzWertPopupProps {
  onClose: () => void;
}

export default function PraesenzWertPopup({ onClose }: PraesenzWertPopupProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      alert('Bitte gib eine Bewertung ab!');
      return;
    }

    setIsSubmitting(true);

    try {
      const ratingsRef = ref(database, 'ratings');
      await push(ratingsRef, {
        rating,
        name: name || 'Anonym',
        email: email || null,
        message: message || null,
        timestamp: Date.now(),
        source: 'tisch-app'
      });

      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Fehler beim Senden der Bewertung. Bitte versuche es später erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Image 
              src="/praesenzwert-logo.png" 
              alt="PräsenzWert" 
              width={60} 
              height={30}
              className="rounded"
            />
          </div>
          <h2 className="text-2xl font-bold">Wie gefällt dir die App?</h2>
          <p className="text-blue-100 text-sm mt-1">Dein Feedback hilft uns besser zu werden!</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-green-600 mb-2">Vielen Dank!</h3>
              <p className="text-gray-600">Deine Bewertung wurde gespeichert.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                  Bewertung *
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                    >
                      {star <= (hoveredRating || rating) ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-center text-sm text-gray-600 mt-2">
                    {rating === 5 && '🎉 Ausgezeichnet!'}
                    {rating === 4 && '😊 Sehr gut!'}
                    {rating === 3 && '👍 Gut!'}
                    {rating === 2 && '😐 Geht so'}
                    {rating === 1 && '😞 Nicht zufrieden'}
                  </p>
                )}
              </div>

              {/* Optional Contact Fields */}
              <div className="border-t pt-4">
                <p className="text-xs text-gray-600 mb-3 text-center">
                  Interesse die App bei deiner Veranstaltung selbst zu nutzen? Oder Interesse an eigener Software-Lösung? Gehe mit uns in Kontakt.
                </p>
                
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dein Name (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                />
                
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Deine E-Mail (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                />
                
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Deine Nachricht (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || rating === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? 'Wird gesendet...' : 'Bewertung absenden'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Präsentiert von{' '}
                <Link href="https://www.praesenzwert.de" target="_blank" className="text-blue-600 hover:underline">
                  PräsenzWert
                </Link>
                {' '}in Kooperation mit Dorfgarde Nierendorf
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
