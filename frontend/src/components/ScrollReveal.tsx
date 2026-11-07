"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ScrollReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Progressive enhancement: content stays visible unless the observer is ready.
    node.classList.add("reveal-ready");
    if (!("IntersectionObserver" in window)) {
      node.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        node.classList.add("is-visible");
        observer.unobserve(node);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`scroll-reveal ${className}`}>{children}</div>;
}
