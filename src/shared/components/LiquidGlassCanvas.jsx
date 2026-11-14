import { useEffect, useRef } from 'react';

/**
 * Lightweight 2D canvas specular highlight layer for navbar fold transitions.
 * Renders only during state transitions or resizes (zero idle RAF loop) and
 * honors prefers-reduced-motion to eliminate Three.js bundle weight.
 */
export default function LiquidGlassCanvas({ isFolded }) {
  const canvasRef = useRef(null);
  const foldProgressRef = useRef(isFolded ? 1 : 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = isFolded ? 1 : 0;
    let rafId = 0;

    const paint = (progress) => {
      const parent = canvas.parentElement;
      const w = Math.max(1, parent?.clientWidth || window.innerWidth);
      const h = Math.max(1, parent?.clientHeight || 68);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const waveShift = (0.28 + progress * 0.44) * w;
      const sheen = ctx.createLinearGradient(waveShift - w * 0.45, 0, waveShift + w * 0.45, h);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sheen.addColorStop(0.42, `rgba(178, 226, 240, ${0.14 + progress * 0.08})`);
      sheen.addColorStop(0.55, `rgba(0, 155, 185, ${0.07 + progress * 0.06})`);
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      const topGleam = ctx.createLinearGradient(0, 0, w, 0);
      topGleam.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
      topGleam.addColorStop(0.5, `rgba(255, 255, 255, ${0.38 + progress * 0.16})`);
      topGleam.addColorStop(1, 'rgba(255, 255, 255, 0.12)');

      ctx.fillStyle = topGleam;
      ctx.fillRect(0, 0, w, 1.5);
    };

    const tick = () => {
      if (reducedMotion) {
        foldProgressRef.current = target;
        paint(target);
        return;
      }

      const delta = target - foldProgressRef.current;
      if (Math.abs(delta) <= 0.004) {
        foldProgressRef.current = target;
        paint(target);
        return;
      }

      foldProgressRef.current += delta * 0.18;
      paint(foldProgressRef.current);
      rafId = requestAnimationFrame(tick);
    };

    tick();

    const handleResize = () => paint(foldProgressRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isFolded]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        borderRadius: 'inherit',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.9,
      }}
    />
  );
}
