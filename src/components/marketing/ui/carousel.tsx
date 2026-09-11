'use client';

import * as React from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketingTestimonial } from '@/config/marketingTestimonials';

type CarouselApi = UseEmblaCarouselType[1];

type CarouselProps = {
  opts?: Parameters<typeof useEmblaCarousel>[0];
  plugins?: Parameters<typeof useEmblaCarousel>[1];
  orientation?: 'horizontal' | 'vertical';
  setApi?: (api: CarouselApi) => void;
} & React.HTMLAttributes<HTMLDivElement>;

const CarouselContext = React.createContext<{
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: CarouselApi;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) {
    throw new Error('useCarousel must be used within a <Carousel />');
  }
  return context;
}

const Carousel = React.forwardRef<HTMLDivElement, CarouselProps>(
  ({ orientation = 'horizontal', opts, setApi, plugins, className, children, ...props }, ref) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === 'horizontal' ? 'x' : 'y',
      },
      plugins
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
    const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);

    React.useEffect(() => {
      if (!api) return;
      setApi?.(api);
      const onSelect = () => {
        setCanScrollPrev(api.canScrollPrev());
        setCanScrollNext(api.canScrollNext());
      };
      onSelect();
      api.on('reInit', onSelect);
      api.on('select', onSelect);
      return () => {
        api.off('reInit', onSelect);
        api.off('select', onSelect);
      };
    }, [api, setApi]);

    return (
      <CarouselContext.Provider
        value={{ carouselRef, api: api ?? undefined, scrollPrev, scrollNext, canScrollPrev, canScrollNext }}
      >
        <div ref={ref} className={cn('relative', className)} {...props}>
          {children}
        </div>
      </CarouselContext.Provider>
    );
  }
);
Carousel.displayName = 'Carousel';

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef } = useCarousel();
    return (
      <div ref={carouselRef} className="overflow-hidden">
        <div ref={ref} className={cn('flex', className)} {...props} />
      </div>
    );
  }
);
CarouselContent.displayName = 'CarouselContent';

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('min-w-0 shrink-0 grow-0 basis-full', className)} {...props} />
  )
);
CarouselItem.displayName = 'CarouselItem';

const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { scrollPrev, canScrollPrev } = useCarousel();
    return (
      <button
        ref={ref}
        type="button"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        className={cn(
          'absolute left-0 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-700/80 bg-slate-950/90 text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-30',
          className
        )}
        aria-label="Previous slide"
        {...props}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
    );
  }
);
CarouselPrevious.displayName = 'CarouselPrevious';

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { scrollNext, canScrollNext } = useCarousel();
    return (
      <button
        ref={ref}
        type="button"
        onClick={scrollNext}
        disabled={!canScrollNext}
        className={cn(
          'absolute right-0 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-700/80 bg-slate-950/90 text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-30',
          className
        )}
        aria-label="Next slide"
        {...props}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    );
  }
);
CarouselNext.displayName = 'CarouselNext';

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
};

type MarketingTestimonialsCarouselProps = {
  items: MarketingTestimonial[];
  className?: string;
  /** Short disclaimer shown under the carousel */
  disclaimer?: string;
};

export function MarketingTestimonialsCarousel({
  items,
  className,
  disclaimer = 'Representative scenarios from teams like yours — not paid endorsements. Share your story at sales@alphaclonesystems.com.',
}: MarketingTestimonialsCarouselProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <Carousel className="mx-auto w-full max-w-4xl px-12" opts={{ align: 'start', loop: true }}>
        <CarouselContent>
          {items.map((item) => (
            <CarouselItem key={item.quote.slice(0, 48)}>
              <article className="rounded-2xl border border-slate-800/80 bg-slate-950/50 px-6 py-8 sm:px-10 sm:py-10 text-center marketing-shadow-md">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Typical outcome · {item.outcome}
                </p>
                <blockquote className="text-lg sm:text-xl text-slate-200 leading-relaxed">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <cite className="mt-6 block text-sm font-semibold not-italic text-cyan-400">{item.persona}</cite>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-1 sm:left-0" />
        <CarouselNext className="-right-1 sm:right-0" />
      </Carousel>
      <p className="text-center text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed">{disclaimer}</p>
    </div>
  );
}
