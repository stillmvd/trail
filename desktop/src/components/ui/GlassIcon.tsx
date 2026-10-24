import { useId } from "react";

const W = (o = ".42") => `fill="#fff" fill-opacity="${o}"`;
const S = (w = 5) => `fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const PAL = {
  gb: ["#a3a3a3", "#5c5c5c", "#262626"],
  gg: [
    [".78", "#ffffff"],
    [".5", "#e0e0e0"],
    [".42", "#b0b0b0"],
  ],
  gd: ["#ffffa8", "#ffff1e"],
  sh: "#000000",
};

const ICONS = {
  gift: {
    back: `<rect x="34" y="28" width="54" height="44" rx="12" fill="url(#U-gb)"/><rect x="30" y="16" width="62" height="17" rx="8.5" fill="url(#U-gb)"/><rect x="58.5" y="16" width="5" height="56" rx="2" ${W(".45")}/><path d="M61 16c-7-11-18-8-15-2 1.5 3 9 3 15 2zm0 0c7-11 18-8 15-2-1.5 3-9 3-15 2z" ${W(".6")}/>`,
    front: `<circle cx="36" cy="60" r="27"/>`,
    glyph: `<circle cx="36" cy="60" r="13" ${S(4)}/><path d="M36 52.5v8l5.5 3.5" ${S(4)}/>`,
    dot: [86, 84, 5],
  },
  cake: {
    back: `<rect x="32" y="42" width="58" height="32" rx="11" fill="url(#U-gb)"/><rect x="40" y="26" width="42" height="20" rx="9" fill="url(#U-gb)"/><rect x="51" y="9" width="5" height="15" rx="2.5" ${W(".7")}/><rect x="66" y="9" width="5" height="15" rx="2.5" ${W(".7")}/><path d="M34 52c5 4 9 4 14 0s9-4 14 0 9 4 14 0 9-4 12-1" ${S(2.4)} stroke-opacity=".45"/>`,
    front: `<circle cx="36" cy="60" r="27"/>`,
    glyph: `<path d="M20 60h13M26.5 53.5v13M41 53.5l6-3.5v21" ${S(4.4)}/>`,
    dot: [16, 22, 5],
  },
  calendar: {
    back: `<rect x="32" y="12" width="58" height="58" rx="15" fill="url(#U-gb)"/><rect x="46" y="5" width="7" height="15" rx="3.5" fill="url(#U-gb)" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/><rect x="70" y="5" width="7" height="15" rx="3.5" fill="url(#U-gb)" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/><rect x="58" y="32" width="9" height="9" rx="3" ${W()}/><rect x="72" y="32" width="9" height="9" rx="3" ${W()}/><rect x="72" y="46" width="9" height="9" rx="3" ${W()}/>`,
    front: `<rect x="6" y="40" width="46" height="46" rx="15"/>`,
    glyph: `<path d="M29 75c-7-5-11-9-11-13.5a5.5 5.5 0 0 1 11-1.5 5.5 5.5 0 0 1 11 1.5C40 66 36 70 29 75z" fill="#fff"/>`,
    dot: [86, 84, 5],
  },
  person: {
    back: `<circle cx="62" cy="30" r="20" fill="url(#U-gb)"/><path d="M30 80c2-18 14-28 32-28s30 10 32 28z" fill="url(#U-gb)"/>`,
    front: `<circle cx="34" cy="60" r="27"/>`,
    glyph: `<circle cx="34" cy="53" r="7" fill="#fff"/><path d="M21 74c2-7 7-11 13-11s11 4 13 11" ${S(4.4)}/>`,
    dot: [86, 84, 5],
  },
  hourglass: {
    back: `<path d="M42 8h40v8c0 12-13 16-13 22s13 10 13 22v10H42V60c0-12 13-16 13-22S42 28 42 16z" fill="url(#U-gb)" stroke="url(#U-gb)" stroke-width="3" stroke-linejoin="round"/><path d="M50 64h24" ${S(3)} stroke-opacity=".45"/>`,
    front: `<circle cx="36" cy="60" r="27"/>`,
    glyph: `<path d="M36 74s-13-7.5-13-16.5a7 7 0 0 1 13-3.6 7 7 0 0 1 13 3.6C49 66.5 36 74 36 74z" fill="#fff"/>`,
    dot: [86, 84, 5],
  },
  week: {
    back: `<path d="M62 8a30 30 0 1 1 0 60 30 30 0 0 1 0-60z" fill="url(#U-gb)"/><path d="M62 20v18l11 7" ${S(4)} stroke-opacity=".5"/>`,
    front: `<rect x="4" y="46" width="62" height="38" rx="15"/>`,
    glyph: `<circle cx="15" cy="65" r="3.6" fill="#fff" fill-opacity=".5"/><circle cx="25" cy="65" r="3.6" fill="#fff" fill-opacity=".5"/><circle cx="35" cy="65" r="5.4" fill="#fff"/><circle cx="45" cy="65" r="3.6" fill="#fff" fill-opacity=".5"/><circle cx="55" cy="65" r="3.6" fill="#fff" fill-opacity=".5"/>`,
    dot: [16, 22, 5],
  },
} as const;

export type GlassIconName = keyof typeof ICONS;

function svg(name: GlassIconName, uid: string, size: number) {
  const ic = ICONS[name];
  const [dx, dy, dr] = ic.dot;
  const gg = PAL.gg.map(([o, c], i) => `<stop offset="${[0, 0.5, 1][i]}" stop-color="${c}" stop-opacity="${o}"/>`).join("");
  return `<svg viewBox="0 0 96 96" width="${size}" height="${size}" style="display:block;overflow:visible"><defs><linearGradient id="U-gb" x1="88" y1="6" x2="30" y2="78" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${PAL.gb[0]}"/><stop offset=".45" stop-color="${PAL.gb[1]}"/><stop offset="1" stop-color="${PAL.gb[2]}"/></linearGradient><linearGradient id="U-gg" x1="0" y1="0" x2="1" y2="1">${gg}</linearGradient><linearGradient id="U-gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".45" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient><linearGradient id="U-gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PAL.gd[0]}"/><stop offset="1" stop-color="${PAL.gd[1]}"/></linearGradient><filter id="U-fb" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter><filter id="U-fs" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b"/><feOffset in="b" dy="3" result="o"/><feFlood flood-color="${PAL.sh}" flood-opacity=".3"/><feComposite in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="U-fg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/><feOffset in="b" dy="2" result="o"/><feFlood flood-color="${PAL.sh}" flood-opacity=".18"/><feComposite in2="o" operator="in"/></filter><clipPath id="U-cf">${ic.front}</clipPath><g id="U-back">${ic.back}</g></defs><use href="#U-back" filter="url(#U-fs)"/><g filter="url(#U-fg)">${ic.front}</g><g clip-path="url(#U-cf)"><use href="#U-back" filter="url(#U-fb)"/><rect width="96" height="96" fill="url(#U-gg)"/></g><g fill="none" stroke="url(#U-gs)" stroke-width="1.4">${ic.front}</g>${ic.glyph}<circle cx="${dx}" cy="${dy}" r="${dr}" fill="url(#U-gd)"/></svg>`.replace(/U-/g, `${uid}-`);
}

export function GlassIcon({
  name,
  size,
  className = "",
  delay,
}: {
  name: GlassIconName;
  size: number;
  className?: string;
  delay?: number;
}) {
  const uid = "gi" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span
      aria-hidden
      className={`block shrink-0 ${className}`}
      style={{ width: size, height: size, animationDelay: delay === undefined ? undefined : `${delay}s` }}
      dangerouslySetInnerHTML={{ __html: svg(name, uid, size) }}
    />
  );
}
