const MAX_STEP = 8;
const STEP = 0.06;
const SPRING = { type: "spring" as const, duration: 0.4, bounce: 0 };

export const appear = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { ...SPRING, delay: Math.min(i, MAX_STEP) * STEP },
});

export const appearList = {
  initial: "hidden",
  animate: "show",
  variants: { show: { transition: { staggerChildren: STEP } } },
};

export const appearItem = {
  variants: { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: SPRING } },
};
