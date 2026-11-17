// Категорийная шкала: оттенок равномерно по кругу, светлота через одну — 62 и 78%
// при C=0.10 в OKLCH. Соседние ступени расходятся не только тоном, но и светлотой,
// поэтому различимы даже точкой в 7 px; хрома ниже акцентной, чтобы жёлтый оставался
// самым громким цветом на экране.
export const CATEGORY_COLORS = [
  "#bb6d6d", // red
  "#eea284", // orange
  "#af7940", // amber
  "#d3b46a", // yellow
  "#8a8b3e", // lime
  "#9fc582", // green
  "#50986b", // emerald
  "#68cdb7", // teal
  "#1c989e", // cyan
  "#67c6e6", // sky
  "#4e8cbe", // blue
  "#9bb6f8", // indigo
  "#857bbe", // violet
  "#cda5e6", // purple
  "#ab6e9e", // pink
  "#ec9cb8", // rose
] as const;

export const DEFAULT_CATEGORY_COLOR = "#a6a6a6";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/**
 * Контрастный цвет контента (текст/иконка) поверх произвольного hex-фона.
 * YIQ-яркость с порогом 140: тёмный фон → белый контент, светлый → почти-чёрный.
 * Для фона из роли значимости берите готовый --rg-sig-N-on — он уже контрастен.
 */
export function onColorFor(hex: string): string {
  if (!HEX_COLOR.test(hex)) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#0a0a0b" : "#ffffff";
}

const SHADE_MIN = 0.5;
const SHADE_MAX = 0.86;
const SHADE_STEP = 0.08;

function toLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(c: number) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

function oklchToLinear(L: number, C: number, h: number): number[] {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function shadeColor(parent: string, index: number, total: number): string {
  if (!HEX_COLOR.test(parent)) return parent;
  const [base, C, h] = hexToOklch(parent);
  const span = Math.min(SHADE_MAX - SHADE_MIN, SHADE_STEP * (total - 1));
  const from = Math.min(Math.max(base - span / 2, SHADE_MIN), SHADE_MAX - span);
  const L = total <= 1 ? Math.min(Math.max(base, SHADE_MIN), SHADE_MAX) : from + (span * index) / (total - 1);
  let chroma = C;
  let rgb = oklchToLinear(L, chroma, h);
  while (chroma > 0 && rgb.some((v) => v < 0 || v > 1)) {
    chroma = Math.max(0, chroma - 0.005);
    rgb = oklchToLinear(L, chroma, h);
  }
  const hex = rgb.map((v) =>
    Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${hex.join("")}`;
}
