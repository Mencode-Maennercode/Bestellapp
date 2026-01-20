import { useState, useRef, useEffect } from 'react';
import { TablePlan } from '@/lib/settings';

interface TablePlanCarouselProps {
  tablePlans: TablePlan[];
  onClose: () => void;
}

export default function TablePlanCarousel({ tablePlans, onClose }: TablePlanCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [favoritePlanId, setFavoritePlanId] = useState<string | null>(null);
  const [swipeStart, setSwipeStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load favorite plan from localStorage
  useEffect(() => {
    const savedFavorite = localStorage.getItem('favoritePlanId');
    if (savedFavorite) {
      setFavoritePlanId(savedFavorite);
      const favoriteIndex = tablePlans.findIndex(p => p.id === savedFavorite);
      if (favoriteIndex !== -1) {
        setCurrentIndex(favoriteIndex);
      }
    }
  }, [tablePlans]);

  // Reset zoom when changing plans
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const handleSetFavorite = (planId: string) => {
    setFavoritePlanId(planId);
    localStorage.setItem('favoritePlanId', planId);
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left' && currentIndex < tablePlans.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (direction === 'right' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1) return;
    setSwipeStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStart === null || scale > 1) return;
    const swipeEnd = e.changedTouches[0].clientX;
    const diff = swipeStart - swipeEnd;
    if (Math.abs(diff) > 50) {
      handleSwipe(diff > 0 ? 'left' : 'right');
    }
    setSwipeStart(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.5, scale * delta), 3);
    setScale(newScale);
    if (newScale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.stopPropagation();
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.stopPropagation();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const currentPlan = tablePlans[currentIndex];
  if (!currentPlan) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <div 
        className="relative w-[90vw] max-w-6xl h-[85vh] bg-gradient-to-br from-gray-900/95 to-gray-800/95 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Plan Selector */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black/30 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-4">
          {/* Plan Tabs - NO nested buttons */}
          <div className="flex items-center gap-2 flex-1 overflow-x-auto">
            {tablePlans.map((plan, index) => (
              <div
                key={plan.id}
                onClick={() => setCurrentIndex(index)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  index === currentIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                <span>Plan {index + 1}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetFavorite(plan.id);
                  }}
                  className={`text-lg transition-all cursor-pointer ${
                    favoritePlanId === plan.id
                      ? 'text-yellow-400 hover:text-yellow-300'
                      : 'text-white/30 hover:text-yellow-400'
                  }`}
                  title={favoritePlanId === plan.id ? 'Favorit' : 'Als Favorit markieren'}
                >
                  {favoritePlanId === plan.id ? '★' : '☆'}
                </span>
              </div>
            ))}
          </div>
          
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl leading-none transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Image Container with Swipe */}
        <div 
          ref={containerRef}
          className="w-full h-full pt-16 pb-4 px-8"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={onClose}
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={currentPlan.image}
              alt={`Tischplan ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              draggable={false}
            />
          </div>
        </div>

        {/* Navigation Arrows */}
        {tablePlans.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handleSwipe('right'); }}
              disabled={currentIndex === 0}
              className={`absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-md text-white text-2xl rounded-full transition-all ${
                currentIndex === 0 ? 'opacity-30' : 'hover:bg-white/20 hover:scale-110'
              }`}
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleSwipe('left'); }}
              disabled={currentIndex === tablePlans.length - 1}
              className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-md text-white text-2xl rounded-full transition-all ${
                currentIndex === tablePlans.length - 1 ? 'opacity-30' : 'hover:bg-white/20 hover:scale-110'
              }`}
            >
              ›
            </button>
          </>
        )}

        {/* Bottom hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs bg-black/30 px-3 py-1 rounded-full">
          Wischen zum Wechseln • Klick zum Schließen
        </div>
      </div>
    </div>
  );
}
