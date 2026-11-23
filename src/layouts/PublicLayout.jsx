import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Navbar from '../shared/components/Navbar';
import Footer from '../shared/components/Footer';
import { mountWindowSmoothScroll, getWindowLenis } from '../lib/smoothScroll';

gsap.registerPlugin(ScrollTrigger);

export default function PublicLayout() {
  const location = useLocation();
  const stageRef = useRef(null);
  const progressBarRef = useRef(null);
  const routeLaserRef = useRef(null);

  useEffect(() => mountWindowSmoothScroll(), []);

  useEffect(() => {
    const lenis = getWindowLenis();
    if (location.hash) {
      const id = location.hash.replace('#', '');
      let attempts = 0;
      let timer = null;
      const tryScrollToAnchor = () => {
        const el = document.getElementById(id);
        if (el) {
          const offset = el.getBoundingClientRect().top + window.scrollY - 84;
          if (lenis) lenis.scrollTo(offset, { duration: 1.0 });
          else window.scrollTo({ top: offset, behavior: 'smooth' });
          return;
        }
        attempts += 1;
        if (attempts < 12) {
          timer = window.setTimeout(tryScrollToAnchor, 80);
        }
      };
      timer = window.setTimeout(tryScrollToAnchor, 60);
      return () => {
        if (timer) window.clearTimeout(timer);
      };
    }
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
    return undefined;
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const onScroll = () => {
      if (!progressBarRef.current) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docHeight > 10 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        progressBarRef.current.style.transform = `scaleX(${ratio})`;
        return;
      }
      gsap.to(progressBarRef.current, { scaleX: ratio, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useGSAP(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      ScrollTrigger.refresh();
      return;
    }
    if (routeLaserRef.current) {
      const tl = gsap.timeline();
      tl.set(routeLaserRef.current, { transformOrigin: 'left center', scaleX: 0, opacity: 1 })
        .to(routeLaserRef.current, { scaleX: 1, duration: 0.3, ease: 'expo.out' })
        .set(routeLaserRef.current, { transformOrigin: 'right center' })
        .to(routeLaserRef.current, { scaleX: 0, opacity: 0, duration: 0.32, ease: 'power3.inOut', onComplete: () => ScrollTrigger.refresh() });
    }
    if (stageRef.current) {
      gsap.fromTo(
        stageRef.current,
        { opacity: 0.35 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' }
      );
    }
  }, { dependencies: [location.pathname] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative', background: '#ffffff' }}>
      <a href="#main-content" className="skip-to-main">
        Lewati ke konten utama
      </a>

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          zIndex: 1100,
          pointerEvents: 'none',
        }}
      >
        <div
          ref={progressBarRef}
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0E7480',
            transformOrigin: 'left center',
            transform: 'scaleX(0)',
          }}
        />
        <div
          ref={routeLaserRef}
          style={{
            position: 'absolute',
            inset: 0,
            background: '#094E68',
            transformOrigin: 'left center',
            transform: 'scaleX(0)',
            opacity: 0,
          }}
        />
      </div>

      <Navbar />

      <main id="main-content" tabIndex={-1} ref={stageRef} style={{ flex: 1 }}>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
