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
  const curtainRef = useRef(null);
  const routeLaserRef = useRef(null);

  // Pasang smooth scroll Lenis pada halaman publik
  useEffect(() => mountWindowSmoothScroll(), []);

  // Scroll ke atas (atau ke anchor hash) setiap pindah halaman publik
  useEffect(() => {
    const lenis = getWindowLenis();
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const timer = window.setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          const offset = el.getBoundingClientRect().top + window.scrollY - 84;
          if (lenis) lenis.scrollTo(offset, { duration: 1.0 });
          else window.scrollTo({ top: offset, behavior: 'smooth' });
        }
      }, 80);
      return () => window.clearTimeout(timer);
    }
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
    return undefined;
  }, [location.pathname, location.hash]);

  // Indikator progress scroll presisi di puncak layar
  useEffect(() => {
    const onScroll = () => {
      if (!progressBarRef.current) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docHeight > 10 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0;
      gsap.to(progressBarRef.current, { scaleX: ratio, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Architectural Curtain Wipe + Top Kinetic Laser pada setiap perpindahan rute publik
  // (tanpa menyisakan transform pada <main> agar ScrollTrigger pin tetap akurat 100%)
  useGSAP(() => {
    if (curtainRef.current) {
      gsap.fromTo(
        curtainRef.current,
        { scaleY: 1, transformOrigin: 'top center' },
        {
          scaleY: 0,
          duration: 0.72,
          ease: 'expo.inOut',
          onComplete: () => ScrollTrigger.refresh(),
        }
      );
    }
    if (routeLaserRef.current) {
      const tl = gsap.timeline();
      tl.set(routeLaserRef.current, { transformOrigin: 'left center', scaleX: 0, opacity: 1 })
        .to(routeLaserRef.current, { scaleX: 1, duration: 0.36, ease: 'expo.out' })
        .set(routeLaserRef.current, { transformOrigin: 'right center' })
        .to(routeLaserRef.current, { scaleX: 0, opacity: 0, duration: 0.4, ease: 'power3.inOut' });
    }
    if (stageRef.current) {
      gsap.fromTo(
        stageRef.current,
        { opacity: 0.2 },
        { opacity: 1, duration: 0.55, ease: 'power2.out' }
      );
    }
  }, { dependencies: [location.pathname] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', background: '#ffffff' }}>
      {/* Architectural Curtain Wipe Layer */}
      <div
        ref={curtainRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: '#09090b',
          transform: 'scaleY(0)',
          transformOrigin: 'top center',
          zIndex: 1090,
          pointerEvents: 'none',
        }}
      />

      {/* Top Kinetic Progress & Route Laser */}
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
            background: '#09090b',
            transformOrigin: 'left center',
            transform: 'scaleX(0)',
          }}
        />
        <div
          ref={routeLaserRef}
          style={{
            position: 'absolute',
            inset: 0,
            background: '#09090b',
            transformOrigin: 'left center',
            transform: 'scaleX(0)',
            opacity: 0,
          }}
        />
      </div>

      <Navbar />

      <main ref={stageRef} style={{ flex: 1 }}>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
