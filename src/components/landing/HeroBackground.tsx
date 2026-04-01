'use client';

import { useEffect, useRef, useCallback } from 'react';

// --- Types ---
interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
  hue: number;
  opacity: number;
  connections: number[];
}

interface DataPacket {
  fromNode: number;
  toNode: number;
  progress: number; // 0..1
  speed: number;
  hue: number;
  size: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  hue: number;
}

const NODE_COUNT = 55;
const MAX_CONNECT_DIST = 200;
const PACKET_COUNT = 20;
const PARTICLE_COUNT = 40;

// --- Factory helpers ---
function makeNode(w: number, h: number): Node {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.08,
    vy: (Math.random() - 0.5) * 0.08,
    radius: 1.5 + Math.random() * 3,
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.005 + Math.random() * 0.008,
    hue: Math.random() > 0.6 ? 185 + Math.random() * 20 : 210 + Math.random() * 25,
    opacity: 0.5 + Math.random() * 0.5,
    connections: [],
  };
}

function makePacket(nodes: Node[]): DataPacket {
  const from = Math.floor(Math.random() * nodes.length);
  let to = Math.floor(Math.random() * nodes.length);
  while (to === from) to = Math.floor(Math.random() * nodes.length);
  return {
    fromNode: from,
    toNode: to,
    progress: Math.random(),
    speed: 0.001 + Math.random() * 0.002,
    hue: Math.random() > 0.5 ? 180 + Math.random() * 20 : 200 + Math.random() * 30,
    size: 1.5 + Math.random() * 2,
  };
}

function makeParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.1,
    vy: (Math.random() - 0.5) * 0.1 - 0.04,
    life: 0,
    maxLife: 300 + Math.random() * 600,
    radius: 0.6 + Math.random() * 1.4,
    hue: 185 + Math.random() * 35,
  };
}

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const packetsRef = useRef<DataPacket[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const visibleRef = useRef(true);
  const dimRef = useRef({ w: 0, h: 0 });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    dimRef.current = { w, h };
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  const buildConnections = useCallback((nodes: Node[], threshold: number) => {
    for (const n of nodes) n.connections = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          nodes[i].connections.push(j);
          nodes[j].connections.push(i);
        }
      }
    }
  }, []);

  const draw = useCallback(function drawFrame() {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(drawFrame); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dimRef.current;
    if (!w || !h) { rafRef.current = requestAnimationFrame(drawFrame); return; }

    ctx.clearRect(0, 0, w, h);

    if (!visibleRef.current) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const nodes = nodesRef.current;
    const packets = packetsRef.current;
    const particles = particlesRef.current;

    // ── 1. Move & bounce nodes ──────────────────────────────────────────
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
      n.pulsePhase += n.pulseSpeed;
    }

    // Rebuild connections every frame (nodes move slowly)
    buildConnections(nodes, MAX_CONNECT_DIST);

    // ── 2. Draw connection lines ────────────────────────────────────────
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (const j of a.connections) {
        if (j <= i) continue;
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const alpha = (1 - dist / MAX_CONNECT_DIST) * 0.18;

        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, `hsla(${a.hue}, 85%, 65%, ${alpha})`);
        grad.addColorStop(1, `hsla(${b.hue}, 85%, 65%, ${alpha})`);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // ── 3. Draw nodes ──────────────────────────────────────────────────
    for (const n of nodes) {
      const pulse = 0.7 + Math.sin(n.pulsePhase) * 0.3;
      const r = n.radius * pulse;
      const alpha = n.opacity * pulse;

      // Outer glow
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5);
      glow.addColorStop(0, `hsla(${n.hue}, 90%, 70%, ${alpha * 0.35})`);
      glow.addColorStop(1, `hsla(${n.hue}, 90%, 70%, 0)`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Core node
      const core = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
      core.addColorStop(0, `hsla(${n.hue}, 100%, 90%, ${alpha})`);
      core.addColorStop(1, `hsla(${n.hue}, 80%, 55%, ${alpha * 0.7})`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
    }

    // ── 4. Animate data packets ────────────────────────────────────────
    for (const pkt of packets) {
      pkt.progress += pkt.speed;
      if (pkt.progress > 1) {
        // Reassign to a new route
        const from = Math.floor(Math.random() * nodes.length);
        let to = Math.floor(Math.random() * nodes.length);
        while (to === from) to = Math.floor(Math.random() * nodes.length);
        pkt.fromNode = from;
        pkt.toNode = to;
        pkt.progress = 0;
        pkt.hue = Math.random() > 0.5 ? 180 + Math.random() * 20 : 200 + Math.random() * 30;
      }

      const a = nodes[pkt.fromNode];
      const b = nodes[pkt.toNode];
      const px = a.x + (b.x - a.x) * pkt.progress;
      const py = a.y + (b.y - a.y) * pkt.progress;

      // Fade in/out
      const fade = pkt.progress < 0.1 ? pkt.progress / 0.1 : pkt.progress > 0.85 ? (1 - pkt.progress) / 0.15 : 1;

      const pGlow = ctx.createRadialGradient(px, py, 0, px, py, pkt.size * 4);
      pGlow.addColorStop(0, `hsla(${pkt.hue}, 100%, 80%, ${0.9 * fade})`);
      pGlow.addColorStop(1, `hsla(${pkt.hue}, 100%, 80%, 0)`);
      ctx.beginPath();
      ctx.arc(px, py, pkt.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = pGlow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, pkt.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${pkt.hue}, 100%, 90%, ${fade})`;
      ctx.fill();
    }

    // ── 5. Ambient particles ───────────────────────────────────────────
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      const ratio = p.life / p.maxLife;
      const fade = ratio < 0.15 ? ratio / 0.15 : ratio > 0.75 ? (1 - ratio) / 0.25 : 1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${0.45 * fade})`;
      ctx.fill();

      if (p.life >= p.maxLife || p.y < -20 || p.x < -20 || p.x > w + 20) {
        particles[i] = makeParticle(w, h);
      }
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [buildConnections]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resize();
    const { w, h } = dimRef.current;

    nodesRef.current = Array.from({ length: NODE_COUNT }, () => makeNode(w, h));
    packetsRef.current = Array.from({ length: PACKET_COUNT }, () => makePacket(nodesRef.current));
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(w, h));
    buildConnections(nodesRef.current, MAX_CONNECT_DIST);

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0.01 }
    );
    observer.observe(canvas);
    window.addEventListener('resize', resize, { passive: true });
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [draw, resize, buildConnections]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #020D1A 0%, #041525 40%, #020D1A 100%)' }}>
      {/* Radial ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute rounded-full blur-[120px] opacity-20"
          style={{ width: '60%', height: '70%', top: '-20%', left: '-10%', background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)' }}
        />
        <div
          className="absolute rounded-full blur-[140px] opacity-15"
          style={{ width: '50%', height: '60%', bottom: '-15%', right: '-5%', background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />
        <div
          className="absolute rounded-full blur-[100px] opacity-10"
          style={{ width: '40%', height: '50%', top: '30%', left: '30%', background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
        />
      </div>

      {/* Network canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(2,13,26,0.7) 100%)' }}
      />

      {/* Bottom fade to body */}
      <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to top, #020D1A, transparent)' }}
      />
    </div>
  );
}
