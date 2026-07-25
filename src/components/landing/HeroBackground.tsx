'use client';

/** Legacy hero photo backgrounds removed — solid canvas only. */
export default function HeroBackground() {
  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none bg-[#041027]"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
