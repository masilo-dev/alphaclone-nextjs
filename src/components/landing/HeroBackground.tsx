'use client';

import { useEffect, useRef, useCallback } from 'react';

// ── Module definitions ─────────────────────────────────────────────────────
const MODULES = [
  { label: 'AlphaClone OS', isHub: true,  hue: 180, size: 7 },
  { label: 'AI Agent',      isHub: false, hue: 270, size: 4.5 },
  { label: 'CRM',           isHub: false, hue: 185, size: 4 },
  { label: 'Lead Finder',   isHub: false, hue: 195, size: 3.5 },
  { label: 'Projects',      isHub: false, hue: 210, size: 3.5 },
  { label: 'Finance',       isHub: false, hue: 155, size: 3.5 },
  { label: 'Analytics',     isHub: false, hue: 220, size: 3.5 },
  { label: 'Security',      isHub: false, hue: 0,   size: 3.5 },
  { label: 'Automation',    isHub: false, hue: 285, size: 3.5 },
  { label: 'Contracts',     isHub: false, hue: 42,  size: 3 },
  { label: 'Mail',          isHub: false, hue: 200, size: 3 },
  { label: 'Calendar',      isHub: false, hue: 170, size: 3 },
  { label: 'Social Media',  isHub: false, hue: 315, size: 3 },
  { label: 'Video Calls',   isHub: false, hue: 235, size: 3 },
  { label: 'Documents',     isHub: false, hue: 58,  size: 3 },
  { label: 'Invoices',      isHub: false, hue: 140, size: 3 },
];

const AMBIENT_COUNT  = 22;   // extra ghost nodes (no label)
const MAX_DIST_HUB   = 380;  // hub connects to anything within this
const MAX_DIST_PEER  = 220;  // peer-to-peer connection distance
const PACKET_COUNT   = 18;

interface ModuleNode {
  x: number; y: number;
  vx: number; vy: number;
  label: string;
  isHub: boolean;
  hue: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
  opacity: number;
  connections: number[];
}

interface AmbientNode {
  x: number; y: number;
  vx: number; vy: number;
  hue: number;
  radius: number;
  pulsePhase: number;
  opacity: number;
}

interface DataPacket {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  hue: number;
  size: number;
  nodeType: 'module' | 'ambient';
}

// ── Speed constants ────────────────────────────────────────────────────────
const NODE_SPEED   = 0.42;  // named module nodes — fast
const AMBIENT_SPD  = 0.03;  // background ghost dots — very slow
const PULSE_SPD    = 0.008;
const PKT_SPEED    = 0.0022; // packet travel speed

export default function HeroBackground() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const moduleNodes = useRef<ModuleNode[]>([]);
  const ambientNodes = useRef<AmbientNode[]>([]);
  const packets     = useRef<DataPacket[]>([]);
  const visibleRef  = useRef(true);
  const dimRef      = useRef({ w: 0, h: 0 });

  // ── Resize ─────────────────────────────────────────────────────────────
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    dimRef.current = { w, h };
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // ── Initialise module nodes ─────────────────────────────────────────────
  const initNodes = useCallback((w: number, h: number) => {
    moduleNodes.current = MODULES.map((m, i) => {
      // Hub starts roughly centred
      const x = m.isHub
        ? w * 0.5 + (Math.random() - 0.5) * 60
        : Math.random() * w * 0.9 + w * 0.05;
      const y = m.isHub
        ? h * 0.45 + (Math.random() - 0.5) * 60
        : Math.random() * h * 0.85 + h * 0.07;
      return {
        x, y,
        vx: (Math.random() - 0.5) * (m.isHub ? NODE_SPEED * 0.4 : NODE_SPEED),
        vy: (Math.random() - 0.5) * (m.isHub ? NODE_SPEED * 0.4 : NODE_SPEED),
        label: m.label,
        isHub: m.isHub,
        hue: m.hue,
        radius: m.size,
        pulsePhase: (i / MODULES.length) * Math.PI * 2,
        pulseSpeed: PULSE_SPD + Math.random() * 0.004,
        opacity: m.isHub ? 1 : 0.75 + Math.random() * 0.25,
        connections: [],
      };
    });

    ambientNodes.current = Array.from({ length: AMBIENT_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * AMBIENT_SPD,
      vy: (Math.random() - 0.5) * AMBIENT_SPD,
      hue: 180 + Math.random() * 60,
      radius: 1 + Math.random() * 2,
      pulsePhase: Math.random() * Math.PI * 2,
      opacity: 0.2 + Math.random() * 0.3,
    }));
  }, []);

  // ── Build connection graph ──────────────────────────────────────────────
  const buildConnections = useCallback((nodes: ModuleNode[]) => {
    for (const n of nodes) n.connections = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Hub connects to everything nearby; peers connect to close neighbours
        const threshold = (nodes[i].isHub || nodes[j].isHub) ? MAX_DIST_HUB : MAX_DIST_PEER;
        if (dist < threshold) {
          nodes[i].connections.push(j);
          nodes[j].connections.push(i);
        }
      }
    }
  }, []);

  // ── Spawn packets ───────────────────────────────────────────────────────
  const spawnPacket = useCallback((nodes: ModuleNode[]): DataPacket => {
    const from = Math.floor(Math.random() * nodes.length);
    let to = Math.floor(Math.random() * nodes.length);
    while (to === from) to = Math.floor(Math.random() * nodes.length);
    return {
      fromIdx: from, toIdx: to,
      progress: Math.random(),
      speed: PKT_SPEED + Math.random() * 0.001,
      hue: nodes[from].hue,
      size: 1.5 + Math.random() * 2,
      nodeType: 'module',
    };
  }, []);

  // ── Main draw loop ──────────────────────────────────────────────────────
  const draw = useCallback(function drawFrame() {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(drawFrame); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx)   { rafRef.current = requestAnimationFrame(drawFrame); return; }

    const { w, h } = dimRef.current;
    if (!w || !h) { rafRef.current = requestAnimationFrame(drawFrame); return; }

    ctx.clearRect(0, 0, w, h);

    if (!visibleRef.current) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const mnodes = moduleNodes.current;
    const anodes = ambientNodes.current;
    const pkts   = packets.current;

    // ── 1. Move module nodes ──────────────────────────────────────────────
    for (const n of mnodes) {
      n.x += n.vx;
      n.y += n.vy;
      const margin = 80;
      if (n.x < margin || n.x > w - margin) n.vx *= -1;
      if (n.y < margin || n.y > h - margin) n.vy *= -1;
      n.pulsePhase += n.pulseSpeed;
    }

    // ── 2. Move ambient nodes ─────────────────────────────────────────────
    for (const a of anodes) {
      a.x += a.vx;
      a.y += a.vy;
      if (a.x < 0 || a.x > w) a.vx *= -1;
      if (a.y < 0 || a.y > h) a.vy *= -1;
      a.pulsePhase += 0.006;
    }

    // ── 3. Rebuild connections ────────────────────────────────────────────
    buildConnections(mnodes);

    // ── 4. Draw ambient node soft glow (background layer) ────────────────
    for (const a of anodes) {
      const pulse = 0.8 + Math.sin(a.pulsePhase) * 0.2;
      const r = a.radius * pulse;
      const glow = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r * 6);
      glow.addColorStop(0, `hsla(${a.hue}, 70%, 65%, ${a.opacity * 0.4})`);
      glow.addColorStop(1, `hsla(${a.hue}, 70%, 65%, 0)`);
      ctx.beginPath();
      ctx.arc(a.x, a.y, r * 6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // ── 5. Draw connection lines ──────────────────────────────────────────
    for (let i = 0; i < mnodes.length; i++) {
      const a = mnodes[i];
      for (const j of a.connections) {
        if (j <= i) continue;
        const b = mnodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxD = (a.isHub || b.isHub) ? MAX_DIST_HUB : MAX_DIST_PEER;
        const alpha = (1 - dist / maxD) * (a.isHub || b.isHub ? 0.28 : 0.16);

        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, `hsla(${a.hue}, 90%, 65%, ${alpha})`);
        grad.addColorStop(1, `hsla(${b.hue}, 90%, 65%, ${alpha})`);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = a.isHub || b.isHub ? 1.2 : 0.7;
        ctx.stroke();
      }
    }

    // ── 6. Draw data packets along lines ─────────────────────────────────
    for (const pkt of pkts) {
      pkt.progress += pkt.speed;
      if (pkt.progress > 1) {
        // re-route
        const from = Math.floor(Math.random() * mnodes.length);
        let to = Math.floor(Math.random() * mnodes.length);
        while (to === from) to = Math.floor(Math.random() * mnodes.length);
        pkt.fromIdx   = from;
        pkt.toIdx     = to;
        pkt.progress  = 0;
        pkt.hue       = mnodes[from].hue;
      }
      const a = mnodes[pkt.fromIdx];
      const b = mnodes[pkt.toIdx];
      const px = a.x + (b.x - a.x) * pkt.progress;
      const py = a.y + (b.y - a.y) * pkt.progress;

      // Packet glow
      const pg = ctx.createRadialGradient(px, py, 0, px, py, pkt.size * 5);
      pg.addColorStop(0, `hsla(${pkt.hue}, 100%, 75%, 0.6)`);
      pg.addColorStop(1, `hsla(${pkt.hue}, 100%, 75%, 0)`);
      ctx.beginPath();
      ctx.arc(px, py, pkt.size * 5, 0, Math.PI * 2);
      ctx.fillStyle = pg;
      ctx.fill();

      // Packet core
      ctx.beginPath();
      ctx.arc(px, py, pkt.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${pkt.hue}, 100%, 80%, 0.9)`;
      ctx.fill();
    }

    // ── 7. Draw module nodes ──────────────────────────────────────────────
    for (const n of mnodes) {
      const pulse = 0.85 + Math.sin(n.pulsePhase) * 0.15;
      const r = n.radius * pulse;
      const alpha = n.opacity * pulse;

      // JARVIS HUD EFFECT: Drawing rotating rings around nodes
      if (n.isHub || Math.random() > 0.8) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${n.hue}, 90%, 65%, ${alpha * 0.2})`;
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.setLineDash([]);

        // HUD Text Readout (Subtle)
        if (n.isHub && Math.random() > 0.5) {
            ctx.fillStyle = `hsla(${n.hue}, 90%, 80%, ${alpha * 0.4})`;
            ctx.font = '7px JetBrains Mono, monospace';
            ctx.fillText('OS_ACTIVE_SYS_STABLE', n.x + r * 4, n.y - r * 4);
        }
      }

      // Outer glow — hub gets a much larger aura
      const glowR = n.isHub ? r * 9 : r * 6;
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      glow.addColorStop(0, `hsla(${n.hue}, 90%, 70%, ${alpha * (n.isHub ? 0.5 : 0.3)})`);
      glow.addColorStop(1, `hsla(${n.hue}, 90%, 70%, 0)`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Core
      const core = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
      core.addColorStop(0, `hsla(${n.hue}, 100%, 92%, ${alpha})`);
      core.addColorStop(1, `hsla(${n.hue}, 80%, 55%, ${alpha * 0.8})`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // ── 8. Draw node labels ─────────────────────────────────────────────
      const labelAlpha = alpha * (n.isHub ? 1 : 0.82);
      const fontSize = n.isHub ? 11 : 9;
      ctx.font = `${n.isHub ? 700 : 500} ${fontSize}px Inter, system-ui, sans-serif`;

      const textY = n.y + r + fontSize + 3;

      // Label backing pill
      const tw = ctx.measureText(n.label).width;
      const pw = tw + 10; const ph = fontSize + 6;
      const px2 = n.x - pw / 2; const py2 = textY - fontSize - 1;
      ctx.beginPath();
      ctx.roundRect(px2, py2, pw, ph, 4);
      ctx.fillStyle = `hsla(${n.hue}, 30%, 10%, ${labelAlpha * 0.65})`;
      ctx.fill();

      // Label text
      ctx.fillStyle = `hsla(${n.hue}, 80%, 80%, ${labelAlpha})`;
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, n.x, py2 + ph / 2);
    }

    // JARVIS SCAN LINE
    const scanPos = (Date.now() % 4000) / 4000 * h;
    ctx.beginPath();
    ctx.moveTo(0, scanPos);
    ctx.lineTo(w, scanPos);
    ctx.strokeStyle = `rgba(20, 184, 166, 0.05)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [buildConnections]);

  // ── Setup / teardown ────────────────────────────────────────────────────
  useEffect(() => {
    resize();
    const { w, h } = dimRef.current;
    initNodes(w, h);
    packets.current = Array.from({ length: PACKET_COUNT }, () =>
      spawnPacket(moduleNodes.current)
    );
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
  }, [resize, initNodes, spawnPacket, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
