'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Beam {
    x: number;
    y: number;
    vx: number;
    vy: number;
    length: number;
    width: number;
    opacity: number;
    hue: number; // 180 = teal, 210 = blue
    phase: number;
    speed: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    opacity: number;
    hue: number;
    life: number;
    maxLife: number;
}

const BEAM_COUNT = 12;
const PARTICLE_COUNT = 60;

function createBeam(w: number, h: number): Beam {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    switch (side) {
        case 0: x = Math.random() * w; y = -100; break;
        case 1: x = w + 100; y = Math.random() * h; break;
        case 2: x = Math.random() * w; y = h + 100; break;
        default: x = -100; y = Math.random() * h; break;
    }
    const angle = Math.atan2(h / 2 - y, w / 2 - x) + (Math.random() - 0.5) * 1.2;
    const speed = 0.08 + Math.random() * 0.12;
    return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: 180 + Math.random() * 280,
        width: 1 + Math.random() * 2.5,
        opacity: 0.04 + Math.random() * 0.1,
        hue: Math.random() > 0.5 ? 185 + Math.random() * 15 : 210 + Math.random() * 20,
        phase: Math.random() * Math.PI * 2,
        speed,
    };
}

function createParticle(w: number, h: number): Particle {
    return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15 - 0.05,
        radius: 0.8 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.35,
        hue: Math.random() > 0.5 ? 185 : 215,
        life: 0,
        maxLife: 200 + Math.random() * 600,
    };
}

export default function HeroBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const beamsRef = useRef<Beam[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const visibleRef = useRef(true);
    const frameRef = useRef(0);

    const resize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
    }, []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !visibleRef.current) {
            rafRef.current = requestAnimationFrame(draw);
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = window.innerWidth;
        const h = window.innerHeight;
        frameRef.current++;

        // Clear with fade trail
        ctx.fillStyle = 'rgba(2, 8, 20, 0.18)';
        ctx.fillRect(0, 0, w, h);

        // Draw beams
        for (let i = 0; i < beamsRef.current.length; i++) {
            const b = beamsRef.current[i];
            b.x += b.vx;
            b.y += b.vy;
            b.phase += 0.008;

            const pulse = 0.6 + Math.sin(b.phase) * 0.4;
            const alpha = b.opacity * pulse;

            const endX = b.x - Math.cos(Math.atan2(b.vy, b.vx)) * b.length;
            const endY = b.y - Math.sin(Math.atan2(b.vy, b.vx)) * b.length;

            const grad = ctx.createLinearGradient(endX, endY, b.x, b.y);
            grad.addColorStop(0, `hsla(${b.hue}, 90%, 60%, 0)`);
            grad.addColorStop(0.6, `hsla(${b.hue}, 90%, 65%, ${alpha * 0.6})`);
            grad.addColorStop(1, `hsla(${b.hue}, 95%, 70%, ${alpha})`);

            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = b.width;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Glow dot at tip
            const tipGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.width * 4);
            tipGrad.addColorStop(0, `hsla(${b.hue}, 100%, 80%, ${alpha * 0.8})`);
            tipGrad.addColorStop(1, `hsla(${b.hue}, 100%, 60%, 0)`);
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.width * 4, 0, Math.PI * 2);
            ctx.fillStyle = tipGrad;
            ctx.fill();

            // Reset if off-screen
            if (b.x < -300 || b.x > w + 300 || b.y < -300 || b.y > h + 300) {
                beamsRef.current[i] = createBeam(w, h);
            }
        }

        // Draw particles
        for (let i = 0; i < particlesRef.current.length; i++) {
            const p = particlesRef.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life++;

            const lifeRatio = p.life / p.maxLife;
            const fade = lifeRatio < 0.1
                ? lifeRatio / 0.1
                : lifeRatio > 0.8
                    ? (1 - lifeRatio) / 0.2
                    : 1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 85%, 65%, ${p.opacity * fade})`;
            ctx.fill();

            if (p.life >= p.maxLife || p.y < -10 || p.x < -10 || p.x > w + 10) {
                particlesRef.current[i] = createParticle(w, h);
            }
        }

        rafRef.current = requestAnimationFrame(draw);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        resize();

        const w = window.innerWidth;
        const h = window.innerHeight;

        beamsRef.current = Array.from({ length: BEAM_COUNT }, () => createBeam(w, h));
        // Spread beams across the canvas initially
        beamsRef.current.forEach(b => {
            b.x = Math.random() * w;
            b.y = Math.random() * h;
        });

        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
            const p = createParticle(w, h);
            p.life = Math.floor(Math.random() * p.maxLife); // stagger start
            return p;
        });

        // Intersection Observer — pause animation when off-screen
        const observer = new IntersectionObserver(
            ([entry]) => { visibleRef.current = entry.isIntersecting; },
            { threshold: 0.01 }
        );
        observer.observe(canvas);

        const onResize = () => resize();
        window.addEventListener('resize', onResize, { passive: true });

        rafRef.current = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(rafRef.current);
            observer.disconnect();
            window.removeEventListener('resize', onResize);
        };
    }, [draw, resize]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            aria-hidden="true"
            style={{
                pointerEvents: 'none',
                willChange: 'transform',
                transform: 'translateZ(0)',
                contain: 'layout style paint',
            }}
        />
    );
}
