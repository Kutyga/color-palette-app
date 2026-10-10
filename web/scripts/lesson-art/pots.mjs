/** Сцены видеоуроков (сценарии — src/data/lessons.json): горшки, грунт, пересадка. */
import { leaf, stem, pot, label, chip, sparkles, phone, badge } from "./kit.mjs";

/** Ростки (как в kit): растут вверх от точки (0, −78). */
const SPROUT = {
  leafy: (d) =>
    `${stem("M0 -78 C -4 -120 6 -160 0 -200", d + 0.3, 8)}${leaf(0, -192, 0.42, 4, d + 0.6)}${leaf(2, -120, 0.36, 46, d + 0.8, "leafG2")}${leaf(-2, -150, 0.38, -44, d + 1)}`,
  aspid: (d) =>
    [-26, -9, 9, 26]
      .map(
        (r, i) =>
          `<g transform="translate(0 -78) rotate(${r})"><path class="grow" style="--d:${d + 0.3 + i * 0.12}" d="M0 0 C -24 -60 -22 -160 0 -215 C 22 -160 24 -60 0 0 Z" fill="url(#leafG)"/></g>`,
      )
      .join(""),
};

// ---------------------------------------------------------------------------
// Вспомогательные детали
// ---------------------------------------------------------------------------

/** Детерминированный «случайный» генератор (для крошек грунта, перлита и т. п.). */
const rng = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const f1 = (n) => Number(n.toFixed(1));

/** Растение (росток из kit) над грунтом: yTop — верх горшка pot(x, yTop, …), грунт на yTop−20. */
const plantIn = (x, yTop, s, d, kind = "leafy") =>
  `<g transform="translate(${x} ${f1(yTop - 20 + 78 * s)}) scale(${s})">${SPROUT[kind](d)}</g>`;

/** Капля с вершиной в (x, y). */
const dropP = (x, y, s = 1) => `M${x} ${y} q ${10 * s} ${18 * s} 0 ${28 * s} q ${-10 * s} ${-10 * s} 0 ${-28 * s} Z`;

/** Трапеция-корпус горшка: верх w на y, низ 0.76w на y+h. */
const potPath = (x, y, w, h, k = 0.76) =>
  `M${x - w / 2} ${y} L ${x + w / 2} ${y} L ${x + (w * k) / 2} ${y + h} L ${x - (w * k) / 2} ${y + h} Z`;

/** Координата x стенки горшка на высоте yy (left=true — левая). */
const wallX = (x, y, w, h, yy, left, k = 0.76) => {
  const t = (yy - y) / h;
  const half = w / 2 + ((w * k) / 2 - w / 2) * t;
  return left ? x - half : x + half;
};

/** Горшок в разрезе: корпус, тёмная задняя стенка; inner(yy) — внутренние стенки. */
const cutPot = (x, y, w, h, wall = 13, fill = "url(#potG)", rim = "#c4643a") => {
  const k = 0.76;
  const L = (yy) => wallX(x, y, w, h, yy, true, k) + wall;
  const R = (yy) => wallX(x, y, w, h, yy, false, k) - wall;
  const yb = y + h - wall;
  const back = `M${f1(L(y))} ${y} L ${f1(R(y))} ${y} L ${f1(R(yb))} ${yb} L ${f1(L(yb))} ${yb} Z`;
  return {
    L,
    R,
    yb,
    body: `
      <ellipse cx="${x}" cy="${y + h + 14}" rx="${w * 0.6}" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="${potPath(x, y, w, h, k)}" fill="${fill}"/>
      <path d="${back}" fill="#24150b"/>
      <path d="${back}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3"/>`,
    rim: `
      <rect x="${x - w / 2 - 12}" y="${y - 24}" width="${w + 24}" height="34" rx="10" fill="${rim}"/>
      <rect x="${x - w / 2 - 12}" y="${y - 24}" width="${w + 24}" height="8" rx="4" fill="#ffffff" opacity=".22"/>`,
  };
};

/** Лейка; (x, y) — середина корпуса, r — наклон. Носик (в своих координатах) — (106, −36). */
const can = (x, y, r, d, color = "#7cc4ff") => `
  <g transform="translate(${x} ${y}) rotate(${r})"><g class="pop" style="--d:${d}">
    <path d="M-40 -30 Q -8 -84 30 -30" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M38 22 L 98 -30" stroke="${color}" stroke-width="11" stroke-linecap="round"/>
    <rect x="92" y="-46" width="22" height="16" rx="5" fill="#2f80ed" transform="rotate(-40 103 -38)"/>
    <path d="M-52 -30 L 42 -30 L 48 42 Q 0 52 -58 42 Z" fill="url(#pt-canG)"/>
    <ellipse cx="-5" cy="-30" rx="47" ry="9" fill="#9fd6ff"/>
    <path d="M-38 -16 L -42 30" stroke="#ffffff" stroke-opacity=".45" stroke-width="8" stroke-linecap="round"/>
  </g></g>`;
const canDefs = `<linearGradient id="pt-canG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f80ed"/><stop offset=".45" stop-color="#7cc4ff"/><stop offset="1" stop-color="#1d5fc0"/></linearGradient>`;
/** Положение носика лейки после поворота. */
const canTip = (x, y, r) => {
  const a = (r * Math.PI) / 180;
  return [f1(x + 106 * Math.cos(a) + 36 * Math.sin(a)), f1(y + 106 * Math.sin(a) - 36 * Math.cos(a))];
};

/** Струйка капель, падающих из (x, y) на dy вниз (бесконечно). */
const dripStream = (x, y, dy, d, n = 4, color = "#7cc4ff", dx = 0, t = 1.1) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<path class="pt-fall" style="--d:${f1(d + (i * t) / n)};--dy:${dy}px;--dx:${dx}px;--t:${t}s" d="${dropP(x, y, 0.7)}" fill="${color}"/>`,
  ).join("");

/** Камешек керамзита. */
const pebble = (x, y, r, fill = "url(#pt-kzG)") =>
  `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * 1.15)}" ry="${f1(r)}" fill="${fill}"/>`;
const kzDefs = `<radialGradient id="pt-kzG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f0a072"/><stop offset=".6" stop-color="#b8592e"/><stop offset="1" stop-color="#6e2e14"/></radialGradient>`;

/** Слой керамзита между стенками L/R от y0 до y1. */
const kzLayer = (L, R, y0, y1, seed = 3, r = 9) => {
  const rand = rng(seed);
  let out = "";
  for (let yy = y1 - r; yy > y0 + r * 0.6; yy -= r * 1.6) {
    for (let xx = L(yy) + r; xx < R(yy) - r * 0.6; xx += r * 2.1) {
      out += pebble(xx + rand() * 4 - 2, yy + rand() * 4 - 2, r * (0.8 + rand() * 0.35));
    }
  }
  return out;
};

/** Крошки грунта/частицы внутри многоугольника, заданного стенками L/R. */
const specks = (L, R, y0, y1, n, colors, seed, rMin = 2, rMax = 5) => {
  const rand = rng(seed);
  return Array.from({ length: n }, () => {
    const yy = y0 + rand() * (y1 - y0);
    const xx = L(yy) + 4 + rand() * (R(yy) - L(yy) - 8);
    const c = colors[Math.floor(rand() * colors.length)];
    return `<circle cx="${f1(xx)}" cy="${f1(yy)}" r="${f1(rMin + rand() * (rMax - rMin))}" fill="${c}"/>`;
  }).join("");
};

/** Пузырьки, поднимающиеся вверх. */
const bubbles = (pts, color = "#cfe9ff") =>
  pts
    .map(
      ([x, y, r, d]) =>
        `<circle class="pt-bub" style="--d:${d}" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="2.5"/>`,
    )
    .join("");

/** Мешок грунта; (x, y) — верх-центр, w×h. */
const bag = (x, y, w, h, d, big = false) => `
  <g class="rise" style="--d:${d}">
    <ellipse cx="${x}" cy="${y + h + 10}" rx="${w * 0.6}" ry="12" fill="#000" opacity=".45" filter="url(#soft)"/>
    <path d="M${x - w / 2} ${y + 14} ${Array.from({ length: 8 }, (_, i) => `L ${f1(x - w / 2 + ((i + 0.5) * w) / 8)} ${y + (i % 2 ? 14 : 0)}`).join(" ")} L ${x + w / 2} ${y + 14} L ${x + w / 2 + 8} ${y + h - 16} Q ${x + w / 2 + 8} ${y + h} ${x + w / 2 - 10} ${y + h} L ${x - w / 2 - 10 + 20} ${y + h} Q ${x - w / 2 - 8} ${y + h} ${x - w / 2 - 8} ${y + h - 16} Z" fill="url(#pt-bagG)"/>
    <rect x="${x - w / 2 + 6}" y="${y + 26}" width="${w * 0.16}" height="${h - 50}" rx="6" fill="#ffffff" opacity=".14"/>
    <g transform="translate(${x} ${y + h * 0.3}) scale(${w / 200})">
      <path d="M0 22 C -26 10 -30 -26 0 -44 C 30 -26 26 10 0 22 Z" fill="url(#leafG)"/>
      <path d="M0 18 L 0 -36" stroke="#0f3f23" stroke-opacity=".5" stroke-width="3"/>
    </g>
    <rect x="${x - w / 2 + 14}" y="${y + h * 0.48}" width="${w - 28}" height="${h * (big ? 0.3 : 0.24)}" rx="10" fill="#f7f4ec"/>
    ${
      big
        ? `<text x="${x}" y="${y + h * 0.48 + 34}" fill="#14512f" font-family="Manrope" font-weight="800" font-size="19" text-anchor="middle">Универсальный</text>
           <text x="${x}" y="${y + h * 0.48 + 72}" fill="#14512f" font-family="Unbounded" font-weight="900" font-size="30" text-anchor="middle">грунт</text>`
        : `<text x="${x}" y="${y + h * 0.48 + h * 0.15}" fill="#14512f" font-family="Unbounded" font-weight="900" font-size="${f1(w * 0.17)}" text-anchor="middle">ГРУНТ</text>`
    }
  </g>`;
const bagDefs = `<linearGradient id="pt-bagG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c5e3a"/><stop offset=".45" stop-color="#3fae6b"/><stop offset="1" stop-color="#14472b"/></linearGradient>`;

/** Род. падеж названия компонента: грунт → грунта, кора → коры. */
const gen = (w) => {
  if (/[гкхжшщч]а$/.test(w)) return `${w.slice(0, -1)}и`;
  if (/а$/.test(w)) return `${w.slice(0, -1)}ы`;
  if (/[яь]$/.test(w)) return `${w.slice(0, -1)}и`;
  return `${w}а`;
};
const partWord = (n) => {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return "часть";
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return "части";
  return "частей";
};

// ---------------------------------------------------------------------------
// Сцены
// ---------------------------------------------------------------------------

export const art = {
  // ---- Урок 9: горшки ----
  sizes: `
    <defs><linearGradient id="pt-sour" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a5a6a" stop-opacity="0"/><stop offset=".35" stop-color="#3f6a72" stop-opacity=".55"/><stop offset="1" stop-color="#5a7a3a" stop-opacity=".8"/></linearGradient></defs>
    <g class="fade" style="--d:0"><rect x="30" y="512" width="540" height="10" rx="5" fill="#ffffff" opacity=".12"/></g>
    ${pot(95, 432, 100, 80, 0.2)}${plantIn(95, 432, 0.7, 0.4)}
    ${label(95, 556, "старый", "#ffffffcc", 0.8, 24)}
    <path class="draw" style="--d:1.2" pathLength="1" d="M150 470 L 182 470 M172 460 L 184 470 L 172 480" stroke="#ffffff99" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${pot(262, 410, 128, 102, 1.0)}${plantIn(262, 410, 0.7, 1.2)}
    <g class="fade" style="--d:1.8">
      <path d="M198 368 L 198 352 M326 368 L 326 352 M198 360 L 326 360" stroke="#8be3a8" stroke-width="3" fill="none"/>
    </g>
    ${chip(262, 560, "+2–3 см", "#8be3a8", 1.9)}
    ${badge(262, 180, true, 2.2, 30)}
    <g class="rise" style="--d:2.4">
      <ellipse cx="458" cy="528" rx="130" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="${potPath(458, 318, 210, 192)}" fill="url(#potG)"/>
      <path d="M371 336 L 545 336 L 525 498 L 391 498 Z" fill="url(#soilG)"/>
      <path d="M375 380 L 541 380 L 525 498 L 391 498 Z" fill="url(#pt-sour)"/>
      ${specks(
        (yy) => 375 + (yy - 336) * 0.12,
        (yy) => 541 - (yy - 336) * 0.12,
        345,
        490,
        26,
        ["#1c120a", "#7a5232", "#4d6a5a"],
        7,
        1.5,
        3.5,
      )}
      <ellipse cx="458" cy="352" rx="34" ry="16" fill="#8a5a35"/>
      <path d="M440 360 q -6 18 -2 30 M458 366 q 2 16 -4 26 M476 360 q 6 14 2 26" stroke="#f3ead8" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="341" y="294" width="234" height="36" rx="10" fill="#c4643a"/>
      <rect x="341" y="294" width="234" height="8" rx="4" fill="#ffffff" opacity=".22"/>
    </g>
    ${plantIn(458, 360, 0.62, 2.7)}
    ${bubbles(
      [
        [410, 470, 5, 3.2],
        [446, 486, 4, 3.8],
        [492, 476, 6, 3.5],
        [520, 462, 4, 4.2],
        [430, 450, 3, 4.6],
      ],
      "#b9e0ff",
    )}
    ${[0, 1, 2]
      .map(
        (i) =>
          `<path class="pt-wisp" style="--d:${3.4 + i * 0.7}" d="M${520 + i * 16} 270 q 8 -12 0 -24 q -8 -12 0 -24" stroke="#b8c46a" stroke-width="4" fill="none" stroke-linecap="round"/>`,
      )
      .join("")}
    ${badge(458, 180, false, 3.0, 30)}
    ${label(458, 556, "грунт закисает", "#ff8a8f", 3.2, 24)}`,

  materials: `
    <defs>
      <linearGradient id="pt-plG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e8a6a"/><stop offset=".4" stop-color="#5fd0a8"/><stop offset="1" stop-color="#0f5a45"/></linearGradient>
      <linearGradient id="pt-glG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1d3f9a"/><stop offset=".4" stop-color="#5b8ae6"/><stop offset="1" stop-color="#0e2560"/></linearGradient>
      <linearGradient id="pt-caG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f8f5a"/><stop offset=".5" stop-color="#7ee6a0"/><stop offset="1" stop-color="#1b5e37"/></linearGradient>
    </defs>
    ${[
      [105, "пластик", "url(#pt-plG)", "#2fb08a", "сохнет долго", 0.82, 0],
      [300, "терракота", "url(#potG)", "#c4643a", "сохнет быстро", 0.12, 0.6],
      [495, "глазурь", "url(#pt-glG)", "#3a66c8", "почти как пластик", 0.74, 1.2],
    ]
      .map(([x, name, fill, rim, sub, k, d], i) => {
        const y = 290;
        const w = 136;
        const h = 118;
        const plant =
          i === 1
            ? `<g transform="translate(${x} ${y - 20})"><g class="grow" style="--d:${d + 0.5}">
                <path d="M-18 0 C -22 -60 -20 -96 0 -100 C 20 -96 22 -60 18 0 Z" fill="url(#pt-caG)"/>
                <path d="M-18 -40 C -40 -42 -44 -62 -38 -76 C -30 -78 -28 -60 -16 -56 Z" fill="url(#pt-caG)"/>
                <path d="M18 -52 C 40 -54 42 -74 36 -86 C 28 -88 28 -70 16 -68 Z" fill="url(#pt-caG)"/>
                <path d="M-8 -6 L -8 -88 M0 -4 L 0 -96 M8 -6 L 8 -88" stroke="#14512f" stroke-opacity=".35" stroke-width="2"/>
              </g></g>
              <g transform="translate(${x} ${y - 120})"><g class="pop" style="--d:${d + 1.4}">
                ${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="6" ry="11" cy="-8" fill="#ff9ccf" transform="rotate(${a})"/>`).join("")}
                <circle r="5" fill="#ffd36e"/>
              </g></g>`
            : plantIn(x, y, 0.6, d + 0.5, i === 0 ? "leafy" : "aspid");
        return `
        <g class="rise" style="--d:${d}">
          <ellipse cx="${x}" cy="${y + h + 14}" rx="${w * 0.6}" ry="12" fill="#000" opacity=".45" filter="url(#soft)"/>
          <path d="${potPath(x, y, w, h)}" fill="${fill}"/>
          ${
            i === 1
              ? specks(
                  (yy) => wallX(x, y, w, h, yy, true) + 6,
                  (yy) => wallX(x, y, w, h, yy, false) - 6,
                  y + 14,
                  y + h - 6,
                  22,
                  ["#8e3f22", "#f0a072"],
                  11,
                  1,
                  2.2,
                )
              : `<path d="M${x - w / 2 + 16} ${y + 10} L ${x - w * 0.38 + 14} ${y + h - 8}" stroke="#ffffff" stroke-opacity=".55" stroke-width="9" stroke-linecap="round"/>`
          }
          <rect x="${x - w / 2 - 10}" y="${y - 24}" width="${w + 20}" height="34" rx="10" fill="${rim}"/>
          <rect x="${x - w / 2 - 10}" y="${y - 24}" width="${w + 20}" height="8" rx="4" fill="#ffffff" opacity="${i === 1 ? 0.22 : 0.45}"/>
          <ellipse cx="${x}" cy="${y - 18}" rx="${w / 2 - 2}" ry="8" fill="#3b2516"/>
        </g>
        ${plant}
        ${label(x, 466, name, "#ffffff", d + 0.6, 25)}
        <g class="fade" style="--d:${d + 0.9}">
          <path d="${dropP(x - 64, 480, 0.75)}" fill="#7cc4ff"/>
          <rect x="${x - 48}" y="487" width="${108}" height="14" rx="7" fill="#ffffff22"/>
          <rect class="pt-dry" style="--d:${d + 1.6};--k:${k}" x="${x - 48}" y="487" width="108" height="14" rx="7" fill="#7cc4ff"/>
        </g>
        ${label(x, 534, sub, i === 1 ? "#ffb38a" : "#ffffffb0", d + 1.2, 19)}`;
      })
      .join("")}
    ${[0, 1, 2, 3]
      .map(
        (i) =>
          `<path class="pt-wisp" style="--d:${2 + i * 0.6}" d="M${i < 2 ? 222 - i * 6 : 378 + (i - 2) * 6} ${360 - (i % 2) * 30} q -7 -10 0 -20 q 7 -10 0 -20" stroke="#ffe6d6" stroke-opacity=".8" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
      )
      .join("")}
    ${chip(300, 608, "терракота — для суккулентов", "#ff9f6e", 3.4)}`,

  orchid: (() => {
    const P = [
      [302, 352],
      [318, 210],
      [400, 92],
      [522, 150],
    ];
    const bz = (t) => {
      const u = 1 - t;
      return [0, 1].map((k) => u ** 3 * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t ** 3 * P[3][k]);
    };
    const flower = (x, y, r, s, d) => `
      <g transform="translate(${f1(x)} ${f1(y)}) rotate(${r}) scale(${s})"><g class="pop" style="--d:${d}">
        ${[-90, 150, 30].map((a) => `<ellipse rx="10" ry="25" cy="-20" fill="#fbe3f0" transform="rotate(${a + 90})"/>`).join("")}
        <circle cx="-17" cy="-3" r="21" fill="url(#pt-orP)"/><circle cx="17" cy="-3" r="21" fill="url(#pt-orP)"/>
        <path d="M-10 6 Q 0 32 10 6 Q 0 0 -10 6 Z" fill="#c2367f"/>
        <circle cy="0" r="5" fill="#ffd36e"/>
      </g></g>`;
    const ts = [0.5, 0.62, 0.74, 0.86, 0.98];
    const rand = rng(5);
    const bark = Array.from({ length: 26 }, (_, i) => {
      const yy = 372 + (i % 6) * 26 + rand() * 8;
      const half = 90 - (yy - 360) * 0.11 - 16;
      const xx = 300 - half + ((Math.floor(i / 6) + rand() * 0.6) / 4.4) * half * 2;
      return `<rect x="${f1(xx)}" y="${f1(yy)}" width="${f1(16 + rand() * 12)}" height="${f1(10 + rand() * 6)}" rx="4" fill="${["#8a5530", "#a8693a", "#6b3f22"][i % 3]}" transform="rotate(${f1(rand() * 60 - 30)} ${f1(xx)} ${f1(yy)})"/>`;
    }).join("");
    const roots = [
      ["M290 356 C 250 380 236 420 250 470 C 258 500 240 516 236 520", "#cfe0cf", 0.8],
      ["M300 358 C 300 400 330 420 320 460 C 312 494 336 510 344 518", "#7fd492", 1.0],
      ["M306 356 C 350 372 372 410 356 448 C 344 476 362 490 372 500", "#cfe0cf", 1.2],
      ["M296 360 C 270 400 296 430 280 470", "#8fdc9f", 1.4],
      ["M310 360 C 340 400 320 430 300 490", "#d9e6d6", 1.6],
    ]
      .map(
        ([dd, c, d]) =>
          `<path class="draw" style="--d:${d}" pathLength="1" d="${dd}" stroke="#4d6b52" stroke-width="12" fill="none" stroke-linecap="round"/><path class="draw" style="--d:${d}" pathLength="1" d="${dd}" stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
      )
      .join("");
    return `
    <defs><radialGradient id="pt-orP" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff4fa"/><stop offset=".6" stop-color="#ffc2e0"/><stop offset="1" stop-color="#f08cc0"/></radialGradient></defs>
    <g transform="translate(76 104)"><g class="pop" style="--d:.1">
      <circle r="38" fill="url(#goldG)" filter="url(#glow)"/>
    </g></g>
    <g class="fade" style="--d:.6"><g class="pulse"><path d="M96 124 L 260 372 L 230 520 L 70 140 Z" fill="url(#beamG)" opacity=".35"/></g></g>
    <g class="rise" style="--d:.2">
      <ellipse cx="300" cy="544" rx="120" ry="13" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="${potPath(300, 352, 184, 176, 0.8)}" fill="#cfe9ff" opacity=".08"/>
      ${bark}
    </g>
    ${roots}
    <g class="fade" style="--d:.3">
      <path d="${potPath(300, 352, 184, 176, 0.8)}" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".7" stroke-width="4"/>
      <path d="M220 366 L 236 516" stroke="#ffffff" stroke-opacity=".45" stroke-width="8" stroke-linecap="round"/>
      <rect x="198" y="330" width="204" height="28" rx="9" fill="#ffffff22" stroke="#e8f5ff" stroke-opacity=".7" stroke-width="3"/>
    </g>
    ${[
      [300, 344, -100, 1.0],
      [300, 344, 96, 1.2],
      [300, 340, -60, 1.4],
    ]
      .map(
        ([x, y, r, d]) =>
          `<g transform="translate(${x} ${y}) rotate(${r})"><g class="pop" style="--d:${d}"><path d="M0 0 C -26 -30 -24 -110 0 -140 C 24 -110 26 -30 0 0 Z" fill="url(#leafG)"/><path d="M0 -6 L 0 -128" stroke="#0f3f23" stroke-opacity=".45" stroke-width="3"/></g></g>`,
      )
      .join("")}
    <g class="pt-sway" style="transform-origin:302px 352px">
      <path class="draw" style="--d:1.5" pathLength="1" d="M${P[0]} C ${P[1]} ${P[2]} ${P[3]}" stroke="#5a8a3a" stroke-width="6" fill="none" stroke-linecap="round"/>
      ${ts.map((t, i) => flower(...bz(t), -20 + i * 14, 0.95 - i * 0.04, 2.0 + i * 0.25)).join("")}
    </g>
    <g class="fade" style="--d:2.6">
      <text x="112" y="440" fill="#ffd36e" font-family="Manrope" font-weight="800" font-size="23" text-anchor="middle">корни</text>
      <text x="112" y="468" fill="#ffd36e" font-family="Manrope" font-weight="800" font-size="23" text-anchor="middle">на свету</text>
      <path d="M160 452 L 226 452 M214 442 L 228 452 L 214 462" stroke="#ffd36e" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ${[
      ["#d9e6d6", "серебристые — пора полить", 576, 3.2],
      ["#7fd492", "зелёные — влаги хватает", 612, 3.6],
    ]
      .map(
        ([c, t, y, d]) =>
          `<g class="fade" style="--d:${d}"><circle cx="128" cy="${y - 8}" r="11" fill="${c}" stroke="#4d6b52" stroke-width="3"/><text x="150" y="${y}" fill="#ffffff" font-family="Manrope" font-weight="700" font-size="21">${t}</text></g>`,
      )
      .join("")}`;
  })(),

  drain: (() => {
    const c = cutPot(240, 170, 300, 300);
    const yb = c.yb;
    const soilTop = 214;
    const kzTop = yb - 40;
    const soil = `M${f1(c.L(soilTop))} ${soilTop} L ${f1(c.R(soilTop))} ${soilTop} L ${f1(c.R(kzTop))} ${kzTop} L ${f1(c.L(kzTop))} ${kzTop} Z`;
    const rand = rng(21);
    const pores = Array.from({ length: 30 }, () => {
      const yy = soilTop + 12 + rand() * (kzTop - soilTop - 22);
      const xx = c.L(yy) + 10 + rand() * (c.R(yy) - c.L(yy) - 20);
      return `<ellipse cx="${f1(xx)}" cy="${f1(yy)}" rx="${f1(4 + rand() * 5)}" ry="${f1(3 + rand() * 3)}" fill="#120a05"/>`;
    }).join("");
    const drops = [
      [180, 0],
      [232, 0.5],
      [290, 0.25],
      [210, 0.9],
      [262, 1.2],
    ]
      .map(
        ([x, dd]) =>
          `<path class="pt-fall" style="--d:${2.4 + dd};--dy:${kzTop - soilTop - 20}px;--dx:${f1((240 - x) * 0.2)}px;--t:2.2s" d="${dropP(x, soilTop + 6, 0.8)}" fill="#7cc4ff"/>`,
      )
      .join("");
    return `
    ${kzDefs}
    <g class="fade" style="--d:.1"><ellipse cx="240" cy="${yb + 46}" rx="150" ry="16" fill="#8e3f22"/><ellipse cx="240" cy="${yb + 40}" rx="140" ry="12" fill="#5a2a14"/><ellipse cx="240" cy="${yb + 42}" rx="60" ry="6" fill="#7cc4ff" opacity=".7"/></g>
    <g class="rise" style="--d:.1">${c.body}</g>
    <g class="grow" style="--d:.8">${kzLayer(c.L, c.R, kzTop, yb, 4, 10)}</g>
    <g class="grow" style="--d:1.3">
      <path d="${soil}" fill="url(#soilG)"/>
      ${pores}
      ${specks(c.L, c.R, soilTop + 6, kzTop - 6, 34, ["#f4f1e8", "#d9d4c4"], 9, 2.5, 4.5)}
      ${specks(c.L, c.R, soilTop + 6, kzTop - 6, 26, ["#a0612f", "#8a5530"], 13, 2.5, 5)}
    </g>
    ${drops}
    <g class="rise" style="--d:.1">${c.rim}</g>
    <rect x="224" y="${yb - 2}" width="32" height="18" rx="4" fill="#120a05"/>
    ${dripStream(240, yb + 14, 22, 3.2, 3, "#7cc4ff", 0, 1.4)}
    ${plantIn(240, soilTop + 20, 0.82, 0.6)}
    <g class="fade" style="--d:2.0">
      <path d="M330 290 L 392 290" stroke="#ffffff99" stroke-width="3"/><circle cx="330" cy="290" r="5" fill="#fff"/>
      <text x="400" y="298" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="23">рыхлый грунт</text>
      <text x="400" y="326" fill="#ffffffaa" font-family="Manrope" font-weight="700" font-size="18">поры с воздухом</text>
    </g>
    <g class="fade" style="--d:1.2">
      <path d="M${f1(c.R(kzTop) + 22)} ${kzTop} L ${f1(c.R(kzTop) + 30)} ${kzTop} L ${f1(c.R(yb) + 30)} ${yb} L ${f1(c.R(yb) + 22)} ${yb}" stroke="#ff9f6e" stroke-width="3" fill="none"/>
      <text x="400" y="${kzTop + 14}" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="23">керамзит</text>
      <text x="400" y="${kzTop + 42}" fill="#ff9f6e" font-family="Unbounded" font-weight="900" font-size="21">1–2 см</text>
    </g>
    <g class="fade" style="--d:2.8">
      <path d="M262 ${yb + 10} Q 330 ${yb + 30} 392 ${yb + 30}" stroke="#ffffff99" stroke-width="3" fill="none"/>
      <text x="400" y="${yb + 38}" fill="#7cc4ff" font-family="Manrope" font-weight="800" font-size="22">отверстие</text>
    </g>
    ${chip(300, 610, "главное — рыхлый грунт", "#7cc4ff", 3.4)}`;
  })(),

  cachepot: (() => {
    const x = 290;
    const y = 250;
    const w = 330;
    const h = 290;
    const L = (yy) => wallX(x, y, w, h, yy, true, 0.82) + 16;
    const R = (yy) => wallX(x, y, w, h, yy, false, 0.82) - 16;
    const yb = y + h - 16;
    const win = `M${f1(L(y + 18))} ${y + 18} L ${f1(R(y + 18))} ${y + 18} L ${f1(R(yb))} ${yb} L ${f1(L(yb))} ${yb} Z`;
    const waterTop = yb - 26;
    const rand = rng(31);
    let peb = "";
    for (let xx = L(waterTop) + 14; xx < R(waterTop) - 10; xx += 27) {
      const r = 11 + rand() * 4;
      peb += pebble(xx + rand() * 6 - 3, waterTop - 4 + rand() * 6, r, "url(#pt-pebG)");
    }
    const potBottom = waterTop - 20;
    return `
    <defs>
      <linearGradient id="pt-cpG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9a582"/><stop offset=".4" stop-color="#f6eedd"/><stop offset="1" stop-color="#9c8a68"/></linearGradient>
      <radialGradient id="pt-pebG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e8e6e0"/><stop offset=".6" stop-color="#9a978f"/><stop offset="1" stop-color="#5a5852"/></radialGradient>
    </defs>
    <g class="rise" style="--d:.1">
      <ellipse cx="${x}" cy="${y + h + 14}" rx="${w * 0.6}" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="${potPath(x, y, w, h, 0.82)}" fill="url(#pt-cpG)"/>
      <path d="${win}" fill="#2a2219"/>
      <path d="${win}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3"/>
      <rect x="${x - w / 2 - 6}" y="${y - 16}" width="${w + 12}" height="24" rx="8" fill="#e8dcc0"/>
      <rect x="${x - w / 2 - 6}" y="${y - 16}" width="${w + 12}" height="6" rx="3" fill="#ffffff" opacity=".6"/>
      <path d="M${f1(wallX(x, y, w, h, y + h - 26, true, 0.82))} ${y + h - 26} L ${f1(L(y + h - 26))} ${y + h - 26} M${f1(R(y + h - 26))} ${y + h - 26} L ${f1(wallX(x, y, w, h, y + h - 26, false, 0.82))} ${y + h - 26}" stroke="#d4a84a" stroke-width="5"/>
    </g>
    <g class="fade" style="--d:.7"><rect x="${f1(L(waterTop))}" y="${waterTop}" width="${f1(R(waterTop) - L(waterTop))}" height="${yb - waterTop}" fill="url(#waterG)"/></g>
    <g class="rise" style="--d:.9">${peb}</g>
    <g class="rise" style="--d:1.4">
      <path d="${potPath(x, 330, 196, potBottom - 330)}" fill="url(#potG)"/>
      <rect x="${x - 110}" y="306" width="220" height="34" rx="10" fill="#c4643a"/>
      <rect x="${x - 110}" y="306" width="220" height="8" rx="4" fill="#f0a072" opacity=".6"/>
      <ellipse cx="${x}" cy="312" rx="98" ry="8" fill="#3b2516"/>
      <rect x="${x - 12}" y="${potBottom - 4}" width="24" height="6" rx="2" fill="#2b1a0f"/>
    </g>
    ${plantIn(x, 332, 0.95, 1.8)}
    ${dripStream(x, potBottom + 2, 14, 2.8, 3, "#7cc4ff", 0, 1.6)}
    ${[0, 1].map((i) => `<ellipse class="pt-ring" style="--d:${3.3 + i * 0.8}" cx="${x}" cy="${waterTop + 3}" rx="20" ry="5" fill="none" stroke="#cfe9ff" stroke-width="2.5"/>`).join("")}
    <g class="fade" style="--d:2.0">
      <path d="M${f1(R(waterTop) - 16)} ${waterTop - 6} L 474 ${waterTop - 44}" stroke="#ffffff99" stroke-width="3"/>
      <text x="480" y="${waterTop - 38}" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="22">камешки</text>
      <path d="M${f1(R(yb) - 10)} ${yb - 10} L 474 ${yb + 12}" stroke="#ffffff99" stroke-width="3"/>
      <text x="480" y="${yb + 20}" fill="#7cc4ff" font-family="Manrope" font-weight="800" font-size="22">вода</text>
    </g>
    ${badge(528, 330, true, 3.0, 26)}
    ${label(528, 386, "дно сухое", "#8be3a8", 3.2, 21)}
    ${chip(300, 612, "дно не стоит в воде", "#62e3d3", 3.6)}`;
  })(),

  // ---- Урок 10: грунт ----
  peat: (() => {
    const x = 432;
    const y = 280;
    const w = 236;
    const h = 200;
    const c = cutPot(x, y, w, h, 12);
    const gap = 14;
    const top = y + 22;
    const bot = c.yb - 4;
    const cl = (yy) => c.L(yy) + gap;
    const cr = (yy) => c.R(yy) - gap;
    const clump = `M${f1(cl(top))} ${top + 8} Q ${x} ${top - 8} ${f1(cr(top))} ${top + 8} L ${f1(cr(bot))} ${bot} L ${f1(cl(bot))} ${bot} Z`;
    const [tx, ty] = canTip(332, 176, 22);
    const sideDrops = [true, false]
      .map((left) =>
        [0, 1, 2]
          .map((i) => {
            const x0 = left ? c.L(top) + gap / 2 : c.R(top) - gap / 2;
            const x1 = left ? c.L(bot) + gap / 2 : c.R(bot) - gap / 2;
            return `<path class="pt-fall" style="--d:${2.6 + i * 0.5 + (left ? 0 : 0.25)};--dy:${bot - top}px;--dx:${f1(x1 - x0)}px;--t:1.5s" d="${dropP(f1(x0), top - 4, 0.6)}" fill="#7cc4ff"/>`;
          })
          .join(""),
      )
      .join("");
    return `
    ${bagDefs}${canDefs}
    ${bag(140, 150, 190, 320, 0.1, true)}
    ${label(140, 524, "почти чистый торф", "#ffb38a", 1.0, 22)}
    <g class="fade" style="--d:.5"><ellipse cx="${x}" cy="${y + h + 28}" rx="150" ry="14" fill="#8e3f22"/><ellipse cx="${x}" cy="${y + h + 24}" rx="138" ry="10" fill="#5a2a14"/><ellipse class="pt-pool" cx="${x}" cy="${y + h + 25}" rx="80" ry="6" fill="#7cc4ff"/></g>
    <g class="rise" style="--d:.5">${c.body}</g>
    <g class="rise" style="--d:.9">
      <path d="${clump}" fill="url(#dryG)"/>
      <path d="M${x - 50} ${top + 30} l 18 26 l -10 24 l 16 30 M${x + 40} ${top + 24} l -14 30 l 12 20 l -8 34 M${x - 6} ${top + 70} l 12 22 l -6 28" stroke="#6e4a2c" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${specks(cl, cr, top + 14, bot - 8, 22, ["#b88a5a", "#e2bd8e"], 41, 2, 4)}
    </g>
    <g class="rise" style="--d:.5">${c.rim}</g>
    <rect x="${x - 14}" y="${c.yb - 1}" width="28" height="14" rx="3" fill="#120a05"/>
    ${dripStream(x - 4, c.yb + 12, 12, 3.6, 3, "#7cc4ff", 0, 1.4)}
    ${can(332, 176, 22, 1.4)}
    ${dripStream(tx, ty + 4, top - ty - 22, 2.0, 5, "#7cc4ff", f1(x - tx), 0.9)}
    <path class="draw" style="--d:2.4" pathLength="1" d="M${x - 8} ${top - 6} Q ${x - 70} ${top - 30} ${f1(cl(top) - 6)} ${top + 4}" stroke="#7cc4ff" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path class="draw" style="--d:2.4" pathLength="1" d="M${x + 8} ${top - 6} Q ${x + 70} ${top - 30} ${f1(cr(top) + 6)} ${top + 4}" stroke="#7cc4ff" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${sideDrops}
    <g transform="translate(${x} ${top + 92})"><g class="pop" style="--d:3.0">
      <rect x="-50" y="-22" width="100" height="40" rx="20" fill="#3a2414" opacity=".85"/>
      <text y="7" fill="#ffd36e" font-family="Manrope" font-weight="800" font-size="22" text-anchor="middle">сухо</text>
    </g></g>
    ${chip(300, 612, "вода уходит по стенкам", "#ffb38a", 3.8)}`;
  })(),

  layers3: (() => {
    const jars = [
      [105, "основа", "торф, кокос,", "листовая земля", "#c79a6a"],
      [300, "разрыхлители", "перлит, кора,", "пемза", "#f4f1e8"],
      [495, "влагодержатели", "вермикулит,", "сфагнум", "#7cc4ff"],
    ];
    const content = (i, x) => {
      const rand = rng(51 + i);
      const L = () => x - 66;
      const R = () => x + 66;
      if (i === 0)
        return `<rect x="${x - 70}" y="262" width="140" height="190" fill="url(#soilG)"/>${Array.from({ length: 34 }, () => {
          const xx = x - 60 + rand() * 120;
          const yy = 270 + rand() * 170;
          return `<path d="M${f1(xx)} ${f1(yy)} q ${f1(rand() * 16 - 8)} ${f1(-4 - rand() * 6)} ${f1(10 + rand() * 10)} ${f1(rand() * 6 - 3)}" stroke="${rand() > 0.5 ? "#9a6a40" : "#2a1a0e"}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
        }).join("")}`;
      if (i === 1)
        return `<rect x="${x - 70}" y="262" width="140" height="190" fill="#4a3020"/>
          ${Array.from({ length: 16 }, () => {
            const xx = x - 60 + rand() * 120;
            const yy = 272 + rand() * 170;
            return `<rect x="${f1(xx - 9)}" y="${f1(yy - 5)}" width="${f1(14 + rand() * 10)}" height="${f1(8 + rand() * 5)}" rx="3" fill="${rand() > 0.5 ? "#a0612f" : "#7a4523"}" transform="rotate(${f1(rand() * 80 - 40)} ${f1(xx)} ${f1(yy)})"/>`;
          }).join("")}
          ${specks(L, R, 268, 446, 12, ["#b8b2a6", "#9a948a"], 61 + i, 5, 8)}
          ${specks(L, R, 268, 446, 34, ["#f4f1e8", "#ffffff", "#e2ddd0"], 71 + i, 3.5, 6.5)}`;
      return `<rect x="${x - 70}" y="262" width="140" height="190" fill="#5e4a2c"/>
        ${Array.from({ length: 30 }, () => {
          const xx = x - 60 + rand() * 120;
          const yy = 270 + rand() * 172;
          return `<rect x="${f1(xx - 6)}" y="${f1(yy - 3)}" width="${f1(9 + rand() * 7)}" height="${f1(5 + rand() * 3)}" rx="1.5" fill="${["#e0bc62", "#c9993c", "#f1d58a"][Math.floor(rand() * 3)]}" transform="rotate(${f1(rand() * 90 - 45)} ${f1(xx)} ${f1(yy)})"/>`;
        }).join("")}
        ${Array.from({ length: 12 }, () => {
          const xx = x - 56 + rand() * 100;
          const yy = 276 + rand() * 160;
          return `<path d="M${f1(xx)} ${f1(yy)} c 6 -10 14 -4 10 4 c -4 8 6 12 12 4" stroke="${rand() > 0.5 ? "#a9c97f" : "#d6dfae"}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
        }).join("")}`;
    };
    const icons = [
      (x) =>
        `<path d="${dropP(x, 98, 1.3)}" fill="#7cc4ff"/><path d="M${x - 14} 132 h 28" stroke="#c79a6a" stroke-width="5" stroke-linecap="round"/>`,
      (x) =>
        `${bubbles(
          [
            [x - 10, 136, 6, 0.6],
            [x + 10, 140, 5, 1.2],
            [x, 132, 4, 1.8],
            [x + 4, 138, 7, 2.4],
          ],
          "#f4f1e8",
        )}`,
      (x) => `<path d="${dropP(x, 92, 1.0)}" fill="#7cc4ff"/>${dripStream(x, 124, 18, 1.4, 3, "#7cc4ff", 0, 1.8)}`,
    ];
    return `
    <defs>${jars.map(([x], i) => `<clipPath id="pt-jar${i}"><rect x="${x - 68}" y="222" width="136" height="226" rx="20"/></clipPath>`).join("")}</defs>
    ${jars
      .map(([x, name, s1, s2, col], i) => {
        const d = 0.2 + i * 0.7;
        return `
      <g class="rise" style="--d:${d}">
        <ellipse cx="${x}" cy="464" rx="88" ry="10" fill="#000" opacity=".45" filter="url(#soft)"/>
        <rect x="${x - 75}" y="214" width="150" height="242" rx="26" fill="#cfe9ff" opacity=".08"/>
      </g>
      <g clip-path="url(#pt-jar${i})"><g class="grow" style="--d:${d + 0.4}">${content(i, x)}</g></g>
      <g class="fade" style="--d:${d}">
        <rect x="${x - 75}" y="214" width="150" height="242" rx="26" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".7" stroke-width="4"/>
        <path d="M${x - 56} 236 L ${x - 56} 420" stroke="#ffffff" stroke-opacity=".4" stroke-width="7" stroke-linecap="round"/>
      </g>
      <g class="rise" style="--d:${d + 0.2}">
        <rect x="${x - 64}" y="190" width="128" height="30" rx="9" fill="${col}"/>
        <rect x="${x - 64}" y="190" width="128" height="8" rx="4" fill="#ffffff" opacity=".35"/>
      </g>
      <g class="fade" style="--d:${d + 0.9}">${icons[i](x)}</g>
      ${label(x, 498, name, col === "#f4f1e8" ? "#ffffff" : col, d + 0.6, name.length > 12 ? 21 : 24)}
      ${label(x, 526, s1, "#ffffffb0", d + 0.8, 18)}${label(x, 550, s2, "#ffffffb0", d + 0.8, 18)}`;
      })
      .join("")}
    ${label(202, 345, "+", "#ffffff99", 2.0, 44)}${label(397, 345, "+", "#ffffff99", 2.4, 44)}
    ${chip(300, 612, "вода · воздух · запас", "#8be3a8", 3.2)}`;
  })(),

  recipe: (o = {}) => {
    const parts = o.parts?.length
      ? o.parts
      : [
          ["грунт", 2, "#6b4429"],
          ["перлит", 1, "#e9e6dc"],
          ["кора", 1, "#a0612f"],
        ];
    const cups = parts.flatMap(([, k, c], gi) => Array.from({ length: k }, () => ({ c, gi })));
    const N = cups.length;
    const cw = Math.min(74, 480 / N - 12);
    const gap = N > 1 ? Math.min(130, (500 - N * cw) / (N - 1)) : 0;
    const span = N * cw + (N - 1) * gap;
    const xs = cups.map((_, i) => 300 - span / 2 + cw / 2 + i * (cw + gap));
    const cy = 236;
    const s = cw / 74;
    const pours = cups.map((_, i) => 1.0 + i * 0.6);
    const mixAt = pours[N - 1] + 1.5;
    const bowl = "M132 420 C 136 520 196 552 300 552 C 404 552 464 520 468 420 Z";
    const fillTop = 440;
    const fillBot = 552;
    const lh = (fillBot - fillTop) / N;
    const rand = rng(77);
    const total = parts.reduce((a, p) => a + p[1], 0);
    const speck = parts
      .slice(1)
      .concat(parts.length === 1 ? parts : [])
      .flatMap(([, k, c]) =>
        Array.from({ length: Math.round((k / total) * 70) }, () => {
          const xx = 140 + rand() * 320;
          const yy = fillTop + 4 + rand() * (fillBot - fillTop - 8);
          return `<circle cx="${f1(xx)}" cy="${f1(yy)}" r="${f1(2.5 + rand() * 3)}" fill="${c}"/>`;
        }),
      )
      .join("");
    const cupSvg = ({ c }, i) => {
      const x = xs[i];
      const dir = x <= 300 ? 1 : -1;
      const r = dir * 108;
      const a = (r * Math.PI) / 180;
      const lx = dir * 30 * s;
      const ly = -44 * s;
      const tx = x + lx * Math.cos(a) - ly * Math.sin(a);
      const ty = cy + lx * Math.sin(a) + ly * Math.cos(a);
      const p = pours[i];
      const stream = Array.from(
        { length: 7 },
        (_, k) =>
          `<circle class="pt-pourfall" style="--d:${f1(p + 0.4 + k * 0.09)};--dx:${f1(300 + (k % 3) * 14 - 14 - tx)}px;--dy:${f1(fillTop - 4 - (N - 1 - i) * lh * 0.4 - ty)}px" cx="${f1(tx)}" cy="${f1(ty)}" r="${f1(5 + (k % 3))}" fill="${c}"/>`,
      ).join("");
      return `
      <g transform="translate(${f1(x)} ${cy}) scale(${f1(s)})"><g class="pop" style="--d:${f1(0.2 + i * 0.12)}"><g class="pt-pour" style="--d:${p};--r:${r}deg">
        <path d="M${dir * -36} -26 q ${dir * -22} 4 ${dir * -18} 28 q 2 12 ${dir * 16} 10" stroke="#e8f5ff" stroke-opacity=".7" stroke-width="6" fill="none"/>
        <g class="pt-empty" style="--d:${f1(p + 0.4)}"><path d="M-31 -24 L 31 -24 L 27 40 L -27 40 Z" fill="${c}"/>${c === "#e9e6dc" ? "" : `<path d="M-31 -24 L 31 -24 L 27 40 L -27 40 Z" fill="#000" opacity=".12"/>`}</g>
        <path d="M-34 -44 L 34 -44 L 29 44 L -29 44 Z" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".75" stroke-width="3.5"/>
        <path d="M-22 -34 L -19 34" stroke="#ffffff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>
        ${[-10, 8, 26].map((yy) => `<path d="M${dir * 14} ${yy} h ${dir * 12}" stroke="#ffffff" stroke-opacity=".7" stroke-width="2.5"/>`).join("")}
      </g></g></g>
      ${stream}`;
    };
    const groups = parts.map(([name, k, c], gi) => {
      const idx = cups.map((cu, i) => (cu.gi === gi ? i : -1)).filter((i) => i >= 0);
      const gx = idx.reduce((a, i) => a + xs[i], 0) / idx.length;
      const d = 0.4 + idx[0] * 0.12;
      return `${label(f1(gx), 124, `${k} ${partWord(k)}`, "#ffffff", d, 24)}${label(f1(gx), 152, gen(name), c === "#6b4429" ? "#c79a6a" : c, d + 0.1, 22)}`;
    });
    return `
    <defs><clipPath id="pt-bowlC"><path d="${bowl}"/></clipPath></defs>
    ${groups.join("")}
    <g class="rise" style="--d:.3">
      <ellipse cx="300" cy="566" rx="180" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="${bowl}" fill="#cfe9ff" opacity=".08"/>
    </g>
    <g clip-path="url(#pt-bowlC)">
      ${cups
        .map(
          ({ c }, i) =>
            `<g class="pt-layer" style="--d:${f1(pours[i] + 0.55)}"><rect x="120" y="${f1(fillBot - (i + 1) * lh)}" width="360" height="${f1(lh + 1)}" fill="${c}"/></g>`,
        )
        .join("")}
      <g class="fade" style="--d:${f1(mixAt)}"><rect x="120" y="${fillTop}" width="360" height="${fillBot - fillTop}" fill="${parts[0][2]}"/>${speck}</g>
    </g>
    <g class="fade" style="--d:.3">
      <path d="${bowl}" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".7" stroke-width="4"/>
      <ellipse cx="300" cy="420" rx="168" ry="18" fill="none" stroke="#e8f5ff" stroke-opacity=".7" stroke-width="4"/>
      <path d="M160 440 C 166 500 196 526 236 538" stroke="#ffffff" stroke-opacity=".4" stroke-width="8" fill="none" stroke-linecap="round"/>
    </g>
    <g transform="translate(300 420) scale(1 .2)"><g class="fade" style="--d:${f1(mixAt)}"><g class="pt-spin">
      <circle r="120" fill="none" stroke="#ffd36e" stroke-width="12" stroke-dasharray="120 60" stroke-linecap="round"/>
    </g></g></g>
    ${cups.map(cupSvg).join("")}
    ${sparkles(
      [
        [110, 470, mixAt + 0.2],
        [500, 450, mixAt + 0.6],
        [470, 540, mixAt + 1],
      ],
      "#ffd36e",
    )}
    ${chip(300, 612, parts.map((p) => p[1]).join(" : "), "#ffd36e", f1(mixAt + 0.3))}`;
  },

  kbcard: (() => {
    const segs = [
      [2, "#6b4429", "грунт — 2 части"],
      [1, "#e9e6dc", "перлит — 1 часть"],
      [1, "#a0612f", "кора — 1 часть"],
    ];
    let acc = -104;
    const bars = segs
      .map(([k, c], i) => {
        const w = (208 * k) / 4;
        const s = `<rect class="pt-growx" style="--d:${1.6 + i * 0.4}" x="${acc}" y="312" width="${w}" height="30" fill="${c}"/>`;
        acc += w;
        return s;
      })
      .join("");
    const inner = `
      <defs><clipPath id="pt-kbC"><rect x="-104" y="312" width="208" height="30" rx="10"/></clipPath></defs>
      <g class="fade" style="--d:.5">
        <rect x="-104" y="92" width="208" height="128" rx="18" fill="#d6f2df"/>
        <circle cx="70" cy="122" r="40" fill="#ffffff" opacity=".5"/>
      </g>
      <g transform="translate(0 212) scale(.5)">${pot(0, -60, 90, 60, 0.6)}${SPROUT.leafy(0.6)}</g>
      <text class="fade" style="--d:.9" x="-104" y="250" fill="#15241b" font-family="Manrope" font-weight="800" font-size="22">Монстера</text>
      <text class="fade" style="--d:1.0" x="-104" y="270" fill="#5f6f66" font-family="Manrope" font-weight="600" font-size="13" font-style="italic">Monstera deliciosa</text>
      <g class="fade" style="--d:1.2">
        <rect x="-112" y="282" width="224" height="200" rx="18" fill="#ffffff"/>
        <text x="-96" y="304" fill="#14512f" font-family="Manrope" font-weight="800" font-size="16">Грунт: рецепт</text>
      </g>
      <g clip-path="url(#pt-kbC)"><rect x="-104" y="312" width="208" height="30" fill="#eee9dc"/>${bars}</g>
      ${segs
        .map(
          ([, c, t], i) =>
            `<g class="fade" style="--d:${1.9 + i * 0.4}"><circle cx="-92" cy="${370 + i * 28}" r="8" fill="${c}" stroke="#00000033" stroke-width="1.5"/><text x="-76" y="${376 + i * 28}" fill="#15241b" font-family="Manrope" font-weight="700" font-size="16">${t}</text></g>`,
        )
        .join("")}
      <g class="pop" style="--d:3.2">
        <rect x="-96" y="440" width="150" height="30" rx="15" fill="#d6f2df"/>
        <text x="-21" y="460" fill="#14512f" font-family="Manrope" font-weight="800" font-size="14" text-anchor="middle">для тропических</text>
      </g>
      <rect class="pt-ring" style="--d:3.4" x="-110" y="306" width="220" height="42" rx="14" fill="none" stroke="#8be3a8" stroke-width="4"/>`;
    return `
    ${phone(300, 28, inner, 0.1)}
    ${sparkles(
      [
        [110, 200, 2.4],
        [500, 300, 2.9],
        [470, 120, 3.4],
      ],
      "#8be3a8",
    )}
    ${chip(300, 612, "схема — в карточке вида", "#8be3a8", 3.6)}`;
  })(),

  // ---- Урок 11: пересадка ----
  rootsOut: `
    ${pot(205, 286, 214, 164, 0.2)}
    ${plantIn(205, 286, 1.1, 0.5)}
    ${[
      "M150 448 C 140 470 112 474 92 470",
      "M182 450 C 184 478 160 492 138 496",
      "M206 450 C 210 482 232 494 262 492",
      "M232 450 C 244 470 280 474 306 466",
      "M196 450 C 196 480 192 500 200 514",
    ]
      .map(
        (dd, i) =>
          `<path class="draw" style="--d:${1.2 + i * 0.25}" pathLength="1" d="${dd}" stroke="#f3ead8" stroke-width="7" fill="none" stroke-linecap="round"/>`,
      )
      .join("")}
    ${["M128 268 C 140 250 162 252 168 268", "M176 270 C 190 254 214 254 222 270", "M232 268 C 246 252 268 256 274 270"]
      .map(
        (dd, i) =>
          `<path class="draw" style="--d:${2.2 + i * 0.25}" pathLength="1" d="${dd}" stroke="#f3ead8" stroke-width="6" fill="none" stroke-linecap="round"/>`,
      )
      .join("")}
    <g class="fade" style="--d:3.0">
      <path d="M205 566 L 205 530 M193 542 L 205 528 L 217 542" stroke="#ff9f6e" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g transform="translate(205 590)"><g class="pop" style="--d:3.2"><g class="pt-beat">
      <rect x="-82" y="-28" width="164" height="56" rx="28" fill="#ff9f6e"/>
      <text y="11" fill="#2a1206" font-family="Unbounded" font-weight="900" font-size="28" text-anchor="middle">пора!</text>
    </g></g></g>
    ${[
      [
        "корни из",
        "отверстий",
        1.0,
        `<path d="M-8 -10 q -4 12 -10 18 M0 -10 q 2 12 -2 20 M8 -10 q 6 10 10 16" stroke="#f3ead8" stroke-width="4" fill="none" stroke-linecap="round"/>`,
      ],
      [
        "вода сразу",
        "насквозь",
        1.8,
        `<path d="${dropP(0, -16, 0.9)}" fill="#7cc4ff"/><path d="M0 14 L 0 22 M-5 17 L 0 22 L 5 17" stroke="#7cc4ff" stroke-width="3" fill="none"/>`,
      ],
      [
        "не растёт",
        "летом",
        2.6,
        `<rect x="-11" y="-12" width="7" height="24" rx="3" fill="#ffd36e"/><rect x="4" y="-12" width="7" height="24" rx="3" fill="#ffd36e"/>`,
      ],
    ]
      .map(
        ([a, b, d, icon], i) => `
      <g class="pt-in" style="--d:${d}">
        <rect x="368" y="${130 + i * 108}" width="216" height="86" rx="22" fill="#ffffff12" stroke="#ff9f6e" stroke-opacity=".6" stroke-width="2"/>
        <circle cx="410" cy="${173 + i * 108}" r="26" fill="#ff9f6e33"/>
        <g transform="translate(410 ${173 + i * 108})">${icon}</g>
        <text x="448" y="${167 + i * 108}" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="20">${a}</text>
        <text x="448" y="${193 + i * 108}" fill="#ffffffb8" font-family="Manrope" font-weight="700" font-size="18">${b}</text>
      </g>`,
      )
      .join("")}`,

  cards: (o = {}) => {
    const list = o.cards?.length
      ? o.cards
      : [
          ["Молодые", "раз в год", "#8be3a8"],
          ["Взрослые", "раз в 2–3 года", "#ffd36e"],
          ["Когда", "весной", "#7cc4ff"],
        ];
    const n = list.length;
    const h = n >= 4 ? 104 : 118;
    const g = n >= 4 ? 20 : 26;
    const total = n * h + (n - 1) * g;
    const y0 = 320 - total / 2;
    return `
    <defs>${list.map((_, i) => `<clipPath id="pt-cc${i}"><rect x="50" y="${f1(y0 + i * (h + g))}" width="500" height="${h}" rx="26"/></clipPath>`).join("")}</defs>
    ${list
      .map(([title, sub, c], i) => {
        const y = f1(y0 + i * (h + g));
        const d = 0.3 + i * 0.7;
        const letter = title.trim()[0];
        return `
      <g class="pt-in" style="--d:${d}">
        <rect x="50" y="${y}" width="500" height="${h}" rx="26" fill="#0b2418" stroke="${c}" stroke-opacity=".55" stroke-width="2.5"/>
        <rect x="50" y="${y}" width="500" height="${h}" rx="26" fill="${c}" opacity=".1"/>
        <g clip-path="url(#pt-cc${i})"><path class="pt-shine" style="--d:${d + 1.2}" d="M0 ${y} L 60 ${y} L 20 ${y + h} L -40 ${y + h} Z" fill="#ffffff" opacity=".12"/></g>
        <circle cx="114" cy="${f1(y + h / 2)}" r="${h * 0.34}" fill="${c}"/>
        <circle cx="104" cy="${f1(y + h / 2 - 10)}" r="${h * 0.12}" fill="#ffffff" opacity=".35"/>
        <text x="114" y="${f1(y + h / 2 + 12)}" fill="#0b1f15" font-family="Unbounded" font-weight="900" font-size="32" text-anchor="middle">${letter}</text>
        <text x="174" y="${f1(y + h / 2 - 6)}" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="30">${title}</text>
        <text x="174" y="${f1(y + h / 2 + 28)}" fill="${c}" font-family="Manrope" font-weight="700" font-size="23">${sub}</text>
        <text x="528" y="${f1(y + h / 2 + 14)}" fill="${c}" opacity=".3" font-family="Unbounded" font-weight="900" font-size="36" text-anchor="end">${String(i + 1).padStart(2, "0")}</text>
      </g>`;
      })
      .join("")}
    ${sparkles(
      [
        [40, Math.round(y0 - 10), n * 0.7 + 0.4],
        [566, Math.round(y0 + total + 6), n * 0.7 + 0.9],
      ],
      list[0][2],
    )}`;
  },

  prep: (() => {
    const [tx, ty] = canTip(120, 214, 14);
    const items = [
      [160, 300, "полить накануне", 0.2],
      [440, 300, "горшок +2–3 см", 1.0],
      [160, 556, "свежий грунт", 1.8],
      [440, 556, "керамзит", 2.6],
    ];
    const rand = rng(91);
    let pile = "";
    for (let row = 0; row < 4; row++) {
      const cnt = 7 - row;
      for (let k = 0; k < cnt; k++) {
        pile += pebble(440 - cnt * 11 + k * 22 + 11 + rand() * 4, 498 - row * 17 + rand() * 3, 10 + rand() * 2);
      }
    }
    return `
    ${canDefs}${bagDefs}${kzDefs}
    ${can(120, 214, 14, 0.2)}
    ${dripStream(tx, ty + 6, 30, 0.9, 3, "#7cc4ff", 0, 1.2)}
    ${pot(440, 160, 140, 104, 1.0)}
    <g class="fade" style="--d:1.4">
      <path d="M362 124 L 362 108 M518 124 L 518 108 M362 116 L 518 116" stroke="#8be3a8" stroke-width="3" fill="none"/>
    </g>
    ${bag(160, 360, 120, 150, 1.8)}
    <g class="rise" style="--d:2.6">
      <ellipse cx="440" cy="514" rx="90" ry="10" fill="#000" opacity=".45" filter="url(#soft)"/>
      ${pile}
    </g>
    ${items.map(([x, y, t, d]) => label(x, y, t, "#ffffff", d + 0.4, 23)).join("")}
    ${items.map(([x, y, , d], i) => badge(x + (i % 2 ? 100 : 96), y - (i < 2 ? 196 : 188), true, d + 0.7, 22)).join("")}
    ${chip(300, 614, "влажный ком выходит легче", "#7cc4ff", 3.6)}`;
  })(),

  flip: (() => {
    // Всё рисуется вокруг точки поворота (0, 0): горшок от y=−50 (верх) до y=80 (дно).
    const ball = `M-90 -62 L 90 -62 L 70 76 L -70 76 Z`;
    const rootsOnBall = [
      "M-80 -20 C -40 -6 -60 30 -20 46",
      "M76 -30 C 40 0 64 30 20 60",
      "M-60 60 C -20 50 20 70 60 56",
      "M-30 -50 C -10 -20 -40 0 -10 30",
      "M40 -50 C 20 -10 50 10 30 40",
    ]
      .map((dd) => `<path d="${dd}" stroke="#f3ead8" stroke-width="4" fill="none" stroke-linecap="round"/>`)
      .join("");
    return `
    <g class="fade" style="--d:.6">
      <path class="draw" style="--d:.6" pathLength="1" d="M470 160 A 170 170 0 0 1 470 380" stroke="#ffb38a" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M452 372 L 470 384 L 484 366" stroke="#ffb38a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g transform="translate(300 240)"><g class="rise" style="--d:.1"><g class="pt-flip">
      <g class="pt-slide">
        <path d="${ball}" fill="url(#soilG)"/>
        ${rootsOnBall}
      </g>
      <ellipse cx="0" cy="94" rx="120" ry="12" fill="#000" opacity=".3" filter="url(#soft)"/>
      <path d="${potPath(0, -50, 200, 130)}" fill="url(#potG)"/>
      <rect x="-112" y="-76" width="224" height="38" rx="10" fill="#c4643a"/>
      <rect x="-112" y="-76" width="224" height="8" rx="4" fill="#f0a072" opacity=".6"/>
      <rect x="-12" y="76" width="24" height="6" rx="2" fill="#2b1a0f"/>
      <g class="pt-slide">
        <ellipse cx="0" cy="-70" rx="98" ry="9" fill="#3b2516"/>
        <g transform="translate(0 -4) scale(.85)">${SPROUT.leafy(0.3)}</g>
        <g class="pop" style="--d:.5">
          <path d="M116 -104 L 44 -104 Q 22 -108 2 -100 L -78 -98 Q -102 -96 -102 -84 Q -102 -70 -80 -70 L 48 -68 Q 84 -66 116 -72 Z" fill="#f2c6a6"/>
          <path d="M-96 -84 L -18 -84 M-92 -77 L -30 -77" stroke="#d9a07e" stroke-width="2.5" stroke-linecap="round"/>
          <ellipse cx="14" cy="-108" rx="26" ry="10" fill="#f2c6a6" transform="rotate(-12 14 -108)"/>
          <path d="M-70 -96 Q -40 -102 -6 -98" stroke="#ffffff" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round"/>
          <rect x="106" y="-112" width="74" height="50" rx="14" fill="#7cc4ff"/>
          <rect x="106" y="-112" width="12" height="50" rx="5" fill="#2f80ed"/>
        </g>
      </g>
    </g></g></g>
    ${[0, 1, 2, 3]
      .map(
        (i) =>
          `<circle class="pt-fall" style="--d:${3.9 + i * 0.35};--dy:90px;--dx:${(i % 2 ? 1 : -1) * 6}px;--t:1.4s" cx="${270 + i * 20}" cy="${400 + (i % 2) * 8}" r="${3 + (i % 2)}" fill="#6b4429"/>`,
      )
      .join("")}
    ${chip(300, 612, "держим у основания", "#ffb38a", 3.8)}`;
  })(),

  rootball: (() => {
    const cx = 250;
    const healthy = [
      "M178 292 C 198 318 186 350 206 384",
      "M322 288 C 306 318 320 352 298 386",
      "M204 262 C 232 280 266 276 296 262",
      "M232 300 C 250 326 228 350 246 378",
      "M200 404 C 196 440 176 460 168 492",
      "M224 408 C 226 444 216 470 222 504",
      "M250 410 C 254 446 246 476 254 512",
    ]
      .map(
        (dd, i) =>
          `<path class="draw" style="--d:${0.6 + i * 0.12}" pathLength="1" d="${dd}" stroke="#f3ead8" stroke-width="${i < 4 ? 4 : 6}" fill="none" stroke-linecap="round"/>`,
      )
      .join("");
    const dark = [
      ["M282 404 C 288 420 290 430 292 440", "M292 440 C 294 460 284 480 290 500"],
      ["M302 398 C 312 414 318 426 322 440", "M322 440 C 326 456 336 474 330 496"],
    ];
    return `
    ${kzDefs}
    <path d="M168 250 Q 250 222 332 250 L 340 330 Q 336 392 300 410 Q 250 426 200 410 Q 164 392 160 330 Z" fill="#000" opacity=".4" filter="url(#soft)" transform="translate(6 14)"/>
    <g class="rise" style="--d:.1">
      <path d="M168 250 Q 250 222 332 250 L 340 330 Q 336 392 300 410 Q 250 426 200 410 Q 164 392 160 330 Z" fill="url(#soilG)"/>
      ${specks(
        (yy) => 170 + Math.max(0, yy - 380) * 0.8,
        (yy) => 330 - Math.max(0, yy - 380) * 0.8,
        250,
        404,
        30,
        ["#8a5a35", "#2a1a0e"],
        101,
        2,
        4,
      )}
    </g>
    ${healthy}
    ${plantIn(cx, 262, 0.9, 0.3)}
    ${dark
      .map(
        ([a, b], i) => `
      <path class="draw" style="--d:${1.2 + i * 0.2}" pathLength="1" d="${a}" stroke="#8a6a50" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path class="draw" style="--d:${1.2 + i * 0.2}" pathLength="1" d="${a}" stroke="#2a1810" stroke-width="7" fill="none" stroke-linecap="round"/>
      <g class="pt-cutfall" style="--d:${2.6 + i * 0.1}">
        <path class="draw" style="--d:${1.3 + i * 0.2}" pathLength="1" d="${b}" stroke="#8a6a50" stroke-width="11" fill="none" stroke-linecap="round"/>
        <path class="draw" style="--d:${1.3 + i * 0.2}" pathLength="1" d="${b}" stroke="#2a1810" stroke-width="7" fill="none" stroke-linecap="round"/>
        <circle cx="${i ? 330 : 289}" cy="${i ? 470 : 476}" r="4" fill="#7a8a3a"/>
      </g>`,
      )
      .join("")}
    <g transform="translate(386 440)"><g class="pt-out"><g class="pop" style="--d:1.6">
      <g class="pt-snipA" style="--d:1.6"><path d="M0 -4 L -96 -2 L -96 2 L 0 6 Z" fill="#dfe6ee"/><circle cx="34" cy="-22" r="16" fill="none" stroke="#ff8a8f" stroke-width="8"/><path d="M0 0 L 22 -14" stroke="#ff8a8f" stroke-width="8"/></g>
      <g class="pt-snipB" style="--d:1.6"><path d="M0 4 L -96 2 L -96 -2 L 0 -6 Z" fill="#b9c3cf"/><circle cx="34" cy="22" r="16" fill="none" stroke="#ff8a8f" stroke-width="8"/><path d="M0 0 L 22 14" stroke="#ff8a8f" stroke-width="8"/></g>
      <circle r="5" fill="#5a6470"/>
    </g></g></g>
    <g transform="translate(350 404) rotate(-120)"><g class="pop" style="--d:3.6">
      <rect x="-24" y="2" width="48" height="66" rx="12" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".75" stroke-width="3"/>
      <rect x="-19" y="26" width="38" height="38" rx="8" fill="#1a1a1a"/>
      <rect x="-26" y="-4" width="52" height="10" rx="4" fill="#e8f5ff" opacity=".8"/>
    </g></g>
    ${label(452, 330, "уголь", "#ffd36e", 3.8, 22)}
    ${[0, 1, 2, 3, 4]
      .map(
        (i) =>
          `<circle class="pt-fall" style="--d:${3.9 + i * 0.22};--dy:${36 + (i % 3) * 6}px;--dx:${-58 + i * 8}px;--t:1.1s" cx="350" cy="404" r="3" fill="#1a1a1a"/>`,
      )
      .join("")}
    ${[
      [292, 442],
      [322, 442],
    ]
      .map(([x, y], i) => `<circle class="pop" style="--d:${4.2 + i * 0.2}" cx="${x}" cy="${y}" r="7" fill="#151515"/>`)
      .join("")}
    ${badge(436, 118, true, 0.9, 22)}
    <text class="fade" style="--d:1.0" x="468" y="114" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="22">светлые</text>
    <text class="fade" style="--d:1.1" x="468" y="138" fill="#ffffffaa" font-family="Manrope" font-weight="700" font-size="17">упругие</text>
    ${badge(436, 200, false, 1.4, 22)}
    <text class="fade" style="--d:1.5" x="468" y="196" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="22">тёмные</text>
    <text class="fade" style="--d:1.6" x="468" y="220" fill="#ffffffaa" font-family="Manrope" font-weight="700" font-size="17">мягкие</text>
    ${chip(300, 612, "срезы — толчёным углём", "#ffd36e", 4.2)}`;
  })(),

  replant: (() => {
    const x = 300;
    const y = 262;
    const w = 280;
    const h = 250;
    const c = cutPot(x, y, w, h, 13);
    const kzTop = c.yb - 22;
    const soilBase = kzTop - 36;
    const ballTop = 312;
    const ball = `M${x - 70} ${ballTop} L ${x + 70} ${ballTop} L ${x + 58} ${soilBase} L ${x - 58} ${soilBase} Z`;
    const sideL = `M${f1(c.L(ballTop))} ${ballTop} L ${x - 70} ${ballTop} L ${x - 58} ${soilBase} L ${f1(c.L(soilBase))} ${soilBase} Z`;
    const sideR = `M${f1(c.R(ballTop))} ${ballTop} L ${x + 70} ${ballTop} L ${x + 58} ${soilBase} L ${f1(c.R(soilBase))} ${soilBase} Z`;
    const base = `M${f1(c.L(soilBase))} ${soilBase} L ${f1(c.R(soilBase))} ${soilBase} L ${f1(c.R(kzTop))} ${kzTop} L ${f1(c.L(kzTop))} ${kzTop} Z`;
    const [tx, ty] = canTip(112, 150, 26);
    return `
    ${kzDefs}${canDefs}
    <defs><linearGradient id="pt-fresh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5232"/><stop offset="1" stop-color="#4a2e1a"/></linearGradient></defs>
    <g class="rise" style="--d:.1">${c.body}</g>
    <g class="grow" style="--d:.7">${kzLayer(c.L, c.R, kzTop, c.yb, 5, 8)}</g>
    <g class="grow" style="--d:1.2"><path d="${base}" fill="url(#pt-fresh)"/>${specks(c.L, c.R, soilBase + 4, kzTop - 4, 12, ["#f4f1e8", "#a0612f"], 111, 2, 3.5)}</g>
    <g class="pt-desc" style="--d:1.8">
      <path d="${ball}" fill="url(#soilG)"/>
      ${["M250 330 C 270 350 250 380 270 400", "M350 330 C 330 350 350 380 330 400", "M270 410 C 290 400 310 412 330 404", "M300 320 C 290 350 310 370 296 404"].map((dd) => `<path d="${dd}" stroke="#f3ead8" stroke-width="4" fill="none" stroke-linecap="round"/>`).join("")}
      <ellipse cx="${x}" cy="${ballTop}" rx="70" ry="7" fill="#3b2516"/>
      ${plantIn(x, ballTop + 20, 0.95, 1.8)}
    </g>
    <g class="grow" style="--d:3.0"><path d="${sideL}" fill="url(#pt-fresh)"/></g>
    <g class="grow" style="--d:3.2"><path d="${sideR}" fill="url(#pt-fresh)"/></g>
    <g class="fade" style="--d:3.2">${specks(
      (yy) => c.L(yy),
      () => x - 64,
      ballTop + 6,
      soilBase - 4,
      6,
      ["#f4f1e8"],
      121,
      2,
      3,
    )}${specks(
      () => x + 64,
      (yy) => c.R(yy),
      ballTop + 6,
      soilBase - 4,
      6,
      ["#f4f1e8"],
      131,
      2,
      3,
    )}</g>
    <g class="rise" style="--d:.1">${c.rim}</g>
    <g class="fade" style="--d:3.6">
      <path d="M${f1(c.L(ballTop) - 30)} ${ballTop} L ${f1(c.R(ballTop) + 30)} ${ballTop}" stroke="#8be3a8" stroke-width="3" stroke-dasharray="10 8"/>
    </g>
    ${[x - 108, x + 108]
      .map(
        (xx, i) =>
          `<g class="fade" style="--d:${3.8 + i * 0.1}"><g class="pt-press"><path d="M${xx} ${ballTop - 52} L ${xx} ${ballTop - 18} M${xx - 9} ${ballTop - 28} L ${xx} ${ballTop - 16} L ${xx + 9} ${ballTop - 28}" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`,
      )
      .join("")}
    ${can(112, 150, 26, 4.0)}
    ${dripStream(tx, ty + 4, ballTop - ty - 30, 4.4, 4, "#7cc4ff", 0, 1)}
    <g class="fade" style="--d:1.0">
      <path d="M${f1(c.R(c.yb - 10) - 6)} ${c.yb - 10} L 462 ${c.yb - 10}" stroke="#ffffff99" stroke-width="3"/>
      <text x="468" y="${c.yb - 3}" fill="#ff9f6e" font-family="Manrope" font-weight="800" font-size="21">дренаж</text>
    </g>
    <g class="fade" style="--d:1.5">
      <path d="M${f1(c.R(soilBase + 18) - 6)} ${soilBase + 18} L 462 ${soilBase + 18}" stroke="#ffffff99" stroke-width="3"/>
      <text x="468" y="${soilBase + 25}" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="21">грунт</text>
    </g>
    ${chip(300, 612, "та же глубина", "#8be3a8", 3.7)}`;
  })(),
};

/** Акцентный цвет сцены (фон, заголовок, полоска прогресса). */
export const accent = {
  sizes: "#ff9f6e",
  materials: "#ff9f6e",
  orchid: "#ffb3d1",
  drain: "#7cc4ff",
  cachepot: "#62e3d3",
  peat: "#ffb38a",
  layers3: "#8be3a8",
  recipe: "#ffd36e",
  kbcard: "#8be3a8",
  rootsOut: "#ff9f6e",
  cards: "#c2a8ff",
  prep: "#7cc4ff",
  flip: "#ffb38a",
  rootball: "#ffd36e",
  replant: "#8be3a8",
};

/** CSS-анимации, нужные этим сценам (префикс pt-). */
export const css = `
  .pt-bub { animation: pt-bub 2.4s ease-in infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-bub { from { transform: translateY(0); opacity: 0; } 20% { opacity: .9; } to { transform: translateY(-60px); opacity: 0; } }
  .pt-fall { animation: pt-fall var(--t, 1.4s) cubic-bezier(.5,0,1,1) infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-fall { from { transform: translate(0, 0); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } to { transform: translate(var(--dx, 0px), var(--dy, 100px)); opacity: 0; } }
  .pt-pourfall { animation: pt-fall .55s cubic-bezier(.5,0,1,1) 2 both; animation-delay: calc(var(--d) * 1s); }
  .pt-wisp { animation: pt-wisp 2.6s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-wisp { from { transform: translateY(0); opacity: 0; } 30% { opacity: .9; } to { transform: translateY(-46px); opacity: 0; } }
  .pt-sway { animation: pt-sway 4.5s ease-in-out infinite; }
  @keyframes pt-sway { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2.5deg); } }
  .pt-dry { transform-box: fill-box; transform-origin: 0 50%; animation: pt-dry 4.5s cubic-bezier(.3,0,.3,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-dry { from { transform: scaleX(1); } to { transform: scaleX(var(--k)); } }
  .pt-growx { transform-box: fill-box; transform-origin: 0 50%; animation: pt-growx .8s cubic-bezier(.2,1,.3,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-growx { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .pt-layer { transform-box: fill-box; transform-origin: 50% 100%; animation: grow .7s cubic-bezier(.2,1,.3,1) both; animation-delay: calc(var(--d) * 1s); }
  .pt-flip { animation: pt-flip 1.5s cubic-bezier(.6,0,.3,1) both; animation-delay: 1s; }
  @keyframes pt-flip { from { transform: rotate(0); } to { transform: rotate(170deg); } }
  .pt-slide { animation: pt-slide 1.4s cubic-bezier(.5,0,.3,1) both; animation-delay: 2.7s; }
  @keyframes pt-slide { from { transform: translateY(0); } to { transform: translateY(-120px); } }
  .pt-pour { animation: pt-pour 1.5s ease-in-out both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-pour { 0% { transform: rotate(0); } 30%,70% { transform: rotate(var(--r)); } 100% { transform: rotate(0); } }
  .pt-empty { transform-box: fill-box; transform-origin: 50% 100%; animation: pt-empty .6s ease-in both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-empty { from { transform: scaleY(1); } to { transform: scaleY(0); } }
  .pt-in { animation: pt-in .9s cubic-bezier(.2,1,.3,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-in { from { transform: translateX(-70px); opacity: 0; } to { transform: none; opacity: 1; } }
  .pt-shine { animation: pt-shine 3.6s ease-in-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-shine { from { transform: translateX(0); } 55%,100% { transform: translateX(640px); } }
  .pt-cutfall { transform-box: fill-box; transform-origin: 50% 0; animation: pt-cutfall 1.2s cubic-bezier(.5,0,1,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-cutfall { to { transform: translate(14px, 110px) rotate(25deg); opacity: 0; } }
  .pt-snipA { animation: pt-snipA 1.4s ease-in-out both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-snipA { 0%,55% { transform: rotate(14deg); } 75%,100% { transform: rotate(0); } }
  .pt-snipB { animation: pt-snipB 1.4s ease-in-out both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-snipB { 0%,55% { transform: rotate(-14deg); } 75%,100% { transform: rotate(0); } }
  .pt-out { animation: pt-out .8s ease-in both; animation-delay: 3.3s; }
  @keyframes pt-out { to { transform: translate(60px, 20px); opacity: 0; } }
  .pt-desc { animation: pt-desc 1.3s cubic-bezier(.3,0,.2,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-desc { from { transform: translateY(-170px); opacity: 0; } 30% { opacity: 1; } to { transform: none; opacity: 1; } }
  .pt-spin { animation: pt-spin 2.4s linear infinite; }
  @keyframes pt-spin { to { transform: rotate(360deg); } }
  .pt-beat { transform-box: fill-box; transform-origin: center; animation: pt-beat 1.3s ease-in-out infinite; animation-delay: 4s; }
  @keyframes pt-beat { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
  .pt-ring { transform-box: fill-box; transform-origin: center; animation: pt-ring 1.8s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pt-ring { from { transform: scale(.7); opacity: 0; } 15% { opacity: .9; } to { transform: scale(1.5); opacity: 0; } }
  .pt-press { animation: pt-press 1s ease-in-out infinite; }
  @keyframes pt-press { 0%,100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }
  .pt-pool { transform-box: fill-box; transform-origin: center; animation: pt-pool 3s ease both; animation-delay: 3.6s; }
  @keyframes pt-pool { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: .8; } }
`;
