import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  cta?: string;
  ctaLink?: string;
  bgGradient: string;
  image?: string;
}

const defaultBanners: Banner[] = [
  {
    id: '1',
    title: 'New Product Launch!',
    subtitle: 'Premium Quality Products Now Available',
    cta: 'Order Now',
    ctaLink: '/distributor-portal/create-primary-order',
    bgGradient: 'from-blue-600 via-blue-500 to-indigo-600',
  },
  {
    id: '2',
    title: 'Summer Scheme Active',
    subtitle: 'Get 10% extra margin on bulk orders',
    cta: 'View Schemes',
    ctaLink: '/distributor-portal/schemes',
    bgGradient: 'from-orange-500 via-amber-500 to-yellow-500',
  },
  {
    id: '3',
    title: 'Quick Delivery Guarantee',
    subtitle: 'Orders placed before 2 PM shipped same day',
    cta: 'Learn More',
    bgGradient: 'from-emerald-600 via-green-500 to-teal-500',
  },
];

interface AdBannerProps {
  banners?: Banner[];
  autoPlayInterval?: number;
}

export const AdBanner = ({ banners = defaultBanners, autoPlayInterval = 5000 }: AdBannerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [banners.length, autoPlayInterval]);

  if (dismissed || banners.length === 0) return null;

  const currentBanner = banners[currentIndex];

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg">
      <div 
        className={cn(
          "relative bg-gradient-to-r p-6 md:p-8 text-white transition-all duration-500",
          currentBanner.bgGradient
        )}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
        </div>

        {/* Close Button */}
        <button 
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div className="flex-1 space-y-2">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">
              {currentBanner.title}
            </h3>
            {currentBanner.subtitle && (
              <p className="text-white/90 text-sm md:text-base max-w-md">
                {currentBanner.subtitle}
              </p>
            )}
            {currentBanner.cta && (
              <Button 
                variant="secondary" 
                size="sm"
                className="mt-3 bg-white text-gray-900 hover:bg-white/90 shadow-md"
              >
                {currentBanner.cta}
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>

          {/* Navigation Dots */}
          {banners.length > 1 && (
            <div className="flex items-center gap-2">
              <button 
                onClick={goToPrev}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-1.5">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      idx === currentIndex ? "bg-white w-6" : "bg-white/40 hover:bg-white/60"
                    )}
                  />
                ))}
              </div>
              <button 
                onClick={goToNext}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
