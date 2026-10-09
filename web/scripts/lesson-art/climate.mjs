/**
 * Сцены видеоуроков (сценарии — src/data/lessons.json): влажность, температура и сезоны
 * (уроки humidity и seasons; pebbles и cactusRest переиспользуют vacation и flowering).
 */

import { badge, chip, label, leaf, pot, potted, sparkles, stem } from "./kit.mjs";

const RAD = Math.PI / 180;
/** Точка на окружности: угол в градусах от «12 часов» по часовой стрелке. */
const pt = (cx, cy, r, a) => [+(cx + r * Math.sin(a * RAD)).toFixed(1), +(cy - r * Math.cos(a * RAD)).toFixed(1)];
/** Дуга окружности от угла a0 до a1 (по часовой). */
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  return `M${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};
/** Сектор кольца между радиусами r0 и r1. */
const sector = (cx, cy, r0, r1, a0, a1) => {
  const [ax, ay] = pt(cx, cy, r1, a0);
  const [bx, by] = pt(cx, cy, r1, a1);
  const [qx, qy] = pt(cx, cy, r0, a1);
  const [px, py] = pt(cx, cy, r0, a0);
  return `M${ax} ${ay} A ${r1} ${r1} 0 0 1 ${bx} ${by} L ${qx} ${qy} A ${r0} ${r0} 0 0 0 ${px} ${py} Z`;
};

/** Капля (вершина в x, y). */
const dropPath = (x, y, s = 1) => `M${x} ${y} q ${9 * s} ${16 * s} 0 ${25 * s} q ${-9 * s} ${-9 * s} 0 ${-25 * s} Z`;

/** Снежинка с центром (0, 0) радиуса r. */
const flake = (r, color, w = 4) =>
  [0, 60, 120]
    .map(
      (a) => `<g transform="rotate(${a})">
        <path d="M0 ${-r} L0 ${r} M${-r * 0.3} ${-r * 0.8} L0 ${-r * 0.55} L${r * 0.3} ${-r * 0.8} M${-r * 0.3} ${r * 0.8} L0 ${r * 0.55} L${r * 0.3} ${r * 0.8}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </g>`,
    )
    .join("");

/** Солнышко с центром (0, 0). */
const sunIcon = (r, color) =>
  `<circle r="${r}" fill="${color}"/>` +
  Array.from({ length: 8 }, (_, i) => {
    const [x0, y0] = pt(0, 0, r + 5, i * 45);
    const [x1, y1] = pt(0, 0, r + 13, i * 45);
    return `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
  }).join("");

/** Волнистая струйка пара/жара от (0, 0) вверх. */
const WAVE = "M0 0 q 7 -12 0 -24 q -7 -12 0 -24 q 7 -12 0 -24";
const waves = (pts, color, d0, t = 2.6) =>
  pts
    .map(
      ([x, y], i) =>
        `<g transform="translate(${x} ${y})"><path class="cl-up" style="--d:${d0 + i * 0.45};--t:${t}s" d="${WAVE}" stroke="${color}" stroke-width="5" stroke-linecap="round" fill="none"/></g>`,
    )
    .join("");

/**
 * Термометр: x — ось, y0 — уровень 0 °C, k — пикселей на градус, tmax — верх шкалы,
 * band — зелёная (или иная) зона [от, до], val — куда поднимется столбик.
 */
const thermometer = ({ id, x, y0, k, tmax, band, val, d, merc = ["#ff8a6b", "#e5484d"], zone = "#5fd38a", scale = true, br = 30 }) => {
  const y = (t) => y0 - t * k;
  const top = y(tmax) - 18;
  const ticks = [];
  for (let t = 0; t <= tmax; t += 5) {
    const long = t % 10 === 0;
    ticks.push(
      `<path d="M${x - 16} ${y(t)} L ${x - (long ? 30 : 24)} ${y(t)}" stroke="#ffffff" stroke-opacity=".7" stroke-width="${long ? 3 : 2}"/>`,
    );
    if (scale && long)
      ticks.push(
        `<text x="${x - 38}" y="${y(t) + 7}" fill="#ffffffb0" font-family="Manrope" font-weight="700" font-size="19" text-anchor="end">${t}</text>`,
      );
  }
  return `
    <defs>
      <linearGradient id="${id}Glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".18"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".42"/><stop offset="1" stop-color="#ffffff" stop-opacity=".12"/></linearGradient>
      <linearGradient id="${id}Merc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${merc[1]}"/><stop offset=".45" stop-color="${merc[0]}"/><stop offset="1" stop-color="${merc[1]}"/></linearGradient>
    </defs>
    <g class="fade" style="--d:${d + 0.5}"><rect x="${x - 26}" y="${y(band[1])}" width="52" height="${(band[1] - band[0]) * k}" rx="10" fill="${zone}" opacity=".3"/></g>
    <g class="fade" style="--d:${d + 0.5}">
      <path d="M${x - 26} ${y(band[1])} L ${x + 30} ${y(band[1])} M${x - 26} ${y(band[0])} L ${x + 30} ${y(band[0])}" stroke="${zone}" stroke-width="3" stroke-dasharray="6 5"/>
    </g>
    <g class="rise" style="--d:${d}">
      <ellipse cx="${x}" cy="${y0 + 40 + br}" rx="${br * 1.6}" ry="10" fill="#000" opacity=".4" filter="url(#soft)"/>
      <rect x="${x - 16}" y="${top}" width="32" height="${y0 + 30 - top}" rx="16" fill="#0b2016" stroke="#ffffff" stroke-opacity=".55" stroke-width="3"/>
      <circle cx="${x}" cy="${y0 + 40}" r="${br}" fill="#0b2016" stroke="#ffffff" stroke-opacity=".55" stroke-width="3"/>
      ${ticks.join("")}
    </g>
    <rect class="cl-merc" style="--d:${d + 0.7}" x="${x - 8}" y="${y(val)}" width="16" height="${y0 + 40 - y(val)}" rx="8" fill="url(#${id}Merc)"/>
    <g class="fade" style="--d:${d + 0.3}">
      <circle cx="${x}" cy="${y0 + 40}" r="${br - 8}" fill="url(#${id}Merc)"/>
      <circle cx="${x - br * 0.3}" cy="${y0 + 40 - br * 0.3}" r="${br * 0.22}" fill="#ffffff" opacity=".55"/>
      <rect x="${x - 10}" y="${top + 8}" width="5" height="${y0 - top - 10}" rx="2.5" fill="url(#${id}Glass)"/>
    </g>`;
};

// ---------------------------------------------------------------------------

/** Гигрометр: стрелка падает с тропических 70 % до зимних 25 %. */
const hygro = () => {
  const cx = 300;
  const cy = 300;
  const ang = (v) => -120 + 2.4 * v;
  const zones = [
    [0, 35, "#ff6b6b"],
    [35, 50, "#ffd36e"],
    [50, 85, "#5fd38a"],
    [85, 100, "#7cc4ff"],
  ];
  const ticks = [];
  for (let v = 0; v <= 100; v += 5) {
    const long = v % 25 === 0;
    const [x0, y0] = pt(cx, cy, 96, ang(v));
    const [x1, y1] = pt(cx, cy, long ? 84 : 90, ang(v));
    ticks.push(
      `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#ffffff" stroke-opacity="${long ? 0.85 : 0.45}" stroke-width="${long ? 3 : 2}"/>`,
    );
    if (long) {
      const [tx, ty] = pt(cx, cy, 66, ang(v));
      ticks.push(
        `<text x="${tx}" y="${ty + 6}" fill="#ffffffb8" font-family="Manrope" font-weight="800" font-size="16" text-anchor="middle">${v}</text>`,
      );
    }
  }
  return `
    <defs>
      <radialGradient id="hyFace" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#1d4a37"/><stop offset="1" stop-color="#081a12"/></radialGradient>
      <linearGradient id="hyFin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9b2a6"/><stop offset=".45" stop-color="#fbf7ef"/><stop offset="1" stop-color="#a8a196"/></linearGradient>
    </defs>
    <!-- тропики -->
    ${pot(85, 342, 80, 54, 0.3)}
    ${[-68, -34, 0, 34, 68].map((r, i) => leaf(85, 322, 0.45, r, 0.6 + i * 0.12, i % 2 ? "leafG2" : "leafG")).join("")}
    ${[
      [30, 214, 1.4],
      [140, 200, 1.6],
      [88, 168, 1.8],
    ]
      .map(
        ([x, y, d]) =>
          `<g class="cl-bob" style="--d:${d}"><path class="pop" style="--d:${d}" d="${dropPath(x, y, 0.8)}" fill="#9fd6ff"/></g>`,
      )
      .join("")}
    ${label(85, 452, "тропики", "#ffffff", 1.0, 22)}
    ${label(85, 486, "60–80%", "#5fd38a", 1.2, 26)}
    <!-- батарея -->
    <g class="fade" style="--d:2.2"><ellipse cx="515" cy="340" rx="80" ry="60" fill="#ff6b6b" opacity=".35" filter="url(#soft)"/></g>
    <g class="rise" style="--d:.5">
      <ellipse cx="515" cy="404" rx="62" ry="8" fill="#000" opacity=".4" filter="url(#soft)"/>
      ${[0, 1, 2, 3, 4].map((i) => `<rect x="${462 + i * 22}" y="292" width="18" height="106" rx="8" fill="url(#hyFin)"/>`).join("")}
      <rect x="458" y="304" width="114" height="7" rx="3" fill="#cfc8bc"/>
      <rect x="458" y="378" width="114" height="7" rx="3" fill="#cfc8bc"/>
    </g>
    ${waves(
      [
        [480, 280],
        [515, 284],
        [550, 280],
      ],
      "#ff9f6e",
      2.2,
    )}
    ${label(515, 452, "зимой", "#ffffff", 2.4, 22)}
    ${label(515, 486, "20–30%", "#ff6b6b", 2.6, 26)}
    <!-- циферблат -->
    <g class="pop" style="--d:.1">
      <circle cx="${cx}" cy="${cy + 10}" r="150" fill="#000" opacity=".45" filter="url(#soft)"/>
      <circle cx="${cx}" cy="${cy}" r="140" fill="url(#hyFace)" stroke="#e9e1d2" stroke-width="8"/>
      ${zones.map(([a, b, c]) => `<path d="${arc(cx, cy, 112, ang(a) + 0.8, ang(b) - 0.8)}" stroke="${c}" stroke-width="20" fill="none"/>`).join("")}
      ${ticks.join("")}
      <path d="${arc(cx, cy, 128, -60, 10)}" stroke="#ffffff" stroke-opacity=".14" stroke-width="8" fill="none" stroke-linecap="round"/>
      <text x="${cx}" y="${cy + 116}" fill="#ffffff80" font-family="Manrope" font-weight="800" font-size="15" letter-spacing="2" text-anchor="middle">ВЛАЖНОСТЬ</text>
    </g>
    <text class="cl-out" style="--d:2.2" x="${cx}" y="${cy + 84}" fill="#5fd38a" font-family="Unbounded" font-weight="900" font-size="34" text-anchor="middle">70%</text>
    <text class="fade" style="--d:3.6" x="${cx}" y="${cy + 84}" fill="#ff6b6b" font-family="Unbounded" font-weight="900" font-size="34" text-anchor="middle">25%</text>
    <g transform="translate(${cx} ${cy})"><g class="fade" style="--d:.6">
      <g class="cl-needle" style="--d:1.8;--a0:${ang(70)}deg;--a1:${ang(25)}deg"><g class="cl-jit">
        <path d="M-7 0 L 0 -104 L 7 0 Z" fill="#ff6b6b"/>
        <path d="M-6 0 L 0 24 L 6 0 Z" fill="#e9e1d2"/>
      </g></g>
      <circle r="13" fill="url(#goldG)"/>
    </g></g>
    ${chip(300, 604, "сухие кончики и клещ", "#ff8a8f", 4.2)}`;
};

/** Увлажнитель с клубами пара между растениями. */
const humidifier = () => `
    <defs>
      <linearGradient id="huBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a9cfca"/><stop offset=".4" stop-color="#f6fffd"/><stop offset="1" stop-color="#94bdb7"/></linearGradient>
      <radialGradient id="huPuff" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f2fdff" stop-opacity=".8"/><stop offset="1" stop-color="#e6fbff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect class="rise" style="--d:.1" x="30" y="545" width="540" height="16" rx="7" fill="#d9cdb8"/>
    ${potted(110, 545, 1.15, 0.7, "leafy")}
    ${potted(486, 545, 1.0, 1.0, "chloro")}
    <g class="rise" style="--d:.2">
      <ellipse cx="300" cy="548" rx="100" ry="10" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="M232 542 L 368 542 Q 384 542 382 526 L 364 362 Q 361 340 340 340 L 260 340 Q 239 340 236 362 L 218 526 Q 216 542 232 542 Z" fill="url(#huBody)"/>
      <rect x="256" y="378" width="88" height="100" rx="16" fill="#0d2a2a" opacity=".45"/>
      <rect x="259" y="420" width="82" height="55" rx="13" fill="url(#waterG)"/>
      <path d="M259 424 q 10 -6 20 0 t 20 0 t 20 0 t 22 0" stroke="#e6fbff" stroke-width="3" fill="none" opacity=".8"/>
      <rect x="262" y="384" width="8" height="88" rx="4" fill="#ffffff" opacity=".35"/>
      <rect x="268" y="492" width="64" height="32" rx="10" fill="#0d2a2a"/>
      <text x="300" y="516" fill="#62e3d3" font-family="Unbounded" font-weight="900" font-size="18" text-anchor="middle">55%</text>
      <ellipse cx="300" cy="342" rx="46" ry="11" fill="#cfe6e2"/>
      <ellipse cx="300" cy="340" rx="24" ry="6" fill="#123a37"/>
    </g>
    <g class="fade" style="--d:1"><ellipse cx="300" cy="340" rx="34" ry="9" fill="none" stroke="#62e3d3" stroke-width="3" filter="url(#glow)"/></g>
    ${Array.from(
      { length: 10 },
      (_, i) =>
        `<circle class="cl-steam" style="--d:${1.1 + i * 0.32};--sx:${[-30, 24, -8, 40, -44, 10, 30, -20, 0, -36][i]}px" cx="300" cy="326" r="${22 + (i % 3) * 5}" fill="url(#huPuff)"/>`,
    ).join("")}
    ${sparkles(
      [
        [190, 200, 2.4],
        [420, 190, 2.9],
        [160, 300, 3.4],
        [440, 300, 3.8],
      ],
      "#bff6ee",
    )}
    ${chip(300, 610, "цель: 50–60%", "#62e3d3", 2.6)}`;

/** Поддон с мокрым керамзитом и группа растений; o.bag — пакет-теплица на центральном. */
const pebbles = (o = {}) => {
  const back = [];
  const front = [];
  [458, 468, 478, 488, 498, 506].forEach((y, j) => {
    for (let x = 92 + (j % 2) * 11; x <= 510; x += 22) {
      const inside = ((x - 300) / 214) ** 2 + ((y - 482) / 28) ** 2 < 1;
      if (!inside || (x * 7 + j * 13) % 9 === 0) continue;
      const r = 8 + ((x + j * 5) % 4);
      const c = `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#peKer)"/>`;
      (y < 488 ? back : front).push(c);
    }
  });
  const bag = o.bag
    ? `<g class="fade" style="--d:2.6">
        <path d="M212 488 C 196 400 200 236 300 176 C 400 236 404 400 388 488 Z" fill="#e8f6ff" opacity=".16" stroke="#eef8ff" stroke-opacity=".7" stroke-width="3"/>
        <path d="M234 420 C 226 330 240 250 286 206" stroke="#ffffff" stroke-opacity=".45" stroke-width="8" stroke-linecap="round" fill="none"/>
        <path d="M300 176 q -10 -18 4 -30 M300 176 q 12 -16 -2 -30" stroke="#eef8ff" stroke-opacity=".8" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
      ${[
        [262, 300],
        [340, 268],
        [352, 352],
        [250, 380],
        [318, 230],
      ]
        .map(([x, y], i) => `<circle class="cl-vanish" style="--d:${3.2 + i * 0.3};--t:3s" cx="${x}" cy="${y}" r="4" fill="#cdeeff"/>`)
        .join("")}`
    : "";
  return `
    <defs>
      <radialGradient id="peKer" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f2b07a"/><stop offset=".6" stop-color="#c06a36"/><stop offset="1" stop-color="#7a3a1a"/></radialGradient>
      <linearGradient id="peTray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9f3f0"/><stop offset="1" stop-color="#93aea6"/></linearGradient>
    </defs>
    <g class="rise" style="--d:.1">
      <ellipse cx="300" cy="540" rx="250" ry="18" fill="#000" opacity=".45" filter="url(#soft)"/>
      <ellipse cx="300" cy="482" rx="228" ry="32" fill="#16323c"/>
      <ellipse cx="300" cy="488" rx="214" ry="24" fill="url(#waterG)"/>
    </g>
    <g class="rise" style="--d:.4">${back.join("")}</g>
    ${potted(150, 494, 0.85, 0.9, "aspid")}
    ${potted(300, 490, 1.05, 1.2, "leafy")}
    ${potted(450, 494, 0.95, 1.5, "snake")}
    <g class="rise" style="--d:.5">
      ${front.join("")}
      <path d="M72 482 A 228 32 0 0 0 528 482 L 512 530 Q 300 556 88 530 Z" fill="url(#peTray)"/>
      <path d="M76 484 A 226 30 0 0 0 524 484" stroke="#ffffff" stroke-opacity=".7" stroke-width="4" fill="none"/>
    </g>
    ${waves(
      [
        [92, 470],
        [226, 462],
        [376, 462],
        [510, 470],
      ],
      "#bfefff",
      1.9,
      3,
    )}
    ${bag}
    ${label(300, 578, "горшки на камешках, не в воде", "#9fd6ff", 2.2, 21)}
    ${o.bag ? chip(300, 104, "влаголюбивым — пакет", "#62e3d3", 3.2) : chip(300, 622, "вместе — влажнее", "#62e3d3", 3.2)}`;
};

/** Опрыскивание: туман на минуты, пятна на опушённых листьях фиалки. */
const mist = () => {
  const vLeaf = (a, d, g) => `
    <g transform="translate(400 440) rotate(${a}) scale(1.15)"><g class="pop" style="--d:${d}">
      <path d="M0 0 C -40 -6 -52 -66 0 -82 C 52 -66 40 -6 0 0 Z" fill="url(#${g})"/>
      <path d="M0 -4 L0 -72" stroke="#0f3f23" stroke-opacity=".5" stroke-width="3"/>
      ${[
        [-18, -30],
        [16, -40],
        [-10, -58],
        [22, -18],
        [-26, -48],
        [6, -66],
        [12, -26],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#ffffff" opacity=".45"/>`)
        .join("")}
    </g></g>`;
  const spots = [
    [-48, 3.4],
    [42, 3.7],
    [12, 4.0],
  ].map(([a, d]) => {
    const [x, y] = pt(400, 440, 52, a);
    return `<g transform="translate(${x} ${y})"><g class="cl-zoom" style="--d:${d}">
        <path d="M-12 -2 C -12 -10 -2 -11 4 -8 C 12 -6 13 2 8 6 C 3 11 -9 9 -12 -2 Z" fill="#f1e6c4" opacity=".9" stroke="#b8935a" stroke-width="1.5"/>
        <circle cx="10" cy="-10" r="3.5" fill="#f1e6c4" opacity=".85"/></g></g>`;
  });
  const flower = (x, y, d) => `
    <g transform="translate(${x} ${y})"><g class="cl-zoom" style="--d:${d}">
      ${[0, 72, 144, 216, 288].map((a) => `<ellipse transform="rotate(${a})" cx="0" cy="-11" rx="8" ry="11" fill="#b77cff"/>`).join("")}
      <circle r="5" fill="#ffd36e"/></g></g>`;
  return `
    <defs>
      <linearGradient id="miLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fbf7a"/><stop offset=".6" stop-color="#2f7d4a"/><stop offset="1" stop-color="#1b4d2e"/></linearGradient>
      <linearGradient id="miLeaf2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fcf8a"/><stop offset=".6" stop-color="#3a8b55"/><stop offset="1" stop-color="#1e5532"/></linearGradient>
      <linearGradient id="miBottle" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3b8fd6"/><stop offset=".45" stop-color="#9fd6ff"/><stop offset="1" stop-color="#2f6fb0"/></linearGradient>
    </defs>
    ${pot(400, 474, 150, 78, 0.2)}
    ${[-80, 80, -48, 48, -14, 14].map((a, i) => vLeaf(a, 0.5 + i * 0.12, i % 2 ? "miLeaf2" : "miLeaf")).join("")}
    ${flower(380, 364, 1.3)}${flower(412, 348, 1.45)}${flower(434, 378, 1.6)}
    <!-- пульверизатор -->
    <g transform="translate(140 300) rotate(12)"><g class="rise" style="--d:.3">
      <rect x="-44" y="0" width="88" height="168" rx="24" fill="url(#miBottle)" opacity=".9"/>
      <rect x="-30" y="12" width="12" height="140" rx="6" fill="#ffffff" opacity=".35"/>
      <rect x="-44" y="70" width="88" height="98" rx="24" fill="#2f80ed" opacity=".45"/>
      <rect x="-20" y="-22" width="40" height="26" rx="6" fill="#e9e1d2"/>
      <path d="M-34 -24 L -34 -60 Q -34 -72 -20 -72 L 62 -66 Q 74 -64 74 -54 L 74 -46 L 30 -44 L 26 -24 Z" fill="#f7f4ec"/>
      <path d="M30 -44 Q 40 -10 22 14 L 12 10 Q 24 -12 18 -40 Z" fill="#d9cdb8"/>
    </g></g>
    <g class="fade" style="--d:1.1"><path d="M222 262 L 420 330 L 380 430 Z" fill="#e6f6ff" opacity=".14"/></g>
    ${Array.from({ length: 18 }, (_, i) => {
      const dx = 120 + ((i * 47) % 90);
      const dy = 50 + ((i * 31) % 110);
      return `<circle class="cl-spray" style="--d:${1.1 + (i % 9) * 0.1};--dx:${dx}px;--dy:${dy}px" cx="222" cy="264" r="${2 + (i % 3)}" fill="#dff3ff"/>`;
    }).join("")}
    ${[
      [360, 380],
      [440, 392],
      [404, 400],
      [372, 418],
      [430, 420],
    ]
      .map(
        ([x, y], i) =>
          `<circle class="cl-vanish" style="--d:${1.8 + i * 0.25};--t:2.4s" cx="${x}" cy="${y}" r="5" fill="#cdeeff" stroke="#ffffff" stroke-width="1.5"/>`,
      )
      .join("")}
    ${spots.join("")}
    <!-- часы -->
    <g transform="translate(500 110)"><g class="pop" style="--d:.8">
      <circle r="50" fill="#000" opacity=".35" filter="url(#soft)"/>
      <circle r="46" fill="#f7f4ec" stroke="#7cc4ff" stroke-width="5"/>
      ${Array.from({ length: 12 }, (_, i) => {
        const [x0, y0] = pt(0, 0, 38, i * 30);
        const [x1, y1] = pt(0, 0, i % 3 ? 34 : 30, i * 30);
        return `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#1b3a4a" stroke-width="${i % 3 ? 2 : 3.5}"/>`;
      }).join("")}
      <path d="${sector(0, 0, 0.1, 30, 0, 30)}" fill="#7cc4ff" opacity=".45"/>
      <g class="cl-spin" style="--t:3s"><path d="M0 4 L 0 -32" stroke="#e5484d" stroke-width="4" stroke-linecap="round"/></g>
      <circle r="5" fill="#1b3a4a"/>
    </g></g>
    ${label(500, 192, "5 минут", "#7cc4ff", 1.2, 24)}
    ${label(470, 286, "пятна на листьях", "#ffb3d1", 4.2, 20)}
    ${chip(300, 612, "скорее гигиена от пыли", "#7cc4ff", 4.6)}`;
};

/** Термометр с зоной комфорта o.from…o.to °C. */
const thermo = (o = {}) => {
  const from = o.from ?? 18;
  const to = o.to ?? 25;
  const mid = (from + to) / 2;
  const y0 = 462;
  const k = 9;
  const y = (t) => y0 - t * k;
  return `
    ${thermometer({ id: "th", x: 200, y0, k, tmax: 40, band: [from, to], val: mid, d: 0.1 })}
    ${label(252, y(to) + 9, `${to}°`, "#5fd38a", 1.4, 26, "start")}
    ${label(252, y(from) + 9, `${from}°`, "#5fd38a", 1.6, 26, "start")}
    <g transform="translate(272 ${y(35)})"><g class="pop" style="--d:2.4">${sunIcon(11, "#ff9f6e")}</g></g>
    ${label(300, y(35) + 7, "жарко", "#ff9f6e", 2.6, 18, "start")}
    <g transform="translate(272 ${y(6)})"><g class="pop" style="--d:2.8">${flake(13, "#9fd6ff", 3)}</g></g>
    ${label(300, y(6) + 7, "холодно", "#9fd6ff", 3.0, 18, "start")}
    ${potted(476, 504, 1.3, 0.8, "leafy")}
    <g class="sway" style="transform-origin:476px 504px">${sparkles(
      [
        [392, 200, 3.4],
        [560, 230, 3.8],
        [550, 150, 4.2],
      ],
      "#8be3a8",
    )}</g>
    <text data-count="${Math.round(mid)}" data-start="1" data-dur="3" x="${476 + 6}" y="120" fill="#ffffff" font-family="Unbounded" font-weight="900" font-size="58" text-anchor="end">1</text>
    <text x="${476 + 10}" y="120" fill="#ffb38a" font-family="Unbounded" font-weight="900" font-size="40">°C</text>
    ${chip(330, 566, `${from}–${to} °C`, "#5fd38a", 3.2)}`;
};

/** Три опасных места: батарея, кондиционер, холодное стекло со сквозняком. */
const radiator = () => `
    <defs>
      <linearGradient id="raFin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9b2a6"/><stop offset=".45" stop-color="#fbf7ef"/><stop offset="1" stop-color="#a8a196"/></linearGradient>
      <linearGradient id="raAC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd8dc"/></linearGradient>
      <linearGradient id="raSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1c3e"/><stop offset="1" stop-color="#4a77a8"/></linearGradient>
      <radialGradient id="raFrost" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".85"/><stop offset="1" stop-color="#dff1ff" stop-opacity="0"/></radialGradient>
    </defs>
    <!-- 1. батарея -->
    <g class="fade" style="--d:1"><ellipse cx="100" cy="470" rx="96" ry="60" fill="#ff6b6b" opacity=".35" filter="url(#soft)"/></g>
    <g class="rise" style="--d:.1">
      <ellipse cx="100" cy="546" rx="78" ry="9" fill="#000" opacity=".4" filter="url(#soft)"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${32 + i * 23}" y="450" width="20" height="92" rx="8" fill="url(#raFin)"/>`).join("")}
      <rect x="28" y="462" width="144" height="7" rx="3" fill="#cfc8bc"/>
      <rect x="28" y="524" width="144" height="7" rx="3" fill="#cfc8bc"/>
    </g>
    ${potted(100, 452, 0.7, 0.4, "leafy")}
    ${waves(
      [
        [38, 440],
        [162, 440],
        [100, 300],
      ],
      "#ff9f6e",
      1.2,
      2.2,
    )}
    ${badge(156, 290, false, 2.4, 26)}
    <!-- 2. кондиционер -->
    <g class="rise" style="--d:.5">
      <rect x="212" y="66" width="176" height="70" rx="18" fill="url(#raAC)"/>
      <rect x="228" y="112" width="144" height="12" rx="6" fill="#33424a"/>
      <circle cx="366" cy="86" r="5" fill="#7cc4ff" filter="url(#glow)"/>
    </g>
    ${[250, 300, 350]
      .map(
        (x, i) =>
          `<g transform="translate(${x} 140)"><path class="cl-down" style="--d:${1.2 + i * 0.3}" d="M0 0 q -8 14 0 28 q 8 14 0 28 q -8 14 0 28" stroke="#9fd6ff" stroke-width="5" stroke-linecap="round" fill="none"/></g>`,
      )
      .join("")}
    ${[
      [236, 0],
      [282, 0.6],
      [326, 0.3],
      [364, 0.9],
    ]
      .map(([x, dd]) => `<g transform="translate(${x} 160)"><g class="cl-fall" style="--d:${1.4 + dd}">${flake(9, "#e8f4ff", 2.5)}</g></g>`)
      .join("")}
    ${potted(300, 542, 0.72, 0.8, "aspid")}
    ${badge(360, 344, false, 2.8, 26)}
    <!-- 3. холодное окно и сквозняк -->
    <g class="fade" style="--d:.3">
      <rect x="428" y="66" width="148" height="400" rx="14" fill="url(#raSky)"/>
      ${[
        [452, 100],
        [552, 96],
        [446, 440],
        [556, 444],
        [500, 270],
      ]
        .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 4 ? 30 : 46}" fill="url(#raFrost)" opacity=".8"/>`)
        .join("")}
    </g>
    ${[
      [456, 112, 1.2],
      [548, 108, 1.5],
      [452, 428, 1.8],
      [552, 430, 2.1],
    ]
      .map(([x, y, d]) => `<g transform="translate(${x} ${y})"><g class="cl-zoom" style="--d:${d}">${flake(16, "#ffffff", 3)}</g></g>`)
      .join("")}
    <g class="fade" style="--d:.3">
      <rect x="428" y="66" width="148" height="400" rx="14" fill="none" stroke="#e9e1d2" stroke-width="12"/>
      <path d="M502 70 L502 462 M432 266 L572 266" stroke="#e9e1d2" stroke-width="7"/>
    </g>
    <rect class="rise" style="--d:.4" x="414" y="466" width="176" height="14" rx="5" fill="#d9cdb8"/>
    ${potted(498, 468, 0.68, 1.0, "leafy")}
    ${[340, 372, 404]
      .map(
        (y, i) =>
          `<path class="cl-wind" style="--d:${1.6 + i * 0.35}" d="M420 ${y} q -16 -8 -32 0 t -32 0" stroke="#dff1ff" stroke-width="4" stroke-linecap="round" fill="none"/>`,
      )
      .join("")}
    ${badge(552, 300, false, 3.2, 26)}
    ${label(100, 590, "батарея", "#ffffff", 1.4, 21)}
    ${label(300, 590, "кондиционер", "#ffffff", 1.8, 21)}
    ${label(502, 590, "окно, сквозняк", "#ffffff", 2.2, 21)}`;

/** Колесо года: четыре сезона вокруг растения. */
const year = () => {
  const cx = 300;
  const cy = 320;
  const seasons = [
    ["зима", "#b4dcff", flake(18, "#ffffff", 4)],
    [
      "весна",
      "#8be3a8",
      `<path d="M0 18 L0 -4" stroke="#1d5e37" stroke-width="4"/><path d="M0 -2 C -22 -2 -24 -20 -20 -24 C -6 -24 0 -12 0 -2 Z" fill="#1f7a45"/><path d="M0 -6 C 20 -6 24 -26 18 -30 C 4 -30 0 -18 0 -6 Z" fill="#2f9d5c"/>`,
    ],
    ["лето", "#ffd36e", sunIcon(13, "#fff6d6")],
    [
      "осень",
      "#ff9f6e",
      `<g transform="rotate(-30)"><path d="M0 18 C -20 8 -22 -16 0 -26 C 22 -16 20 8 0 18 Z" fill="#c64b1f"/><path d="M0 18 L0 -22" stroke="#7a2a0c" stroke-width="3"/></g>`,
    ],
  ];
  const parts = seasons
    .map(([name, color, icon], i) => {
      const a = i * 90;
      const [ix, iy] = pt(0, 0, 140, a);
      const [lx, ly] = pt(0, 0, 186, a);
      return `
        <g class="fade" style="--d:${0.2 + i * 0.35}"><path d="${sector(0, 0, 104, 214, a - 44, a + 44)}" fill="${color}" opacity=".9"/>
        <path d="${sector(0, 0, 196, 214, a - 44, a + 44)}" fill="#ffffff" opacity=".22"/></g>
        <g transform="translate(${ix} ${iy})"><g class="pop" style="--d:${0.6 + i * 0.35}">${icon}</g></g>
        <text class="fade" style="--d:${0.8 + i * 0.35}" x="${lx}" y="${ly + 7}" fill="#0b2016" font-family="Manrope" font-weight="800" font-size="19" text-anchor="middle">${name}</text>`;
    })
    .join("");
  const months = Array.from({ length: 12 }, (_, i) => {
    const [x0, y0] = pt(0, 0, 220, i * 30 + 15);
    const [x1, y1] = pt(0, 0, 230, i * 30 + 15);
    return `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
  }).join("");
  return `
    <circle cx="${cx}" cy="${cy + 12}" r="236" fill="#000" opacity=".35" filter="url(#soft)"/>
    <g transform="translate(${cx} ${cy})"><g class="cl-spin" style="--t:90s">
      ${parts}
      <g class="fade" style="--d:1.6">${months}</g>
    </g></g>
    <g class="pop" style="--d:1.2"><circle cx="${cx}" cy="${cy}" r="98" fill="#0b2016" stroke="#8be3a8" stroke-width="3"/></g>
    <g class="fade" style="--d:1.4"><circle cx="${cx}" cy="${cy}" r="98" fill="#8be3a8" opacity=".12" filter="url(#glow)"/></g>
    <g class="sway" style="transform-origin:${cx}px ${cy + 76}px">${potted(cx, cy + 76, 0.55, 1.6, "leafy")}</g>
    <g transform="translate(${cx} ${cy - 236})"><g class="pop" style="--d:2"><path d="M-14 -10 L 14 -10 L 0 12 Z" fill="#ffffff"/></g></g>
    ${sparkles(
      [
        [70, 110, 2.6],
        [540, 140, 3],
        [530, 520, 3.4],
      ],
      "#8be3a8",
    )}
    ${chip(300, 612, "уход по сезону", "#8be3a8", 2.8)}`;
};

/** Тряпочка стирает пыль с листа; растение придвигается к окну. */
const wipe = () => {
  const dust = Array.from({ length: 34 }, (_, i) => {
    const t = ((i * 37) % 100) / 100;
    const yy = -20 - t * 124;
    const half = 50 * Math.sin(Math.PI * Math.min(1, (-yy + 6) / 160));
    const xx = (((i * 53) % 100) / 100 - 0.5) * 2 * half * 0.85;
    return `<circle cx="${xx.toFixed(1)}" cy="${yy.toFixed(1)}" r="${1.2 + (i % 3) * 0.6}" fill="#e2dccb"/>`;
  }).join("");
  return `
    <defs>
      <linearGradient id="wiSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc8ff"/><stop offset="1" stop-color="#fff2c4"/></linearGradient>
      <linearGradient id="wiBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4" stop-opacity=".6"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></linearGradient>
    </defs>
    <!-- окно -->
    <g class="fade" style="--d:0">
      <rect x="412" y="60" width="168" height="270" rx="14" fill="url(#wiSky)"/>
      <circle cx="520" cy="130" r="36" fill="#fff6d6" filter="url(#glow)"/>
      <rect x="412" y="60" width="168" height="270" rx="14" fill="none" stroke="#e9e1d2" stroke-width="12"/>
      <path d="M496 64 L496 326 M416 196 L576 196" stroke="#e9e1d2" stroke-width="7"/>
    </g>
    <path class="beam" style="transform-origin:496px 330px" d="M418 330 L 576 330 L 590 562 L 386 562 Z" fill="url(#wiBeam)"/>
    <rect class="rise" style="--d:.2" x="330" y="560" width="260" height="12" rx="6" fill="#ffffff" opacity=".16"/>
    <g class="cl-slide" style="--d:4.2;--sx:132px">${potted(356, 562, 0.82, 0.6, "leafy")}</g>
    <path class="draw" style="--d:3.6" pathLength="1" d="M318 296 L 392 296" stroke="#ffd36e" stroke-width="5" stroke-dasharray="1" fill="none" stroke-linecap="round"/>
    <g transform="translate(398 296)"><g class="pop" style="--d:4.4"><path d="M-12 -10 L 4 0 L -12 10" stroke="#ffd36e" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>
    ${label(356, 278, "к окну", "#ffd36e", 3.8, 20)}
    <!-- большой пыльный лист -->
    <path class="draw" style="--d:.2" pathLength="1" d="M198 576 C 196 566 194 556 192 546" stroke="#4f9a4a" stroke-width="10" fill="none" stroke-linecap="round"/>
    <g transform="translate(192 548) rotate(-6) scale(2)"><g class="pop" style="--d:.3">
      <path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z" fill="url(#leafG)"/>
      <path d="M0 -6 C -3 -60 -2 -112 0 -148" stroke="#0f3f23" stroke-opacity=".55" stroke-width="3" fill="none"/>
      ${[-40, -70, -100]
        .map(
          (yy) =>
            `<path d="M0 ${yy} q -18 -6 -30 -24 M0 ${yy} q 18 -6 30 -24" stroke="#0f3f23" stroke-opacity=".35" stroke-width="2" fill="none"/>`,
        )
        .join("")}
      <path d="M-22 -118 C -40 -96 -44 -70 -36 -50" stroke="#ffffff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round" fill="none"/>
      <g class="cl-dust" style="--d:1.2">
        <path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z" fill="#a49b86" opacity=".72"/>
        ${dust}
      </g>
    </g></g>
    <g transform="translate(200 410)"><g class="cl-wipe" style="--d:1">
      <g transform="rotate(-14)">
        <rect x="-46" y="-30" width="92" height="60" rx="14" fill="#ffd36e"/>
        <path d="M-46 0 Q 0 10 46 -4" stroke="#e0a830" stroke-width="4" fill="none"/>
        <rect x="-40" y="-24" width="80" height="10" rx="5" fill="#fff1b0" opacity=".7"/>
        ${[-30, -15, 0, 15, 30].map((x) => `<path d="M${x} 6 L ${x} 24" stroke="#e0a830" stroke-width="2" stroke-dasharray="3 3"/>`).join("")}
      </g>
    </g></g>
    ${sparkles(
      [
        [150, 330, 4.4],
        [236, 280, 4.8],
        [176, 450, 5.2],
      ],
      "#fff3c2",
    )}
    ${chip(300, 614, "пыль крадёт свет", "#ffd36e", 2.6)}`;
};

/** Кактус зимует в прохладе почти без полива — и потом зацветает. */
const cactusRest = () => {
  const spines = [];
  for (const x of [226, 250, 274]) {
    for (let y = 252 + (x === 250 ? 0 : 10); y < 424; y += 24) {
      spines.push(
        `<path d="M${x - 5} ${y - 4} L ${x} ${y} L ${x + 5} ${y - 4}" stroke="#fff8e0" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
      );
    }
  }
  for (let y = 300; y < 380; y += 22) {
    spines.push(
      `<path d="M${337} ${y - 4} L ${342} ${y} L ${347} ${y - 4}" stroke="#fff8e0" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    );
  }
  return `
    <defs>
      <linearGradient id="caBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#215c38"/><stop offset=".4" stop-color="#6fcf8a"/><stop offset="1" stop-color="#1d5233"/></linearGradient>
      <radialGradient id="caPetal" cx=".5" cy=".9" r="1"><stop offset="0" stop-color="#fff0f6"/><stop offset=".5" stop-color="#ff8ac0"/><stop offset="1" stop-color="#e0407e"/></radialGradient>
    </defs>
    <g class="fade" style="--d:0"><circle cx="250" cy="330" r="190" fill="#7cc4ff" opacity=".12" filter="url(#soft)"/></g>
    ${Array.from({ length: 14 }, (_, i) => `<circle class="snow" style="--i:${i};--x:${20 + ((i * 41) % 150)}px;--s:${5 + (i % 4) * 1.4}s" cx="0" cy="0" r="${2 + (i % 3)}" fill="#ffffff" opacity=".8"/>`).join("")}
    <g transform="translate(100 150)"><g class="pop" style="--d:.4"><g class="cl-spin" style="--t:14s">${flake(42, "#dff1ff", 6)}</g></g></g>
    ${label(100, 238, "прохлада", "#b4dcff", 0.9, 22)}
    <g transform="translate(100 360)"><g class="pop" style="--d:2.2">
      <path d="${dropPath(0, -26, 1.9)}" fill="#7cc4ff"/>
      <path d="M-28 -28 L 28 30" stroke="#ff6b6b" stroke-width="7" stroke-linecap="round"/>
    </g></g>
    ${label(96, 430, "почти", "#ffffff", 2.6, 21)}
    ${label(96, 456, "без полива", "#ffffff", 2.7, 21)}
    <g transform="translate(14 0)">
    ${pot(250, 450, 160, 90, 0.2)}
    <g class="rise" style="--d:.2">
      <ellipse cx="250" cy="430" rx="78" ry="8" fill="url(#dryG)"/>
      <path d="M200 430 l 12 -3 l 8 4 M262 428 l 10 3 l 12 -2" stroke="#8a6440" stroke-width="2" fill="none"/>
    </g>
    <g class="grow" style="--d:.6">
      <path d="M283 362 L 318 362 Q 330 362 330 350 L 330 302 Q 330 286 342 286 Q 354 286 354 302 L 354 354 Q 354 386 322 386 L 283 386 Z" fill="url(#caBody)"/>
      <path d="M216 434 L 216 282 Q 216 230 250 230 Q 284 230 284 282 L 284 434 Z" fill="url(#caBody)"/>
      ${[232, 250, 268].map((x) => `<path d="M${x} 244 L ${x} 432" stroke="#123d24" stroke-opacity=".45" stroke-width="3"/>`).join("")}
      <path d="M228 276 Q 228 248 244 240" stroke="#ffffff" stroke-opacity=".35" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${spines.join("")}
    </g>
    <g transform="translate(250 226)"><g class="cl-zoom" style="--d:4.4">
      ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse transform="rotate(${a})" cx="0" cy="-20" rx="10" ry="20" fill="url(#caPetal)"/>`).join("")}
      <circle r="9" fill="#ffd36e"/><circle r="4" fill="#e0a830"/>
    </g></g>
    ${sparkles(
      [
        [196, 200, 4.8],
        [312, 196, 5.1],
        [250, 160, 5.4],
      ],
      "#ffb3d1",
    )}
    </g>
    ${thermometer({ id: "ca", x: 476, y0: 470, k: 10, tmax: 30, band: [10, 15], val: 12, d: 0.6, merc: ["#9fd6ff", "#2f80ed"], zone: "#7cc4ff", scale: false, br: 26 })}
    ${label(506, 377, "10°", "#b4dcff", 1.6, 22, "start")}
    ${label(506, 327, "15°", "#b4dcff", 1.8, 22, "start")}
    <text class="fade" style="--d:1.4" x="476" y="136" fill="#b4dcff" font-family="Unbounded" font-weight="900" font-size="28" text-anchor="middle">10–15 °C</text>
    ${chip(262, 580, "отдых — к цветению", "#ffb3d1", 4.8)}`;
};

/** Весна: солнце встаёт, из почек раскрываются новые листья. */
const spring = () => `
    <defs>
      <linearGradient id="spNew" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4ff9a"/><stop offset=".55" stop-color="#8fd85a"/><stop offset="1" stop-color="#3f8f3a"/></linearGradient>
    </defs>
    <g class="cl-sunup">
      <circle cx="300" cy="220" r="150" fill="#ffd36e" opacity=".22" filter="url(#soft)"/>
      <g transform="translate(300 220)"><g class="cl-spin" style="--t:40s">
        ${Array.from({ length: 12 }, (_, i) => {
          const [x0, y0] = pt(0, 0, 92, i * 30);
          const [x1, y1] = pt(0, 0, i % 2 ? 118 : 132, i * 30);
          return `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#ffd36e" stroke-width="8" stroke-linecap="round"/>`;
        }).join("")}
      </g></g>
      <circle cx="300" cy="220" r="74" fill="url(#goldG)" filter="url(#glow)"/>
    </g>
    ${pot(300, 410, 150, 90, 0.3)}
    ${stem("M300 394 C 296 340 306 290 300 214", 0.6)}
    ${stem("M300 344 C 340 326 360 304 370 282", 0.9, 7)}
    ${stem("M300 316 C 262 298 248 280 238 258", 1.0, 7)}
    ${leaf(300, 380, 0.5, 64, 1.0, "leafG")}${leaf(300, 372, 0.5, -64, 1.1, "leafG2")}
    ${[
      [370, 284, 40],
      [238, 260, -40],
      [300, 218, 0],
    ]
      .map(
        ([x, y, r], i) =>
          `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse class="pop" style="--d:${1.5 + i * 0.15}" cx="0" cy="-8" rx="7" ry="12" fill="#c9f28a"/></g>`,
      )
      .join("")}
    ${leaf(370, 284, 0.46, 40, 2.4, "spNew")}${leaf(238, 260, 0.46, -40, 2.7, "spNew")}${leaf(300, 218, 0.52, 4, 3.0, "spNew")}
    ${sparkles(
      [
        [410, 210, 2.8],
        [190, 200, 3.2],
        [300, 120, 3.6],
      ],
      "#e4ff9a",
    )}
    <g transform="translate(150 548)"><g class="pop" style="--d:3.4"><path d="${dropPath(0, -14, 0.9)}" fill="#7cc4ff"/></g></g>
    ${label(170, 548, "пьют больше — грунт проверяем чаще", "#9fd6ff", 3.4, 21, "start")}
    ${chip(160, 612, "пересадка", "#8be3a8", 4.0)}
    ${chip(440, 612, "подкормки", "#8be3a8", 4.4)}`;

/** Весеннее солнце: тюль смягчает лучи, без неё лист обгорает. */
const tulle = () => {
  // Центры листьев potted(…, "leafy") при масштабе .9.
  const burns = [
    [430 + 2, 357, 3.0],
    [430 - 20, 404, 3.3],
    [430 + 20, 432, 3.6],
  ];
  return `
    <defs>
      <linearGradient id="tuSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fbfff"/><stop offset="1" stop-color="#fff1c4"/></linearGradient>
      <linearGradient id="tuHot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8" stop-opacity=".75"/><stop offset="1" stop-color="#ffd36e" stop-opacity=".05"/></linearGradient>
      <linearGradient id="tuSoft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8e6" stop-opacity=".32"/><stop offset="1" stop-color="#fff8e6" stop-opacity="0"/></linearGradient>
    </defs>
    <g class="fade" style="--d:0">
      <rect x="60" y="50" width="480" height="250" rx="18" fill="url(#tuSky)"/>
      <circle cx="420" cy="140" r="52" fill="#fffbe6" filter="url(#glow)"/>
      <circle cx="420" cy="140" r="90" fill="#fff3c2" opacity=".35" filter="url(#soft)"/>
    </g>
    <g class="fade" style="--d:.9"><g class="cl-tulle">
      <path d="M66 56 L 300 56 L 300 290 Q 285 302 270 290 T 240 290 T 210 290 T 180 290 T 150 290 T 120 290 T 90 290 T 66 290 Z" fill="#ffffff" opacity=".62"/>
      ${[92, 128, 164, 200, 236, 272].map((x) => `<path d="M${x} 58 Q ${x + 10} 170 ${x} 288" stroke="#e8eef4" stroke-width="10" fill="none" opacity=".75"/>`).join("")}
    </g></g>
    <g class="fade" style="--d:0">
      <rect x="60" y="50" width="480" height="250" rx="18" fill="none" stroke="#e9e1d2" stroke-width="12"/>
      <path d="M300 54 L300 296" stroke="#e9e1d2" stroke-width="9"/>
    </g>
    ${label(183, 186, "тюль", "#3a5a4a", 1.3, 26)}
    <g class="fade" style="--d:1.2"><path d="M74 306 L 292 306 L 300 566 L 52 566 Z" fill="url(#tuSoft)"/></g>
    <g class="fade" style="--d:1.4"><g class="pulse"><path d="M308 306 L 532 306 L 560 566 L 320 566 Z" fill="url(#tuHot)"/></g></g>
    ${[350, 410, 470]
      .map(
        (x, i) =>
          `<path class="draw" style="--d:${1.6 + i * 0.2}" pathLength="1" d="M${x} 310 L ${x + 18} 470" stroke="#fff6c8" stroke-width="5" stroke-linecap="round"/>`,
      )
      .join("")}
    <rect class="rise" style="--d:.2" x="40" y="560" width="520" height="12" rx="6" fill="#ffffff" opacity=".16"/>
    ${potted(170, 562, 0.9, 0.5, "leafy")}
    ${potted(430, 562, 0.9, 0.7, "leafy")}
    ${burns
      .map(
        ([x, y, d], i) =>
          `<g transform="translate(${x + (i ? 0 : -4)} ${y})"><g class="cl-zoom" style="--d:${d}"><path d="M-13 -3 C -12 -11 -3 -12 3 -9 C 11 -7 14 1 9 6 C 4 12 -6 11 -10 6 C -14 3 -14 0 -13 -3 Z" fill="#9a6a32" stroke="#e8c27a" stroke-width="2.5"/><path d="M-5 -2 C -2 -6 4 -5 5 0" stroke="#5a3a18" stroke-width="2" fill="none" stroke-linecap="round"/></g></g>`,
      )
      .join("")}
    ${badge(256, 340, true, 4.0, 26)}
    ${badge(518, 340, false, 4.2, 26)}
    ${chip(300, 614, "приучайте постепенно", "#ffd36e", 4.8)}`;
};

/** Балкон ночью: луна, +12…15 °C, растение сначала в тени. */
const balcony = () => `
    <defs>
      <linearGradient id="baShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity=".55"/><stop offset="1" stop-color="#000000" stop-opacity=".1"/></linearGradient>
    </defs>
    <g class="fade" style="--d:0">
      <rect x="40" y="40" width="520" height="440" rx="26" fill="url(#skyNight)"/>
      <circle cx="440" cy="112" r="42" fill="#f4f1d8" filter="url(#glow)"/>
      <circle cx="458" cy="100" r="38" fill="#08112c"/>
      <path d="M40 470 L 40 400 L 90 400 L 90 370 L 150 370 L 150 410 L 210 410 L 210 350 L 270 350 L 270 395 L 330 395 L 330 380 L 380 380 L 380 410 L 440 410 L 440 360 L 500 360 L 500 400 L 560 400 L 560 470 Z" fill="#0a1530"/>
      ${[
        [104, 388],
        [226, 368],
        [244, 384],
        [346, 398],
        [456, 376],
        [474, 392],
        [520, 416],
      ]
        .map(([x, y]) => `<rect x="${x}" y="${y}" width="9" height="9" rx="1" fill="#ffd36e" opacity=".75"/>`)
        .join("")}
    </g>
    ${sparkles(
      [
        [120, 170, 0.6],
        [300, 90, 1.0],
        [360, 190, 1.4],
        [530, 220, 1.8],
      ],
      "#fff6d6",
    )}
    <!-- навес и тень -->
    <g class="fade" style="--d:1.6"><path d="M40 110 L 292 110 L 330 480 L 40 480 Z" fill="url(#baShade)"/></g>
    <g class="rise" style="--d:.5">
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${40 + i * 36}" y="40" width="36" height="58" fill="${i % 2 ? "#f7f4ec" : "#ff8a8f"}"/>`).join("")}
      <path d="M40 96 ${Array(7).fill("q 18 22 36 0").join(" ")} L 292 96 Z" fill="#ff8a8f"/>
      <rect x="36" y="36" width="260" height="10" rx="5" fill="#d9cdb8"/>
    </g>
    <!-- перила -->
    <g class="rise" style="--d:.3">
      ${Array.from({ length: 18 }, (_, i) => `<rect x="${44 + i * 30}" y="392" width="6" height="88" fill="#cfc8bc"/>`).join("")}
      <rect x="30" y="380" width="540" height="14" rx="6" fill="#e9e1d2"/>
      <rect x="30" y="478" width="540" height="16" rx="6" fill="#d9cdb8"/>
    </g>
    ${potted(170, 486, 1.0, 1.0, "leafy")}
    ${label(170, 534, "сначала в тень", "#ffffff", 2.4, 22)}
    ${thermometer({ id: "ba", x: 520, y0: 340, k: 6, tmax: 30, band: [12, 15], val: 14, d: 1.2, merc: ["#ffb38a", "#e5734d"], zone: "#5fd38a", scale: false, br: 22 })}
    <text class="fade" style="--d:2" x="486" y="276" fill="#ffffff" font-family="Unbounded" font-weight="900" font-size="27" text-anchor="end">+12…15 °C</text>
    ${label(486, 308, "ночью", "#b4dcff", 2.2, 22, "end")}
    ${chip(300, 610, "график полива — по сезону", "#8be3a8", 3.4)}`;

export const art = {
  hygro: hygro(),
  humidifier: humidifier(),
  pebbles,
  mist: mist(),
  thermo,
  radiator: radiator(),
  year: year(),
  wipe: wipe(),
  cactusRest: cactusRest(),
  spring: spring(),
  tulle: tulle(),
  balcony: balcony(),
};

export const accent = {
  hygro: "#7cc4ff",
  humidifier: "#62e3d3",
  pebbles: "#62e3d3",
  mist: "#7cc4ff",
  thermo: "#ffb38a",
  radiator: "#ff8a8f",
  year: "#8be3a8",
  wipe: "#ffd36e",
  cactusRest: "#b4dcff",
  spring: "#8be3a8",
  tulle: "#ffd36e",
  balcony: "#b4dcff",
};

export const css = `
  .cl-spin { animation: cl-spin var(--t, 40s) linear infinite; }
  @keyframes cl-spin { to { transform: rotate(360deg); } }
  .cl-needle { transform: rotate(var(--a0)); animation: cl-needle 2.6s cubic-bezier(.5,0,.25,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-needle { from { transform: rotate(var(--a0)); } to { transform: rotate(var(--a1)); } }
  .cl-jit { animation: cl-jit 1.4s ease-in-out infinite; }
  @keyframes cl-jit { 0%,100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }
  .cl-out { animation: cl-out 1s ease both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-out { from { opacity: 1; } to { opacity: 0; } }
  .cl-bob { animation: cl-bob 3s ease-in-out infinite; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .cl-up { animation: cl-up var(--t, 2.6s) ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-up { from { transform: translateY(10px); opacity: 0; } 30% { opacity: .9; } to { transform: translateY(-80px); opacity: 0; } }
  .cl-down { animation: cl-down 1.8s ease-in infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-down { from { transform: translateY(-10px); opacity: 0; } 30% { opacity: .9; } to { transform: translateY(70px); opacity: 0; } }
  .cl-fall { animation: cl-fall 2.6s linear infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-fall { from { transform: translate(0, 0) rotate(0); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } to { transform: translate(12px, 150px) rotate(120deg); opacity: 0; } }
  .cl-wind { animation: cl-wind 1.8s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-wind { from { transform: translateX(10px); opacity: 0; } 25% { opacity: 1; } to { transform: translateX(-50px); opacity: 0; } }
  .cl-steam { transform-box: fill-box; transform-origin: center; animation: cl-steam 3.2s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-steam { from { transform: translate(0, 0) scale(.3); opacity: 0; } 20% { opacity: .85; } to { transform: translate(var(--sx, 0px), -200px) scale(2.3); opacity: 0; } }
  .cl-spray { transform-box: fill-box; transform-origin: center; animation: cl-spray .9s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-spray { from { transform: translate(0, 0) scale(.4); opacity: 0; } 15% { opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.3); opacity: 0; } }
  .cl-vanish { transform-box: fill-box; transform-origin: center; animation: cl-vanish var(--t, 2.4s) ease infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-vanish { 0% { transform: scale(.2); opacity: 0; } 15% { transform: scale(1); opacity: 1; } 55% { transform: scale(1); opacity: 1; } 80%,100% { transform: scale(.4); opacity: 0; } }
  .cl-zoom { transform-box: fill-box; transform-origin: center; animation: cl-zoom .9s cubic-bezier(.2,1.4,.4,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-zoom { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .cl-merc { transform-box: fill-box; transform-origin: 50% 100%; animation: cl-merc 3s cubic-bezier(.3,.8,.3,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-merc { from { transform: scaleY(.08); } to { transform: scaleY(1); } }
  .cl-wipe { animation: cl-wipe 3.8s ease-in-out both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-wipe {
    0% { transform: translate(-40px, -150px); opacity: 0; } 8% { opacity: 1; }
    20% { transform: translate(40px, -110px); } 34% { transform: translate(-50px, -50px); } 48% { transform: translate(50px, 0); }
    62% { transform: translate(-40px, 50px); } 80% { transform: translate(30px, 100px); opacity: 1; }
    100% { transform: translate(-150px, 150px); opacity: 0; } }
  .cl-dust { animation: cl-dust 3.2s linear both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-dust { from { opacity: 1; } to { opacity: 0; } }
  .cl-slide { animation: cl-slide 1.6s cubic-bezier(.4,0,.2,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes cl-slide { to { transform: translateX(var(--sx)); } }
  .cl-sunup { animation: cl-sunup 3.4s cubic-bezier(.2,.8,.3,1) both; }
  @keyframes cl-sunup { from { transform: translateY(170px); opacity: 0; } 30% { opacity: 1; } to { transform: none; opacity: 1; } }
  .cl-tulle { transform-box: fill-box; transform-origin: 50% 0; animation: cl-tulle 3.6s ease-in-out infinite alternate; }
  @keyframes cl-tulle { from { transform: skewX(-2.5deg); } to { transform: skewX(2.5deg); } }
`;
