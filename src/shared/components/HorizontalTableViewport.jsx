import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';

const INTERACTIVE_SELECTOR =
  'input, textarea, select, option, button, a, label, [role="button"], [contenteditable="true"], .no-drag-pan';

/**
 * Mengaktifkan geser tabel horizontal lewat klik-dan-seret mouse pada area non-interaktif
 * sekaligus memantau ketersediaan overflow dan batas kiri/kanan secara realtime.
 */
export function useHorizontalScrollControl(externalRef, { dragDisabled = false } = {}) {
  const internalRef = useRef(null);
  const scrollRef = externalRef || internalRef;
  const [metrics, setMetrics] = useState({
    hasOverflow: false,
    canLeft: false,
    canRight: false,
    scrollWidth: 0,
  });
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sw = el.scrollWidth || 0;
    const cw = el.clientWidth || 0;
    const sl = el.scrollLeft || 0;
    const hasOverflow = sw > cw + 2;
    const canLeft = hasOverflow && sl > 2;
    const canRight = hasOverflow && sl + cw < sw - 2;
    setMetrics((prev) =>
      prev.hasOverflow === hasOverflow &&
      prev.canLeft === canLeft &&
      prev.canRight === canRight &&
      prev.scrollWidth === sw
        ? prev
        : { hasOverflow, canLeft, canRight, scrollWidth: sw }
    );
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    measure();
    const rafId = requestAnimationFrame(measure);
    const settleTimer = window.setTimeout(measure, 340);
    const onScroll = () => measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
      if (el.firstElementChild) {
        ro.observe(el.firstElementChild);
      }
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [scrollRef, measure]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || dragDisabled) return undefined;

    let pointerId = null;
    let startX = 0;
    let startScrollLeft = 0;
    let engaged = false;
    let suppressNextClick = false;

    const cleanup = () => {
      if (engaged) {
        suppressNextClick = true;
        window.setTimeout(() => {
          suppressNextClick = false;
        }, 60);
      }
      pointerId = null;
      engaged = false;
      setDragging(false);
      document.body.style.userSelect = '';
    };

    const onPointerDown = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (event.button !== 0) return;
      if (el.scrollWidth <= el.clientWidth + 2) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(INTERACTIVE_SELECTOR)) return;

      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = el.scrollLeft;
      engaged = false;
    };

    const onPointerMove = (event) => {
      if (pointerId === null || (event.pointerId && event.pointerId !== pointerId)) return;
      const dx = event.clientX - startX;
      if (!engaged && Math.abs(dx) > 5) {
        engaged = true;
        setDragging(true);
        document.body.style.userSelect = 'none';
      }
      if (engaged) {
        el.scrollLeft = startScrollLeft - dx;
      }
    };

    const onPointerUp = (event) => {
      if (pointerId === null) return;
      if (event.pointerId && event.pointerId !== pointerId) return;
      cleanup();
    };

    const onClickCapture = (event) => {
      if (!suppressNextClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick = false;
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('click', onClickCapture, { capture: true });

    return () => {
      cleanup();
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('click', onClickCapture, { capture: true });
    };
  }, [scrollRef, dragDisabled]);

  const panBy = useCallback(
    (deltaX) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollBy({ left: deltaX, behavior: 'smooth' });
    },
    [scrollRef]
  );

  return { scrollRef, metrics, dragging, panBy, measure };
}

/**
 * Kontainer tabel dengan scrollbar atas tersinkronisasi, tombol pan kiri/kanan,
 * serta klik-seret horizontal agar tabel lebar mudah digeser di desktop maupun seluler.
 */
export default function HorizontalTableViewport({
  children,
  scrollRef: externalRef,
  className = '',
  outerStyle,
  viewportStyle,
  panLabel = 'Geser tabel',
  dragDisabled = false,
  dataLenisPrevent = false,
  ...viewportProps
}) {
  const topTrackRef = useRef(null);
  const syncLockRef = useRef(false);
  const { scrollRef, metrics, dragging, panBy } = useHorizontalScrollControl(externalRef, {
    dragDisabled,
  });

  const handleViewportScroll = useCallback(() => {
    const vp = scrollRef.current;
    const top = topTrackRef.current;
    if (!vp || !top || syncLockRef.current) return;
    syncLockRef.current = true;
    top.scrollLeft = vp.scrollLeft;
    requestAnimationFrame(() => {
      syncLockRef.current = false;
    });
  }, [scrollRef]);

  const handleTopTrackScroll = useCallback(() => {
    const vp = scrollRef.current;
    const top = topTrackRef.current;
    if (!vp || !top || syncLockRef.current) return;
    syncLockRef.current = true;
    vp.scrollLeft = top.scrollLeft;
    requestAnimationFrame(() => {
      syncLockRef.current = false;
    });
  }, [scrollRef]);

  useEffect(() => {
    const vp = scrollRef.current;
    const top = topTrackRef.current;
    if (vp && top && Math.abs(top.scrollLeft - vp.scrollLeft) > 1) {
      top.scrollLeft = vp.scrollLeft;
    }
  }, [metrics.scrollWidth, metrics.hasOverflow, scrollRef]);

  return (
    <div className="htv-root" style={{ width: '100%', maxWidth: '100%', minWidth: 0, ...outerStyle }}>
      {metrics.hasOverflow && (
        <div className="htv-pan-bar" role="region" aria-label="Kontrol geser tabel horizontal">
          <div className="htv-pan-meta">
            <span className="htv-pan-hint">
              <MoveHorizontal size={13} />
              <span>{panLabel}: seret tabel, geser bilah biru, atau pakai tombol</span>
            </span>
            <div className="htv-pan-actions">
              <button
                type="button"
                className="htv-pan-btn no-drag-pan"
                disabled={!metrics.canLeft}
                onClick={() => panBy(-300)}
                aria-label="Geser tabel ke kiri"
              >
                <ChevronLeft size={14} />
                <span>Kiri</span>
              </button>
              <button
                type="button"
                className="htv-pan-btn no-drag-pan"
                disabled={!metrics.canRight}
                onClick={() => panBy(300)}
                aria-label="Geser tabel ke kanan"
              >
                <span>Kanan</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div
            ref={topTrackRef}
            onScroll={handleTopTrackScroll}
            className="htv-top-track"
            aria-label="Bilah geser horizontal tabel"
          >
            <div style={{ width: `${metrics.scrollWidth}px`, height: '1px' }} />
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleViewportScroll}
        data-lenis-prevent={dataLenisPrevent ? '' : undefined}
        className={`htv-viewport ${metrics.hasOverflow ? 'is-scrollable' : ''} ${dragging ? 'is-dragging' : ''} ${metrics.canRight ? 'has-right-fade' : ''} ${className}`.trim()}
        style={viewportStyle}
        {...viewportProps}
      >
        {children}
      </div>
    </div>
  );
}
