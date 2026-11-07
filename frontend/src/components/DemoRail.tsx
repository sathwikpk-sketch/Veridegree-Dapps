"use client";

import { useEffect, useRef, useState } from "react";

export type DemoRailItem = { id: string; label: string };

/**
 * A fixed outline of the page's sections, meant for presenting: it tells
 * whoever is narrating (and whoever is watching) where they are, and lets
 * the presenter click straight to a section instead of scrolling blindly.
 * Desktop only — on a small screen it would just cover content.
 */
export function DemoRail({ items }: { items: DemoRailItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const ratios = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const sections = items
      .map(item => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => ratios.current.set(entry.target.id, entry.intersectionRatio));
        let topId = active;
        let topRatio = 0;
        ratios.current.forEach((ratio, id) => {
          if (ratio > topRatio) { topRatio = ratio; topId = id; }
        });
        if (topRatio > 0) setActive(topId);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-15% 0px -55% 0px" }
    );
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <nav className="demo-rail" aria-label="Page sections">
      {items.map((item, index) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={`demo-rail-item ${active === item.id ? "active" : ""}`}
          onClick={event => {
            event.preventDefault();
            document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <span className="demo-rail-dot" />
          <span className="demo-rail-label"><b>{String(index + 1).padStart(2, "0")}</b>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
