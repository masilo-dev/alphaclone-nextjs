'use client';

<<<<<<< HEAD
/** Legacy hero photo backgrounds removed — solid canvas only. */
export default function HeroBackground() {
  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none bg-[#041027]"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
=======
export default function HeroBackground() {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-62"
        style={{ backgroundImage: "url('/marketing-bg-v2.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_45%,rgba(7,43,71,0.08)_0%,rgba(2,6,23,0.52)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/6 via-[#05162a]/22 to-[#072847]/34" />
    </div>
>>>>>>> origin/main
  );
}
