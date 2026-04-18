'use client';

import { useEffect, useRef, useCallback } from 'react';

const ORBIT_NODES = [
  { isHub: true, hue: 174, size: 8 },
  { isHub: false, hue: 182, size: 4.2 },
  { isHub: false, hue: 168, size: 3.8 },
  { isHub: false, hue: 192, size: 3.6 },
  { isHub: false, hue: 158, size: 3.5 },
  { isHub: false, hue: 200, size: 3.4 },
  { isHub: false, hue: 210, size: 3.3 },
  { isHub: false, hue: 265, size: 3.2 },
  { isHub: false, hue: 42, size: 3.1 },
  { isHub: false, hue: 310, size: 3.0 },
  { isHub: false, hue: 235, size: 2.9 },
  { isHub: false, hue: 120, size: 2.8 },
];

const MAX_DIST_HUB = 360;
const MAX_DIST_PEER = 200;
const BRAND_SIG = 0xac1a; // deterministic micro-pattern seed (visual signature, not user-facing text)

interface ModuleNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isHub: boolean;
  hue: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
  opacity: number;
  connections: number[];
}

const NODE_SPEED = 0.03;
const PULSE_SPD = 0.0002;

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const moduleNodes = useRef<ModuleNode[]>([]);
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

  const initNodes = useCallback((w: number, h: number) => {
    let seed = BRAND_SIG;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    moduleNodes.current = ORBIT_NODES.map((m, i) => {
      const x = m.isHub
        ? w * 0.52 + (rnd() - 0.5) * 80
        : rnd() * w * 0.88 + w * 0.06;
      const y = m.isHub
        ? h * 0.42 + (rnd() - 0.5) * 80
        : rnd() * h * 0.82 + h * 0.08;
      return {
        x,
        y,
        vx: (rnd() - 0.5) * (m.isHub ? NODE_SPEED * 0.35 : NODE_SPEED),
        vy: (rnd() - 0.5) * (m.isHub ? NODE_SPEED * 0.35 : NODE_SPEED),
        isHub: m.isHub,
        hue: m.hue,
        radius: m.size,
        pulsePhase: (i / ORBIT_NODES.length) * Math.PI * 2,
        pulseSpeed: PULSE_SPD + rnd() * 0.003,
        opacity: m.isHub ? 1 : 0.72 + rnd() * 0.22,
        connections: [],
      };
    });
  }, []);

  const buildConnections = useCallback((nodes: ModuleNode[]) => {
    for (const n of nodes) n.connections = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const threshold = nodes[i].isHub || nodes[j].isHub ? MAX_DIST_HUB : MAX_DIST_PEER;
        if (dist < threshold) {
          nodes[i].connections.push(j);
          nodes[j].connections.push(i);
        }
      }
    }
  }, []);

  const draw = useCallback(
    function drawFrame() {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const { w, h } = dimRef.current;
      if (!w || !h) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const mnodes = moduleNodes.current;
      for (const n of mnodes) {
        n.pulsePhase += n.pulseSpeed;
      }

      buildConnections(mnodes);

      for (let i = 0; i < mnodes.length; i++) {
        const a = mnodes[i];
        for (const j of a.connections) {
          if (j <= i) continue;
          const b = mnodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxD = a.isHub || b.isHub ? MAX_DIST_HUB : MAX_DIST_PEER;
          const alpha = (1 - dist / maxD) * (a.isHub || b.isHub ? 0.26 : 0.14);
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `hsla(${a.hue}, 88%, 62%, ${alpha})`);
          grad.addColorStop(1, `hsla(${b.hue}, 88%, 62%, ${alpha})`);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = a.isHub || b.isHub ? 1.1 : 0.65;
          ctx.stroke();
        }
      }

      const t = Date.now() / 1000;
      for (let gx = 0; gx < w; gx += 140) {
        for (let gy = 0; gy < h; gy += 140) {
          const v = ((gx ^ gy ^ BRAND_SIG) % 7) * 0.012;
          ctx.fillStyle = `rgba(20, 184, 166, ${0.02 + v})`;
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      for (const n of mnodes) {
        const pulse = 0.85 + Math.sin(n.pulsePhase) * 0.15;
        const r = n.radius * pulse;
        const alpha = n.opacity * pulse;

        if (n.isHub) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 2.8, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${n.hue}, 90%, 60%, ${alpha * 0.18})`;
          ctx.setLineDash([3, 6]);
          ctx.lineWidth = 0.6;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const glowR = n.isHub ? r * 8.5 : r * 5.5;
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        glow.addColorStop(0, `hsla(${n.hue}, 90%, 68%, ${alpha * (n.isHub ? 0.48 : 0.28)})`);
        glow.addColorStop(1, `hsla(${n.hue}, 90%, 68%, 0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        const core = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
        core.addColorStop(0, `hsla(${n.hue}, 100%, 92%, ${alpha})`);
        core.addColorStop(1, `hsla(${n.hue}, 78%, 52%, ${alpha * 0.82})`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();
      }

      const scanPos = (Date.now() % 5200) / 5200;
      const y = scanPos * h;
      const wave = Math.sin(t * 0.6 + scanPos * 6) * 14;
      ctx.beginPath();
      ctx.moveTo(0, y + wave);
      ctx.lineTo(w, y - wave * 0.5);
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.045)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      rafRef.current = requestAnimationFrame(drawFrame);
    },
    [buildConnections]
  );

  useEffect(() => {
    resize();
    const { w, h } = dimRef.current;
    initNodes(w, h);
    rafRef.current = requestAnimationFrame(draw);

    const onResize = () => {
      resize();
      const { w: nw, h: nh } = dimRef.current;
      initNodes(nw, nh);
    };

    const onVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible';
    };

    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resize, initNodes, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
