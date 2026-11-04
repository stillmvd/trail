const NUDGE: Keyframe[] = [
  { translate: "0 0" },
  { translate: "-6px 0" },
  { translate: "6px 0" },
  { translate: "-3px 0" },
  { translate: "0 0" },
];

export function nudge(el: HTMLElement | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(NUDGE, { duration: 280, easing: "ease-out" });
}
