import Image from 'next/image';

type ProductScreenshotProps = {
  src: string;
  alt: string;
  caption?: string;
  priority?: boolean;
  className?: string;
};

/** Consistent product frame for marketing screenshots with download/drag protection. */
export default function ProductScreenshot({
  src,
  alt,
  caption,
  priority = false,
  className = '',
}: ProductScreenshotProps) {
  return (
    <figure
      className={`relative select-none ${className}`.trim()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="overflow-hidden rounded-[var(--marketing-radius-lg)] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] shadow-[var(--marketing-shadow-hero)] relative">
        <div className="flex items-center gap-1.5 border-b border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" aria-hidden="true" />
          <span className="ml-3 text-[11px] text-[var(--marketing-text-muted)]">
            AlphaClone workspace — demonstration data
          </span>
        </div>
        
        {/* Protected Image Area */}
        <div className="relative aspect-[16/10] w-full bg-[var(--marketing-bg-primary)] overflow-hidden">
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1100px"
            className="object-cover object-top pointer-events-none select-none"
            draggable={false}
          />
          {/* Transparent protection overlay to block right-click & drag */}
          <div
            className="absolute inset-0 z-10 bg-transparent"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-sm text-[var(--marketing-text-muted)]">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
