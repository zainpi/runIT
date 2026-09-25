"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import styles from "./sticky-cta.module.css";

/**
 * Phone-only call to action that appears once the page's main call to action scrolls
 * out of view, and steps aside again when the closing call to action is reached.
 */
export function StickyCta({ href, label, after, until }: { href: string; label: string; after: string; until?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const start = document.getElementById(after);
    const end = until ? document.getElementById(until) : null;
    if (!start) return;
    let passedStart = false;
    let reachedEnd = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const above = entry.boundingClientRect.bottom < 0;
        if (entry.target === start) passedStart = !entry.isIntersecting && above;
        if (entry.target === end) reachedEnd = entry.isIntersecting || entry.boundingClientRect.top < 0;
      }
      setVisible(passedStart && !reachedEnd);
    });
    observer.observe(start);
    if (end) observer.observe(end);
    return () => observer.disconnect();
  }, [after, until]);

  return (
    <div className={styles.sticky} hidden={!visible}>
      <Link href={href} className={styles.link}>{label} <ArrowRightIcon /></Link>
    </div>
  );
}
