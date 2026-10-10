/** Сцены видеоуроков (сценарии — src/data/lessons.json): отпуск, питомцы, цветение, словарь. */
import { leaf, stem, pot, label, chip, sparkles, potted, badge, roundel } from "./kit.mjs";

/** Капля (вершина в точке x, y). */
const dropPath = (x, y, s = 1) => `M${x} ${y} q ${7 * s} ${13 * s} 0 ${20 * s} q ${-7 * s} ${-7 * s} 0 ${-20 * s} Z`;

/** Треугольный знак «!» (центр x, y; s — масштаб). */
const warn = (x, y, s, d, color = "#ffd36e", ink = "#3a2a05") => `
  <g transform="translate(${x} ${y}) scale(${s})"><g class="pop" style="--d:${d}">
    <path d="M0 -52 L 52 40 L -52 40 Z" fill="${color}" stroke="${color}" stroke-width="16" stroke-linejoin="round" filter="url(#glow)"/>
    <rect x="-7" y="-26" width="14" height="40" rx="7" fill="${ink}"/><circle cy="28" r="8" fill="${ink}"/>
  </g></g>`;

/** Маска прорезей листа монстеры (координаты листа: черешок в 0,0, лист вверх). */
const monMask = (id) => `
  <mask id="${id}" maskUnits="userSpaceOnUse" x="-260" y="-420" width="520" height="460">
    <rect x="-260" y="-420" width="520" height="460" fill="#fff"/>
    ${[0, 1, 2, 3]
      .map((k) => {
        const y = -110 - k * 52;
        const r = y - 18;
        return `<path d="M-26 ${y} L -215 ${y - 58} L -215 ${y - 30} Z"/><path d="M26 ${r} L 215 ${r - 58} L 215 ${r - 30} Z"/>
          <ellipse cx="-62" cy="${y - 34}" rx="11" ry="6" transform="rotate(-18 -62 ${y - 34})"/>
          <ellipse cx="66" cy="${r - 34}" rx="10" ry="6" transform="rotate(18 66 ${r - 34})"/>`;
      })
      .join("")}
  </mask>`;

/** Лист монстеры с черешком; (x, y) — основание черешка. */
const mon = (x, y, s, r, d, id) => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${(s * 0.84).toFixed(3)} ${s})"><g class="pop" style="--d:${d}">
    <path d="M0 0 C 2 -24 -2 -44 0 -64" stroke="#3f8a3e" stroke-width="12" fill="none" stroke-linecap="round"/>
    <g mask="url(#${id})">
      <path d="M0 -76 C -40 -48 -146 -64 -158 -176 C -170 -296 -84 -372 0 -380 C 84 -372 170 -296 158 -176 C 146 -64 40 -48 0 -76 Z" fill="url(#leafG)"/>
      ${[0, 1, 2, 3, 4]
        .map((k) => {
          const y = -88 - k * 52;
          return `<path d="M-4 ${y} L -150 ${y - 44}" stroke="#14512f" stroke-opacity=".45" stroke-width="3"/><path d="M4 ${y - 16} L 150 ${y - 60}" stroke="#14512f" stroke-opacity=".45" stroke-width="3"/>`;
        })
        .join("")}
      <path d="M0 -76 C -3 -180 -2 -280 0 -350" stroke="#0f3f23" stroke-opacity=".55" stroke-width="6" fill="none"/>
      <path d="M-120 -250 C -140 -220 -146 -190 -140 -160" stroke="#fff" stroke-opacity=".35" stroke-width="10" stroke-linecap="round" fill="none"/>
    </g>
  </g></g>`;

/** Ножницы вокруг шарнира (0, 0), лезвия влево; snip — щёлкают. */
const scissors = (snip = true) => `
  <g class="${snip ? "lf-snipA" : ""}">
    <path d="M0 0 L -74 -12 Q -80 -8 -72 -2 Z" fill="#e8eef2"/>
    <circle cx="30" cy="16" r="13" fill="none" stroke="#ff6b6b" stroke-width="7"/>
    <path d="M0 0 L 20 10" stroke="#ff6b6b" stroke-width="7" stroke-linecap="round"/>
  </g>
  <g class="${snip ? "lf-snipB" : ""}">
    <path d="M0 0 L -74 12 Q -80 8 -72 2 Z" fill="#cfd8dc"/>
    <circle cx="30" cy="-16" r="13" fill="none" stroke="#ff6b6b" stroke-width="7"/>
    <path d="M0 0 L 20 -10" stroke="#ff6b6b" stroke-width="7" stroke-linecap="round"/>
  </g>
  <circle r="5" fill="#8a97a0"/>`;

/** Узкий ланцетный лист (спатифиллум): основание в 0,0, лист вверх. */
const lance = (x, y, s, r, d, g = "leafG") => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><g class="pop" style="--d:${d}">
    <path d="M0 0 C -4 -40 -2 -70 0 -80 C -30 -110 -28 -170 0 -210 C 28 -170 30 -110 0 -80" stroke="#3f8a3e" stroke-width="5" fill="url(#${g})"/>
    <path d="M0 -84 C -2 -130 -1 -170 0 -200" stroke="#0f3f23" stroke-opacity=".5" stroke-width="3" fill="none"/>
    <path d="M-14 -170 C -20 -150 -20 -130 -16 -112" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round" fill="none"/>
  </g></g>`;

/** Ветка декабриста: членики по дуге и бутон на конце. */
const zygo = (x0, y0, a0, curv, n, d, bloom = false) => {
  let x = x0;
  let y = y0;
  let a = a0;
  let out = "";
  for (let i = 0; i < n; i++) {
    const rad = (a * Math.PI) / 180;
    const cx = x + Math.cos(rad) * 17;
    const cy = y + Math.sin(rad) * 17;
    out += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${(a + 90).toFixed(1)})"><g class="pop" style="--d:${(d + i * 0.12).toFixed(2)}">
      <path d="M0 18 C -10 16 -14 8 -12 0 L -16 -10 C -12 -19 12 -19 16 -10 L 12 0 C 14 8 10 16 0 18 Z" fill="url(#leafG)" stroke="#1b5e37" stroke-width="1.5"/>
      <path d="M-6 -8 C -8 0 -6 8 -3 12" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g></g>`;
    x += Math.cos(rad) * 34;
    y += Math.sin(rad) * 34;
    a += curv;
  }
  const bd = (d + n * 0.12 + 0.3).toFixed(2);
  out += `<g transform="translate(${(x - Math.cos((a * Math.PI) / 180) * 2).toFixed(1)} ${y.toFixed(1)}) rotate(${(a - curv + 90).toFixed(1)})"><g class="pop" style="--d:${bd}">
    ${
      bloom
        ? `<path d="M0 0 C -14 -16 -24 -40 -34 -58 C -16 -50 -6 -34 0 -20 C 6 -34 16 -50 34 -58 C 24 -40 14 -16 0 0 Z" fill="url(#lf-buG)"/>
           <path d="M0 -12 C -4 -30 -2 -52 0 -70 C 2 -52 4 -30 0 -12 Z" fill="#ff8fc0"/>
           <path d="M0 -20 L -4 -74 M0 -20 L 4 -74" stroke="#fff3fb" stroke-width="2"/>`
        : `<path d="M0 0 C -11 -8 -12 -30 0 -46 C 12 -30 11 -8 0 0 Z" fill="url(#lf-buG)"/>
           <path d="M-3 -10 C -6 -20 -5 -30 -2 -38" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>`
    }
    <path d="M-7 2 C -6 -6 6 -6 7 2 Z" fill="#2f9d5c"/>
  </g></g>`;
  return out;
};

/** Ребристый столбик молочая от yb до yt (скруглённая или обломанная верхушка). */
const euCol = (x, yb, yt, w, d, broken = false) => {
  const top = broken
    ? `L ${x - w / 2} ${yt} L ${x - w / 4} ${yt - 9} L ${x} ${yt + 3} L ${x + w / 4} ${yt - 11} L ${x + w / 2} ${yt}`
    : `L ${x - w / 2} ${yt + w / 2} Q ${x - w / 2} ${yt} ${x} ${yt} Q ${x + w / 2} ${yt} ${x + w / 2} ${yt + w / 2}`;
  const spines = [];
  for (let y = yb - 26; y > yt + 20; y -= 28) spines.push(y);
  return `<g class="grow" style="--d:${d}">
    <path d="M${x - w / 2} ${yb} ${top} L ${x + w / 2} ${yb} Z" fill="url(#lf-euG)"/>
    <path d="M${x - w / 6} ${yb} L ${x - w / 6} ${yt + 12} M${x + w / 6} ${yb} L ${x + w / 6} ${yt + 12}" stroke="#bff0a8" stroke-opacity=".45" stroke-width="3"/>
    ${spines.map((y) => `<circle cx="${x - w / 2}" cy="${y}" r="3.5" fill="#7a2f1e"/><circle cx="${x + w / 2}" cy="${y - 12}" r="3.5" fill="#7a2f1e"/>`).join("")}
    ${broken ? `<ellipse cx="${x}" cy="${yt - 2}" rx="${w / 2 - 3}" ry="6" fill="#f6f3ea"/>` : ""}
  </g>`;
};

/** Маленький листочек молочая на верхушке. */
const euLeaf = (x, y, r, d) =>
  `<g transform="translate(${x} ${y}) rotate(${r})"><g class="pop" style="--d:${d}"><path d="M0 0 C -9 -10 -8 -26 0 -34 C 8 -26 9 -10 0 0 Z" fill="url(#leafG2)"/></g></g>`;

const WICK = "M458 540 C 458 470 456 432 432 414 C 404 394 330 446 282 432 C 256 424 242 418 240 402";

export const art = {
  // ---- Урок 20: отпуск ----
  away: `
    <defs>
      <radialGradient id="lf-awShade" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#020c07" stop-opacity=".75"/><stop offset=".6" stop-color="#020c07" stop-opacity=".5"/><stop offset="1" stop-color="#020c07" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="fade" style="--d:0">
      <rect x="34" y="70" width="128" height="400" rx="14" fill="#fff4cf" filter="url(#glow)"/>
      <path d="M98 70 L98 470 M34 260 L162 260" stroke="#d8c9a3" stroke-width="7"/>
      <rect x="34" y="70" width="128" height="400" rx="14" fill="none" stroke="#e9e1d2" stroke-width="10"/>
    </g>
    <path class="beam" d="M162 90 L 470 540 L 162 540 Z" fill="url(#beamG)" opacity=".5"/>
    <g class="fade" style="--d:2.6"><ellipse cx="440" cy="330" rx="200" ry="300" fill="url(#lf-awShade)"/></g>
    <rect x="20" y="540" width="560" height="8" rx="4" fill="#ffffff" opacity=".16"/>
    <g class="fade" style="--d:3.8"><path d="M98 474 L 202 474 L 190 540 L 110 540 Z" fill="none" stroke="#ffffff" stroke-opacity=".4" stroke-width="3" stroke-dasharray="9 9"/></g>
    <g class="lf-slide" style="--d:2.5;--dx:280px">
      <g class="lf-sway">${potted(150, 540, 1.15, 0.2, "leafy")}</g>
      <ellipse cx="150" cy="452" rx="44" ry="7" fill="#6b4429"/>
      <g class="fade" style="--d:1.4"><ellipse cx="150" cy="452" rx="44" ry="7" fill="#3a2414"/></g>
    </g>
    <g class="lf-out" style="--d:2.1">
      <g transform="translate(270 170) rotate(-30)"><g class="pop" style="--d:.3">
        <path d="M-10 -40 L 70 -40 L 80 42 L -20 42 Z" fill="#7cc4ff"/>
        <path d="M2 -30 L 10 30" stroke="#ffffff" stroke-opacity=".45" stroke-width="8" stroke-linecap="round"/>
        <path d="M14 -40 C 14 -84 66 -84 66 -40" stroke="#4d8fd6" stroke-width="10" fill="none"/>
        <path d="M-14 22 L -84 -14" stroke="#7cc4ff" stroke-width="13" stroke-linecap="round"/>
        <rect x="-104" y="-30" width="22" height="34" rx="6" fill="#4d8fd6" transform="rotate(-27 -93 -13)"/>
      </g></g>
      ${[0, 1, 2, 3, 4, 5]
        .map((i) => `<path class="drop" style="--d:${0.9 + i * 0.18}" d="${dropPath(160 + (i % 3) * 9, 200)}" fill="#9fd6ff"/>`)
        .join("")}
    </g>
    <g class="fade" style="--d:3.8">
      <path d="${dropPath(440, 92, 1.3)}" fill="#7cc4ff"/>
      <text x="466" y="116" fill="#b4dcff" font-family="Manrope" font-weight="800" font-size="24">в тени</text>
      <text x="440" y="148" fill="#b4dcff" font-family="Manrope" font-weight="800" font-size="24" text-anchor="middle">пьют меньше</text>
    </g>
    <g class="fade" style="--d:3.4">
      <path d="M150 572 L 430 572" stroke="#ffd36e" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>
      <path d="M164 562 L 150 572 L 164 582 M416 562 L 430 572 L 416 582" stroke="#ffd36e" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>
    <g class="fade" style="--d:3.6">
      <rect x="226" y="548" width="128" height="46" rx="23" fill="#2a2208"/>
      <text x="290" y="582" fill="#ffd36e" font-family="Unbounded" font-weight="900" font-size="26" text-anchor="middle">1–2 м</text>
    </g>
`,

  wickPot: `
    <defs>
      <clipPath id="lf-wkIn"><path d="M196 340 L 284 340 L 276 396 L 204 396 Z"/></clipPath>
    </defs>
    <rect x="20" y="560" width="560" height="8" rx="4" fill="#ffffff" opacity=".16"/>
    <g class="rise" style="--d:.1">
      <path d="M180 410 L 162 560 M300 410 L 318 560" stroke="#cfd8dc" stroke-width="8" stroke-linecap="round"/>
      <path d="M172 486 L 308 486" stroke="#cfd8dc" stroke-width="6" stroke-linecap="round"/>
      <rect x="166" y="400" width="148" height="12" rx="6" fill="#e3eaee"/>
    </g>
    ${potted(240, 400, 1.2, 0.3, "leafy")}
    <g class="fade" style="--d:.9">
      <path d="M196 340 L 284 340 L 276 396 L 204 396 Z" fill="url(#soilG)" stroke="#8e3f22" stroke-width="3"/>
      <g clip-path="url(#lf-wkIn)" opacity=".55"><rect class="flood" style="--d:2.8" x="190" y="340" width="100" height="60" fill="url(#waterG)"/></g>
    </g>
    <g class="rise" style="--d:.4">
      <rect x="390" y="456" width="132" height="98" rx="6" fill="url(#waterG)" opacity=".7"/>
      <path d="M380 420 L 380 540 Q 380 560 400 560 L 512 560 Q 532 560 532 540 L 532 420" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".75" stroke-width="5"/>
      <path d="M396 470 Q 412 464 428 470 T 460 470 T 492 470 T 516 470" stroke="#e8f5ff" stroke-opacity=".6" stroke-width="3" fill="none"/>
    </g>
    <path d="${WICK}" class="draw" style="--d:1" pathLength="1" stroke="#efe6d2" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path class="draw" style="--d:1.6" pathLength="1" d="M240 402 C 236 384 246 366 238 346" stroke="#efe6d2" stroke-width="7" fill="none" stroke-linecap="round"/>
    <g class="fade" style="--d:2.2">
      <path d="${WICK}" class="lf-flow" pathLength="1" stroke="#9fe6ff" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="0.001 0.0490" filter="url(#glow)"/>
      ${[0, 1, 2].map((i) => `<path class="lf-up" style="--d:${2.4 + i * 0.5}" d="${dropPath(239, 388, 0.6)}" fill="#9fe6ff"/>`).join("")}
    </g>
    <text class="fade" style="--d:1.8" x="456" y="530" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="22" text-anchor="middle">вода</text>
    <g class="fade" style="--d:2">
      <path d="M440 352 L 436 402" stroke="#efe6d2" stroke-width="3" stroke-dasharray="4 6"/>
      <text x="450" y="300" fill="#efe6d2" font-family="Manrope" font-weight="800" font-size="22" text-anchor="middle">синтетический</text>
      <text x="450" y="330" fill="#efe6d2" font-family="Manrope" font-weight="800" font-size="22" text-anchor="middle">шнур</text>
    </g>
    ${sparkles(
      [
        [330, 200, 3.0],
        [100, 300, 3.6],
      ],
      "#62e3d3",
    )}
    ${chip(300, 600, "вода идёт по шнуру", "#62e3d3", 3.2)}`,

  flood: `
    <defs>
      <clipPath id="lf-flSoil"><path d="M110 318 L 310 318 L 290 522 L 130 522 Z"/></clipPath>
    </defs>
    <g class="rise" style="--d:0">
      <ellipse cx="210" cy="566" rx="170" ry="12" fill="#000" opacity=".4" filter="url(#soft)"/>
      <path d="M56 506 L 364 506 L 346 558 L 74 558 Z" fill="#8e3f22"/>
    </g>
    <g opacity=".85"><rect class="flood" style="--d:.6" x="64" y="500" width="292" height="44" rx="6" fill="url(#waterG)"/></g>
    <g class="rise" style="--d:.2">
      <path d="M95 300 L 325 300 L 300 535 L 120 535 Z" fill="url(#potG)"/>
      <path d="M110 318 L 310 318 L 290 522 L 130 522 Z" fill="url(#soilG)"/>
      <rect x="83" y="276" width="254" height="34" rx="10" fill="#c4643a"/>
      <rect x="83" y="276" width="254" height="8" rx="4" fill="#f0a072" opacity=".6"/>
    </g>
    <g clip-path="url(#lf-flSoil)">
      <g opacity=".6"><rect class="flood" style="--d:1.2" x="104" y="430" width="212" height="96" fill="url(#waterG)"/></g>
      ${Array.from({ length: 7 }, (_, i) => `<circle class="lf-bub" style="--d:${2 + i * 0.45}" cx="${140 + ((i * 53) % 140)}" cy="516" r="${4 + (i % 3)}" fill="#e8f5ff" opacity=".8"/>`).join("")}
    </g>
    <g class="lf-rot" style="--d:2.2" stroke="#f3ead8" stroke-width="5" fill="none" stroke-linecap="round">
      ${[
        "M210 322 C 180 370 160 420 150 480",
        "M210 322 C 236 380 262 420 270 486",
        "M210 322 C 204 390 214 440 206 500",
        "M196 360 C 176 380 150 400 140 420",
        "M224 370 C 250 380 272 400 284 410",
      ]
        .map((p, i) => `<path class="draw" style="--d:${0.8 + i * 0.15}" pathLength="1" d="${p}"/>`)
        .join("")}
    </g>
    <path d="M56 540 L 364 540 L 346 558 L 74 558 Z" fill="url(#potG)"/>
    ${stem("M210 300 C 206 250 214 210 210 160", 0.6)}
    ${leaf(210, 168, 0.48, 2, 0.9)}${leaf(212, 250, 0.4, 52, 1.1, "leafG2")}${leaf(208, 226, 0.42, -50, 1.3)}
    <g class="fade" style="--d:3.6">${leaf(212, 250, 0.4, 66, 0, "leafY")}${leaf(208, 226, 0.42, -64, 0, "leafY")}</g>
    <g filter="url(#glow)">
      <path class="draw" style="--d:2.8" pathLength="1" d="M108 300 L 312 536" stroke="#ff4d4f" stroke-width="22" stroke-linecap="round"/>
      <path class="draw" style="--d:3.1" pathLength="1" d="M312 300 L 108 536" stroke="#ff4d4f" stroke-width="22" stroke-linecap="round"/>
    </g>
    ${label(210, 612, "не заливать впрок", "#ff6b6b", 3.4, 28)}
    <g class="lf-sway">${potted(468, 462, 1.4, 1.2, "zz")}</g>
    <g class="rise" style="--d:2.4">
      <rect x="374" y="492" width="196" height="96" rx="22" fill="#ffffff14" stroke="#8be3a8" stroke-opacity=".6" stroke-width="2"/>
      <text x="472" y="534" fill="#8be3a8" font-family="Unbounded" font-weight="900" font-size="24" text-anchor="middle">3–4 нед.</text>
      <text x="472" y="568" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="20" text-anchor="middle">без полива</text>
    </g>
    ${badge(564, 494, true, 3, 22)}`,

  // ---- Урок 21: питомцы ----
  aroid: `
    <defs>
      ${monMask("lf-arMask")}
      <clipPath id="lf-arClip"><circle r="100"/></clipPath>
      <radialGradient id="lf-arCell" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#3f9a5c"/><stop offset="1" stop-color="#14512f"/></radialGradient>
    </defs>
    ${mon(196, 530, 0.95, -10, 0.2, "lf-arMask")}
    <g class="fade" style="--d:1.4">
      <circle cx="304" cy="318" r="22" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="6 6"/>
      <path d="M318 300 L 362 214 M326 330 L 382 346" stroke="#ffffff" stroke-opacity=".5" stroke-width="3"/>
    </g>
    <g transform="translate(450 280)"><g class="pop" style="--d:1.6"><g class="lf-bob">
      <path d="M68 68 L 122 122" stroke="#5b3a22" stroke-width="26" stroke-linecap="round"/>
      <path d="M68 68 L 122 122" stroke="#8a5a34" stroke-width="12" stroke-linecap="round"/>
      <g clip-path="url(#lf-arClip)">
        <rect x="-100" y="-100" width="200" height="200" fill="url(#lf-arCell)"/>
        ${[
          [-60, -60],
          [0, -72],
          [60, -54],
          [-78, 4],
          [-20, -4],
          [42, 6],
          [86, 20],
          [-56, 66],
          [10, 64],
          [70, 76],
        ]
          .map(
            ([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="34" ry="28" fill="none" stroke="#8be3a8" stroke-opacity=".35" stroke-width="3"/>`,
          )
          .join("")}
        ${[
          [-30, -24, 28],
          [36, 34, -32],
          [-34, 52, 64],
        ]
          .map(
            ([cx, cy, r], b) => `<g transform="translate(${cx} ${cy}) rotate(${r})">
            ${[-12, -8, -4, 0, 4, 8, 12]
              .map(
                (o, k) =>
                  `<path class="lf-glint" style="--d:${(b * 0.5 + k * 0.17).toFixed(2)}" d="M${o} ${-40 + (k % 2) * 6} L ${o * 0.6} ${42 - (k % 3) * 5}" stroke="#f4fbff" stroke-width="3.5" stroke-linecap="round" filter="url(#glow)"/>`,
              )
              .join("")}
          </g>`,
          )
          .join("")}
      </g>
      <circle r="100" fill="url(#glassG)"/>
      <circle r="100" fill="none" stroke="#e9e1d2" stroke-width="12"/>
    </g></g></g>
    ${warn(548, 116, 0.75, 2.4)}
    ${label(436, 434, "кристаллы-иглы", "#ffffff", 2.2, 22)}
    ${sparkles(
      [
        [388, 210, 2.6],
        [500, 360, 3.2],
      ],
      "#ffffff",
    )}
    ${chip(150, 560, "монстера", "#ffd36e", 3)}${chip(420, 560, "диффенбахия", "#ffd36e", 3.3)}${chip(300, 600, "спатифиллум", "#ffd36e", 3.6)}`,

  euphorbia: `
    <defs>
      <linearGradient id="lf-euG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b5e37"/><stop offset=".45" stop-color="#5cc27e"/><stop offset="1" stop-color="#14512f"/></linearGradient>
    </defs>
    ${pot(200, 436, 180, 116, 0)}
    ${euCol(150, 420, 216, 34, 0.4)}
    ${euCol(205, 420, 132, 42, 0.5)}
    ${euCol(262, 420, 288, 36, 0.6, true)}
    ${euLeaf(150, 222, -20, 1.1)}${euLeaf(146, 236, -60, 1.2)}${euLeaf(205, 140, 10, 1.2)}${euLeaf(200, 152, -40, 1.3)}${euLeaf(210, 156, 50, 1.3)}
    <g transform="translate(262 284)"><g class="lf-bend" style="--d:1.2">
      <path d="M-18 0 L -9 -9 L 0 3 L 9 -11 L 18 0 L 18 -86 Q 18 -104 0 -104 Q -18 -104 -18 -86 Z" fill="url(#lf-euG)"/>
      <path d="M-6 -2 L -6 -90 M6 -2 L 6 -90" stroke="#bff0a8" stroke-opacity=".45" stroke-width="3"/>
      ${euLeaf(0, -100, 10, 0.9)}${euLeaf(-4, -92, -50, 1)}
    </g></g>
    <g transform="translate(266 286)"><g class="lf-ooze" style="--d:2">
      <path d="M-14 -2 C -14 -14 14 -14 14 -2 C 14 10 6 18 0 22 C -6 18 -14 10 -14 -2 Z" fill="#fbf9f2" filter="url(#glow)"/>
      <ellipse cx="-5" cy="-3" rx="4" ry="3" fill="#fff"/>
    </g></g>
    ${[0, 1, 2].map((i) => `<path class="drip" style="--d:${2.8 + i * 0.6}" d="M${279 - i * 4} 304 q 6 11 0 17 q -6 -6 0 -17 Z" fill="#fbf9f2"/>`).join("")}
    <g class="fade" style="--d:2.4">
      <path class="lf-dash" d="M296 270 C 340 230 370 200 398 186" stroke="#ff9f6e" stroke-width="4" stroke-dasharray="8 10" fill="none" stroke-linecap="round"/>
      <path class="lf-dash" d="M296 306 C 340 330 370 360 398 372" stroke="#ff9f6e" stroke-width="4" stroke-dasharray="8 10" fill="none" stroke-linecap="round"/>
    </g>
    ${roundel(
      476,
      170,
      `<g transform="translate(0 6)">
        ${[-19, -7, 5, 17].map((x, i) => `<rect x="${x - 5}" y="${-38 + Math.abs(i - 1.5) * 5}" width="11" height="34" rx="5.5" fill="#f2c6a6"/>`).join("")}
        <path d="M-24 -10 L 24 -10 L 24 14 Q 24 30 2 30 Q -20 30 -24 14 Z" fill="#f2c6a6"/>
        <path d="M-22 4 C -34 -2 -40 -14 -34 -20 C -26 -18 -18 -8 -16 0 Z" fill="#e8b48f"/>
      </g>`,
      "кожа",
      "#ff9f6e",
      2.8,
    )}
    ${roundel(
      476,
      380,
      `<g class="blink"><path d="M-36 0 Q 0 -32 36 0 Q 0 32 -36 0 Z" fill="#ffffff"/><circle r="15" fill="#4a90e2"/><circle r="7" fill="#0d1f17"/><circle cx="5" cy="-5" r="3" fill="#fff"/></g>`,
      "глаза",
      "#ff9f6e",
      3.2,
    )}
    ${warn(522, 128, 0.42, 3.4, "#ff6b6b", "#fff")}${warn(522, 338, 0.42, 3.6, "#ff6b6b", "#fff")}
    ${chip(300, 600, "едкий млечный сок", "#ff9f6e", 3.8)}`,

  lily: `
    <defs>
      <radialGradient id="lf-lyP" cx=".5" cy="1" r="1"><stop offset="0" stop-color="#ffd1e6"/><stop offset=".55" stop-color="#ffffff"/><stop offset="1" stop-color="#ffe3ef"/></radialGradient>
      <linearGradient id="lf-lyCat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc480"/><stop offset="1" stop-color="#c8662a"/></linearGradient>
    </defs>
    ${pot(150, 474, 128, 84, 0)}
    ${stem("M150 458 C 146 380 160 300 172 220", 0.4, 9)}
    ${[
      [148, 420, -38, 0.6],
      [152, 380, 34, 0.75],
      [154, 334, -30, 0.9],
      [162, 290, 30, 1.05],
    ]
      .map(
        ([x, y, r, d]) =>
          `<g transform="translate(${x} ${y}) rotate(${r})"><g class="pop" style="--d:${d}"><path d="M0 0 C -10 -30 -8 -70 0 -100 C 8 -70 10 -30 0 0 Z" fill="url(#leafG)"/></g></g>`,
      )
      .join("")}
    <g transform="translate(176 206)"><g class="pop" style="--d:1.1">
      ${[30, 90, 150, 210, 270, 330]
        .map(
          (r, i) => `<g transform="rotate(${r})">
          <path d="M0 0 C -30 -26 -30 -70 -4 -100 C 2 -96 8 -94 14 -96 C 30 -66 26 -26 0 0 Z" fill="url(#lf-lyP)" stroke="#f3b7d0" stroke-width="2"/>
          <path d="M2 -12 L 4 -78" stroke="#ff7eb0" stroke-width="4" stroke-linecap="round" opacity="${i % 2 ? 0.7 : 0.9}"/>
          ${[30, 46, 60].map((y) => `<circle cx="${-8 + (y % 3)}" cy="${-y}" r="2.5" fill="#c2185b"/>`).join("")}
        </g>`,
        )
        .join("")}
      ${[0, 60, 120, 180, 240, 300]
        .map(
          (r) => `<g transform="rotate(${r + 10})"><path d="M0 0 L 0 -54" stroke="#cbe6a0" stroke-width="3"/>
          <ellipse cy="-58" rx="5" ry="11" fill="#d9581a" filter="url(#glow)"/></g>`,
        )
        .join("")}
      <circle r="9" fill="#9bd16a"/>
    </g></g>
    ${Array.from(
      { length: 18 },
      (_, i) =>
        `<circle class="rain" style="--d:${1.6 + (i % 6) * 0.22 + Math.floor(i / 6) * 0.45};--dx:${130 + ((i * 41) % 120)}px;animation-duration:2.6s" cx="${160 + ((i * 23) % 40)}" cy="${214 + ((i * 17) % 30)}" r="${4 + (i % 3)}" fill="#ffa040" filter="url(#glow)"/>`,
    ).join("")}
    <g transform="translate(450 566)"><g class="rise" style="--d:.8">
      <g transform="translate(46 -16)"><g class="lf-tail">
        <path d="M0 0 C 44 10 72 -6 70 -56 C 69 -80 54 -90 44 -82" stroke="url(#lf-lyCat)" stroke-width="16" fill="none" stroke-linecap="round"/>
      </g></g>
      <path d="M-62 0 C -78 -70 -56 -140 0 -150 C 56 -140 78 -70 62 0 Z" fill="url(#lf-lyCat)"/>
      <ellipse cx="0" cy="-74" rx="26" ry="50" fill="#fff2dc" opacity=".75"/>
      <path d="M-58 -60 L -40 -54 M-62 -34 L -42 -30 M58 -60 L 40 -54 M62 -34 L 42 -30" stroke="#a9521f" stroke-width="6" stroke-linecap="round"/>
      <rect x="-30" y="-56" width="24" height="56" rx="12" fill="#ffd9a8"/><rect x="6" y="-56" width="24" height="56" rx="12" fill="#ffd9a8"/>
      <path d="M-50 -196 L -42 -252 L -10 -216 Z M50 -196 L 42 -252 L 10 -216 Z" fill="url(#lf-lyCat)"/>
      <path d="M-40 -206 L -38 -236 L -20 -216 Z M40 -206 L 38 -236 L 20 -216 Z" fill="#ff9fb8"/>
      <circle cy="-172" r="54" fill="url(#lf-lyCat)"/>
      <path d="M-14 -222 L -10 -204 M0 -224 L 0 -206 M14 -222 L 10 -204" stroke="#a9521f" stroke-width="5" stroke-linecap="round"/>
      <ellipse cy="-150" rx="26" ry="18" fill="#fff2dc"/>
      <g class="blink">
        <ellipse cx="-20" cy="-178" rx="11" ry="13" fill="#b6e86a"/><ellipse cx="20" cy="-178" rx="11" ry="13" fill="#b6e86a"/>
        <ellipse cx="-20" cy="-178" rx="4" ry="10" fill="#1a1a1a"/><ellipse cx="20" cy="-178" rx="4" ry="10" fill="#1a1a1a"/>
      </g>
      <path d="M-6 -160 L 6 -160 L 0 -152 Z" fill="#ff7c9c"/>
      <path d="M0 -152 Q -6 -144 -12 -146 M0 -152 Q 6 -144 12 -146" stroke="#7a3a14" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M-22 -154 L -62 -160 M-22 -150 L -60 -144 M22 -154 L 62 -160 M22 -150 L 60 -144" stroke="#ffffff" stroke-opacity=".8" stroke-width="2"/>
    </g></g>
    <g transform="translate(452 134)"><g class="pop" style="--d:2.2"><g class="lf-throb">
      <path d="M0 -62 L 64 50 L -64 50 Z" fill="#e5484d" stroke="#e5484d" stroke-width="18" stroke-linejoin="round" filter="url(#glow)"/>
      <path d="M0 -44 L 50 42 L -50 42 Z" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-linejoin="round"/>
      <rect x="-8" y="-28" width="16" height="48" rx="8" fill="#fff"/><circle cy="34" r="9" fill="#fff"/>
    </g></g></g>
    <g class="pop" style="--d:2.8">
      <rect x="92" y="568" width="416" height="52" rx="26" fill="#e5484d" filter="url(#glow)"/>
      <text x="300" y="603" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="26" text-anchor="middle">смертельно для кошек</text>
    </g>`,

  // ---- Урок 22: цветение ----
  snug: `
    <defs>
      <clipPath id="lf-snSoil"><path d="M308 318 L 532 318 L 512 524 L 328 524 Z"/></clipPath>
      <linearGradient id="lf-snSp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f1f7ef"/><stop offset="1" stop-color="#c9e6cf"/></linearGradient>
    </defs>
    ${pot(150, 432, 132, 100, 0)}
    ${[-52, -30, -10, 12, 34, 54].map((r, i) => lance(150, 414, 0.72 + (i % 2) * 0.1, r, 0.4 + i * 0.1)).join("")}
    ${[
      [126, 190, -8, 1.3],
      [178, 206, 10, 1.6],
    ]
      .map(
        ([x, y, r, d]) => `
      <path class="draw" style="--d:${d - 0.4}" pathLength="1" d="M150 414 C 150 330 ${x} 290 ${x} ${y}" stroke="#4f9a4a" stroke-width="5" fill="none" stroke-linecap="round"/>
      <g transform="translate(${x} ${y}) rotate(${r})"><g class="pop" style="--d:${d}"><g class="lf-sway">
        <path d="M0 6 C -34 -8 -38 -60 0 -100 C 38 -60 34 -8 0 6 Z" fill="url(#lf-snSp)"/>
        <path d="M0 -6 C -4 -40 -2 -70 0 -92" stroke="#c9e6cf" stroke-width="2" fill="none"/>
        <rect x="-6" y="-46" width="12" height="44" rx="6" fill="#f4e3a0"/>
      </g></g></g>`,
      )
      .join("")}
    ${sparkles(
      [
        [90, 170, 2.4],
        [214, 150, 2.9],
        [70, 300, 3.4],
      ],
      "#ffffff",
    )}
    ${badge(150, 484, true, 2.4, 28)}
    ${label(150, 598, "тесно — цветёт", "#8be3a8", 2.6, 24)}
    <g class="rise" style="--d:.3">
      <ellipse cx="420" cy="552" rx="170" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="M290 300 L 550 300 L 520 540 L 320 540 Z" fill="url(#potG)"/>
      <path d="M308 318 L 532 318 L 512 524 L 328 524 Z" fill="url(#soilG)"/>
      <rect x="278" y="276" width="284" height="36" rx="10" fill="#c4643a"/>
      <rect x="278" y="276" width="284" height="8" rx="4" fill="#f0a072" opacity=".6"/>
    </g>
    <g clip-path="url(#lf-snSoil)" stroke="#f3ead8" stroke-width="4" fill="none" stroke-linecap="round">
      ${[
        "M420 320 C 380 360 340 400 330 470",
        "M420 320 C 470 360 510 400 514 470",
        "M420 320 C 410 400 430 460 418 520",
        "M420 320 C 360 340 330 360 316 380",
        "M420 320 C 480 340 510 350 528 370",
        "M380 360 C 360 420 380 470 360 516",
        "M462 360 C 484 420 462 470 480 516",
        "M400 420 C 370 440 350 470 340 500",
        "M440 420 C 470 450 490 470 500 500",
      ]
        .map((p, i) => `<path class="draw" style="--d:${0.9 + i * 0.3}" pathLength="1" d="${p}"/>`)
        .join("")}
    </g>
    <g class="lf-sway">${[-60, -40, -20, 0, 20, 40, 60].map((r, i) => lance(420, 300, 0.78 + (i % 2) * 0.12, r, 0.6 + i * 0.1, i % 2 ? "leafG2" : "leafG")).join("")}</g>
    ${badge(420, 82, false, 3, 30)}
    ${label(420, 598, "просторно — листья", "#ff9f9f", 3.2, 24)}`,

  buds: `
    <defs>
      <linearGradient id="lf-buG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#c2185b"/><stop offset=".6" stop-color="#ff5fa2"/><stop offset="1" stop-color="#ffc2dc"/></linearGradient>
    </defs>
    ${pot(190, 446, 160, 104, 0)}
    ${zygo(140, 426, -140, -16, 4, 0.4)}
    ${zygo(166, 420, -112, -12, 5, 0.5)}
    ${zygo(190, 418, -90, -4, 5, 0.6, true)}
    ${zygo(214, 420, -68, 12, 5, 0.5)}
    ${zygo(240, 426, -40, 16, 4, 0.4)}
    ${sparkles(
      [
        [60, 300, 2.2],
        [300, 250, 2.7],
        [190, 120, 3.2],
      ],
      "#ffb3d1",
    )}
    ${roundel(
      470,
      142,
      `<path d="M0 -26 A 26 26 0 1 1 -26 0" stroke="#ffd36e" stroke-width="7" fill="none" stroke-linecap="round"/>
       <path d="M-36 4 L -26 -10 L -15 4" stroke="#ffd36e" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
       <path d="M-38 38 L 38 -38" stroke="#ff4d4f" stroke-width="9" stroke-linecap="round"/>`,
      "не поворачивать",
      "#ff6b6b",
      2,
    )}
    ${stem("M412 560 C 412 500 440 440 458 380", 1.2, 6)}
    <g class="lf-snipoff" style="--d:3.6">
      <path d="M452 400 C 458 380 466 360 470 340" stroke="#4f9a4a" stroke-width="6" fill="none" stroke-linecap="round"/>
      <g transform="translate(470 336) rotate(40)"><g class="pop" style="--d:1.5">
        <path d="M0 0 C -16 6 -30 22 -26 40 C -14 30 -6 22 0 12 C 6 22 14 30 26 40 C 30 22 16 6 0 0 Z" fill="#9b6b6f"/>
        <path d="M0 4 C -6 18 -4 34 0 44 C 4 34 6 18 0 4 Z" fill="#7d5054"/>
      </g></g>
    </g>
    <g transform="translate(450 402) rotate(-24)"><g class="pop" style="--d:2.6">${scissors()}</g></g>
    ${label(470, 540, "отцветшие —", "#ffffff", 3, 22)}${label(470, 568, "удалять", "#ffffff", 3, 22)}
    ${chip(190, 614, "бутоны не трогать", "#ffb3d1", 3.4)}`,

  // ---- Урок 23: словарь ----
  book: `
    <defs>
      <linearGradient id="lf-bkPgL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbf6e8"/><stop offset=".85" stop-color="#efe6cc"/><stop offset="1" stop-color="#cdbf9a"/></linearGradient>
      <linearGradient id="lf-bkPgR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fbf6e8"/><stop offset=".85" stop-color="#efe6cc"/><stop offset="1" stop-color="#cdbf9a"/></linearGradient>
      <radialGradient id="lf-bkGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".7"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="fade" style="--d:.8"><g class="lf-glowp"><ellipse cx="300" cy="300" rx="260" ry="170" fill="url(#lf-bkGlow)"/></g></g>
    <g class="rise" style="--d:0">
      <ellipse cx="300" cy="510" rx="240" ry="18" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="M300 370 C 236 342 136 342 64 362 L 64 500 C 136 482 236 482 300 510 C 364 482 464 482 536 500 L 536 362 C 464 342 364 342 300 370 Z" fill="#1f6b3e"/>
      <path d="M300 362 C 240 334 146 334 80 352 L 80 486 C 146 468 240 468 300 496 Z" fill="#e3d6b4"/>
      <path d="M300 362 C 360 334 454 334 520 352 L 520 486 C 454 468 360 468 300 496 Z" fill="#e3d6b4"/>
      <path d="M300 354 C 242 326 150 326 90 344 L 90 476 C 150 458 242 458 300 486 Z" fill="url(#lf-bkPgL)"/>
      <path d="M300 354 C 358 326 450 326 510 344 L 510 476 C 450 458 358 458 300 486 Z" fill="url(#lf-bkPgR)"/>
      <path d="M300 354 L 300 486" stroke="#b8a77c" stroke-width="2"/>
      <text x="196" y="380" fill="#14512f" font-family="Unbounded" font-weight="900" font-size="24" text-anchor="middle">Словарь</text>
      <text x="404" y="380" fill="#14512f" font-family="Unbounded" font-weight="900" font-size="24" text-anchor="middle">садовода</text>
      ${[0, 1, 2, 3]
        .map(
          (k) =>
            `<path d="M118 ${404 + k * 18} C 180 ${396 + k * 18} 240 ${400 + k * 18} 280 ${412 + k * 18}" stroke="#bdb08c" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/><path d="M320 ${412 + k * 18} C 360 ${400 + k * 18} 420 ${396 + k * 18} ${482 - (k % 2) * 30} ${404 + k * 18}" stroke="#bdb08c" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`,
        )
        .join("")}
    </g>
    <g transform="translate(372 476) rotate(168)">
      <g class="grow" style="--d:1"><rect x="-5" y="-30" width="10" height="34" rx="4" fill="#3f8a3e"/></g>
      ${leaf(0, -24, 0.4, 0, 1.2, "leafG2")}
    </g>
    ${[
      ["узел", 200, -110, -270, "#8be3a8"],
      ["дренаж", 400, 110, -270, "#7cc4ff"],
      ["субстрат", 210, -40, -270, "#ffd36e"],
      ["пазуха", 390, 40, -270, "#ffb3d1"],
      ["хлороз", 190, -150, -270, "#c2f07a"],
      ["детка", 410, 150, -270, "#ff9f6e"],
    ]
      .map(
        ([w, x, dx, dy, c], i) =>
          `<text class="lf-fly" style="--d:${0.9 + i * 0.75};--dx:${dx}px;--dy:${dy}px" x="${x}" y="360" fill="${c}" font-family="Manrope" font-weight="800" font-size="30" text-anchor="middle">${w}</text>`,
      )
      .join("")}
    ${[
      [300, -20, 1.3, -30],
      [300, 24, 2.8, 40],
      [300, -6, 4.3, 10],
    ]
      .map(
        ([x, dx, d, r]) =>
          `<g transform="translate(${x} 350)"><g class="lf-fly" style="--d:${d};--dx:${dx}px;--dy:-240px"><path transform="rotate(${r})" d="M0 0 C -14 -10 -16 -34 0 -46 C 16 -34 14 -10 0 0 Z" fill="url(#leafG)"/></g></g>`,
      )
      .join("")}
    ${sparkles(
      [
        [80, 300, 1.8],
        [520, 280, 2.4],
        [140, 520, 3],
        [470, 540, 3.4],
      ],
      "#ffd36e",
    )}
    ${chip(300, 600, "слова из советов", "#ffd36e", 2.6)}`,

  aerial: `
    <defs>
      ${monMask("lf-aeMask")}
      <linearGradient id="lf-aePole" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b3a22"/><stop offset=".5" stop-color="#7a8a3a"/><stop offset="1" stop-color="#3e3218"/></linearGradient>
    </defs>
    ${pot(250, 452, 230, 108, 0)}
    <g class="grow" style="--d:.3">
      <rect x="236" y="96" width="38" height="340" rx="14" fill="url(#lf-aePole)"/>
      ${Array.from({ length: 22 }, (_, i) => `<circle cx="${242 + ((i * 13) % 28)}" cy="${110 + i * 15}" r="${3 + (i % 3)}" fill="#a8c25a" opacity=".7"/>`).join("")}
    </g>
    ${stem("M226 436 C 212 380 232 330 218 270 C 206 214 228 170 222 120", 0.6, 14)}
    ${[
      [221, 340],
      [214, 252],
      [222, 172],
    ]
      .map(([x, y], i) => `<ellipse class="pop" style="--d:${1 + i * 0.2}" cx="${x}" cy="${y}" rx="11" ry="5" fill="#2d6b2f"/>`)
      .join("")}
    ${mon(219, 336, 0.42, -64, 1.2, "lf-aeMask")}
    ${mon(216, 250, 0.44, 58, 1.4, "lf-aeMask")}
    ${mon(222, 170, 0.4, -24, 1.6, "lf-aeMask")}
    <path class="draw" style="--d:2" pathLength="1" d="M214 176 C 150 210 128 300 140 380 C 144 404 146 420 148 440" stroke="#9a7650" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path class="draw" style="--d:2.2" pathLength="1" d="M216 344 C 190 362 176 394 180 440" stroke="#9a7650" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path class="draw" style="--d:2.4" pathLength="1" d="M222 258 C 236 270 244 280 252 296" stroke="#9a7650" stroke-width="7" fill="none" stroke-linecap="round"/>
    <g class="fade" style="--d:3">
      <path class="lf-dash" d="M214 176 C 150 210 128 300 140 380 C 144 404 146 420 148 440" stroke="#ffe0b0" stroke-width="3" stroke-dasharray="6 14" fill="none" stroke-linecap="round"/>
      <path class="lf-dash" d="M216 344 C 190 362 176 394 180 440" stroke="#ffe0b0" stroke-width="3" stroke-dasharray="6 14" fill="none" stroke-linecap="round"/>
      <circle class="lf-glint" style="--d:0" cx="148" cy="440" r="7" fill="#ffe0b0" filter="url(#glow)"/>
      <circle class="lf-glint" style="--d:.6" cx="252" cy="296" r="7" fill="#ffe0b0" filter="url(#glow)"/>
    </g>
    ${label(76, 404, "в грунт", "#ffe0b0", 3.2, 22)}
    <g class="fade" style="--d:3.6">
      <path d="M336 330 C 310 320 290 310 280 302" stroke="#ffe0b0" stroke-width="3" fill="none" stroke-dasharray="4 6"/>
      <text x="378" y="350" fill="#ffe0b0" font-family="Manrope" font-weight="800" font-size="22" text-anchor="middle">к опоре</text>
    </g>
    ${roundel(
      486,
      200,
      `<g transform="translate(10 4) rotate(-30) scale(.62)">${scissors()}</g><path d="M-38 38 L 38 -38" stroke="#ff4d4f" stroke-width="9" stroke-linecap="round"/>`,
      "не обрезать",
      "#ff6b6b",
      2.8,
    )}
    ${chip(300, 600, "в грунт или к опоре", "#8be3a8", 4)}`,
};

/** Акцентный цвет сцены (фон, заголовок, полоска прогресса). */
export const accent = {
  away: "#7cc4ff",
  wickPot: "#62e3d3",
  flood: "#ff6b6b",
  aroid: "#ffd36e",
  euphorbia: "#ff9f6e",
  lily: "#ff6b6b",
  snug: "#8be3a8",
  buds: "#ffb3d1",
  book: "#ffd36e",
  aerial: "#8be3a8",
};

/** CSS-анимации, нужные этим сценам (префикс lf-). */
export const css = `
  .lf-slide { animation: lf-slide 1.8s cubic-bezier(.55,0,.2,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-slide { to { transform: translateX(var(--dx)); } }
  .lf-out { animation: lf-out .8s ease both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-out { to { opacity: 0; } }
  .lf-sway { transform-box: fill-box; transform-origin: 50% 100%; animation: lf-sway 4.4s ease-in-out infinite; }
  @keyframes lf-sway { 0%,100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }
  .lf-flow { animation: lf-flow 1.4s linear infinite; }
  @keyframes lf-flow { to { stroke-dashoffset: -0.245; } }
  .lf-up { animation: lf-up 1.5s ease-in infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-up { from { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } to { transform: translateY(-44px); opacity: 0; } }
  .lf-rot { animation: lf-rot 2.6s ease both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-rot { to { stroke: #2a170b; } }
  .lf-bub { animation: lf-bub 2.2s ease-in infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-bub { from { transform: translateY(0); opacity: 0; } 20% { opacity: .9; } to { transform: translateY(-80px); opacity: 0; } }
  .lf-bob { animation: lf-bob 3.2s ease-in-out infinite; }
  @keyframes lf-bob { 0%,100% { transform: translate(0, 0); } 50% { transform: translate(-6px, -8px); } }
  .lf-glint { animation: lf-glint 1.8s ease-in-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-glint { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  .lf-bend { animation: lf-bend 1.1s cubic-bezier(.5,0,.3,1.3) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-bend { from { transform: rotate(0); } to { transform: rotate(62deg); } }
  .lf-ooze { transform-box: fill-box; transform-origin: 50% 0; animation: lf-ooze 1.4s cubic-bezier(.2,1.2,.4,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-ooze { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .lf-dash { animation: lf-dash 1s linear infinite; }
  @keyframes lf-dash { to { stroke-dashoffset: -18; } }
  .lf-tail { animation: lf-tail 2.6s ease-in-out infinite; }
  @keyframes lf-tail { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-14deg); } }
  .lf-throb { transform-box: fill-box; transform-origin: center; animation: lf-throb 1.6s ease-in-out infinite; }
  @keyframes lf-throb { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
  .lf-snipA { animation: lf-snipA 1.6s ease-in-out infinite; }
  @keyframes lf-snipA { 0%,100% { transform: rotate(-16deg); } 50% { transform: rotate(0); } }
  .lf-snipB { animation: lf-snipB 1.6s ease-in-out infinite; }
  @keyframes lf-snipB { 0%,100% { transform: rotate(16deg); } 50% { transform: rotate(0); } }
  .lf-snipoff { animation: lf-snipoff 1.6s cubic-bezier(.5,0,.8,.6) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-snipoff { from { transform: translate(0, 0); opacity: 1; } to { transform: translate(30px, 150px); opacity: 0; } }
  .lf-fly { animation: lf-fly 4.5s cubic-bezier(.3,.6,.4,1) infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes lf-fly { from { transform: translate(0, 30px) scale(.7); opacity: 0; } 15% { opacity: 1; } 75% { opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0; } }
  .lf-glowp { animation: lf-glowp 3s ease-in-out infinite; }
  @keyframes lf-glowp { 0%,100% { opacity: .7; } 50% { opacity: 1; } }
`;
