import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let activeLenis = null;
let activeWindowLenis = null;

/** Instance Lenis aktif pada area internal (null jika belum dipasang / reduced motion). */
export const getLenis = () => activeLenis;

/** Instance Lenis aktif pada window publik (null jika belum dipasang / reduced motion). */
export const getWindowLenis = () => activeWindowLenis;

/**
 * Memasang smooth scroll Lenis pada container scroll internal dan
 * menyinkronkannya dengan ticker GSAP sehingga ScrollTrigger bergerak mulus.
 */
export function mountSmoothScroll(wrapper, content) {
  if (!wrapper || !content) return () => {};
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

  const lenis = new Lenis({
    wrapper,
    content,
    autoRaf: false,
    lerp: 0.09,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.4,
    smoothWheel: true,
    syncTouch: false,
    allowNestedScroll: true,
    // Elemen yang punya scroll sendiri (dropdown, modal, panel) tetap scroll natif.
    prevent: (node) => Boolean(node?.closest?.('[data-lenis-prevent]')),
  });

  const onTick = (time) => lenis.raf(time * 1000);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);
  activeLenis = lenis;

  // Konten yang berubah tinggi (tabel bertambah baris) → hitung ulang batas scroll.
  let refreshTimer;
  const resizeObserver = new ResizeObserver(() => {
    lenis.resize();
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 160);
  });
  resizeObserver.observe(content);

  return () => {
    clearTimeout(refreshTimer);
    resizeObserver.disconnect();
    gsap.ticker.remove(onTick);
    lenis.destroy();
    if (activeLenis === lenis) activeLenis = null;
  };
}

/**
 * Memasang smooth scroll Lenis pada window halaman publik (Landing, Tentang, Kerangka, dll.)
 * dan menyinkronkannya dengan GSAP ScrollTrigger.
 */
export function mountWindowSmoothScroll() {
  if (typeof window === 'undefined') return () => {};
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.085,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.35,
    smoothWheel: true,
    syncTouch: false,
    prevent: (node) => Boolean(node?.closest?.('[data-lenis-prevent]')),
  });

  const onTick = (time) => lenis.raf(time * 1000);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);
  activeWindowLenis = lenis;

  return () => {
    gsap.ticker.remove(onTick);
    lenis.destroy();
    if (activeWindowLenis === lenis) activeWindowLenis = null;
  };
}

/** Scroll halus ke elemen/posisi di container internal atau window (fallback ke native). */
export function smoothScrollTo(target, options = {}) {
  const instance = activeLenis || activeWindowLenis;
  if (instance) {
    instance.scrollTo(target, { duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 4), ...options });
    return;
  }
  if (target instanceof Element) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' });
}
