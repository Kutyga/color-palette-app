/** Сцены видеоуроков (сценарии — src/data/lessons.json): свет, полив, симптомы на листьях. */
import { leaf, stem, pot, potted, label, chip, badge } from "./kit.mjs";

const chipW = (t) => t.length * 18 + 44;

/** Чипы рядами снизу вверх (нижний ряд — y=bottom); возвращает svg и верх верхнего ряда. */
const chipRows = (items, color, d, bottom = 612) => {
  const rows = [];
  for (const t of items) {
    const row = rows[rows.length - 1];
    const w = row ? row.reduce((s, x) => s + chipW(x) + 14, 0) + chipW(t) : Infinity;
    if (row && w <= 580) row.push(t);
    else rows.push([t]);
  }
  let k = 0;
  const svg = rows
    .map((row, ri) => {
      const y = bottom - (rows.length - 1 - ri) * 56;
      const total = row.reduce((s, x) => s + chipW(x), 0) + (row.length - 1) * 14;
      let x = 300 - total / 2;
      return row
        .map((t) => {
          const cx = x + chipW(t) / 2;
          x += chipW(t) + 14;
          return chip(cx, y, t, color, d + 0.35 * k++);
        })
        .join("");
    })
    .join("");
  return { svg, top: rows.length ? bottom - 30 - (rows.length - 1) * 56 : 640 };
};

/** Солнце с вращающимися лучами; (x, y) — центр. */
const sun = (x, y, r, d, rays = 12) => `
  <g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}">
    <g class="lt-spin">${Array.from(
      { length: rays },
      (_, i) => `<rect x="-4" y="${-r - 26}" width="8" height="18" rx="4" fill="#ffd36e" transform="rotate(${(360 / rays) * i})"/>`,
    ).join("")}</g>
    <circle r="${r}" fill="url(#goldG)" filter="url(#glow)"/>
    <circle cx="${-r * 0.3}" cy="${-r * 0.3}" r="${r * 0.3}" fill="#fff8d8" opacity=".55"/>
  </g></g>`;

/** Неровное пятно (детерминированное). */
const blob = (cx, cy, r, seed = 1, n = 9) => {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.78 + 0.32 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233)));
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  let dd = `M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    dd += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${dd} Z`;
};

/** Лист с цветной каймой (для вялых и больных растений). */
const edgeLeaf = (x, y, s, r, d, g = "leafG", edge = "none", cls = "pop") => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><g class="${cls}" style="--d:${d}">
    <path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z" fill="url(#${g})" stroke="${edge}" stroke-width="12" stroke-linejoin="round"/>
    <path d="M0 -6 C -3 -60 -2 -112 0 -148" stroke="#0f3f23" stroke-opacity=".5" stroke-width="4" fill="none"/>
    <path d="M-22 -118 C -40 -96 -44 -70 -36 -50" stroke="#ffffff" stroke-opacity=".3" stroke-width="7" stroke-linecap="round" fill="none"/>
  </g></g>`;

/** Подоконник. */
const sill = (y, d = 0.1) =>
  `<g class="fade" style="--d:${d}"><rect x="20" y="${y}" width="560" height="18" rx="8" fill="#d9cdb8"/><rect x="20" y="${y + 18}" width="560" height="10" rx="5" fill="#000" opacity=".25"/></g>`;

// ---------------------------------------------------------------- компас: четыре окна
const COMPASS = [
  ["ЮГ", "прямое солнце", "#ffb347", 4, 36, [0.5, 0.36]],
  ["ВОСТОК", "мягкое утро", "#ffd36e", 2, 24, [0.22, 0.72]],
  ["ЗАПАД", "яркий вечер", "#ff9f6e", 3, 28, [0.78, 0.68]],
  ["СЕВЕР", "рассеянный", "#9fc8ff", 0, 0, [0.5, 0.5]],
];

const compassArt = () => `
  <defs>
    <linearGradient id="cmpDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa9e6"/><stop offset="1" stop-color="#bfe3ff"/></linearGradient>
    <linearGradient id="cmpEve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4f8f"/><stop offset=".6" stop-color="#e8875d"/><stop offset="1" stop-color="#ffc36e"/></linearGradient>
    <linearGradient id="cmpMorn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb6e8"/><stop offset=".7" stop-color="#ffd9a0"/><stop offset="1" stop-color="#ffe9c4"/></linearGradient>
    <linearGradient id="cmpGrey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa6bf"/><stop offset="1" stop-color="#d3dde8"/></linearGradient>
  </defs>
  ${COMPASS.map(([name, sub, color, power, r, [sx, sy]], i) => {
    const x = i % 2 ? 310 : 28;
    const y = i < 2 ? 34 : 316;
    const sky = ["cmpDay", "cmpMorn", "cmpEve", "cmpGrey"][i];
    const d = 0.3 + i * 0.5;
    const wx = x + 20;
    const wy = y + 18;
    return `
    <g class="rise" style="--d:${d}">
      <rect x="${x}" y="${y}" width="262" height="256" rx="26" fill="#ffffff0f" stroke="${color}" stroke-opacity=".55" stroke-width="3"/>
      <rect x="${wx}" y="${wy}" width="222" height="142" rx="14" fill="url(#${sky})"/>
      ${
        power
          ? `<g class="fade" style="--d:${d + 0.4}"><path d="M${wx + 222 * sx} ${wy + 142 * sy} L ${wx + 40} ${wy + 142} L ${wx + 182} ${wy + 142} Z" fill="#fff2c4" opacity="${0.1 * power}"/></g>`
          : `<g class="lt-drift"><ellipse cx="${wx + 80}" cy="${wy + 52}" rx="44" ry="18" fill="#ffffff" opacity=".85"/><ellipse cx="${wx + 110}" cy="${wy + 42}" rx="30" ry="20" fill="#ffffff" opacity=".9"/><ellipse cx="${wx + 150}" cy="${wy + 86}" rx="40" ry="15" fill="#ffffff" opacity=".7"/></g>`
      }
      <path d="M${wx + 111} ${wy} V ${wy + 142} M${wx} ${wy + 71} H ${wx + 222}" stroke="#f0e8d8" stroke-width="7"/>
      <rect x="${wx}" y="${wy}" width="222" height="142" rx="14" fill="none" stroke="#f0e8d8" stroke-width="8"/>
      <text x="${x + 22}" y="${y + 206}" fill="${color}" font-family="Unbounded" font-weight="900" font-size="28">${name}</text>
      <text x="${x + 22}" y="${y + 238}" fill="#ffffffd0" font-family="Manrope" font-weight="700" font-size="20">${sub}</text>
      ${[0, 1, 2, 3]
        .map(
          (k) =>
            `<rect class="pop" style="--d:${d + 0.8 + k * 0.15}" x="${x + 206 + k * 12}" y="${y + 228 - k * 9}" width="8" height="${12 + k * 9}" rx="3" fill="${k < power ? color : "#ffffff30"}"/>`,
        )
        .join("")}
    </g>
    ${power ? sun(wx + 222 * sx, wy + 142 * sy - 14, r * 0.62, d + 0.5, power * 3) : ""}`;
  }).join("")}
  <g transform="translate(300 303)"><g class="pop" style="--d:2.4">
    <circle r="40" fill="#0d2a1b" stroke="#ffd36e" stroke-width="4"/>
    <g class="lt-needle"><path d="M0 -30 L 9 0 L 0 30 L -9 0 Z" fill="#ffffff"/><path d="M0 -30 L 9 0 L -9 0 Z" fill="#ff6b6b"/></g>
    <circle r="5" fill="#0d2a1b"/>
  </g></g>
`;

// ---------------------------------------------------------------- тест тенью
const HAND =
  "M-34 40 C -46 16 -48 -6 -44 -30 L -44 -64 C -44 -74 -30 -74 -30 -64 L -30 -30 L -26 -30 L -26 -80 C -26 -90 -12 -90 -12 -80 L -12 -32 L -8 -32 L -8 -84 C -8 -94 6 -94 6 -84 L 6 -32 L 10 -32 L 10 -76 C 10 -86 24 -86 24 -76 L 24 -16 L 34 -36 C 40 -46 54 -40 48 -28 L 32 14 C 26 30 16 40 0 44 Z";

const SHADOWS = [
  ["солнце", "#ffd36e", 0, 0.62, "sun"],
  ["рассеянный", "#8be3a8", 7, 0.5, "cloud"],
  ["полутень", "#9fc8ff", 16, 0.24, "dim"],
];

const shadowArt = () => `
  <defs>
    <filter id="shBlur1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="shBlur2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="16"/></filter>
    <radialGradient id="shPatch" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d0"/><stop offset="1" stop-color="#fff6d0" stop-opacity="0"/></radialGradient>
  </defs>
  ${SHADOWS.map(([name, color, blur, op, src], i) => {
    const x = 100 + i * 200;
    const d = 0.3 + i * 0.6;
    const bright = [1, 0.6, 0.3][i];
    const icon =
      src === "sun"
        ? sun(x, 80, 26, d, 10)
        : src === "cloud"
          ? `${sun(x + 18, 70, 20, d, 8)}<g class="pop" style="--d:${d + 0.2}"><ellipse cx="${x - 8}" cy="${92}" rx="40" ry="18" fill="#e8eef5"/><ellipse cx="${x + 14}" cy="${80}" rx="26" ry="20" fill="#f4f7fb"/></g>`
          : `<g class="pop" style="--d:${d}"><ellipse cx="${x}" cy="${88}" rx="46" ry="20" fill="#9aa9b8"/><ellipse cx="${x - 16}" cy="${74}" rx="26" ry="20" fill="#b3c0cc"/><ellipse cx="${x + 18}" cy="${78}" rx="22" ry="16" fill="#a5b3c1"/></g>`;
    return `
    ${icon}
    <g class="fade" style="--d:${d + 0.2}"><ellipse cx="${x}" cy="${410}" rx="92" ry="74" fill="url(#shPatch)" opacity="${bright}"/></g>
    ${leaf(x - 30, 470, 0.5, -38, d + 0.3)}${leaf(x + 28, 470, 0.5, 40, d + 0.4, "leafG2")}${leaf(x, 476, 0.55, 2, d + 0.5)}
    <g class="fade" style="--d:${d + 1.2}"><g class="lt-shadow" style="--d:${i * 0.3}">
      <g transform="translate(${x + 4} 404) scale(.95)"><path d="${HAND}" fill="#06150d" opacity="${op}" ${blur ? `filter="url(#${blur > 10 ? "shBlur2" : "shBlur1"})"` : ""}/></g>
    </g></g>
    <g class="rise" style="--d:${d + 0.9}"><g class="lt-hover" style="--d:${i * 0.3}">
      <g transform="translate(${x} 214)">
        <path d="${HAND}" fill="#f2c6a6"/>
        <path d="M-30 -60 L -30 -36 M-12 -76 L -12 -40 M6 -80 L 6 -40 M24 -70 L 24 -26" stroke="#d9a07c" stroke-width="3" stroke-linecap="round"/>
        <rect x="-28" y="40" width="58" height="44" rx="10" fill="#f2c6a6"/>
        <rect x="-32" y="74" width="66" height="22" rx="8" fill="#5aa0d6"/>
      </g>
    </g></g>
    ${label(x, 548, name, color, d + 1.6, 27)}`;
  }).join("")}
  <g class="fade" style="--d:1.4">
    <path d="M556 210 V 380" stroke="#ffffff99" stroke-width="3" stroke-dasharray="6 6"/>
    <path d="M548 220 L 556 206 L 564 220 M548 370 L 556 384 L 564 370" stroke="#ffffff99" stroke-width="3" fill="none"/>
  </g>
  <g transform="translate(578 296) rotate(90)">${label(0, 0, "30 см", "#ffffff", 1.6, 22)}</g>
  ${chip(300, 612, "чёткая · размытая · едва видна", "#ffd36e", 3.6)}`;

// ---------------------------------------------------------------- растение тянется к окну
const stretchArt = () => {
  const P = [
    [440, 470],
    [450, 330],
    [300, 180],
    [170, 150],
  ];
  const at = (t) => {
    const u = 1 - t;
    return [0, 1].map((k) => u ** 3 * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t ** 3 * P[3][k]);
  };
  const nodes = [0.28, 0.52, 0.74, 0.94];
  return `
  <defs>
    <linearGradient id="stPale" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2f7c4"/><stop offset=".6" stop-color="#c3d98a"/><stop offset="1" stop-color="#8fae5c"/></linearGradient>
    <linearGradient id="stWin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff4cf"/><stop offset="1" stop-color="#ffe7a0"/></linearGradient>
  </defs>
  <g class="fade" style="--d:0">
    <rect x="30" y="60" width="110" height="440" rx="14" fill="url(#stWin)" filter="url(#glow)"/>
    <path d="M85 60 V 500 M30 270 H 140" stroke="#d8c9a3" stroke-width="7"/>
  </g>
  <g class="lt-glow"><path d="M140 70 L 470 190 L 470 470 L 140 500 Z" fill="url(#beamG)" opacity=".35"/></g>
  ${sill(500)}
  ${pot(440, 420, 120, 80, 0.3)}
  <g class="lt-lean">
    <path class="draw" style="--d:.8;animation-duration:3s" pathLength="1" d="M${P[0]} C ${P[1]} ${P[2]} ${P[3]}" stroke="#9cbf6a" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${nodes
      .map((t, k) => {
        const [x, y] = at(t);
        const d = 1 + t * 2.7;
        return `<circle class="pop" style="--d:${d}" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="6" fill="#6f9446"/>
        ${edgeLeaf(x.toFixed(0), y.toFixed(0), 0.2 + k * 0.01, k % 2 ? 60 : -100, d + 0.1, "stPale")}`;
      })
      .join("")}
    ${edgeLeaf(170, 150, 0.16, -80, 3.8, "stPale")}
  </g>
  ${(() => {
    const [x1, y1] = at(nodes[1]);
    const [x2, y2] = at(nodes[2]);
    return `<g class="fade" style="--d:4"><path d="M${(x1 + 26).toFixed(0)} ${(y1 + 26).toFixed(0)} L ${(x2 + 26).toFixed(0)} ${(y2 + 26).toFixed(0)}" stroke="#ffd36e" stroke-width="3" stroke-dasharray="7 6"/>
      <circle cx="${(x1 + 26).toFixed(0)}" cy="${(y1 + 26).toFixed(0)}" r="5" fill="#ffd36e"/><circle cx="${(x2 + 26).toFixed(0)}" cy="${(y2 + 26).toFixed(0)}" r="5" fill="#ffd36e"/></g>
      <g class="fade" style="--d:4.2"><path d="M300 352 Q ${((x1 + x2) / 2 - 10).toFixed(0)} ${((y1 + y2) / 2 + 70).toFixed(0)} ${((x1 + x2) / 2 + 20).toFixed(0)} ${((y1 + y2) / 2 + 30).toFixed(0)}" stroke="#ffd36e" stroke-width="2.5" fill="none" stroke-dasharray="4 5"/></g>
      ${label(270, 386, "длинные", "#ffd36e", 4.2, 28)}${label(270, 418, "междоузлия", "#ffd36e", 4.3, 28)}`;
  })()}
  <g class="fade" style="--d:1.8"><g class="lt-nudge">
    <path d="M300 92 L 200 92" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
    <path d="M216 78 L 198 92 L 216 106" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g></g>
  ${label(380, 102, "к свету", "#ffffff", 2, 26)}
  ${chip(170, 586, "мелкие листья", "#c9e27a", 4.8)}${chip(440, 586, "бледные", "#c9e27a", 5.2)}`;
};

// ---------------------------------------------------------------- большой лист с симптомами
const LEAF = "M0 0 C -150 -40 -185 -250 0 -400 C 185 -250 150 -40 0 0 Z";
const VEINS = [
  [-50, 75],
  [-110, 100],
  [-170, 102],
  [-230, 85],
  [-290, 52],
];
const veins = (stroke, w, op, cls = "") =>
  `<path ${cls} pathLength="1" d="M0 -6 C 4 -120 -2 -260 0 -386" stroke="${stroke}" stroke-opacity="${op}" stroke-width="${w * 1.4}" fill="none" stroke-linecap="round"/>` +
  VEINS.map(([y, x]) =>
    [-1, 1]
      .map(
        (s) =>
          `<path ${cls} pathLength="1" d="M0 ${y} Q ${s * x * 0.45} ${y - 18} ${s * x} ${y - 62}" stroke="${stroke}" stroke-opacity="${op}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`,
      )
      .join(""),
  ).join("");

const LEAF_CHIP = {
  burn: "#ffb38a",
  tips: "#e8b070",
  mildew: "#d8e8ff",
  spots: "#ffd36e",
  chlorosis: "#ffe08a",
  variegated: "#fff3c2",
  question: "#8be3a8",
};

const symptom = (kind) => {
  switch (kind) {
    case "burn":
      return `
        ${[
          [62, -150, 36, "#f3e7b8", 1],
          [92, -112, 20, "#8b5a2b", 2],
          [84, -232, 28, "#8b5a2b", 3],
          [38, -300, 22, "#f3e7b8", 4],
          [24, -205, 16, "#a0672e", 5],
          [110, -190, 24, "#f3e7b8", 6],
        ]
          .map(
            ([x, y, r, c, s], i) =>
              `<g class="fade" style="--d:${1.4 + i * 0.35}"><path d="${blob(x, y, r + 6, s)}" fill="#e8c860" opacity=".55"/><path d="${blob(x, y, r, s)}" fill="${c}" stroke="#6b3d1c" stroke-opacity=".5" stroke-width="3"/></g>`,
          )
          .join("")}`;
    case "tips":
      return `
        <g class="fade" style="--d:1.4">
          <path d="M-220 -480 H 220 V -288 Q 120 -266 60 -296 Q 0 -270 -60 -300 Q -120 -272 -220 -292 Z" fill="#d9b44a" opacity=".85"/>
          <path d="M-220 -480 H 220 V -306 Q 110 -290 50 -318 Q 0 -296 -50 -322 Q -110 -296 -220 -312 Z" fill="url(#lfBrown)"/>
        </g>
        <g class="fade" style="--d:2.2"><path d="${blob(-128, -150, 24, 3)}" fill="#8b5a2b"/><path d="${blob(132, -120, 20, 5)}" fill="#8b5a2b"/></g>`;
    case "mildew":
      return `
        <g filter="url(#lfMblur)">${[
          [-50, -120, 30],
          [40, -170, 36],
          [-70, -230, 26],
          [20, -280, 28],
          [80, -100, 22],
          [-20, -60, 20],
          [60, -240, 20],
          [-90, -160, 18],
          [0, -340, 16],
          [-30, -190, 22],
        ]
          .map(
            ([x, y, r], i) =>
              `<g class="fade" style="--d:${1.2 + i * 0.22}"><path d="${blob(x, y, r, i + 2)}" fill="#f6f6f0" opacity=".82"/></g>`,
          )
          .join("")}</g>
        ${Array.from({ length: 22 }, (_, i) => `<circle class="fade" style="--d:${1.4 + i * 0.1}" cx="${((i * 53) % 200) - 100}" cy="${-60 - ((i * 97) % 280)}" r="${2 + (i % 3)}" fill="#ffffff"/>`).join("")}`;
    case "spots":
      return [
        [-50, -130],
        [50, -200],
        [-30, -270],
        [70, -110],
        [-80, -200],
      ]
        .map(
          ([x, y], i) => `
          <g class="pop" style="--d:${1.4 + i * 0.4}">
            <g class="lt-halo" style="--d:${i * 0.4}"><circle cx="${x}" cy="${y}" r="30" fill="#f2cf4a" opacity=".8" filter="url(#lfHblur)"/></g>
            <path d="${blob(x, y, 17, i + 3)}" fill="#7a4520"/>
            <circle cx="${x + 2}" cy="${y + 1}" r="6" fill="#3d200c"/>
          </g>`,
        )
        .join("");
    case "chlorosis":
      return `
        <g class="fade" style="--d:1.2"><path d="${LEAF}" fill="url(#lfYel)"/></g>
        <g class="lt-veinglow">${veins("#2f9d5c", 9, 1, 'class="draw" style="--d:2"')}</g>`;
    case "variegated":
      return `
        <g class="fade" style="--d:1"><path d="${LEAF}" fill="none" stroke="#f6f2d6" stroke-width="64"/></g>
        ${[
          [-96, -150, 30, 2],
          [100, -210, 26, 4],
          [-60, -300, 22, 6],
          [88, -96, 24, 8],
        ]
          .map(([x, y, r, k], i) => `<g class="fade" style="--d:${1.2 + i * 0.2}"><path d="${blob(x, y, r, k, 7)}" fill="#f6f2d6"/></g>`)
          .join("")}
        ${[
          [-40, -130, -50],
          [44, -180, 46],
          [-36, -240, -48],
          [30, -290, 44],
          [50, -110, 52],
          [-46, -190, -52],
        ]
          .map(
            ([x, y, a], i) =>
              `<g transform="translate(${x} ${y}) rotate(${a})"><g class="fade" style="--d:${1.6 + i * 0.2}"><ellipse rx="9" ry="34" fill="#e8f3c6"/></g></g>`,
          )
          .join("")}`;
    default:
      return "";
  }
};

const symptomOuter = (kind) => {
  switch (kind) {
    case "burn":
      return `
        <g class="fade" style="--d:.2">
          <rect x="530" y="40" width="54" height="470" rx="10" fill="url(#glassG)" stroke="#e9e1d2" stroke-width="6"/>
          <path d="M546 80 L 566 60 M546 140 L 572 114" stroke="#ffffff" stroke-opacity=".6" stroke-width="4" stroke-linecap="round"/>
        </g>
        <g class="lt-glow"><path d="M560 120 L 360 200 L 380 330 L 560 260 Z" fill="url(#lfBeam)" opacity=".5"/></g>
        ${sun(510, 88, 34, 0.6)}
        ${label(470, 170, "стекло", "#ffffff", 1, 22, "end")}`;
    case "tips":
      return Array.from(
        { length: 5 },
        (_, i) =>
          `<g transform="translate(${250 + i * 26} 150)"><path class="lt-crumb" style="--d:${2.6 + i * 0.5}" d="M0 0 l 8 -4 l 4 7 l -9 4 Z" fill="#8b5a2b"/></g>`,
      ).join("");
    case "variegated":
      return sun(510, 90, 30, 2.6);
    case "mildew":
      return Array.from(
        { length: 8 },
        (_, i) =>
          `<circle class="lt-spore" style="--d:${2 + i * 0.45}" cx="${200 + ((i * 47) % 200)}" cy="${300 - ((i * 31) % 120)}" r="4" fill="#ffffff"/>`,
      ).join("");
    case "question":
      return `
        ${[
          [130, 150, 64, 0.8],
          [470, 120, 52, 1.2],
          [500, 330, 44, 1.6],
        ]
          .map(
            ([x, y, s, d], i) =>
              `<g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}"><g class="lt-float" style="--d:${i * 0.6}"><text y="${s * 0.35}" fill="#ffd36e" font-family="Unbounded" font-weight="900" font-size="${s}" text-anchor="middle">?</text></g></g></g>`,
          )
          .join("")}
        <g class="lt-scan">
          <circle r="62" fill="url(#glassG)" stroke="#e8fff0" stroke-width="10"/>
          <g transform="rotate(-45)"><rect x="-14" y="66" width="28" height="92" rx="12" fill="#8be3a8"/></g>
        </g>
        <g transform="translate(176 560) rotate(-118)">${edgeLeaf(0, 0, 0.62, 0, 2.6, "leafY")}</g>
        <g transform="translate(176 560)"><g class="fade" style="--d:2.6"><path d="M0 0 L 40 0" stroke="#4f9a4a" stroke-width="7" stroke-linecap="round"/></g></g>
        ${badge(90, 470, true, 3.4, 26)}${label(90, 524, "норма", "#8be3a8", 3.6, 24)}`;
    default:
      return "";
  }
};

const leafArt = (o = {}) => {
  const kind = o.kind ?? "question";
  const color = LEAF_CHIP[kind] ?? "#ffb38a";
  const rows = chipRows(o.chips ?? [], color, 3.2);
  const baseY = kind === "question" ? 540 : Math.min(520, rows.top - 56);
  const s = Math.min(1.12, (baseY - 66) / 420);
  const lx = kind === "question" ? 330 : 300;
  return `
  <defs>
    <linearGradient id="lfBig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ef0ae"/><stop offset=".5" stop-color="#34a862"/><stop offset="1" stop-color="#145a33"/></linearGradient>
    <linearGradient id="lfYel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".6" stop-color="#ead05a"/><stop offset="1" stop-color="#b8961e"/></linearGradient>
    <linearGradient id="lfBrown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3216"/><stop offset=".7" stop-color="#8b5a2b"/><stop offset="1" stop-color="#a87238"/></linearGradient>
    <linearGradient id="lfBeam" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff2c4" stop-opacity=".9"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></linearGradient>
    <clipPath id="lfClip"><path d="${LEAF}"/></clipPath>
    <filter id="lfMblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="lfHblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <g transform="translate(${lx} ${baseY}) rotate(${kind === "question" ? 8 : -4}) scale(${s.toFixed(3)})"><g class="lt-leafsway"><g class="pop" style="--d:.2">
    <ellipse cx="18" cy="-170" rx="140" ry="200" fill="#000" opacity=".3" filter="url(#soft)"/>
    <path d="M0 0 C 3 14 7 26 14 40" stroke="#4f9a4a" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="${LEAF}" fill="url(#lfBig)"/>
    <g clip-path="url(#lfClip)">${symptom(kind)}</g>
    ${kind === "chlorosis" ? "" : veins("#0f3f23", 4, 0.45)}
    <path d="M-80 -300 C -120 -240 -128 -160 -112 -96" stroke="#ffffff" stroke-opacity=".3" stroke-width="12" stroke-linecap="round" fill="none"/>
  </g></g></g>
  ${symptomOuter(kind)}
  ${rows.svg}`;
};

// ---------------------------------------------------------------- фитолампа
const lampArt = () => `
  <defs>
    <linearGradient id="lmCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9ee6" stop-opacity=".75"/><stop offset=".6" stop-color="#c79bff" stop-opacity=".25"/><stop offset="1" stop-color="#c79bff" stop-opacity="0"/></linearGradient>
    <linearGradient id="lmBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c6670"/><stop offset="1" stop-color="#2a3138"/></linearGradient>
  </defs>
  <g class="fade" style="--d:0"><path d="M200 30 V 66 M400 30 V 66" stroke="#9aa5ae" stroke-width="3"/></g>
  <g class="lt-glow" style="--d:1"><g class="fade" style="--d:1"><path d="M190 96 L 410 96 L 520 520 L 80 520 Z" fill="url(#lmCone)"/></g></g>
  <g class="rise" style="--d:.2">
    <rect x="170" y="62" width="260" height="36" rx="12" fill="url(#lmBar)"/>
    <rect x="178" y="66" width="244" height="6" rx="3" fill="#ffffff" opacity=".25"/>
    ${Array.from({ length: 11 }, (_, i) => `<circle class="lt-led" style="--d:${0.9 + i * 0.06}" cx="${190 + i * 22}" cy="94" r="6" fill="${i % 3 === 1 ? "#7ab8ff" : "#ff5fb0"}" filter="url(#glow)"/>`).join("")}
  </g>
  ${potted(300, 572, 1.3, 0.5, "leafy")}
  <g class="fade" style="--d:2.2">
    <path d="M440 110 V 228" stroke="#ffffff" stroke-width="3" stroke-dasharray="6 6"/>
    <path d="M432 122 L 440 108 L 448 122 M432 216 L 440 230 L 448 216" stroke="#ffffff" stroke-width="3" fill="none"/>
  </g>
  ${label(460, 180, "20–30 см", "#ffffff", 2.4, 26, "start")}
  <g transform="translate(96 300)"><g class="pop" style="--d:2.8">
    <circle r="60" fill="#0d2a1b" stroke="#d9a3ff" stroke-width="4"/>
    <g transform="rotate(-90)"><circle class="draw" style="--d:3;animation-duration:3.5s" pathLength="1" r="48" fill="none" stroke="#d9a3ff" stroke-width="10" stroke-linecap="round" stroke-dasharray="1" transform="scale(1 1)"/></g>
    <g class="lt-hand"><path d="M0 0 V -34" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/></g>
    <path d="M0 0 H 22" stroke="#ffffffb0" stroke-width="4" stroke-linecap="round"/>
    <circle r="6" fill="#ffffff"/>
  </g></g>
  ${label(96, 398, "12–14 ч", "#d9a3ff", 3.2, 30)}
  ${label(96, 428, "в день", "#ffffffc0", 3.4, 20)}
  ${chip(300, 616, "октябрь – март", "#d9a3ff", 4)}`;

// ---------------------------------------------------------------- поворот горшка (вид сверху)
const turnArt = () => `
  <defs>
    <radialGradient id="tnSoil" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5a3a24"/><stop offset="1" stop-color="#2e1c10"/></radialGradient>
    <radialGradient id="tnRim" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#f0a072"/><stop offset=".7" stop-color="#c4643a"/><stop offset="1" stop-color="#8e3f22"/></radialGradient>
  </defs>
  <g class="fade" style="--d:0">
    <rect x="24" y="70" width="70" height="460" rx="12" fill="#fff4cf" filter="url(#glow)"/>
    <path d="M24 300 H 94" stroke="#d8c9a3" stroke-width="6"/>
  </g>
  <g class="lt-glow"><path d="M94 80 L 470 220 L 470 380 L 94 520 Z" fill="url(#beamG)" opacity=".3"/></g>
  ${label(59, 562, "окно", "#ffffff", 0.4, 22)}
  <g transform="translate(330 300)">
    <g class="pop" style="--d:.2">
      <ellipse cx="10" cy="16" rx="160" ry="160" fill="#000" opacity=".4" filter="url(#soft)"/>
      <circle r="150" fill="url(#tnRim)"/>
      <circle r="124" fill="url(#tnSoil)"/>
    </g>
    <g class="lt-quarter">
      ${[0, 1, 2, 3, 4, 5, 6]
        .map((k) => {
          const a = k * (360 / 7) + 12;
          return `<g transform="rotate(${a})">${edgeLeaf(0, 0, 0.82 - (k % 2) * 0.12, 90, 0.5 + k * 0.12, k % 2 ? "leafG2" : "leafG")}</g>`;
        })
        .join("")}
      <circle r="16" fill="#4f9a4a"/>
      <g transform="rotate(12) translate(104 0)"><g class="pop" style="--d:1.6"><circle r="13" fill="#ff6b6b" stroke="#ffffff" stroke-width="4"/></g></g>
    </g>
    <g class="fade" style="--d:1.8">
      <path class="lt-arcdash" d="M 0 -196 A 196 196 0 0 1 196 0" stroke="#8be3a8" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="20 14"/>
      <path d="M 180 -18 L 196 6 L 214 -16" stroke="#8be3a8" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
  <g transform="translate(510 80)"><g class="pop" style="--d:2.2">
    <circle r="54" fill="#0d2a1b" stroke="#8be3a8" stroke-width="4"/>
    <path d="M0 0 L 0 -42 A 42 42 0 0 1 42 0 Z" fill="#8be3a8"/>
    <circle r="42" fill="none" stroke="#8be3a855" stroke-width="3"/>
  </g></g>
  ${label(434, 72, "¼ оборота", "#8be3a8", 2.6, 28, "end")}
  ${chip(330, 612, "раз в 1–2 недели", "#8be3a8", 3.2)}`;

// ---------------------------------------------------------------- корни: воздух против гнили
const rootsArt = () => `
  <defs>
    <clipPath id="rtIn"><path d="M110 168 L 490 168 L 444 548 L 156 548 Z"/></clipPath>
    <linearGradient id="rtAir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5c3a"/><stop offset="1" stop-color="#5a3a24"/></linearGradient>
    <linearGradient id="rtWet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2416"/><stop offset="1" stop-color="#160c06"/></linearGradient>
    <linearGradient id="rtPool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa0e6" stop-opacity=".25"/><stop offset="1" stop-color="#2f80ed" stop-opacity=".55"/></linearGradient>
  </defs>
  <g class="rise" style="--d:0">
    <ellipse cx="300" cy="576" rx="230" ry="16" fill="#000" opacity=".45" filter="url(#soft)"/>
    <path d="M96 150 L 504 150 L 456 564 L 144 564 Z" fill="url(#potG)"/>
    <g clip-path="url(#rtIn)">
      <rect x="100" y="160" width="200" height="400" fill="url(#rtAir)"/>
      <rect x="300" y="160" width="200" height="400" fill="url(#rtWet)"/>
      ${Array.from({ length: 34 }, (_, i) => `<circle cx="${120 + ((i * 61) % 180)}" cy="${190 + ((i * 89) % 350)}" r="${3 + (i % 4)}" fill="${i % 2 ? "#a77a52" : "#3f2716"}"/>`).join("")}
      <g class="fade" style="--d:.9"><rect x="300" y="330" width="200" height="230" fill="url(#rtPool)"/></g>
      <g class="lt-wave"><path d="M300 330 Q 325 322 350 330 T 400 330 T 450 330 T 500 330" stroke="#9fd6ff" stroke-width="3" fill="none" opacity=".7"/></g>
    </g>
    <rect x="84" y="128" width="432" height="36" rx="10" fill="#c4643a"/>
    <rect x="84" y="128" width="432" height="8" rx="4" fill="#f0a072" opacity=".6"/>
  </g>
  <g class="fade" style="--d:.6"><path d="M300 176 V 552" stroke="#ffffff" stroke-width="3" stroke-dasharray="8 8" opacity=".6"/></g>
  ${[
    "M290 176 C 270 240 240 280 200 330",
    "M282 210 C 250 270 210 300 170 300",
    "M200 330 C 190 380 200 430 180 500",
    "M240 280 C 250 340 240 400 260 470",
    "M200 330 C 160 360 150 400 140 420",
  ]
    .map(
      (p, i) =>
        `<path class="draw" style="--d:${0.8 + i * 0.25}" pathLength="1" d="${p}" stroke="#f3ead8" stroke-width="${8 - i}" fill="none" stroke-linecap="round"/>`,
    )
    .join("")}
  ${[
    "M310 176 C 330 240 360 280 400 330",
    "M318 210 C 350 270 390 300 430 300",
    "M400 330 C 410 380 400 430 420 500",
    "M360 280 C 350 340 360 400 340 470",
  ]
    .map(
      (p, i) =>
        `<path class="draw" style="--d:${1.2 + i * 0.25}" pathLength="1" d="${p}" stroke="#6b4a2a" stroke-width="${8 - i}" fill="none" stroke-linecap="round"/>`,
    )
    .join("")}
  ${[
    [400, 330],
    [420, 500],
    [340, 470],
    [430, 300],
    [362, 390],
  ]
    .map(
      ([x, y], i) =>
        `<g class="pop" style="--d:${2.4 + i * 0.3}"><path d="${blob(x, y, 12, i + 1)}" fill="#1a0e06" stroke="#4a3018" stroke-width="3"/></g>`,
    )
    .join("")}
  ${Array.from({ length: 9 }, (_, i) => `<circle class="lt-bubble" style="--d:${1.4 + i * 0.37}" cx="${130 + ((i * 47) % 150)}" cy="${520 - ((i * 71) % 220)}" r="${5 + (i % 3) * 2}" fill="#ffffff" fill-opacity=".25" stroke="#ffffff" stroke-width="2"/>`).join("")}
  ${stem("M300 132 C 296 96 304 70 300 40", 0.6, 8)}
  ${leaf(300, 50, 0.32, -50, 1)}${leaf(300, 70, 0.3, 56, 1.2, "leafG2")}
  ${chip(160, 616, "воздух", "#8be3a8", 2.6)}${chip(440, 616, "гниль", "#ff8a8f", 3.2)}`;

// ---------------------------------------------------------------- вес и шпажка
const weighPot = (wet) => `
  <path d="M-56 -86 L 56 -86 L 44 0 L -44 0 Z" fill="url(#potG)"/>
  <rect x="-62" y="-98" width="124" height="22" rx="7" fill="#c4643a"/>
  <ellipse cx="0" cy="-90" rx="54" ry="7" fill="${wet ? "#24160c" : "#c79a6a"}"/>
  ${
    wet
      ? `<ellipse cx="-14" cy="-92" rx="16" ry="3" fill="#9fd6ff" opacity=".7"/>${[0, 1].map((k) => `<g transform="translate(${-20 + k * 40} 2)"><path class="drip" style="--d:${2 + k * 0.7}" d="M0 0 q 7 12 0 18 q -7 -6 0 -18 Z" fill="#7cc4ff"/></g>`).join("")}`
      : `<path d="M-30 -92 l 10 3 l 8 -4 M8 -90 l 12 2" stroke="#8a6a44" stroke-width="2" fill="none"/>`
  }`;

const weighArt = () => `
  <g class="rise" style="--d:0">
    <path d="M300 92 V 318" stroke="#cfd8dc" stroke-width="12" stroke-linecap="round"/>
    <path d="M240 330 Q 300 304 360 330 Z" fill="#cfd8dc"/>
    <rect x="236" y="326" width="128" height="14" rx="7" fill="#9aa5ae"/>
  </g>
  <g transform="translate(300 92)"><g class="lt-tilt">
    <rect x="-190" y="-7" width="380" height="14" rx="7" fill="#e6edf0"/>
    <circle r="14" fill="#ffd36e"/>
    ${[
      [-180, false],
      [180, true],
    ]
      .map(
        ([x, wet]) => `
      <g transform="translate(${x} 0)"><g class="lt-untilt">
        <path d="M0 0 L -66 116 M0 0 L 66 116" stroke="#cfd8dc" stroke-width="3"/>
        <circle r="7" fill="#e6edf0"/>
        <path d="M-80 116 H 80 Q 70 132 0 132 Q -70 132 -80 116 Z" fill="#9aa5ae"/>
        <g transform="translate(0 116)">${weighPot(wet)}</g>
        <text y="172" fill="${wet ? "#7cc4ff" : "#ffd36e"}" font-family="Manrope" font-weight="800" font-size="26" text-anchor="middle">${wet ? "тяжёлый" : "лёгкий"}</text>
      </g></g>`,
      )
      .join("")}
  </g></g>
  <g class="rise" style="--d:1.6">
    <ellipse cx="190" cy="574" rx="120" ry="12" fill="#000" opacity=".4" filter="url(#soft)"/>
    <path d="M90 430 L 290 430 L 268 564 L 112 564 Z" fill="url(#potG)" opacity=".5"/>
    <path d="M100 444 L 280 444 L 262 556 L 118 556 Z" fill="url(#dryG)"/>
    ${Array.from({ length: 14 }, (_, i) => `<circle cx="${112 + ((i * 41) % 150)}" cy="${456 + ((i * 29) % 90)}" r="${2 + (i % 3)}" fill="#8a6a44"/>`).join("")}
    <rect x="82" y="414" width="216" height="24" rx="8" fill="#c4643a"/>
  </g>
  <g class="lt-pull">
    <rect class="fade" style="--d:1.8" x="185" y="376" width="10" height="174" rx="4" fill="#e6c48a" stroke="#b08850" stroke-width="2"/>
  </g>
  <g class="fade" style="--d:3.8">
    <path d="M214 330 C 260 330 300 360 340 420" stroke="#ffffff99" stroke-width="3" stroke-dasharray="6 6" fill="none"/>
  </g>
  <g transform="translate(430 470)"><g class="pop" style="--d:4">
    <circle r="78" fill="#ffffff10" stroke="#ffd36e" stroke-width="4"/>
    <g transform="rotate(-30)"><rect x="-8" y="-60" width="16" height="120" rx="6" fill="#e6c48a" stroke="#b08850" stroke-width="2"/></g>
  </g></g>
  ${badge(492, 412, true, 4.6, 24)}
  ${chip(330, 612, "шпажка чистая — поливаем", "#7cc4ff", 5)}`;

// ---------------------------------------------------------------- полив до поддона
const soakArt = () => `
  <defs>
    <linearGradient id="skCan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd6c4"/><stop offset="1" stop-color="#2a8f80"/></linearGradient>
    <clipPath id="skSoil"><path d="M236 334 L 464 334 L 442 500 L 258 500 Z"/></clipPath>
  </defs>
  ${stem("M372 316 C 368 260 380 200 372 130", 0.6)}
  ${stem("M372 250 C 410 230 430 210 440 186", 1, 7)}
  ${leaf(372, 138, 0.5, 6, 1)}${leaf(438, 192, 0.42, 40, 1.3, "leafG2")}${leaf(372, 240, 0.4, -40, 1.5)}
  <g class="rise" style="--d:.2">
    <ellipse cx="350" cy="560" rx="170" ry="14" fill="#000" opacity=".4" filter="url(#soft)"/>
    <ellipse cx="350" cy="536" rx="160" ry="22" fill="#a94f2c"/>
    <ellipse cx="350" cy="530" rx="146" ry="15" fill="#5a2a14"/>
  </g>
  <g class="fade" style="--d:2.6"><g class="lt-pool"><ellipse cx="350" cy="531" rx="130" ry="11" fill="url(#waterG)"/></g></g>
  <g class="rise" style="--d:.3">
    <path d="M226 320 L 474 320 L 448 512 L 252 512 Z" fill="url(#potG)"/>
    <rect x="214" y="300" width="272" height="36" rx="10" fill="#c4643a"/>
    <rect x="214" y="300" width="272" height="8" rx="4" fill="#f0a072" opacity=".6"/>
    <ellipse cx="350" cy="306" rx="128" ry="9" fill="#3b2516"/>
  </g>
  <g class="lt-wetten"><ellipse cx="350" cy="306" rx="128" ry="9" fill="#c79a6a"/></g>
  ${[300, 350, 400]
    .map(
      (x, i) =>
        `<g transform="translate(${x} 512)">${[0, 1].map((k) => `<path class="lt-drip2" style="--d:${2.2 + i * 0.25 + k * 0.6}" d="M0 0 q 7 12 0 18 q -7 -6 0 -18 Z" fill="#7cc4ff"/>`).join("")}</g>`,
    )
    .join("")}
  <g transform="translate(150 150) rotate(28)"><g class="rise" style="--d:.8">
    <path d="M-80 -50 L 60 -50 L 70 60 L -90 60 Z" fill="url(#skCan)"/>
    <path d="M-80 -50 L 60 -50 L 62 -30 L -82 -30 Z" fill="#ffffff" opacity=".25"/>
    <path d="M-80 -40 C -140 -40 -140 40 -86 40" stroke="#2a8f80" stroke-width="12" fill="none"/>
    <path d="M60 20 L 150 -40 L 160 -26 L 68 44 Z" fill="#2a8f80"/>
    <rect x="148" y="-56" width="24" height="34" rx="6" fill="#1f6f63" transform="rotate(-36 160 -40)"/>
  </g></g>
  ${Array.from(
    { length: 12 },
    (_, i) =>
      `<path class="rain" style="--d:${1.5 + (i % 6) * 0.18 + Math.floor(i / 6) * 0.55};--dx:${((i * 17) % 30) - 10}px" d="M${250 + ((i * 13) % 34)} 160 q 6 11 0 17 q -6 -6 0 -17 Z" fill="#9fd6ff"/>`,
  ).join("")}
  ${chip(300, 612, "пока не потечёт в поддон", "#7cc4ff", 3.6)}`;

// ---------------------------------------------------------------- слить воду из поддона
const saucerArt = () => `
  <defs>
    <linearGradient id="scFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6fffb"/><stop offset="1" stop-color="#b8eee6"/></linearGradient>
  </defs>
  <g transform="translate(150 170)"><g class="pop" style="--d:.2">
    <rect x="-16" y="-112" width="32" height="20" rx="6" fill="#9aa5ae"/>
    <circle r="96" fill="#1c3a30" stroke="#62e3d3" stroke-width="6"/>
    <circle r="80" fill="url(#scFace)"/>
    <g transform="rotate(-90)">
      <circle r="80" fill="none" stroke="#62e3d3" stroke-width="10" stroke-opacity=".3"/>
      <circle class="draw" style="--d:.8;animation-duration:4s" pathLength="1" r="80" fill="none" stroke="#1fae9c" stroke-width="10" stroke-linecap="round"/>
    </g>
    <text data-count="20" data-start=".8" data-dur="4" y="18" fill="#123d36" font-family="Unbounded" font-weight="900" font-size="60" text-anchor="middle">1</text>
    <text y="50" fill="#1f6f63" font-family="Manrope" font-weight="800" font-size="22" text-anchor="middle">мин</text>
  </g></g>
  ${label(150, 306, "15–20 минут", "#62e3d3", 1.2, 26)}
  ${sun(470, 112, 40, 2.4)}
  ${label(470, 214, "утром", "#ffd36e", 2.8, 30)}
  ${sill(560, 0)}
  ${potted(150, 560, 0.8, 0.6, "leafy")}
  <g transform="translate(470 470)"><g class="lt-tray">
    <g class="rise" style="--d:1">
      <path d="M-200 -8 L 0 -8 L -16 22 Q -100 34 -184 22 Z" fill="url(#potG)"/>
      <ellipse cx="-100" cy="-8" rx="100" ry="22" fill="#c4643a"/>
      <ellipse cx="-100" cy="-6" rx="88" ry="16" fill="#6b3018"/>
      <g class="lt-empty"><ellipse cx="-100" cy="-5" rx="84" ry="14" fill="url(#waterG)"/></g>
    </g>
  </g></g>
  ${Array.from({ length: 6 }, (_, i) => `<g transform="translate(${470 + (i % 3) * 6} 470)"><path class="lt-pour" style="--d:${3.2 + i * 0.22}" d="M0 0 q 8 14 0 22 q -8 -8 0 -22 Z" fill="#7cc4ff"/></g>`).join("")}
  ${chip(300, 616, "слить воду из поддона", "#62e3d3", 3.6)}`;

// ---------------------------------------------------------------- перелив / недолив
const pairSide = (x, [state, title, sub], d) => {
  const wet = state !== "dry";
  const color = wet ? "#7cc4ff" : "#ffb38a";
  return `
  ${label(x, 72, title, color, d, 34)}
  <g class="rise" style="--d:${d + 0.2}">
    <ellipse cx="${x}" cy="510" rx="110" ry="12" fill="#000" opacity=".45" filter="url(#soft)"/>
    <path d="M${x - 85} 380 L ${x + 85} 380 L ${x + 66} 500 L ${x - 66} 500 Z" fill="url(#potG)"/>
    <rect x="${x - 97}" y="356" width="194" height="34" rx="10" fill="#c4643a"/>
    <rect x="${x - 97}" y="356" width="194" height="8" rx="4" fill="#f0a072" opacity=".6"/>
    <ellipse cx="${x}" cy="362" rx="85" ry="10" fill="${wet ? "#1a0f08" : "#2a1a10"}"/>
    ${
      wet
        ? `<ellipse cx="${x}" cy="362" rx="83" ry="9" fill="#24160c"/><ellipse cx="${x - 26}" cy="361" rx="24" ry="4" fill="#9fd6ff" opacity=".7"/><ellipse cx="${x + 30}" cy="363" rx="14" ry="3" fill="#9fd6ff" opacity=".55"/>`
        : `<ellipse cx="${x}" cy="363" rx="70" ry="7" fill="url(#dryG)"/><path d="M${x - 40} 362 l 12 2 l 8 -3 M${x + 6} 364 l 10 -3 l 10 2 M${x - 10} 360 l 4 4" stroke="#7a5638" stroke-width="2" fill="none"/>`
    }
  </g>
  ${stem(`M${x} 356 C ${x - 4} 300 ${x + 6} 230 ${x} 170`, d + 0.6, 8)}
  ${
    wet
      ? `${leaf(x, 180, 0.5, 4, d + 1)}${leaf(x + 2, 250, 0.42, 48, d + 1.1, "leafG2")}${leaf(x - 2, 230, 0.42, -46, d + 1.2)}
         <g class="lt-sag" style="--r:18deg;--d:${d}">${edgeLeaf(x + 2, 320, 0.44, 112, d + 1.4, "leafY")}</g>
         <g class="lt-sag" style="--r:-18deg;--d:${d}">${edgeLeaf(x - 2, 330, 0.42, -116, d + 1.5, "leafY")}</g>
         ${[0, 1, 2].map((k) => `<g transform="translate(${x - 50 + k * 50} 506)"><path class="drip" style="--d:${d + 2 + k * 0.5}" d="M0 0 q 7 12 0 18 q -7 -6 0 -18 Z" fill="#7cc4ff"/></g>`).join("")}`
      : `<g class="lt-wilt" style="--d:${d + 1.6}">
         ${edgeLeaf(x, 176, 0.46, 150, d + 1, "leafG", "#a0672e")}
         ${edgeLeaf(x + 2, 240, 0.42, 128, d + 1.1, "leafG2", "#a0672e")}
         ${edgeLeaf(x - 2, 260, 0.42, -132, d + 1.2, "leafG", "#a0672e")}
         ${edgeLeaf(x, 310, 0.38, -140, d + 1.3, "leafY", "#8b5a2b")}</g>
         ${[0, 1, 2].map((k) => `<g transform="translate(${x - 92 + k * 6} 380)"><path class="lt-dust" style="--d:${d + 2 + k * 0.6}" d="M0 0 l 3 -6 l 3 6 Z" fill="#c79a6a"/></g>`).join("")}`
  }
  ${chip(x, 570, sub, color, d + 2.4)}`;
};

const pairArt = (o = {}) => `
  ${pairSide(150, o.left ?? ["wet", "перелив", "грунт мокрый"], 0.2)}
  ${pairSide(450, o.right ?? ["dry", "недолив", "грунт сухой"], 1)}
  <g class="fade" style="--d:1.6"><path d="M300 110 V 520" stroke="#ffffff" stroke-opacity=".25" stroke-width="3" stroke-dasharray="8 10"/></g>`;

// ---------------------------------------------------------------- вялое + мокрое = не поливать
const alertArt = (o = {}) => `
  <g class="rise" style="--d:0">
    <ellipse cx="190" cy="534" rx="130" ry="13" fill="#000" opacity=".45" filter="url(#soft)"/>
    <path d="M90 400 L 290 400 L 266 524 L 114 524 Z" fill="url(#potG)"/>
    <rect x="76" y="374" width="228" height="36" rx="10" fill="#c4643a"/>
    <rect x="76" y="374" width="228" height="8" rx="4" fill="#f0a072" opacity=".6"/>
    <ellipse cx="190" cy="381" rx="100" ry="10" fill="#1a0f08"/>
    <ellipse cx="160" cy="380" rx="28" ry="4" fill="#9fd6ff" opacity=".7"/>
    <ellipse cx="222" cy="382" rx="16" ry="3" fill="#9fd6ff" opacity=".55"/>
  </g>
  ${stem("M190 376 C 186 320 196 280 180 220 C 172 190 150 176 130 182", 0.5, 8)}
  <g class="lt-droop">
    ${edgeLeaf(132, 184, 0.44, -160, 1.1)}
    ${edgeLeaf(186, 270, 0.42, 140, 1.2, "leafG2")}
    ${edgeLeaf(184, 300, 0.4, -138, 1.3, "leafY")}
    ${edgeLeaf(190, 340, 0.38, 128, 1.4, "leafY")}
  </g>
  ${[0, 1, 2].map((k) => `<g transform="translate(${150 + k * 40} 528)"><path class="drip" style="--d:${1.6 + k * 0.5}" d="M0 0 q 7 12 0 18 q -7 -6 0 -18 Z" fill="#7cc4ff"/></g>`).join("")}
  <g transform="translate(440 210)"><g class="pop" style="--d:1.4"><g class="lt-shake">
    <path d="M0 -118 L 112 84 L -112 84 Z" fill="#ffcf4a" stroke="#ffcf4a" stroke-width="24" stroke-linejoin="round" filter="url(#glow)"/>
    <path d="M0 -96 L 94 72 L -94 72 Z" fill="none" stroke="#3a2a05" stroke-width="6" stroke-linejoin="round"/>
    <rect x="-11" y="-56" width="22" height="80" rx="11" fill="#3a2a05"/>
    <circle cy="50" r="13" fill="#3a2a05"/>
  </g></g></g>
  <g transform="translate(440 410)"><g class="pop" style="--d:2.2">
    <circle r="56" fill="#ffffff12" stroke="#ff6b6b" stroke-width="7"/>
    <g transform="scale(.42) translate(-10 10)">
      <path d="M-80 -50 L 60 -50 L 70 60 L -90 60 Z" fill="#7fd6c4"/>
      <path d="M-80 -40 C -140 -40 -140 40 -86 40" stroke="#2a8f80" stroke-width="14" fill="none"/>
      <path d="M60 20 L 140 -40 L 150 -26 L 68 44 Z" fill="#2a8f80"/>
    </g>
    <path d="M-40 -40 L 40 40" stroke="#ff6b6b" stroke-width="9" stroke-linecap="round"/>
  </g></g>
  ${label(440, 500, "не поливать", "#ff8a8f", 2.6, 28)}
  ${chip(300, 610, o.chip ?? "проверьте корни", "#ff8a8f", 3.2)}`;

/** Рисунки сцен: строка SVG или функция от параметров сцены (opts). */
export const art = {
  compass: compassArt(),
  shadow: shadowArt(),
  stretch: stretchArt(),
  leaf: leafArt,
  lamp: lampArt(),
  turn: turnArt(),
  roots: rootsArt(),
  weigh: weighArt(),
  soak: soakArt(),
  saucer: saucerArt(),
  pair: pairArt,
  alert: alertArt,
};

/** Акцентный цвет сцены (фон, заголовок, полоска прогресса). */
export const accent = {
  compass: "#ffd36e",
  shadow: "#ffd36e",
  stretch: "#c9e27a",
  leaf: "#ffb38a",
  lamp: "#d9a3ff",
  turn: "#8be3a8",
  roots: "#ff9f6e",
  weigh: "#7cc4ff",
  soak: "#7cc4ff",
  saucer: "#62e3d3",
  pair: "#7cc4ff",
  alert: "#ff8a8f",
};

/** CSS-анимации, нужные этим сценам. */
export const css = `
  .lt-spin { transform-box: view-box; transform-origin: 0 0; animation: lt-spin 16s linear infinite; }
  @keyframes lt-spin { to { transform: rotate(360deg); } }
  .lt-needle { transform-box: view-box; transform-origin: 0 0; animation: lt-needle 3.2s ease-in-out infinite; animation-delay: 2.6s; }
  @keyframes lt-needle { 0%,100% { transform: rotate(-14deg); } 50% { transform: rotate(10deg); } }
  .lt-drift { animation: lt-drift 6s ease-in-out infinite alternate; }
  @keyframes lt-drift { from { transform: translateX(-10px); } to { transform: translateX(14px); } }
  .lt-glow { animation: lt-glow 2.8s ease-in-out infinite alternate; animation-delay: calc(var(--d, 0) * 1s); }
  @keyframes lt-glow { from { opacity: .55; } to { opacity: 1; } }
  .lt-hover { animation: lt-hover 2.4s ease-in-out infinite alternate; animation-delay: calc(var(--d, 0) * -1s); }
  @keyframes lt-hover { from { transform: translateY(-6px); } to { transform: translateY(8px); } }
  .lt-shadow { animation: lt-shadow 2.4s ease-in-out infinite alternate; animation-delay: calc(var(--d, 0) * -1s); }
  @keyframes lt-shadow { from { transform: translateX(-4px); } to { transform: translateX(4px); } }
  .lt-lean { transform-box: view-box; transform-origin: 440px 470px; animation: lt-lean 4s ease-in-out infinite; animation-delay: 4s; }
  @keyframes lt-lean { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-2.5deg); } }
  .lt-nudge { animation: lt-nudge 1.4s ease-in-out infinite; }
  @keyframes lt-nudge { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-14px); } }
  .lt-leafsway { transform-box: view-box; transform-origin: 0 0; animation: lt-leafsway 5s ease-in-out infinite; }
  @keyframes lt-leafsway { 0%,100% { transform: rotate(-1.6deg); } 50% { transform: rotate(1.6deg); } }
  .lt-halo { animation: lt-halo 2.2s ease-in-out infinite alternate; animation-delay: calc(var(--d, 0) * -1s); }
  @keyframes lt-halo { from { opacity: .55; } to { opacity: 1; } }
  .lt-veinglow { animation: lt-glow 2s ease-in-out infinite alternate; animation-delay: 3.6s; }
  .lt-crumb { animation: lt-crumb 2.6s cubic-bezier(.5,0,1,1) infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lt-crumb { from { transform: translate(0, 0) rotate(0); opacity: 0; } 15% { opacity: 1; } to { transform: translate(-20px, 300px) rotate(300deg); opacity: 0; } }
  .lt-spore { animation: lt-spore 3s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lt-spore { from { transform: translate(0, 0); opacity: 0; } 20% { opacity: .9; } to { transform: translate(30px, -120px); opacity: 0; } }
  .lt-float { animation: lt-float 2.6s ease-in-out infinite alternate; animation-delay: calc(var(--d, 0) * -1s); }
  @keyframes lt-float { from { transform: translateY(-8px); } to { transform: translateY(8px); } }
  .lt-scan { animation: lt-scan 7s ease-in-out infinite both; animation-delay: 1s; }
  @keyframes lt-scan { 0% { transform: translate(450px, 470px); opacity: 0; } 10% { opacity: 1; } 35% { transform: translate(300px, 260px); } 65% { transform: translate(380px, 360px); } 90% { transform: translate(450px, 470px); opacity: 1; } 100% { transform: translate(450px, 470px); opacity: 0; } }
  .lt-led { animation: lt-led 1.6s ease-in-out infinite alternate both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lt-led { from { opacity: .25; } to { opacity: 1; } }
  .lt-hand { transform-box: view-box; transform-origin: 0 0; animation: lt-spin 3.5s linear infinite; animation-delay: 3s; }
  .lt-quarter { transform-box: view-box; transform-origin: 0 0; animation: lt-quarter 10s cubic-bezier(.6,0,.3,1) infinite; animation-delay: 1.6s; }
  @keyframes lt-quarter { 0%,10% { transform: rotate(0); } 25%,35% { transform: rotate(90deg); } 50%,60% { transform: rotate(180deg); } 75%,85% { transform: rotate(270deg); } 100% { transform: rotate(360deg); } }
  .lt-arcdash { animation: lt-arcdash 1s linear infinite; }
  @keyframes lt-arcdash { to { stroke-dashoffset: -34; } }
  .lt-bubble { animation: lt-bubble 2.8s ease-in-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lt-bubble { from { transform: translateY(0); opacity: 0; } 25% { opacity: 1; } to { transform: translateY(-50px); opacity: 0; } }
  .lt-wave { animation: lt-wave 2s ease-in-out infinite alternate; }
  @keyframes lt-wave { from { transform: translate(-12px, -3px); } to { transform: translate(0, 3px); } }
  .lt-tilt { transform-box: view-box; transform-origin: 0 0; animation: lt-tilt 3s cubic-bezier(.3,0,.2,1) both; animation-delay: 1s; }
  @keyframes lt-tilt { 0% { transform: rotate(0); } 45% { transform: rotate(14deg); } 65% { transform: rotate(9deg); } 82% { transform: rotate(11.5deg); } 100% { transform: rotate(11deg); } }
  .lt-untilt { transform-box: view-box; transform-origin: 0 0; animation: lt-untilt 3s cubic-bezier(.3,0,.2,1) both; animation-delay: 1s; }
  @keyframes lt-untilt { 0% { transform: rotate(0); } 45% { transform: rotate(-14deg); } 65% { transform: rotate(-9deg); } 82% { transform: rotate(-11.5deg); } 100% { transform: rotate(-11deg); } }
  .lt-pull { animation: lt-pull 1.6s cubic-bezier(.4,0,.2,1) both; animation-delay: 2.6s; }
  @keyframes lt-pull { to { transform: translateY(-96px); } }
  .lt-pool { transform-box: fill-box; transform-origin: center; animation: lt-pool 3s ease-out both; animation-delay: 2.6s; }
  @keyframes lt-pool { from { transform: scale(.2); } to { transform: scale(1); } }
  .lt-wetten { animation: lt-wetten 2.4s ease both; animation-delay: 1.8s; }
  @keyframes lt-wetten { to { opacity: 0; } }
  .lt-drip2 { animation: lt-drip2 1.3s cubic-bezier(.5,0,1,1) infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lt-drip2 { from { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } to { transform: translateY(20px); opacity: 0; } }
  .lt-tray { transform-box: view-box; transform-origin: 0 0; animation: lt-tray 1.4s cubic-bezier(.4,0,.2,1) both; animation-delay: 2.6s; }
  @keyframes lt-tray { to { transform: rotate(16deg); } }
  .lt-empty { transform-box: fill-box; transform-origin: 100% 50%; animation: lt-empty 3s ease-in both; animation-delay: 3.2s; }
  @keyframes lt-empty { to { transform: scaleX(.15); opacity: 0; } }
  .lt-pour { animation: lt-pour 1s cubic-bezier(.5,0,1,1) 4 both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lt-pour { from { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } to { transform: translateY(110px); opacity: 0; } }
  .lt-sag { animation: lt-sag 2s ease-in-out infinite alternate; animation-delay: calc(var(--d) * 1s + 2s); }
  @keyframes lt-sag { from { transform: translateY(0); } to { transform: translateY(6px); } }
  .lt-wilt { animation: lt-wilt 3s ease-in-out infinite alternate; animation-delay: calc(var(--d) * 1s); }
  @keyframes lt-wilt { from { transform: translateY(0); } to { transform: translateY(8px); } }
  .lt-dust { animation: lt-dust 2.2s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lt-dust { from { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } to { transform: translateY(110px); opacity: 0; } }
  .lt-droop { transform-box: view-box; transform-origin: 190px 376px; animation: lt-droop 3.6s ease-in-out infinite alternate; animation-delay: 1.6s; }
  @keyframes lt-droop { from { transform: rotate(0); } to { transform: rotate(-3deg) translateY(4px); } }
  .lt-shake { transform-box: view-box; transform-origin: 0 84px; animation: lt-shake 2.4s ease-in-out infinite; animation-delay: 2.4s; }
  @keyframes lt-shake { 0%,70%,100% { transform: rotate(0); } 76% { transform: rotate(-6deg); } 82% { transform: rotate(5deg); } 88% { transform: rotate(-3deg); } 94% { transform: rotate(2deg); } }
`;
