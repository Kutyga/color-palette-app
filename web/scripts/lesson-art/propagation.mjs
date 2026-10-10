/**
 * Сцены модуля «Размножение» (уроки propagation, pothos-cuttings, division, seeds; ключи potsRow и node
 * используются также в уроках pets и glossary). Сценарии — src/data/lessons.json.
 */
import { leaf, stem, pot, label, chip, sparkles, potted, badge, roundel, vine } from "./kit.mjs";

const KINDS = ["leafy", "snake", "zz", "aspid", "chloro"];

/** Точка на кубической кривой Безье. */
const bez = (t, [x0, y0], [x1, y1], [x2, y2], [x3, y3]) => {
  const u = 1 - t;
  return [
    u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
    u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
  ];
};

// ---------------------------------------------------------------------------
// Свои градиенты (префикс pg). На кадре рисуется одна сцена, поэтому блок вставляется в каждую.
// ---------------------------------------------------------------------------

const DEFS = `<defs>
  <linearGradient id="pgSteelV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f9fc"/><stop offset=".5" stop-color="#c3ccd5"/><stop offset="1" stop-color="#7d8995"/></linearGradient>
  <linearGradient id="pgSteelH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d8995"/><stop offset=".45" stop-color="#f6f9fc"/><stop offset="1" stop-color="#a7b2bd"/></linearGradient>
  <linearGradient id="pgWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a331b"/><stop offset=".5" stop-color="#b0703e"/><stop offset="1" stop-color="#5a331b"/></linearGradient>
  <linearGradient id="pgSucc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4f5dc"/><stop offset=".5" stop-color="#86c9a6"/><stop offset="1" stop-color="#3f8a6a"/></linearGradient>
  <linearGradient id="pgAloe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f6a40"/><stop offset=".5" stop-color="#93d28c"/><stop offset="1" stop-color="#2a5e39"/></linearGradient>
  <radialGradient id="pgSeed" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f0c68a"/><stop offset=".6" stop-color="#9a6234"/><stop offset="1" stop-color="#5a341a"/></radialGradient>
  <linearGradient id="pgPeat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5236"/><stop offset="1" stop-color="#352113"/></linearGradient>
  <linearGradient id="pgTray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4b55"/><stop offset="1" stop-color="#151f25"/></linearGradient>
  <linearGradient id="pgLamp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa6e6" stop-opacity=".6"/><stop offset="1" stop-color="#ffa6e6" stop-opacity="0"/></linearGradient>
  <linearGradient id="pgShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03100a" stop-opacity=".7"/><stop offset="1" stop-color="#03100a" stop-opacity="0"/></linearGradient>
  <linearGradient id="pgStem" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="590"><stop offset="0" stop-color="#5fb25a"/><stop offset=".8" stop-color="#3f8a3c"/><stop offset="1" stop-color="#3f8a3c" stop-opacity="0"/></linearGradient>
  <linearGradient id="pgSpathe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9e6d6"/></linearGradient>
  <linearGradient id="pgCup" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#ffffff" stop-opacity=".25"/></linearGradient>
</defs>`;

// ---------------------------------------------------------------------------
// Детали
// ---------------------------------------------------------------------------

const f = (n) => Number(n.toFixed(1));

/** Крупная надпись шрифтом Unbounded. */
const big = (x, y, text, color, d, size = 40, anchor = "middle") =>
  `<text class="fade" style="--d:${d}" x="${x}" y="${y}" fill="${color}" font-family="Unbounded" font-weight="900" font-size="${size}" text-anchor="${anchor}">${text}</text>`;

/** Статичный сердцевидный лист (без анимации) — для групп, которые двигаются целиком. */
const hleaf = (x, y, s, r, g = "leafG") => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
    <path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z" fill="${g.startsWith("#") ? g : `url(#${g})`}"/>
    <path d="M0 -6 C -3 -60 -2 -112 0 -148" stroke="#0f3f23" stroke-opacity=".55" stroke-width="4" fill="none"/>
    <path d="M-22 -118 C -40 -96 -44 -70 -36 -50" stroke="#ffffff" stroke-opacity=".35" stroke-width="7" stroke-linecap="round" fill="none"/>
  </g>`;

/** Стрелка: кривая прорисовывается, наконечник появляется в конце. */
const arrow = (x0, y0, cx, cy, x1, y1, color, d, w = 6, dash = false) => {
  const a = (Math.atan2(y1 - cy, x1 - cx) * 180) / Math.PI;
  return `
  <path class="${dash ? "fade" : "draw"}" style="--d:${d}" ${dash ? 'stroke-dasharray="4 14"' : 'pathLength="1"'} d="M${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>
  <g transform="translate(${x1} ${y1}) rotate(${f(a)})"><g class="fade" style="--d:${d + (dash ? 0.3 : 1.1)}">
    <path d="M-16 -12 L 2 0 L -16 12" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g></g>`;
};

/** Кружок-шеврон «дальше» между двумя шагами. */
const next = (x, y, color, d) => `
  <g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}">
    <circle r="22" fill="${color}" opacity=".9"/>
    <path d="M-5 -10 L 6 0 L -5 10" stroke="#10301f" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g></g>`;

/** Номер шага в кружке. */
const step = (x, y, n, color, d) => `
  <g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}">
    <circle r="20" fill="${color}"/>
    <text y="8" fill="#10301f" font-family="Unbounded" font-weight="900" font-size="22" text-anchor="middle">${n}</text>
  </g></g>`;

/** Панель-карточка для пошаговых сцен. */
const panel = (x, y, w, h, d) =>
  `<g class="fade" style="--d:${d}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="#ffffff" fill-opacity=".07" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/></g>`;

/** Солнце с вращающимися лучами. */
const sun = (x, y, r, d) => `
  <g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}">
    <g class="pg-spin">${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${-r - 10} L 0 ${-r - 24}" transform="rotate(${i * 30})" stroke="#ffd36e" stroke-width="6" stroke-linecap="round"/>`).join("")}</g>
    <circle r="${r}" fill="url(#goldG)" filter="url(#glow)"/>
  </g></g>`;

/** Термометр: (x, y) — верх колбы-шарика; ртуть поднимается. */
const thermo = (x, y, text, d) => `
  <g class="rise" style="--d:${d}">
    <rect x="${x - 17}" y="${y - 176}" width="34" height="190" rx="17" fill="#f4f8fb" fill-opacity=".92" stroke="#ffffff" stroke-width="3"/>
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M${x + 6} ${y - 146 + i * 30} L ${x + 14} ${y - 146 + i * 30}" stroke="#9aa6b2" stroke-width="3"/>`).join("")}
    <rect class="pg-merc" style="--d:${d + 0.5}" x="${x - 7}" y="${y - 120}" width="14" height="130" rx="7" fill="#ff6b6b"/>
    <circle cx="${x}" cy="${y + 26}" r="27" fill="#ff6b6b" stroke="#ffffff" stroke-width="4"/>
    <circle cx="${x - 9}" cy="${y + 17}" r="7" fill="#ffffff" opacity=".55"/>
  </g>
  ${label(x, y + 96, text, "#ffd36e", d + 1.2, 28)}`;

/** Ножницы: ось в (x, y), лезвия направлены влево (до −120), щёлкают. */
const scissors = (x, y, rot, s, d) => `
  <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><g class="fade" style="--d:${d}">
    <g class="pg-snipA" style="--d:${d + 0.5}">
      <path d="M12 -6 L -118 -4 Q -128 1 -116 6 L 12 8 Z" fill="url(#pgSteelV)" stroke="#5d6873" stroke-width="1.5"/>
      <path d="M8 6 L 34 24" stroke="#ff8a5c" stroke-width="11" stroke-linecap="round"/>
      <ellipse cx="56" cy="34" rx="25" ry="16" fill="none" stroke="#ff8a5c" stroke-width="11"/>
    </g>
    <g class="pg-snipB" style="--d:${d + 0.5}">
      <path d="M12 6 L -118 4 Q -128 -1 -116 -6 L 12 -8 Z" fill="url(#pgSteelV)" stroke="#5d6873" stroke-width="1.5"/>
      <path d="M8 -6 L 34 -24" stroke="#ff8a5c" stroke-width="11" stroke-linecap="round"/>
      <ellipse cx="56" cy="-34" rx="25" ry="16" fill="none" stroke="#ff8a5c" stroke-width="11"/>
    </g>
    <circle r="8" fill="#46505a"/><circle r="3" fill="#dfe5ea"/>
  </g></g>`;

/** Нож лезвием вниз: опускается на ky пикселей и исчезает. Кончик — (x, y + 168). */
const knife = (x, y, d, ky) => `
  <g transform="translate(${x} ${y})"><g class="pg-knife" style="--d:${d};--ky:${ky}px">
    <rect x="-12" y="-96" width="24" height="92" rx="10" fill="url(#pgWood)"/>
    <circle cy="-72" r="3.5" fill="#f0d9b5"/><circle cy="-34" r="3.5" fill="#f0d9b5"/>
    <rect x="-15" y="-10" width="30" height="12" rx="4" fill="#9aa6b2"/>
    <path d="M-13 2 L 11 2 L 11 122 Q 6 150 -13 168 Z" fill="url(#pgSteelH)" stroke="#6d7883" stroke-width="1.5"/>
    <path d="M6 12 L 6 116" stroke="#ffffff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
  </g></g>`;

/** Задняя часть банки (тень и вода). */
const jarBack = (x, top, w, h, wl, d) => {
  const l = x - w / 2;
  const r = x + w / 2;
  const b = top + h;
  return `<g class="rise" style="--d:${d}">
    <ellipse cx="${x}" cy="${b + 14}" rx="${w * 0.62}" ry="13" fill="#000" opacity=".4" filter="url(#soft)"/>
    <path d="M${l} ${wl} L ${r} ${wl} L ${r} ${b - 26} Q ${r} ${b} ${r - 26} ${b} L ${l + 26} ${b} Q ${l} ${b} ${l} ${b - 26} Z" fill="url(#waterG)" opacity=".5"/>
    <ellipse class="pg-glow" cx="${x}" cy="${wl}" rx="${w / 2 - 2}" ry="7" fill="#d8f0ff" opacity=".5"/>
  </g>`;
};

/** Передняя часть банки (стекло с бликом). */
const jarFront = (x, top, w, h, d) => {
  const l = x - w / 2;
  const r = x + w / 2;
  const b = top + h;
  return `<g class="rise" style="--d:${d}">
    <path d="M${l} ${top + 12} L ${l} ${b - 26} Q ${l} ${b} ${l + 26} ${b} L ${r - 26} ${b} Q ${r} ${b} ${r} ${b - 26} L ${r} ${top + 12}" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".75" stroke-width="5"/>
    <ellipse cx="${x}" cy="${top + 10}" rx="${w / 2 + 5}" ry="9" fill="none" stroke="#e8f5ff" stroke-opacity=".85" stroke-width="5"/>
    <path d="M${l + 16} ${top + 44} L ${l + 16} ${b - 44}" stroke="#ffffff" stroke-opacity=".35" stroke-width="8" stroke-linecap="round"/>
    <path d="M${r - 18} ${top + 60} L ${r - 18} ${top + 90}" stroke="#ffffff" stroke-opacity=".25" stroke-width="6" stroke-linecap="round"/>
  </g>`;
};

/** Пузырьки в воде. */
const bubbles = (pts, h) =>
  pts
    .map(
      ([x, y, d, r = 4]) =>
        `<circle class="pg-bubble" style="--d:${d};--h:${h}px" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#e8f7ff" stroke-width="2"/>`,
    )
    .join("");

/** Узел на стебле: утолщение с бликом. */
const node = (x, y, s = 1) =>
  `<ellipse cx="${x}" cy="${y}" rx="${13 * s}" ry="${8 * s}" fill="#3c7f3a"/><ellipse cx="${x - 4 * s}" cy="${y - 3 * s}" rx="${5 * s}" ry="${2.5 * s}" fill="#bff0b0" opacity=".6"/>`;

/** Корень, который отрастает (прорисовывается). */
const root = (dPath, d, w = 4, dur = 1.6, color = "#f3ead8") =>
  `<path class="draw" style="--d:${d};animation-duration:${dur}s" pathLength="1" d="${dPath}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

/** Капля конденсата, сползающая вниз. */
const cond = (pts) =>
  pts
    .map(
      ([x, y, d, r = 5]) =>
        `<g class="pg-cond" style="--d:${d}"><ellipse cx="${x}" cy="${y}" rx="${r * 0.8}" ry="${r}" fill="#e8f7ff" opacity=".85"/><circle cx="${x - r * 0.25}" cy="${y - r * 0.35}" r="${r * 0.25}" fill="#ffffff"/></g>`,
    )
    .join("");

/** Ланцетный лист (спатифиллум, аспидистра): основание в (x, y). */
const lance = (x, y, s, r, d, g = "leafG") => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><g class="grow" style="--d:${d}">
    <path d="M0 0 C -26 -50 -28 -130 0 -190 C 28 -130 26 -50 0 0 Z" fill="url(#${g})"/>
    <path d="M0 -4 C -2 -60 -1 -130 0 -182" stroke="#0f3f23" stroke-opacity=".5" stroke-width="3" fill="none"/>
    <path d="M-10 -150 C -18 -120 -20 -90 -16 -60" stroke="#ffffff" stroke-opacity=".3" stroke-width="5" stroke-linecap="round" fill="none"/>
  </g></g>`;

/** Белый цветок-покрывало спатифиллума на цветоносе. */
const spathe = (x0, y0, x1, y1, d) => `
  ${stem(`M${x0} ${y0} C ${x0} ${(y0 + y1) / 2} ${x1} ${(y0 + y1) / 2 + 30} ${x1} ${y1}`, d, 5)}
  <g transform="translate(${x1} ${y1})"><g class="pop" style="--d:${d + 1}">
    <path d="M0 0 C -22 -18 -22 -62 0 -84 C 22 -62 22 -18 0 0 Z" fill="url(#pgSpathe)"/>
    <path d="M0 -10 C -3 -24 -3 -40 0 -50" stroke="#f3dc7a" stroke-width="8" stroke-linecap="round" fill="none"/>
  </g></g>`;

/** Розетка-детка хлорофитума (основание в 0,0). */
const baby = (s = 1) =>
  `<g transform="scale(${s})">${[-64, -36, -12, 12, 36, 64]
    .map((dx) => {
      const p = `M0 0 Q ${dx * 0.35} -46 ${dx} ${-22 + Math.abs(dx) * 0.25}`;
      return `<path d="${p}" stroke="#4fbf74" stroke-width="9" fill="none" stroke-linecap="round"/><path d="${p}" stroke="#e8f7c8" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    })
    .join("")}</g>`;

/** Пухлый лист суккулента, лежащий горизонтально; срез — слева (−74, 0). */
const succLeafShape = (s = 1, cut = "") => `
  <g transform="scale(${s})">
    <path d="M-74 0 C -62 -30 48 -36 76 -6 C 68 18 -50 26 -74 0 Z" fill="url(#pgSucc)"/>
    <path d="M-40 -14 C -10 -24 30 -24 56 -14" stroke="#ffffff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round" fill="none"/>
    <ellipse ${cut} cx="-71" cy="0" rx="6" ry="12" fill="#d6ff9a"/>
  </g>`;

/** Лист алоэ: основание в 0,0, растёт вверх. */
const aloeLeaf = (x, y, s, r, d) => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><g class="grow" style="--d:${d}">
    <path d="M-17 0 C -19 -60 -9 -130 0 -182 C 9 -130 19 -60 17 0 Z" fill="url(#pgAloe)"/>
    ${[-40, -76, -112, -146].map((yy, i) => `<ellipse cx="${i % 2 ? 4 : -5}" cy="${yy}" rx="3" ry="5" fill="#e6f7d8" opacity=".7"/>`).join("")}
  </g></g>`;

/** Сеянец: (x, y) — основание стебля. tl — с двумя настоящими листьями. */
const seedling = (s, tl = false, pale = false) => {
  const h = tl ? 96 : 58;
  const col = pale ? "#cfdc8a" : "#8fd16a";
  return `<g transform="scale(${s})">
    <path d="M0 0 C -3 ${-h * 0.35} 3 ${-h * 0.7} 0 ${-h}" stroke="${col}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M0 ${tl ? -50 : -h + 2} C -10 ${tl ? -66 : -h - 14} -36 ${tl ? -68 : -h - 16} -44 ${tl ? -56 : -h - 4} C -34 ${tl ? -46 : -h + 6} -12 ${tl ? -44 : -h + 8} 0 ${tl ? -50 : -h + 2} Z" fill="${pale ? "#d6e29a" : "url(#leafG2)"}"/>
    <path d="M0 ${tl ? -50 : -h + 2} C 10 ${tl ? -66 : -h - 14} 36 ${tl ? -68 : -h - 16} 44 ${tl ? -56 : -h - 4} C 34 ${tl ? -46 : -h + 6} 12 ${tl ? -44 : -h + 8} 0 ${tl ? -50 : -h + 2} Z" fill="${pale ? "#c6d68a" : "url(#leafG)"}"/>
    ${tl ? `${hleaf(-2, -h + 4, 0.3, -32, "leafG")}${hleaf(2, -h + 4, 0.3, 32, "leafG")}` : ""}
  </g>`;
};

/** Растение-черенок эпипремнума в маленькой баночке (для сцены many). */
const miniJar = (x, b, d) => {
  const top = b - 96;
  return `${jarBack(x, top, 74, 96, top + 28, d)}
    ${stem(`M${x} ${b - 22} C ${x - 3} ${b - 70} ${x + 4} ${b - 110} ${x} ${b - 140}`, d + 0.3, 6)}
    ${leaf(x, b - 134, 0.34, -12, d + 0.7)}${leaf(x + 2, b - 104, 0.28, 52, d + 0.9, "leafG2")}
    ${root(`M${x} ${b - 24} q -10 10 -14 18`, d + 1.2, 3)}${root(`M${x} ${b - 24} q 8 8 14 16`, d + 1.4, 3)}
    ${jarFront(x, top, 74, 96, d)}`;
};

// ---------------------------------------------------------------------------
// Сцены
// ---------------------------------------------------------------------------

export const art = {
  // Одно растение → три черенка; сердечко «подарок другу».
  many: `${DEFS}
    <g class="pg-sway">${potted(170, 520, 1.45, 0.2, "leafy")}
      ${leaf(166, 352, 0.5, -64, 0.9, "leafG2")}${leaf(176, 300, 0.46, 58, 1.0)}${leaf(168, 268, 0.4, -28, 1.1, "leafG2")}</g>
    ${[360, 455, 550]
      .map((x, i) => arrow(250 + i * 4, 290 - i * 22, (262 + x) / 2 - 10, 150 - i * 10, x, 316, "#8be3a8", 1.4 + i * 0.35, 5))
      .join("")}
    ${[360, 455, 550].map((x, i) => miniJar(x, 520, 2.0 + i * 0.4)).join("")}
    <g transform="translate(455 128)"><g class="pop" style="--d:3.6"><g class="pg-beat">
      <circle r="44" fill="#ffb3d1" opacity=".18"/>
      <path d="M0 26 C -44 -4 -36 -40 -14 -40 C -4 -40 0 -32 0 -26 C 0 -32 4 -40 14 -40 C 36 -40 44 -4 0 26 Z" fill="#ff7aa8" filter="url(#glow)"/>
      <path d="M-20 -26 C -26 -20 -26 -12 -22 -6" stroke="#ffffff" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/>
    </g></g></g>
    ${label(455, 62, "подарок другу", "#ffb3d1", 3.9, 24)}
    ${sparkles(
      [
        [390, 110, 4.2],
        [530, 150, 4.6],
        [70, 150, 2.8],
      ],
      "#ffd6e6",
    )}
    ${chip(300, 610, "одно растение — три новых", "#8be3a8", 4.4)}`,

  // Стебель крупно: узел, воздушный корешок, междоузлие, ножницы режут чуть ниже узла.
  node: `${DEFS}
    <path class="draw" style="--d:.1" pathLength="1" d="M300 590 C 296 500 306 420 300 330 C 294 240 304 150 300 40" stroke="url(#pgStem)" stroke-width="26" fill="none" stroke-linecap="round"/>
    <path class="draw" style="--d:.3" pathLength="1" d="M293 560 C 290 480 298 420 293 330 C 288 240 297 150 293 52" stroke="#d8ffd0" stroke-opacity=".3" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${leaf(300, 52, 0.3, 14, 1.4, "leafG2")}
    ${stem("M310 394 C 340 380 360 360 372 338", 0.8, 9)}${leaf(372, 340, 0.72, 50, 1.1)}
    ${stem("M290 166 C 262 152 246 134 238 116", 1.0, 8)}${leaf(238, 118, 0.6, -50, 1.3, "leafG2")}
    <g class="pop" style="--d:.7">${node(300, 400, 1.7)}</g>
    <g class="pop" style="--d:.9">${node(300, 170, 1.6)}</g>
    ${root("M286 408 C 272 414 262 422 256 434", 1.2, 7, 1.2, "#8a5a32")}
    ${root("M314 178 C 328 186 336 196 340 208", 1.4, 6, 1.2, "#8a5a32")}
    <circle class="pg-ring" style="--d:1.6" cx="300" cy="400" r="40" fill="none" stroke="#ffd36e" stroke-width="4"/>
    <g class="fade" style="--d:1.5"><circle cx="300" cy="400" r="40" fill="none" stroke="#ffd36e" stroke-width="4" stroke-dasharray="8 7"/></g>
    ${label(352, 418, "узел", "#ffd36e", 1.7, 32, "start")}
    <g class="fade" style="--d:2.1"><circle cx="300" cy="170" r="34" fill="none" stroke="#ffd36e" stroke-opacity=".7" stroke-width="3" stroke-dasharray="7 7"/></g>
    <g class="fade" style="--d:2.4">
      <path d="M252 188 L 238 188 L 238 382 L 252 382" stroke="#ffffff" stroke-opacity=".75" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ${label(226, 294, "междоузлие", "#ffffff", 2.6, 24, "end")}
    <g class="fade" style="--d:3"><path d="M222 454 L 378 454" stroke="#ff9f6e" stroke-width="4" stroke-dasharray="10 8"/></g>
    ${label(392, 462, "срез", "#ff9f6e", 3.2, 24, "start")}
    ${scissors(206, 454, 180, 0.95, 2.8)}
    ${chip(300, 610, "хотя бы один узел", "#ffd36e", 3.8)}`,

  // Банка: узлы под водой, листья над водой, корни отрастают; смена воды раз в 3–5 дней.
  jar: `${DEFS}
    ${jarBack(370, 250, 220, 310, 330, 0.1)}
    ${stem("M372 478 C 366 400 378 320 368 206", 0.5, 9)}
    ${stem("M330 490 C 326 420 318 330 300 226", 0.7, 8)}
    ${node(370, 440)}${node(371, 384)}${node(325, 452)}
    ${leaf(368, 212, 0.55, -6, 1.0)}${stem("M369 262 C 392 254 404 240 410 226", 0.9, 6)}${leaf(410, 228, 0.48, 52, 1.2, "leafG2")}
    ${leaf(300, 230, 0.48, -34, 1.3)}
    ${root("M370 446 C 360 480 368 510 356 540", 1.8, 4, 2.6)}
    ${root("M372 446 C 390 476 404 500 414 526", 2.3, 4, 2.6)}
    ${root("M371 390 C 392 410 410 420 430 446", 2.9, 3.5, 2.4)}
    ${root("M369 390 C 352 404 344 420 340 440", 3.4, 3.5, 2.2)}
    ${root("M325 458 C 316 486 306 504 300 534", 2.6, 4, 2.6)}
    ${root("M327 458 C 336 480 336 500 344 520", 3.6, 3.5, 2.2)}
    ${bubbles(
      [
        [290, 540, 1.0],
        [440, 548, 1.8, 3],
        [400, 530, 2.6],
        [280, 520, 3.4, 3],
      ],
      190,
    )}
    ${jarFront(370, 250, 220, 310, 0.1)}
    <g class="fade" style="--d:1.6"><circle cx="370" cy="440" r="22" fill="none" stroke="#7cc4ff" stroke-width="3" stroke-dasharray="6 6"/></g>
    <g class="fade" style="--d:1.6"><path d="M240 444 L 346 440" stroke="#7cc4ff" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/></g>
    ${label(232, 452, "узел", "#7cc4ff", 1.8, 26, "end")}
    ${roundel(
      120,
      150,
      `<g class="pg-spinf"><path d="M-26 -12 A 28 28 0 0 1 20 -20" stroke="#7cc4ff" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M14 -30 L 22 -18 L 8 -14" stroke="#7cc4ff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 12 A 28 28 0 0 1 -20 20" stroke="#7cc4ff" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-14 30 L -22 18 L -8 14" stroke="#7cc4ff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g><path d="M0 -14 C 8 -2 12 4 12 9 A 12 12 0 0 1 -12 9 C -12 4 -8 -2 0 -14 Z" fill="#7cc4ff"/>`,
      "смена воды",
      "#7cc4ff",
      2.2,
    )}
    ${label(120, 266, "раз в 3–5 дней", "#7cc4ff", 2.7, 22)}
    ${chip(300, 610, "корни — через 2–4 недели", "#7cc4ff", 4.2)}`,

  // Лист суккулента: подсушить 1–3 дня → на грунт → корешки и розетка.
  succLeaf: `${DEFS}
    ${panel(28, 130, 250, 372, 0)}${panel(322, 130, 250, 372, 0.2)}
    ${step(62, 164, 1, "#9fe0c0", 0.3)}${step(356, 164, 2, "#9fe0c0", 2.4)}
    <g transform="translate(153 222)"><g class="pop" style="--d:.5">
      <circle r="38" fill="#fff6dc" stroke="#ffd36e" stroke-width="5"/>
      ${[0, 90, 180, 270].map((a) => `<path d="M0 -30 L 0 -24" transform="rotate(${a})" stroke="#b08a3a" stroke-width="4" stroke-linecap="round"/>`).join("")}
      <g class="pg-spinf"><path d="M0 4 L 0 -26" stroke="#3b2a12" stroke-width="5" stroke-linecap="round"/></g>
      <path d="M0 0 L 16 8" stroke="#3b2a12" stroke-width="5" stroke-linecap="round"/><circle r="4" fill="#3b2a12"/>
    </g></g>
    ${big(153, 318, "1–3 дня", "#9fe0c0", 0.9, 34)}
    <g class="fade" style="--d:.4"><rect x="58" y="402" width="190" height="14" rx="7" fill="#f4efe2" opacity=".85"/></g>
    <g transform="translate(160 392)"><g class="rise" style="--d:.6">${succLeafShape(1, 'class="pg-callus" style="--d:1.4"')}</g></g>
    <g class="fade" style="--d:1.6"><circle cx="89" cy="392" r="20" fill="none" stroke="#ffd36e" stroke-width="3" stroke-dasharray="5 5"/></g>
    ${label(153, 476, "срез затягивается", "#ffffff", 1.8, 20)}
    ${next(300, 330, "#9fe0c0", 2.2)}
    <g class="rise" style="--d:2.4">
      <rect x="342" y="398" width="210" height="62" rx="16" fill="url(#soilG)"/>
      <rect x="342" y="398" width="210" height="16" rx="8" fill="url(#dryG)"/>
      ${[360, 392, 430, 470, 506, 536].map((x, i) => `<circle cx="${x}" cy="${430 + (i % 3) * 8}" r="3" fill="#e9dcc4" opacity=".6"/>`).join("")}
    </g>
    ${root("M398 400 q -6 22 -18 40", 3.2, 3, 1.4, "#ffd6d0")}${root("M401 400 q 6 20 2 46", 3.5, 3, 1.4, "#ffd6d0")}${root("M396 400 q -18 10 -36 16", 3.8, 3, 1.2, "#ffd6d0")}
    <g transform="translate(470 390)"><g class="rise" style="--d:2.7">${succLeafShape(0.9, 'fill="#a0703f"')}</g></g>
    ${[-34, 0, 34]
      .map(
        (r, i) =>
          `<g transform="translate(402 386) rotate(${r})"><g class="pop" style="--d:${4 + i * 0.2}"><path d="M0 0 C -9 -8 -8 -24 0 -30 C 8 -24 9 -8 0 0 Z" fill="url(#pgSucc)"/></g></g>`,
      )
      .join("")}
    ${sparkles(
      [
        [436, 336, 4.6],
        [370, 330, 5],
      ],
      "#d6ffe6",
    )}
    <g transform="translate(470 252)"><g class="pop" style="--d:5"><path d="M0 -26 C 14 -6 20 4 20 12 A 20 20 0 0 1 -20 12 C -20 4 -14 -6 0 -26 Z" fill="#7cc4ff"/><path d="M-8 6 A 10 10 0 0 0 -2 18" stroke="#ffffff" stroke-opacity=".7" stroke-width="4" fill="none" stroke-linecap="round"/></g></g>
    ${[0, 1].map((i) => `<path class="drip" style="--d:${5.4 + i * 0.9}" d="M470 284 q 7 12 0 19 q -7 -7 0 -19 Z" fill="#7cc4ff"/>`).join("")}
    ${label(447, 476, "корни и розетка", "#ffffff", 4.2, 20)}
    ${chip(300, 610, "полив — после корней", "#9fe0c0", 5)}`,

  // Деление куста: нож делит ком на две части с корнями и листьями, срезы — углём.
  divide: `${DEFS}
    <g class="pg-apart" style="--d:2.4;--dx:-62px">
      <ellipse cx="245" cy="532" rx="70" ry="10" fill="#000" opacity=".35" filter="url(#soft)"/>
      ${lance(262, 366, 0.95, -34, 0.5)}${lance(268, 366, 1.05, -14, 0.6, "leafG2")}${lance(276, 366, 0.85, 4, 0.7)}
      <g class="rise" style="--d:.1">
        <path d="M300 360 C 250 350 202 362 190 400 C 178 440 196 500 240 520 C 264 530 290 528 300 524 Z" fill="url(#soilG)"/>
        <path d="M210 410 C 230 430 220 460 240 480 M250 380 C 240 420 262 450 250 500 M282 390 C 270 430 290 470 278 510" stroke="#e9d9b8" stroke-opacity=".75" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M220 512 q -8 26 2 48 M250 524 q 2 22 -6 40 M276 524 q 8 18 4 34" stroke="#e9d9b8" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
      <g class="fade" style="--d:3.4"><path d="M300 362 L 300 522" stroke="#1e2124" stroke-opacity=".55" stroke-width="7"/></g>
      ${[380, 410, 440, 470, 500]
        .map(
          (y, i) =>
            `<circle class="pop" style="--d:${3.6 + i * 0.12}" cx="${296 - (i % 2) * 5}" cy="${y}" r="${4 + (i % 2)}" fill="#1e2124" stroke="#4a5058" stroke-width="1"/>`,
        )
        .join("")}
    </g>
    <g class="pg-apart" style="--d:2.4;--dx:62px">
      <ellipse cx="355" cy="532" rx="70" ry="10" fill="#000" opacity=".35" filter="url(#soft)"/>
      ${spathe(320, 366, 320, 200, 0.9)}
      ${lance(326, 366, 0.9, -6, 0.6, "leafG2")}${lance(332, 366, 1.0, 16, 0.7)}${lance(340, 366, 0.85, 36, 0.8, "leafG2")}
      <g class="rise" style="--d:.1">
        <path d="M300 360 C 350 350 398 362 410 400 C 422 440 404 500 360 520 C 336 530 310 528 300 524 Z" fill="url(#soilG)"/>
        <path d="M390 410 C 370 430 380 460 360 480 M350 380 C 360 420 338 450 350 500 M318 390 C 330 430 310 470 322 510" stroke="#e9d9b8" stroke-opacity=".75" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M380 512 q 8 26 -2 48 M350 524 q -2 22 6 40 M324 524 q -8 18 -4 34" stroke="#e9d9b8" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
      <g class="fade" style="--d:3.5"><path d="M300 362 L 300 522" stroke="#1e2124" stroke-opacity=".55" stroke-width="7"/></g>
      ${[380, 410, 440, 470, 500]
        .map(
          (y, i) =>
            `<circle class="pop" style="--d:${3.7 + i * 0.12}" cx="${304 + (i % 2) * 5}" cy="${y}" r="${4 + ((i + 1) % 2)}" fill="#1e2124" stroke="#4a5058" stroke-width="1"/>`,
        )
        .join("")}
    </g>
    ${knife(300, 150, 1.0, 330)}
    ${[0, 1, 2, 3, 4, 5]
      .map(
        (i) =>
          `<circle class="pg-sprinkle" style="--d:${3.4 + i * 0.22};--sx:${i % 2 ? 6 : -6}px;--sy:110px" cx="${i < 3 ? 236 : 364}" cy="${300 + (i % 3) * 6}" r="3.5" fill="#2a2d31"/>`,
      )
      .join("")}
    ${label(300, 300, "уголь", "#d6dde3", 3.4, 24)}
    ${badge(136, 160, true, 4.4, 26)}${badge(464, 160, true, 4.6, 26)}
    ${chip(300, 610, "у каждой — корни и листья", "#ffb38a", 4.8)}`,

  // Мини-теплица: растение под прозрачным пакетом, конденсат, 22–25 °C, солнце.
  greenhouse: `${DEFS}
    ${sun(95, 112, 40, 0.1)}
    ${label(95, 214, "весна и лето", "#ffd36e", 0.6, 22)}
    <g class="fade" style="--d:.8"><g opacity=".22"><path class="pulse" d="M128 140 L 300 170 L 420 330 L 200 420 Z" fill="url(#beamG)"/></g></g>
    ${potted(300, 540, 1.25, 0.3, "leafy")}
    <g class="fade" style="--d:1.4">
      <path d="M224 448 C 150 340 168 170 300 148 C 432 170 450 340 376 448 Z" fill="url(#glassG)"/>
      <path d="M224 448 C 150 340 168 170 300 148 C 432 170 450 340 376 448 Z" fill="#d8efff" opacity=".1"/>
      <path d="M224 448 C 150 340 168 170 300 148 C 432 170 450 340 376 448" fill="none" stroke="#f0f8ff" stroke-opacity=".7" stroke-width="4"/>
      <path d="M200 330 C 192 270 210 210 250 182" stroke="#ffffff" stroke-opacity=".45" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M396 300 C 400 270 396 240 384 216" stroke="#ffffff" stroke-opacity=".25" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M222 446 Q 300 462 378 446" stroke="#ffd36e" stroke-width="7" fill="none" stroke-linecap="round"/>
    </g>
    ${cond([
      [212, 300, 2.2, 6],
      [236, 230, 2.6, 5],
      [270, 186, 3.4, 4],
      [384, 260, 2.9, 6],
      [396, 340, 3.6, 5],
      [206, 380, 4.0, 5],
      [340, 184, 4.4, 4],
      [384, 400, 2.4, 5],
    ])}
    ${thermo(515, 330, "22–25 °C", 1.8)}
    ${chip(300, 610, "мини-теплица", "#ffd36e", 3.6)}`,

  // Нижний лист отрываем (загниёт в воде), черенок — в воду узлами.
  stripLeaf: `${DEFS}
    ${stem("M150 470 C 146 400 156 300 150 160", 0.2, 10)}
    ${node(151, 200)}${node(150, 310)}${node(149, 420)}
    ${stem("M156 196 C 172 190 182 180 188 170", 0.5, 6)}${leaf(188, 172, 0.5, 48, 0.7)}
    ${stem("M144 306 C 128 300 118 290 112 280", 0.6, 6)}${leaf(112, 282, 0.5, -48, 0.8, "leafG2")}
    ${leaf(150, 166, 0.45, 6, 0.9)}
    <g class="pg-leafoff" style="--d:1.6">
      <g class="pop" style="--d:.9">
        <path d="M155 418 C 170 412 180 404 186 394" stroke="#4f9a4a" stroke-width="6" fill="none" stroke-linecap="round"/>
        ${hleaf(186, 396, 0.5, 64)}
        <g class="fade" style="--d:2.6">${hleaf(186, 396, 0.5, 64, "leafY")}</g>
      </g>
    </g>
    ${badge(202, 500, false, 3.2, 22)}
    ${label(150, 592, "этот лист загниёт в воде", "#ff8a8f", 3.4, 20)}
    ${next(296, 330, "#ff8a8f", 3.6)}
    ${jarBack(450, 232, 190, 310, 312, 3.6)}
    ${stem("M452 500 C 446 430 458 320 450 190", 4.0, 9)}
    <g class="fade" style="--d:4.2">${node(451, 470)}${node(451, 404)}${node(450, 258)}</g>
    ${stem("M456 254 C 476 246 488 232 494 218", 4.3, 6)}${leaf(494, 220, 0.46, 50, 4.5, "leafG2")}
    ${leaf(450, 196, 0.5, -8, 4.6)}
    ${root("M451 476 C 440 500 446 516 436 532", 4.8, 3.5)}${root("M452 476 C 466 494 472 508 482 524", 5, 3.5)}
    ${root("M451 410 C 470 424 482 436 496 452", 5.2, 3)}${root("M450 410 C 436 420 428 432 424 448", 5.4, 3)}
    ${jarFront(450, 232, 190, 310, 3.6)}
    <circle class="pg-ring" style="--d:5" cx="451" cy="470" r="18" fill="none" stroke="#7cc4ff" stroke-width="3"/>
    <circle class="pg-ring" style="--d:5.4" cx="451" cy="404" r="18" fill="none" stroke="#7cc4ff" stroke-width="3"/>
    ${label(450, 92, "листья — над водой", "#ffffff", 4.6, 22)}
    ${label(450, 592, "узлы — в воде", "#7cc4ff", 5, 22)}`,

  // 3–5 укоренённых черенков в один горшок → пышный куст.
  bush: `${DEFS}
    ${[
      [236, -8, 0.5],
      [268, -3, 0.85],
      [300, 0, 1.2],
      [332, 4, 1.55],
      [364, 9, 1.9],
    ]
      .map(
        ([x, r, d], i) => `
      <g class="pg-plant" style="--d:${d}">
        <g transform="rotate(${r} ${x} 420)">
          <path d="M${x} 450 C ${x - 4} 380 ${x + 4} 320 ${x} ${280 - (i % 2) * 24}" stroke="#4f9a4a" stroke-width="7" fill="none" stroke-linecap="round"/>
          ${hleaf(x, 286 - (i % 2) * 24, 0.36, i % 2 ? -18 : 14, i % 2 ? "leafG2" : "leafG")}
          ${hleaf(x + 2, 346, 0.3, i % 2 ? 56 : -56, "leafG")}
          <path d="M${x} 448 q -12 18 -10 40 M${x} 448 q 10 16 14 34 M${x} 452 q 0 20 -2 36" stroke="#f3ead8" stroke-width="3" fill="none" stroke-linecap="round"/>
        </g>
      </g>`,
      )
      .join("")}
    ${pot(300, 400, 240, 150, 0.1)}
    ${[
      [300, 232, 0.4, -4, 3.4],
      [232, 270, 0.38, -48, 3.6],
      [368, 266, 0.38, 46, 3.8],
      [206, 330, 0.34, -76, 4.0],
      [396, 330, 0.34, 74, 4.2],
      [262, 214, 0.32, -24, 4.4],
      [340, 212, 0.32, 24, 4.6],
    ]
      .map(([x, y, s, r, d], i) => leaf(x, y, s, r, d, i % 2 ? "leafG2" : "leafG"))
      .join("")}
    ${vine(
      [
        [176, 392],
        [126, 420],
        [112, 480],
        [128, 560],
      ],
      3.8,
      2.4,
      4,
    )}
    ${vine(
      [
        [424, 392],
        [474, 420],
        [488, 480],
        [472, 560],
      ],
      4.0,
      2.4,
      4,
    )}
    ${big(500, 126, "3–5", "#8be3a8", 2.6, 52)}
    ${label(500, 164, "черенков", "#ffffff", 2.6, 22)}
    <g transform="translate(96 108)"><g class="pop" style="--d:3"><path d="M0 -30 C 16 -8 24 4 24 14 A 24 24 0 0 1 -24 14 C -24 4 -16 -8 0 -30 Z" fill="#7cc4ff"/><path d="M-10 8 A 12 12 0 0 0 -2 22" stroke="#ffffff" stroke-opacity=".7" stroke-width="4" fill="none" stroke-linecap="round"/></g></g>
    ${label(96, 174, "2 недели", "#7cc4ff", 3.2, 22)}
    ${label(96, 200, "слегка влажно", "#ffffff", 3.4, 18)}
    ${sparkles(
      [
        [190, 220, 4.8],
        [420, 200, 5.2],
        [300, 160, 5.6],
      ],
      "#d6ffe6",
    )}
    ${chip(300, 610, "куст будет пышнее", "#8be3a8", 4.6)}`,

  // Материнское растение со срезом: из пазух ниже среза — новые побеги.
  mother: (() => {
    const P = [
      [250, 372],
      [250, 280],
      [300, 200],
      [380, 140],
    ];
    const at = (t) => bez(t, ...P).map((v) => Math.round(v));
    const [a1, a2, a3, a4] = [at(0.22), at(0.62), at(0.45), at(0.78)];
    const shoot = ([x, y], d) => `
      <g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}">
        <circle r="22" fill="#c8ff9a" opacity=".22" filter="url(#glow)"/>
        <path d="M0 0 C -12 -4 -22 -14 -30 -28" stroke="#7fd36a" stroke-width="6" fill="none" stroke-linecap="round"/>
        ${hleaf(-30, -26, 0.3, -36, "leafG2")}${hleaf(-14, -10, 0.22, -96, "leafG2")}
      </g></g>
      <circle class="pg-ring" style="--d:${d}" cx="${x}" cy="${y}" r="16" fill="none" stroke="#c8ff9a" stroke-width="3"/>`;
    return `${DEFS}
    ${stem("M232 372 C 210 320 180 280 140 244", 0.4, 8)}
    ${leaf(140, 248, 0.5, -40, 1.0)}${leaf(196, 304, 0.42, -76, 1.1, "leafG2")}
    ${stem(`M${P[0]} C ${P[1]} ${P[2]} ${P[3]}`, 0.5, 9)}
    ${leaf(a1[0], a1[1], 0.5, 64, 1.0, "leafG2")}${leaf(a2[0], a2[1], 0.46, 60, 1.2)}
    ${node(a3[0], a3[1], 1.1)}${node(a4[0], a4[1], 1.1)}
    <g transform="translate(380 140) rotate(52)"><g class="pop" style="--d:1.2">
      <ellipse rx="11" ry="6.5" fill="#e8f8c8" stroke="#a87b4f" stroke-width="3"/>
    </g></g>
    ${scissors(452, 78, -45, 0.5, 1.3)}
    ${label(398, 172, "срез", "#ffd36e", 1.6, 24, "start")}
    ${pot(240, 380, 200, 150, 0.1)}
    ${vine(
      [
        [148, 384],
        [96, 420],
        [84, 480],
        [100, 560],
      ],
      0.8,
      2.2,
      4,
    )}
    ${vine(
      [
        [334, 384],
        [390, 410],
        [412, 470],
        [402, 550],
      ],
      1.0,
      2.2,
      4,
    )}
    ${shoot(a3, 2.2)}${shoot(a4, 2.9)}
    ${arrow(130, 150, 200, 130, a4[0] - 46, a4[1] - 20, "#c8ff9a", 3.4, 4, true)}
    ${label(84, 108, "новые", "#c8ff9a", 3.4, 24)}
    ${label(84, 136, "побеги", "#c8ff9a", 3.5, 24)}
    ${sparkles(
      [
        [a3[0] - 60, a3[1] - 30, 3.2],
        [a4[0] - 10, a4[1] - 70, 3.8],
        [470, 260, 4.4],
      ],
      "#e6ffcc",
    )}
    ${chip(300, 610, "станет пышнее", "#8be3a8", 4.2)}`;
  })(),

  // Разросшийся куст из многих розеток, тесный горшок, корни лезут наружу.
  clump: `${DEFS}
    <g class="pg-tight" style="--d:3">
      ${[
        [226, [-42, -24, -8], 0.3],
        [268, [-18, 0, 14], 0.6],
        [316, [-10, 6, 22], 0.9],
        [364, [10, 26, 44], 1.2],
      ]
        .map(([x, rs, d], i) =>
          rs.map((r, j) => lance(x, 390, 0.8 + ((i + j) % 3) * 0.12, r, d + j * 0.12, (i + j) % 2 ? "leafG2" : "leafG")).join(""),
        )
        .join("")}
      ${spathe(270, 390, 250, 196, 1.6)}${spathe(318, 390, 340, 204, 1.9)}
      <path class="draw" style="--d:2.4" pathLength="1" d="M206 392 C 194 380 186 392 188 412 C 190 430 182 450 186 470" stroke="#e9d9b8" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path class="draw" style="--d:2.6" pathLength="1" d="M394 392 C 408 382 416 396 412 414 C 410 432 418 446 414 462" stroke="#e9d9b8" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${pot(300, 410, 190, 130, 0.1)}
      <path class="draw" style="--d:2.8" pathLength="1" d="M292 540 q -8 22 -22 36 M300 540 q 2 24 -4 44 M308 540 q 10 18 24 30" stroke="#e9d9b8" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path class="draw" style="--d:2.4" pathLength="1" d="M196 396 C 190 404 186 418 190 432" stroke="#e9d9b8" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path class="draw" style="--d:2.6" pathLength="1" d="M404 396 C 410 406 414 418 410 430" stroke="#e9d9b8" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
    ${[226, 268, 316, 364].map((x, i) => `<circle class="pop" style="--d:${3.2 + i * 0.25}" cx="${x}" cy="390" r="9" fill="#c2a8ff" stroke="#ffffff" stroke-width="3"/>`).join("")}
    ${[226, 268, 316, 364].map((x, i) => `<circle class="pg-ring" style="--d:${3.4 + i * 0.25}" cx="${x}" cy="390" r="12" fill="none" stroke="#c2a8ff" stroke-width="3"/>`).join("")}
    ${label(470, 520, "тесно!", "#ff8a8f", 3.0, 26, "start")}
    ${chip(300, 612, "много розеток от корня", "#c2a8ff", 4.4)}`,

  // Ряд горшков: o.kinds — виды, o.badges — галочки, иначе навес «неделя в тени»; o.chip — подпись.
  potsRow: (o = {}) => {
    const kinds = Array.isArray(o.kinds) && o.kinds.length ? o.kinds.slice(0, 4) : ["aspid", "aspid"];
    const n = kinds.length;
    const s = n <= 2 ? 1.2 : n === 3 ? 1.02 : 0.82;
    const gap = n <= 2 ? 240 : n === 3 ? 178 : 135;
    const y = 520;
    const tall = { leafy: 270, snake: 225, zz: 215, aspid: 295, chloro: 200 };
    const xs = kinds.map((_, i) => 300 + (i - (n - 1) / 2) * gap);
    const plants = kinds.map((k, i) => potted(xs[i], y, s, 0.3 + i * 0.4, KINDS.includes(k) ? k : "leafy")).join("");
    const text = o.chip ?? (o.badges ? "безопасно" : "неделя в тени");
    const shade = `
      ${sun(530, 64, 26, 0.1)}
      <g class="fade" style="--d:1.4"><path d="M70 134 L 530 134 L 590 ${y + 30} L 10 ${y + 30} Z" fill="url(#pgShade)"/></g>
      <g class="rise" style="--d:1.2">
        <path d="M60 96 L 540 96 L 552 128 L 48 128 Z" fill="#2f5d47"/>
        ${Array.from({ length: 8 }, (_, i) => `<path d="M${60 + i * 60} 96 L ${120 + i * 60} 96 L ${120 + i * 60 + 1.5} 128 L ${60 + i * 60 - 1.5} 128 Z" fill="${i % 2 ? "#f2efe4" : "#2f9d5c"}" opacity=".9"/>`).join("")}
        ${Array.from({ length: 12 }, (_, i) => `<path d="M${48 + i * 42} 128 q 21 22 42 0" fill="${i % 2 ? "#e6e1d2" : "#2f9d5c"}"/>`).join("")}
        <rect x="56" y="88" width="488" height="10" rx="5" fill="#d9cdb8"/>
      </g>
      ${xs
        .map((x, i) =>
          [0, 1]
            .map(
              (j) =>
                `<path class="drip" style="--d:${2.4 + i * 0.3 + j * 0.8}" d="M${x + 34} ${y - 112 * s} q 8 14 0 22 q -8 -8 0 -22 Z" fill="#7cc4ff"/>`,
            )
            .join(""),
        )
        .join("")}
      ${label(300, 572, "подкормка — через месяц", "#ffffff", 3.4, 20)}`;
    const ok = `
      ${xs.map((x, i) => badge(x, y - (tall[kinds[i]] ?? 260) * s - 34, true, 1.8 + i * 0.4, 26)).join("")}
      ${sparkles(
        [
          [60, 140, 2.8],
          [540, 170, 3.2],
          [300, 90, 3.6],
        ],
        "#d6ffe6",
      )}`;
    return `${DEFS}
      <rect class="rise" style="--d:.1" x="30" y="${y}" width="540" height="14" rx="7" fill="#d9cdb8" opacity=".9"/>
      ${plants}
      ${o.badges ? ok : shade}
      ${chip(300, 612, text, o.badges ? "#8be3a8" : "#b4dcff", o.badges ? 3.2 : 3.8)}`;
  },

  // Хлорофитум: усы с детками; одна — в воде, другая прикопана в соседний горшок.
  spider: `${DEFS}
    <g class="rise" style="--d:.1">
      <rect x="226" y="372" width="48" height="186" rx="8" fill="url(#pgWood)"/>
      <rect x="176" y="358" width="148" height="18" rx="8" fill="#c99a68"/>
      <ellipse cx="250" cy="566" rx="70" ry="10" fill="#000" opacity=".35" filter="url(#soft)"/>
    </g>
    ${potted(250, 360, 1.25, 0.2, "chloro")}
    <path class="draw" style="--d:1.2" pathLength="1" d="M272 262 C 380 150 470 250 470 430" stroke="#d9efb0" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path class="draw" style="--d:1.5" pathLength="1" d="M232 262 C 140 170 92 270 110 414" stroke="#d9efb0" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g transform="translate(470 432)"><g class="pg-plant" style="--d:2.6;--py:-60px">
      ${baby(1.15)}
      <path d="M0 2 q -8 14 -6 26 M0 2 q 8 12 10 24" stroke="#f3ead8" stroke-width="3" fill="none"/>
    </g></g>
    ${pot(470, 450, 120, 90, 0.6)}
    ${jarBack(110, 420, 100, 140, 450, 0.5)}
    <g transform="translate(110 416)"><g class="pop" style="--d:2.8">${baby(1.05)}</g></g>
    ${root("M110 420 C 100 460 106 500 96 536", 3.4, 3, 2)}${root("M112 420 C 122 456 126 490 132 520", 3.7, 3, 2)}${root("M110 422 C 110 460 114 490 112 512", 4.0, 3, 1.8)}
    ${jarFront(110, 420, 100, 140, 0.5)}
    ${scissors(470, 132, 200, 0.42, 3.2)}
    ${badge(500, 122, false, 3.6, 20)}
    ${label(470, 72, "не отрезая", "#d8f59a", 3.8, 24)}
    ${label(110, 594, "в воду", "#7cc4ff", 3.4, 22)}
    ${label(470, 594, "в соседний горшок", "#d8f59a", 3.6, 22)}`,

  // Алоэ: нож отделяет детку с корнями, подсушить день, посадить в сухой грунт.
  pup: `${DEFS}
    <g class="pg-pup" style="--d:2.2">
      <g class="pop" style="--d:.9">
        ${[-34, -8, 22].map((r, i) => `<g transform="translate(252 318) rotate(${r}) scale(${0.46 + (i % 2) * 0.1})"><path d="M-17 0 C -19 -60 -9 -130 0 -182 C 9 -130 19 -60 17 0 Z" fill="url(#pgAloe)"/></g>`).join("")}
        <path d="M252 320 q -12 16 -10 34 M252 320 q 10 14 14 30 M252 322 q 0 18 -2 32" stroke="#f3ead8" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      </g>
    </g>
    ${pot(180, 330, 170, 120, 0.1)}
    ${[
      [-52, 0.9],
      [-30, 1.05],
      [-12, 1.15],
      [8, 1.12],
      [28, 1.0],
      [48, 0.86],
    ]
      .map(([r, s], i) => aloeLeaf(180 + r * 0.4, 318, s, r, 0.3 + i * 0.08))
      .join("")}
    ${knife(226, 120, 1.2, 140)}
    ${pot(465, 430, 120, 90, 1.6)}
    <g class="rise" style="--d:1.6"><ellipse cx="465" cy="410" rx="58" ry="8" fill="url(#dryG)"/></g>
    ${sun(520, 76, 26, 3.4)}
    ${label(520, 146, "подсушить", "#ffffff", 3.6, 20)}
    ${big(520, 178, "1 день", "#62e3d3", 3.8, 24)}
    ${label(465, 568, "сухой грунт", "#ffffff", 5.4, 20)}
    ${chip(300, 612, "отделять, когда есть корни", "#62e3d3", 5.6)}`,

  // Семечко прорастает: корешок вниз, росток вверх, раскрываются семядоли.
  seed: `${DEFS}
    ${sun(96, 100, 36, 0.1)}
    <g class="fade" style="--d:.4"><g opacity=".18"><path class="pulse" d="M120 120 L 300 230 L 380 330 L 150 330 Z" fill="url(#beamG)"/></g></g>
    <g class="rise" style="--d:0">
      <rect x="70" y="330" width="460" height="234" rx="30" fill="url(#soilG)"/>
      <path d="M70 344 Q 70 330 100 330 L 500 330 Q 530 330 530 344 L 530 352 Q 400 344 300 352 Q 180 360 70 350 Z" fill="#7a5236"/>
      ${[
        [110, 400],
        [170, 520],
        [440, 410],
        [490, 500],
        [380, 540],
        [140, 460],
        [230, 380],
        [470, 360],
      ]
        .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${5 + (i % 3) * 2}" ry="${4 + (i % 2) * 2}" fill="#a07a58" opacity=".6"/>`)
        .join("")}
    </g>
    ${root("M300 470 C 296 500 304 520 298 552", 1.0, 6, 1.4)}
    ${root("M299 500 q -16 8 -28 22", 1.9, 3, 1)}${root("M300 520 q 16 6 26 20", 2.1, 3, 1)}
    <path class="draw" style="--d:1.6;animation-duration:1.8s" pathLength="1" d="M300 436 C 306 400 290 370 300 340 C 306 310 300 280 300 246" stroke="#9be07a" stroke-width="8" fill="none" stroke-linecap="round"/>
    <g transform="translate(300 452) rotate(-18)"><g class="pop" style="--d:.4">
      <ellipse rx="26" ry="18" fill="url(#pgSeed)"/>
      <path class="draw" style="--d:.9" pathLength="1" d="M-20 -2 Q 0 6 20 -4" stroke="#3b2210" stroke-width="3" fill="none"/>
    </g></g>
    <g transform="translate(300 250)"><g class="pg-sway">
      <g class="pop" style="--d:3"><path d="M0 0 C -12 -14 -44 -20 -58 -6 C -46 6 -16 8 0 0 Z" fill="url(#leafG2)"/></g>
      <g class="pop" style="--d:3.2"><path d="M0 0 C 12 -14 44 -20 58 -6 C 46 6 16 8 0 0 Z" fill="url(#leafG)"/></g>
    </g></g>
    ${label(240, 460, "семечко", "#ffffff", 0.8, 22, "end")}
    ${label(330, 548, "корешок", "#f3ead8", 1.8, 22, "start")}
    ${label(318, 300, "росток", "#9be07a", 2.6, 22, "start")}
    ${label(372, 236, "семядоли", "#ffd36e", 3.6, 24, "start")}
    ${sparkles(
      [
        [250, 200, 3.6],
        [350, 180, 4.2],
      ],
      "#fff3c2",
    )}
    ${chip(300, 612, "зелень · колеус · кактусы", "#ffd36e", 4.4)}`,

  // Лоток: мелкие семена — по поверхности, крупное — на глубину двух своих размеров.
  sow: `${DEFS}
    ${label(165, 116, "мелкие", "#ffffff", 0.2, 28)}${label(425, 116, "крупные", "#ffffff", 0.4, 28)}
    <g class="rise" style="--d:0">
      <ellipse cx="300" cy="552" rx="260" ry="14" fill="#000" opacity=".4" filter="url(#soft)"/>
      <path d="M58 380 L 542 380 L 526 540 L 74 540 Z" fill="url(#pgPeat)"/>
      <path d="M58 380 L 542 380 L 540 392 L 60 392 Z" fill="#8a6040"/>
      ${Array.from({ length: 56 }, (_, i) => `<circle cx="${78 + ((i * 137 + i * i * 7) % 444)}" cy="${396 + ((i * 71 + i * i * 13) % 136)}" r="${1.6 + (i % 3)}" fill="#f4f1e8" opacity=".7"/>`).join("")}
      <path d="M48 372 L 58 380 L 74 540 L 526 540 L 542 380 L 552 372" stroke="url(#pgTray)" stroke-width="14" fill="none" stroke-linejoin="round"/>
      <path d="M300 388 L 300 534" stroke="#ffffff" stroke-opacity=".25" stroke-width="3" stroke-dasharray="6 8"/>
    </g>
    <g transform="translate(150 206) rotate(28) scale(1.2)"><g class="pop" style="--d:.6">
      <rect x="-40" y="-60" width="80" height="104" rx="8" fill="#f4efe2"/>
      <rect x="-40" y="-60" width="80" height="22" rx="8" fill="#ffb38a"/>
      <path d="M0 -8 C -12 -14 -14 -30 0 -36 C 14 -30 12 -14 0 -8 Z" fill="#2f9d5c" transform="translate(0 20)"/>
      <circle cy="30" r="4" fill="#5a3a20"/><circle cx="-12" cy="30" r="3" fill="#5a3a20"/><circle cx="12" cy="30" r="3" fill="#5a3a20"/>
    </g></g>
    ${Array.from(
      { length: 10 },
      (_, i) =>
        `<circle class="pg-sprinkle" style="--d:${1.2 + i * 0.15};--sx:${-60 + ((i * 41) % 130)}px;--sy:${100 + (i % 3) * 4}px" cx="${150 + (i % 3) * 6}" cy="${276 + (i % 2) * 4}" r="3.5" fill="#3b2210"/>`,
    ).join("")}
    ${Array.from({ length: 14 }, (_, i) => `<circle class="pop" style="--d:${1.6 + i * 0.15}" cx="${84 + i * 14.5 + (i % 2) * 4}" cy="${377 - (i % 2)}" r="4" fill="#2a170a"/>`).join("")}
    <g class="fade" style="--d:2.6">
      <ellipse cx="425" cy="395" rx="22" ry="15" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="2.5" stroke-dasharray="5 5"/>
      <ellipse cx="425" cy="425" rx="22" ry="15" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="2.5" stroke-dasharray="5 5"/>
      <path d="M458 380 L 474 380 M466 380 L 466 440 M458 440 L 474 440" stroke="#ffb38a" stroke-width="4" stroke-linecap="round"/>
    </g>
    <g class="pg-sink" style="--d:1"><ellipse cx="425" cy="455" rx="22" ry="15" fill="url(#pgSeed)"/><path d="M410 450 Q 425 444 440 452" stroke="#3b2210" stroke-width="2.5" fill="none"/></g>
    <g class="fade" style="--d:2.2"><path d="M394 380 Q 425 368 456 380" stroke="#8a6040" stroke-width="8" fill="none" stroke-linecap="round"/></g>
    ${label(482, 410, "2 размера", "#ffb38a", 2.8, 22, "start")}
    ${label(482, 436, "семени", "#ffb38a", 3.0, 22, "start")}
    ${label(165, 572, "не заглублять", "#ffffff", 2.4, 22)}
    ${label(425, 572, "заделать", "#ffffff", 3.2, 22)}
    ${chip(300, 616, "торф + перлит или кокос", "#ffb38a", 3.8)}`,

  // Мини-парник: лоток под крышкой, конденсат, 22–25 °C, пульверизатор.
  minigreen: `${DEFS}
    ${sun(92, 98, 34, 0.1)}
    <g class="fade" style="--d:.4"><g opacity=".16"><path class="pulse" d="M112 120 L 280 230 L 420 300 L 90 300 Z" fill="url(#beamG)"/></g></g>
    <g class="rise" style="--d:.2">
      <ellipse cx="245" cy="508" rx="190" ry="12" fill="#000" opacity=".4" filter="url(#soft)"/>
      <path d="M64 436 L 426 436 L 412 500 L 78 500 Z" fill="url(#pgTray)"/>
      <rect x="66" y="430" width="358" height="14" rx="6" fill="#5a3a24"/>
    </g>
    ${[100, 146, 192, 238, 284, 330, 376]
      .map((x, i) => `<g transform="translate(${x} 434)"><g class="pop" style="--d:${0.8 + i * 0.12}">${seedling(0.55)}</g></g>`)
      .join("")}
    <g class="pg-air" style="--d:3">
      <g class="fade" style="--d:1.2">
        <path d="M68 434 L 68 300 Q 68 250 118 250 L 372 250 Q 422 250 422 300 L 422 434 Z" fill="url(#glassG)"/>
        <path d="M68 434 L 68 300 Q 68 250 118 250 L 372 250 Q 422 250 422 300 L 422 434 Z" fill="#d8efff" opacity=".08"/>
        <path d="M68 434 L 68 300 Q 68 250 118 250 L 372 250 Q 422 250 422 300 L 422 434" fill="none" stroke="#f0f8ff" stroke-opacity=".75" stroke-width="4"/>
        <path d="M90 410 L 90 310 Q 90 276 120 272" stroke="#ffffff" stroke-opacity=".45" stroke-width="8" fill="none" stroke-linecap="round"/>
        <rect x="215" y="236" width="60" height="16" rx="8" fill="#f0f8ff" opacity=".8"/>
      </g>
      ${cond([
        [120, 300, 1.8, 5],
        [170, 268, 2.2, 4],
        [260, 272, 2.8, 5],
        [340, 270, 2.0, 4],
        [400, 320, 2.6, 5],
        [84, 360, 3.2, 4],
        [404, 380, 3.6, 4],
        [220, 290, 4.0, 4],
      ])}
    </g>
    ${thermo(515, 236, "22–25 °C", 1.6)}
    <g class="rise" style="--d:2.2">
      <path d="M488 422 L 540 422 L 548 560 Q 548 572 536 572 L 492 572 Q 480 572 480 560 Z" fill="#62e3d3" fill-opacity=".85"/>
      <path d="M494 436 L 494 552" stroke="#ffffff" stroke-opacity=".45" stroke-width="7" stroke-linecap="round"/>
      <rect x="496" y="396" width="38" height="28" rx="6" fill="#e9eef2"/>
      <path d="M496 404 L 456 404 L 456 416 L 496 416 Z" fill="#cfd6dc"/>
      <path d="M520 424 L 528 450 L 516 450 Z" fill="#cfd6dc"/>
    </g>
    ${[0, 1, 2]
      .map(
        (i) =>
          `<g class="pg-mist" style="--d:${3 + i * 0.4}"><path d="M454 410 L 420 388 Q 412 410 420 432 Z" fill="#d8f0ff" opacity=".5"/>${[0, 1, 2, 3].map((j) => `<circle cx="${430 + (j % 2) * 8}" cy="${396 + j * 10}" r="2.2" fill="#ffffff"/>`).join("")}</g>`,
      )
      .join("")}
    ${chip(300, 610, "проветривать каждый день", "#62e3d3", 3.6)}`,

  // Всходы: крышку снимаем, фитолампа; вытянутый сеянец без света — перечёркнут.
  sprouts: `${DEFS}
    <g class="rise" style="--d:0">
      <path d="M140 30 L 140 78 M340 30 L 340 78" stroke="#c9d1d8" stroke-width="3"/>
      <rect x="86" y="74" width="308" height="26" rx="13" fill="#2b3138"/>
      <rect x="100" y="94" width="280" height="8" rx="4" fill="#ff9fe0" filter="url(#glow)"/>
    </g>
    <g class="fade" style="--d:.5"><g opacity=".75"><path class="pulse" d="M100 100 L 380 100 L 430 440 L 50 440 Z" fill="url(#pgLamp)"/></g></g>
    <g class="rise" style="--d:.2">
      <ellipse cx="240" cy="520" rx="190" ry="12" fill="#000" opacity=".4" filter="url(#soft)"/>
      <path d="M58 446 L 422 446 L 408 510 L 72 510 Z" fill="url(#pgTray)"/>
      <rect x="60" y="440" width="360" height="14" rx="6" fill="#5a3a24"/>
    </g>
    ${[92, 132, 172, 212, 252, 292, 332, 372]
      .map(
        (x, i) =>
          `<g transform="translate(${x} 444)"><g class="pop" style="--d:${0.6 + i * 0.15}"><g class="pg-sway">${seedling(0.62 + (i % 3) * 0.06)}</g></g></g>`,
      )
      .join("")}
    <g transform="translate(62 444)"><g class="pg-lid" style="--d:1.6">
      <path d="M2 0 L 2 -130 Q 2 -180 52 -180 L 308 -180 Q 358 -180 358 -130 L 358 0 Z" fill="url(#glassG)"/>
      <path d="M2 0 L 2 -130 Q 2 -180 52 -180 L 308 -180 Q 358 -180 358 -130 L 358 0" fill="none" stroke="#f0f8ff" stroke-opacity=".75" stroke-width="4"/>
      <path d="M24 -24 L 24 -124 Q 24 -158 54 -162" stroke="#ffffff" stroke-opacity=".45" stroke-width="8" fill="none" stroke-linecap="round"/>
    </g></g>
    <g class="fade" style="--d:2.2"><rect x="440" y="190" width="146" height="330" rx="24" fill="#06120c" fill-opacity=".6" stroke="#ffffff" stroke-opacity=".16" stroke-width="2"/></g>
    <g class="rise" style="--d:2.4">
      <path d="M470 482 L 556 482 L 548 510 L 478 510 Z" fill="url(#pgTray)"/>
      <rect x="468" y="476" width="90" height="10" rx="4" fill="#5a3a24"/>
    </g>
    <g transform="translate(513 480)"><g class="fade" style="--d:2.6"><g class="pg-flop">
      <path d="M0 0 C 4 -80 10 -170 -14 -214 C -24 -232 -38 -226 -42 -206" stroke="#d6e29a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M-42 -206 C -54 -212 -62 -200 -58 -190 C -50 -190 -44 -196 -42 -206 Z" fill="#d6e29a"/>
      <path d="M-42 -206 C -36 -194 -40 -182 -48 -178 C -52 -186 -50 -198 -42 -206 Z" fill="#c6d68a"/>
    </g></g></g>
    ${badge(513, 240, false, 3.2, 24)}
    ${label(513, 552, "без света", "#ff8a8f", 3.4, 22)}
    ${chip(240, 610, "много света", "#ff9fe0", 4)}`,

  // Пикировка: сеянец с двумя настоящими листьями — палочкой в отдельный стаканчик.
  prick: `${DEFS}
    <g transform="translate(150 140)"><g class="pop" style="--d:.2">
      ${hleaf(-6, 18, 0.22, -30, "leafG")}${hleaf(6, 18, 0.22, 30, "leafG2")}
    </g></g>
    ${label(182, 150, "2 настоящих листа", "#8be3a8", 0.4, 26, "start")}
    ${[75, 195, 255].map((x, i) => `<g transform="translate(${x} 404)"><g class="pop" style="--d:${0.4 + i * 0.15}">${seedling(0.8, true)}</g></g>`).join("")}
    <g class="pg-prick" style="--d:1.5">
      <g transform="translate(135 404)">
        ${seedling(0.8, true)}
        <path d="M0 0 q -10 14 -8 34 M0 0 q 8 12 12 28 M0 2 q 0 18 -2 30" stroke="#f3ead8" stroke-width="3" fill="none" stroke-linecap="round"/>
      </g>
      <g class="pg-stickoff" style="--d:3.4"><path d="M170 476 L 128 432" stroke="url(#pgWood)" stroke-width="9" stroke-linecap="round"/></g>
    </g>
    <g class="rise" style="--d:.1">
      <ellipse cx="170" cy="480" rx="140" ry="10" fill="#000" opacity=".4" filter="url(#soft)"/>
      <path d="M36 400 L 304 400 L 294 470 L 46 470 Z" fill="url(#pgTray)"/>
      <rect x="38" y="396" width="264" height="12" rx="5" fill="#5a3a24"/>
      ${[100, 165, 230].map((x) => `<path d="M${x} 408 L ${x} 470" stroke="#0c1418" stroke-width="3"/>`).join("")}
    </g>
    <g class="fade" style="--d:1"><path class="pg-dash" d="M150 330 Q 270 170 370 300" stroke="#8be3a8" stroke-opacity=".7" stroke-width="4" fill="none" stroke-linecap="round"/></g>
    ${[460, 550].map((x, i) => `<g transform="translate(${x} 418)"><g class="pop" style="--d:${4.8 + i * 0.3}">${seedling(0.7, true)}</g></g>`).join("")}
    ${[370, 460, 550]
      .map(
        (x, i) => `
      <g class="rise" style="--d:${0.5 + i * 0.2}">
        <ellipse cx="${x}" cy="512" rx="40" ry="7" fill="#000" opacity=".35" filter="url(#soft)"/>
        <path d="M${x - 34} 424 L ${x + 34} 424 L ${x + 27} 506 L ${x - 27} 506 Z" fill="url(#soilG)"/>
        <path d="M${x - 38} 408 L ${x + 38} 408 L ${x + 29} 508 L ${x - 29} 508 Z" fill="url(#pgCup)" stroke="#ffffff" stroke-opacity=".55" stroke-width="3"/>
        <ellipse cx="${x}" cy="408" rx="38" ry="6" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="3"/>
      </g>`,
      )
      .join("")}
    ${sparkles(
      [
        [370, 300, 4.8],
        [520, 320, 5.4],
      ],
      "#d6ffe6",
    )}
    ${chip(300, 610, "это пикировка", "#8be3a8", 4.6)}`,
};

/** Акцентные цвета сцен. */
export const accent = {
  many: "#8be3a8",
  node: "#ffd36e",
  jar: "#7cc4ff",
  succLeaf: "#9fe0c0",
  divide: "#ffb38a",
  greenhouse: "#ffd36e",
  stripLeaf: "#ff8a8f",
  bush: "#8be3a8",
  mother: "#8be3a8",
  clump: "#c2a8ff",
  potsRow: "#b4dcff",
  spider: "#d8f59a",
  pup: "#62e3d3",
  seed: "#ffd36e",
  sow: "#ffb38a",
  minigreen: "#62e3d3",
  sprouts: "#ff9fe0",
  prick: "#8be3a8",
};

/** CSS-анимации сцен (префикс pg-). */
export const css = `
  .pg-spin { animation: pg-spin 16s linear infinite; }
  .pg-spinf { animation: pg-spin 2.6s linear infinite; }
  @keyframes pg-spin { to { transform: rotate(360deg); } }
  .pg-sway { transform-box: fill-box; transform-origin: 50% 100%; animation: pg-sway 3.6s ease-in-out infinite; }
  @keyframes pg-sway { 0%,100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
  .pg-snipA { animation: pg-snipA 1s ease-in-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-snipA { 0%,100% { transform: rotate(16deg); } 45%,60% { transform: rotate(0); } }
  .pg-snipB { animation: pg-snipB 1s ease-in-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-snipB { 0%,100% { transform: rotate(-16deg); } 45%,60% { transform: rotate(0); } }
  .pg-beat { transform-box: fill-box; transform-origin: center; animation: pg-beat 1.6s ease-in-out infinite; }
  @keyframes pg-beat { 0%,60%,100% { transform: scale(1); } 15% { transform: scale(1.15); } 30% { transform: scale(1); } 45% { transform: scale(1.08); } }
  .pg-bubble { animation: pg-bubble 2.8s ease-in infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-bubble { from { transform: translateY(0); opacity: 0; } 20% { opacity: .9; } to { transform: translateY(calc(var(--h) * -1)); opacity: 0; } }
  .pg-cond { animation: pg-cond 3.4s ease-in infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-cond { 0% { transform: translateY(0); opacity: 0; } 25% { opacity: 1; } 65% { transform: translateY(5px); opacity: 1; } 100% { transform: translateY(36px); opacity: 0; } }
  .pg-merc { transform-box: fill-box; transform-origin: 50% 100%; animation: pg-merc 2.4s cubic-bezier(.3,1.3,.5,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-merc { from { transform: scaleY(.12); } to { transform: scaleY(1); } }
  .pg-knife { animation: pg-knife 1.5s cubic-bezier(.5,0,.4,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-knife { 0% { transform: translateY(-40px); opacity: 0; } 20% { transform: translateY(0); opacity: 1; } 75% { transform: translateY(var(--ky)); opacity: 1; } 100% { transform: translateY(var(--ky)); opacity: 0; } }
  .pg-apart { animation: pg-apart 1s cubic-bezier(.3,0,.2,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-apart { to { transform: translateX(var(--dx)); } }
  .pg-leafoff { transform-box: fill-box; transform-origin: 30% 80%; animation: pg-leafoff 1.6s cubic-bezier(.5,0,.6,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-leafoff { 0% { transform: none; } 25% { transform: rotate(-10deg); } 100% { transform: translate(-6px, 108px) rotate(46deg); } }
  .pg-plant { animation: pg-plant 1s cubic-bezier(.3,1.1,.5,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-plant { from { transform: translateY(var(--py, -150px)); opacity: 0; } 40% { opacity: 1; } to { transform: none; opacity: 1; } }
  .pg-pup { animation: pg-pup 3.4s ease-in-out both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-pup { 0% { transform: none; } 28% { transform: translate(34px, -120px); } 50%,68% { transform: translate(150px, -132px); } 100% { transform: translate(213px, 94px); } }
  .pg-prick { animation: pg-prick 3.2s ease-in-out both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-prick { 0% { transform: none; } 28% { transform: translate(0, -130px); } 70% { transform: translate(235px, -130px); } 100% { transform: translate(235px, 20px); } }
  .pg-stickoff { animation: pg-gone .6s ease both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-gone { to { opacity: 0; } }
  .pg-sprinkle { animation: pg-sprinkle 1.3s cubic-bezier(.5,0,1,1) infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-sprinkle { from { transform: translate(0, 0); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } to { transform: translate(var(--sx), var(--sy)); opacity: 0; } }
  .pg-sink { animation: pg-sink 1.4s cubic-bezier(.4,0,.2,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-sink { from { transform: translateY(-200px); opacity: 0; } 20% { opacity: 1; } to { transform: none; opacity: 1; } }
  .pg-air { animation: pg-air 4s ease-in-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-air { 0%,50%,100% { transform: none; } 65%,85% { transform: translateY(-30px); } }
  .pg-mist { transform-box: fill-box; transform-origin: 100% 50%; animation: pg-mist 1.2s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-mist { from { transform: scale(.2); opacity: 0; } 30% { opacity: 1; } to { transform: scale(1.15); opacity: 0; } }
  .pg-lid { animation: pg-lid 2.8s cubic-bezier(.4,0,.2,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-lid { to { transform: rotate(-22deg); opacity: .8; } }
  .pg-flop { animation: pg-flop 3s ease-in-out infinite; }
  @keyframes pg-flop { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-5deg); } }
  .pg-callus { animation: pg-callus 2.6s ease both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-callus { to { fill: #a0703f; } }
  .pg-tight { animation: pg-tight 2.8s ease-in-out infinite; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-tight { 0%,70%,100% { transform: none; } 76% { transform: translateX(-3px); } 82% { transform: translateX(3px); } 88% { transform: translateX(-2px); } 94% { transform: translateX(2px); } }
  .pg-glow { animation: pg-glow 2.2s ease-in-out infinite; }
  @keyframes pg-glow { 0%,100% { opacity: .3; } 50% { opacity: .7; } }
  .pg-dash { stroke-dasharray: 10 12; animation: pg-dash 1s linear infinite; }
  @keyframes pg-dash { to { stroke-dashoffset: -22; } }
  .pg-ring { transform-box: fill-box; transform-origin: center; animation: pg-ring 1.8s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pg-ring { 0% { transform: scale(1); opacity: 0; } 8% { opacity: .9; } 100% { transform: scale(1.7); opacity: 0; } }
`;
