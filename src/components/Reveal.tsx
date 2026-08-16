'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-triggered fade-up reveal, matching the entrance animation pattern
 * seen on the reference site (opacity 0 -> 1, translateY(30px) -> 0, ease,
 * fill-mode both). IntersectionObserver rather than CSS scroll-timelines
 * so it behaves consistently across browsers, not just Chromium.
 */
export default function Reveal({
  children,
  delayMs = 0,
  className = '',
  style,
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-[opacity,transform] duration-[800ms] ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-[30px] opacity-0'
      }`}
      style={{ ...style, transitionDelay: visible ? `${delayMs}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
