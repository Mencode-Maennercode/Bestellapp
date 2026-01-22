import { useState, useRef, useEffect, useCallback } from 'react';
import { TablePlan } from '@/lib/settings';

interface TablePlanCarouselProps {
  tablePlans: TablePlan[];
  onClose: () => void;
}

// Helper to detect mobile device
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
};

export default function TablePlanCarousel({ tablePlans, onClose }: TablePlanCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [favoritePlanId, setFavoritePlanId] = useState<string | null>(null);
  const [swipeStart, setSwipeStart] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect mobile device
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Load favorite plan and saved zoom level from localStorage
  useEffect(() => {
    const savedFavorite = localStorage.getItem('favoritePlanId');
    if (savedFavorite) {
      setFavoritePlanId(savedFavorite);
      const favoriteIndex = tablePlans.findIndex(p => p.id === savedFavorite);
      if (favoriteIndex !== -1) {
        setCurrentIndex(favoriteIndex);
      }
    }
    
    // Load saved zoom level for mobile
    if (isMobileDevice()) {
      const savedZoom = localStorage.getItem('tablePlanZoomLevel');
      if (savedZoom) {
        const zoomValue = parseFloat(savedZoom);
        if (!isNaN(zoomValue) && zoomValue >= 0.5 && zoomValue <= 3) {
          setScale(zoomValue);
        }
      }
    }
  }, [tablePlans]);

  // Reset position when changing plans (but keep zoom level on mobile)
  useEffect(() => {
    if (!isMobile) {
      setScale(1);
    }
    setPosition({ x: 0, y: 0 });
  }, [currentIndex, isMobile]);

  // Save zoom level to localStorage when it changes (mobile only)
  useEffect(() => {
    if (isMobile) {
      localStorage.setItem('tablePlanZoomLevel', scale.toString());
    }
  }, [scale, isMobile]);

  // Zoom control functions
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.3, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    const newScale = scale * 0.7;
    if (newScale <= 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(newScale);
    }
  }, [scale]);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    if (isMobile) {
      localStorage.setItem('tablePlanZoomLevel', '1');
    }
  }, [isMobile]);

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

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Pinch-to-zoom with two fingers
    if (e.touches.length === 2) {
      e.preventDefault();
      setLastPinchDistance(getTouchDistance(e.touches));
      return;
    }
    
    // Single finger - swipe or drag
    if (e.touches.length === 1) {
      if (scale > 1) {
        // Drag when zoomed in
        setDragStart({ 
          x: e.touches[0].clientX - position.x, 
          y: e.touches[0].clientY - position.y 
        });
        setIsDragging(true);
      } else {
        // Swipe when not zoomed
        setSwipeStart(e.touches[0].clientX);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Pinch-to-zoom
    if (e.touches.length === 2 && lastPinchDistance !== null) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scaleFactor = currentDistance / lastPinchDistance;
      const newScale = Math.min(Math.max(0.5, scale * scaleFactor), 3);
      setScale(newScale);
      setLastPinchDistance(currentDistance);
      
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return;
    }
    
    // Single finger drag when zoomed
    if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Reset pinch tracking
    if (lastPinchDistance !== null) {
      setLastPinchDistance(null);
      return;
    }
    
    // Handle drag end
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    
    // Handle swipe
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
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
              className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
              title="Verkleinern"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleResetZoom(); }}
              className="px-2 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm font-medium min-w-[50px]"
              title="Zoom zurücksetzen"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
              className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
              title="Vergrößern"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
          </div>

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
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => { if (!isDragging && lastPinchDistance === null) onClose(); }}
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs bg-black/30 px-3 py-1 rounded-full text-center">
          {isMobile 
            ? '2 Finger zum Zoomen • Wischen zum Wechseln' 
            : 'Mausrad zum Zoomen • Wischen zum Wechseln • Klick zum Schließen'
          }
        </div>
      </div>
    </div>
  );
}
