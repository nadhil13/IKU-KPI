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
 * Menentukan apakah event wheel harus dikecualikan dari Lenis.
 * Hanya mengecualikan dialog/modal atau kontainer dengan data-lenis-prevent yang benar-benar
 * memiliki overflow vertikal aktif, sehingga tabel/form lebar (overflow-x: auto) tetap bisa
 * di-scroll vertikal dengan mulus saat kursor berada di atas form/input.
 */
function shouldPreventLenis(node) {
  let el = node instanceof Element ? node : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.classList?.contains('internal-main-scroll')) return false;
    if (el.getAttribute?.('role') === 'dialog' || el.getAttribute?.('aria-modal') === 'true') {
      return true;
    }
    if (el.hasAttribute?.('data-lenis-prevent')) {
      const style = window.getComputedStyle(el);
      const canScrollY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 2;
      if (canScrollY) return true;
    }
    el = el.parentElement;
  }
  return false;
}

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
    allowNestedScroll: false,
    gestureOrientation: 'vertical',
    prevent: shouldPreventLenis,
  });

  // Sinkronkan posisi scroll aktual (mis. setelah fokus input form) dan lepas fokus input[type="number"]
  // pada fase capture sebelum Lenis memproses wheel event.
  const handleFormWheelCapture = (event) => {
    const active = document.activeElement;
    if (active && active.tagName === 'INPUT' && active.type === 'number' && wrapper.contains(event.target)) {
      active.blur();
    }
    if (lenis.isScrolling !== 'smooth' && Math.abs(wrapper.scrollTop - lenis.animatedScroll) > 1) {
      lenis.animatedScroll = wrapper.scrollTop;
      lenis.targetScroll = wrapper.scrollTop;
    }
  };
  wrapper.addEventListener('wheel', handleFormWheelCapture, { passive: true, capture: true });

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
    wrapper.removeEventListener('wheel', handleFormWheelCapture, { capture: true });
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
    allowNestedScroll: false,
    gestureOrientation: 'vertical',
    prevent: shouldPreventLenis,
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
