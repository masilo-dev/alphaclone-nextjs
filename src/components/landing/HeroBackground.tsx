'use client';

export default function HeroBackground() {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-45"
        style={{ backgroundImage: "url('/marketing-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_45%,rgba(7,43,71,0.26)_0%,rgba(2,6,23,0.90)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/28 via-[#05162a]/54 to-[#072847]/92" />
    </div>
  );
}
