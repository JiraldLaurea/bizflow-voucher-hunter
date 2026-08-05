"use client";

import { useEffect } from "react";

/**
 * Fades below-the-fold marketing content in as it comes into view.
 *
 * One observer over every `[data-reveal]` rather than a wrapper component per
 * element: the page stays a server component, the markup stays readable, and
 * animating something new is one attribute.
 *
 * Above-the-fold content does NOT use this — the hero runs a CSS keyframe
 * animation instead. This effect can only arm elements *after* the first paint,
 * so anything already on screen would be visible for a moment and then hidden.
 * Off-screen elements have no such problem, which is exactly the split here.
 *
 * Arming is deliberately instant: the transition lives on `.is-revealed`, so
 * adding `.is-armed` cannot itself animate. An earlier version declared the
 * transition on the base selector and every element faded *out* over half a
 * second on load.
 *
 * The hidden state is applied by script rather than in the stylesheet, so a
 * visitor whose JavaScript never runs sees the finished page, not a blank one.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (targets.length === 0) return;

    // Honour the OS setting: show everything, animate nothing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    const pending: HTMLElement[] = [];
    for (const target of targets) {
      // Already on screen — someone refreshed mid-page. Hiding it now just to
      // fade it back in is the flicker this component exists to avoid.
      const box = target.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) {
        target.classList.add("is-revealed");
        continue;
      }
      target.classList.add("is-armed");
      pending.push(target);
    }
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          // Reveal once. Content that re-hides on the way back up reads as a
          // glitch rather than an effect.
          observer.unobserve(entry.target);
        }
      },
      // Fires a little before the element reaches the bottom edge, so the
      // motion has finished by the time it is properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    for (const target of pending) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return null;
}
