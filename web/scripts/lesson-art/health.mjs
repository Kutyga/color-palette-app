/** Сцены видеоуроков (сценарии — src/data/lessons.json): подкормки, вредители, болезни, пересадка, черенки, питомцы. */
import { badge, chip, label, leaf, pot, potted, sparkles, stem } from "./kit.mjs";

// ---------------------------------------------------------------------------
// Общие детали этого файла
// ---------------------------------------------------------------------------

/** Капля воды (вершина в x,y). */
const dropPath = (x, y, s = 1) => `M${x} ${y} q ${7 * s} ${13 * s} 0 ${20 * s} q ${-7 * s} ${-7 * s} 0 ${-20 * s} Z`;

/** Лист как в kit.leaf, но с дополнительным содержимым в тех же координатах (пятна, точки, кончики). */
const leafWith = (x, y, s, r, d, g, extra = "", outline = "#0f3f23") => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><g class="pop" style="--d:${d}">
    <path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z" fill="url(#${g})"/>
    <path d="M0 -6 C -3 -60 -2 -112 0 -148" stroke="${outline}" stroke-opacity=".55" stroke-width="4" fill="none"/>
    <path d="M-22 -118 C -40 -96 -44 -70 -36 -50" stroke="#ffffff" stroke-opacity=".3" stroke-width="7" stroke-linecap="round" fill="none"/>
  </g>${extra}</g>`;

/** Контур листа для clip-path (координаты листа). */
const LEAF_CLIP = `<clipPath id="hlLeafClip"><path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z"/></clipPath>`;

/** Детерминированные «случайные» точки внутри листа (локальные координаты листа). */
const leafPoints = (n, seed = 1) =>
  Array.from({ length: n }, (_, i) => {
    const t = ((i * 0.618 + seed * 0.37) % 1) * 0.8 + 0.1;
    const y = -18 - t * 118;
    const half = 50 * Math.sin(Math.PI * (t * 0.9 + 0.05));
    const u = (((i * 7 + seed * 3) % 11) / 10) * 2 - 1;
    return [Math.round(u * half * 0.75), Math.round(y)];
  });

/** Лейка: носик в (0,0), корпус справа-внизу; tilt — наклон. */
const can = (x, y, tilt = -30, s = 1, color = "#62b3ff") => `
  <g transform="translate(${x} ${y}) rotate(${tilt}) scale(${s})">
    <path d="M44 22 L 2 -4 L -2 4 L 40 36 Z" fill="${color}"/>
    <ellipse cx="0" cy="0" rx="8" ry="12" transform="rotate(-30)" fill="#9fd6ff"/>
    <path d="M88 -6 Q 132 -8 128 34" stroke="#3f86d0" stroke-width="10" fill="none" stroke-linecap="round"/>
    <rect x="40" y="-10" width="84" height="74" rx="14" fill="${color}"/>
    <rect x="50" y="-4" width="12" height="62" rx="6" fill="#ffffff" opacity=".35"/>
    <rect x="36" y="-16" width="92" height="12" rx="6" fill="#4a98e6"/>
  </g>`;

/** Флакон удобрения: горлышко в (0,0), корпус вниз (в локальных координатах). */
const bottle = (x, y, rot = 0, s = 1, liquid = "#c6e86a") => `
  <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <rect x="-13" y="-2" width="26" height="22" rx="4" fill="#f4f1e8"/>
    <path d="M-16 18 L 16 18 L 32 44 L -32 44 Z" fill="#fff8e6"/>
    <rect x="-40" y="40" width="80" height="128" rx="16" fill="#fff8e6"/>
    <rect x="-34" y="92" width="68" height="70" rx="10" fill="${liquid}" opacity=".9"/>
    <rect x="-40" y="62" width="80" height="44" fill="#2f9d5c"/>
    <path d="M0 98 C -10 92 -12 78 0 70 C 12 78 10 92 0 98 Z" fill="#c6f2d2"/>
    <rect x="-30" y="48" width="10" height="110" rx="5" fill="#ffffff" opacity=".55"/>
  </g>`;

/** Горшок в разрезе: виден грунт спереди. Возвращает разметку; x — центр, y — верх. */
const cutPot = (x, y, w, h, soil = "url(#soilG)", d = 0) => `
  <g class="rise" style="--d:${d}">
    <ellipse cx="${x}" cy="${y + h + 12}" rx="${w * 0.6}" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
    <path d="M${x - w / 2} ${y} L ${x + w / 2} ${y} L ${x + w * 0.4} ${y + h} L ${x - w * 0.4} ${y + h} Z" fill="url(#potG)"/>
    <path d="M${x - w / 2 + 14} ${y + 18} L ${x + w / 2 - 14} ${y + 18} L ${x + w * 0.4 - 12} ${y + h - 12} L ${x - w * 0.4 + 12} ${y + h - 12} Z" fill="${soil}"/>
    <rect x="${x - w / 2 - 12}" y="${y - 18}" width="${w + 24}" height="34" rx="10" fill="#c4643a"/>
    <rect x="${x - w / 2 - 12}" y="${y - 18}" width="${w + 24}" height="8" rx="4" fill="#f0a072" opacity=".6"/>
  </g>`;

/** Маленький вредитель (тельце + ножки), рисуется вокруг (0,0). */
const bug = (color, s = 1) => `
  <g transform="scale(${s})">
    <path d="M-7 -4 L -13 -8 M-7 1 L -14 1 M-7 5 L -12 10 M7 -4 L 13 -8 M7 1 L 14 1 M7 5 L 12 10" stroke="#2a1a10" stroke-width="1.8" stroke-linecap="round"/>
    <ellipse cx="0" cy="1" rx="7.5" ry="9.5" fill="${color}"/>
    <circle cx="0" cy="-9" r="4" fill="${color}"/>
    <ellipse cx="-2.5" cy="-1" rx="2.2" ry="3.5" fill="#ffffff" opacity=".55"/>
  </g>`;

/** Подпись в две строки. */
const label2 = (x, y, [a, b], color, d, size = 22) =>
  `${label(x, y, a, color, d, size)}${label(x, y + size * 1.2, b, color, d + 0.1, size)}`;

/** Тонкая выноска. */
const pointer = (d, path, color = "#ffffff") =>
  `<path class="draw" style="--d:${d}" pathLength="1" d="${path}" stroke="${color}" stroke-opacity=".75" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

/** Снежинка вокруг (0,0). */
const flake = (r, color) =>
  [0, 60, 120]
    .map(
      (a) =>
        `<path d="M0 ${-r} L0 ${r} M${-r * 0.3} ${-r * 0.7} L0 ${-r * 0.42} L${r * 0.3} ${-r * 0.7} M${-r * 0.3} ${r * 0.7} L0 ${r * 0.42} L${r * 0.3} ${r * 0.7}" stroke="${color}" stroke-width="${Math.max(2, r / 5)}" fill="none" stroke-linecap="round" transform="rotate(${a})"/>`,
    )
    .join("");

/** Кошка (как в уроке 2), точка (0,0) — низ туловища. */
const cat = (mood = "") => `
  <path class="tail" d="M60 -6 C 120 -10 130 -70 96 -96" stroke="#f0d9b5" stroke-width="16" fill="none" stroke-linecap="round"/>
  <ellipse cx="0" cy="-72" rx="70" ry="74" fill="#f0d9b5"/>
  <ellipse cx="-20" cy="-60" rx="30" ry="40" fill="#fff4e0" opacity=".5"/>
  <path d="M-52 -196 L -46 -250 L -14 -216 Z" fill="#f0d9b5"/><path d="M6 -218 L 34 -248 L 40 -196 Z" fill="#f0d9b5"/>
  <path d="M-46 -206 L -43 -236 L -24 -215 Z" fill="#e9a99a"/><path d="M14 -216 L 30 -234 L 33 -206 Z" fill="#e9a99a"/>
  <circle cx="-8" cy="-170" r="52" fill="#f0d9b5"/>
  <g class="blink"><ellipse cx="-28" cy="-174" rx="7" ry="11" fill="#163d39"/><ellipse cx="12" cy="-174" rx="7" ry="11" fill="#163d39"/></g>
  <path d="M-14 -150 l 6 6 l 6 -6" stroke="#c97a5a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M-30 -146 L -78 -152 M-30 -140 L -76 -132 M14 -146 L 60 -152 M14 -140 L 58 -132" stroke="#ffffff" stroke-opacity=".7" stroke-width="2"/>
  ${mood}`;

// ---------------------------------------------------------------------------
// Сцены
// ---------------------------------------------------------------------------

export const art = {
  // ---- Пересадка / черенки: отрывной календарь со счётчиком ----
  calendar: (o) => {
    const count = o.count ?? 6;
    const header = o.header ?? "ЖДЁМ";
    const unit = o.unit ?? "недель";
    const chips = o.chips ?? [];
    const hdrSize = header.length > 11 ? 21 : 24;
    const cal = `
      <g class="rise" style="--d:.1">
        <ellipse cx="185" cy="420" rx="140" ry="16" fill="#000" opacity=".4" filter="url(#soft)"/>
        <rect x="64" y="128" width="250" height="280" rx="30" fill="#e6e0d0"/>
        <rect x="58" y="120" width="250" height="280" rx="30" fill="#f7f4ec"/>
        <rect x="58" y="120" width="250" height="80" rx="30" fill="#ffd36e"/>
        <rect x="58" y="168" width="250" height="32" fill="#ffd36e"/>
        <rect x="58" y="196" width="250" height="5" fill="#000" opacity=".08"/>
        <circle cx="118" cy="120" r="12" fill="#7a5a10"/><circle cx="248" cy="120" r="12" fill="#7a5a10"/>
        <rect x="113" y="98" width="10" height="28" rx="5" fill="#cfc6b2"/><rect x="243" y="98" width="10" height="28" rx="5" fill="#cfc6b2"/>
        <text x="183" y="178" fill="#3a2a05" font-family="Manrope" font-weight="800" font-size="${hdrSize}" text-anchor="middle" letter-spacing="1">${header}</text>
        <text data-count="${count}" data-start=".8" data-dur="4" x="183" y="330" fill="#3a2a05" font-family="Unbounded" font-weight="900" font-size="110" text-anchor="middle">1</text>
        <text x="183" y="374" fill="#7a5a10" font-family="Manrope" font-weight="800" font-size="24" text-anchor="middle">${unit}</text>
      </g>
      ${[0, 1, 2, 3]
        .map(
          (k) => `<g class="hl-tear" style="--d:${1 + k * 0.9}">
        <path d="M58 200 L 308 200 L 308 370 Q 308 400 278 400 L 88 400 Q 58 400 58 370 Z" fill="#fffdf6" stroke="#e6e0d0" stroke-width="2"/>
      </g>`,
        )
        .join("")}`;
    const right = o.jar
      ? `
      <g transform="translate(450 0)">
        <g class="rise" style="--d:.4">
          <ellipse cx="0" cy="482" rx="110" ry="14" fill="#000" opacity=".4" filter="url(#soft)"/>
          <rect x="-76" y="300" width="152" height="172" rx="4" fill="url(#waterG)" opacity=".5"/>
          <path d="M-80 220 L -80 446 Q -80 476 -50 476 L 50 476 Q 80 476 80 446 L 80 220" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".75" stroke-width="5"/>
          <ellipse cx="0" cy="300" rx="76" ry="7" fill="#cfe9ff" opacity=".5"/>
          <rect x="-64" y="236" width="10" height="210" rx="5" fill="#ffffff" opacity=".3"/>
        </g>
        ${stem("M0 380 C -4 320 6 260 0 170", 0.6, 8)}
        ${leaf(0, 178, 0.5, 8, 1.0)}${leaf(2, 238, 0.42, 58, 1.2, "leafG2")}${leaf(-2, 214, 0.4, -54, 1.4)}
        <circle class="pop" style="--d:.9" cx="0" cy="356" r="7" fill="#8a6038"/>
        ${["M0 358 q -24 40 -16 100", "M0 358 q 26 36 22 92", "M0 358 q -46 26 -54 70", "M0 358 q 44 22 52 62", "M0 358 q 4 40 2 104"]
          .map(
            (p, i) =>
              `<path class="draw" style="--d:${1.4 + i * 0.25};animation-duration:${4 - i * 0.3}s" pathLength="1" d="${p}" stroke="#f3ead8" stroke-width="${4 - (i % 2)}" fill="none" stroke-linecap="round"/>`,
          )
          .join("")}
        ${[-40, 10, 46]
          .map(
            (bx, i) =>
              `<circle class="hl-bubble" style="--d:${1 + i * 0.8}" cx="${bx}" cy="460" r="${3 + (i % 2) * 2}" fill="#e8f5ff" opacity=".8"/>`,
          )
          .join("")}
        <g class="fade" style="--d:4.4">
          <path d="M100 380 L 112 380 L 112 460 L 100 460" stroke="#ffd36e" stroke-width="4" fill="none"/>
        </g>
        ${label(124, 428, "3–5", "#ffd36e", 4.5, 20, "start")}
      </g>`
      : `
      <g transform="translate(520 90)"><g class="pop" style="--d:1.2">
        <circle r="30" fill="#ffd36e" filter="url(#glow)"/>
        ${Array.from({ length: 8 }, (_, k) => `<path d="M0 -40 L0 -52" stroke="#ffd36e" stroke-width="6" stroke-linecap="round" transform="rotate(${k * 45})"/>`).join("")}
      </g></g>
      ${badge(556, 128, false, 2.2, 20)}
      <g class="fade" style="--d:1.6">
        <path d="M380 160 Q 450 130 520 150 L 586 420 L 336 460 Z" fill="#0b1a2c" opacity=".45" filter="url(#soft)"/>
      </g>
      <g class="rise" style="--d:.3"><rect x="340" y="456" width="230" height="12" rx="6" fill="#ffffff" opacity=".14"/></g>
      ${potted(455, 456, 1.15, 0.5, "leafy")}
      <g class="fade" style="--d:2.4"><g transform="translate(455 498)">
        <text y="0" fill="#b4dcff" font-family="Manrope" font-weight="800" font-size="22" text-anchor="middle">в тени, без солнца</text>
      </g></g>`;
    const chipEls = chips
      .map((c, i) => chip(300, chips.length > 1 ? 560 + i * 56 : 612, c, i ? "#ffb3d1" : "#ffd36e", 3 + i * 0.6))
      .join("");
    return `${cal}${right}${chipEls}${sparkles(
      [
        [70, 470, 3.4],
        [300, 90, 3.9],
      ],
      "#ffd36e",
    )}`;
  },

  // ---- Урок 12: подкормки ----
  fert: `
    <g class="fade" style="--d:.2">${bottle(250, 196, 120, 0.85)}</g>
    ${[0, 1, 2].map((i) => `<path class="drop" style="--d:${1 + i * 0.37}" d="${dropPath(252, 204, 1.1)}" fill="#c6e86a"/>`).join("")}
    <g class="rise" style="--d:.4">
      <ellipse cx="240" cy="520" rx="120" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="M150 432 L 82 360 L 72 372 L 136 450 Z" fill="#4a98e6"/>
      <ellipse cx="78" cy="364" rx="14" ry="9" transform="rotate(-48 78 364)" fill="#9fd6ff"/>
      <path d="M294 392 Q 352 392 340 470" stroke="#3f86d0" stroke-width="12" fill="none" stroke-linecap="round"/>
      <rect x="140" y="380" width="160" height="130" rx="22" fill="#62b3ff"/>
      <rect x="156" y="392" width="16" height="106" rx="8" fill="#ffffff" opacity=".35"/>
      <ellipse cx="250" cy="382" rx="44" ry="10" fill="#1d4f86"/>
      <ellipse cx="250" cy="384" rx="34" ry="6" fill="#c6e86a" opacity=".8"/>
    </g>
    ${label(220, 572, "удобрение в воду", "#ffffff", 1.6, 22)}
    <g class="rise" style="--d:.8">
      <ellipse cx="470" cy="540" rx="110" ry="12" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="M370 300 L 570 300 L 548 530 L 392 530 Z" fill="url(#potG)"/>
      <path d="M384 318 L 556 318 L 538 516 L 402 516 Z" fill="url(#soilG)"/>
      <rect x="360" y="284" width="220" height="30" rx="10" fill="#c4643a"/>
    </g>
    ${stem("M470 300 C 466 260 476 220 470 170", 1.0, 8)}
    ${leaf(470, 178, 0.45, 6, 1.3)}${leaf(472, 250, 0.36, 52, 1.5, "leafG2")}${leaf(468, 230, 0.36, -50, 1.6)}
    ${["M470 320 q -30 60 -22 160", "M470 320 q 34 50 30 150", "M470 320 q -56 30 -66 100", "M470 330 q 50 24 60 90"]
      .map(
        (p, i) =>
          `<path class="draw" style="--d:${1.4 + i * 0.15}" pathLength="1" d="${p}" stroke="#f3ead8" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      )
      .join("")}
    <g class="fade" style="--d:3"><g class="hl-burn">
      ${["M470 320 q -30 60 -22 160", "M470 320 q 34 50 30 150", "M470 320 q -56 30 -66 100", "M470 330 q 50 24 60 90"]
        .map((p) => `<path d="${p}" stroke="#ff5a4a" stroke-width="9" fill="none" stroke-linecap="round" filter="url(#glow)"/>`)
        .join("")}
    </g></g>
    ${[
      [446, 392],
      [500, 420],
      [418, 440],
      [482, 470],
      [452, 488],
      [528, 452],
      [436, 360],
    ]
      .map(
        ([x, y], i) =>
          `<g transform="translate(${x} ${y}) rotate(${i * 23})"><rect class="pop" style="--d:${2.3 + i * 0.12}" x="-6" y="-6" width="12" height="12" rx="2" fill="#ffffff" stroke="#d8f0ff" stroke-width="2"/></g>`,
      )
      .join("")}
    ${label(470, 572, "соли жгут корни", "#ff8a6e", 3.2, 22)}
    ${chip(300, 620, "перекорм опаснее", "#ff9f6e", 3.8)}`,

  months: () => {
    const names = ["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"];
    const x0 = 20;
    const step = 47;
    const tiles = names
      .map((n, i) => {
        const x = x0 + i * step;
        const grow = i >= 2 && i <= 8;
        const winter = i <= 1 || i >= 10;
        const d = 0.2 + i * 0.07;
        const lit = grow
          ? `<g class="fade" style="--d:${1.3 + (i - 2) * 0.15}"><rect x="${x}" y="170" width="42" height="96" rx="12" fill="url(#hlMonG)"/><rect x="${x + 5}" y="176" width="32" height="10" rx="5" fill="#ffffff" opacity=".35"/></g>`
          : winter
            ? `<g class="fade" style="--d:${2.6 + (i > 5 ? i - 10 : i) * 0.12}"><rect x="${x}" y="170" width="42" height="96" rx="12" fill="url(#hlWinG)"/></g>
               <g transform="translate(${x + 21} 244)"><g class="fade" style="--d:2.9"><g class="hl-spin">${flake(10, "#ffffff")}</g></g></g>`
            : "";
        return `<g class="pop" style="--d:${d}"><rect x="${x}" y="170" width="42" height="96" rx="12" fill="#ffffff" opacity=".12"/></g>
          ${lit}
          <text class="fade" style="--d:${d}" x="${x + 21}" y="${winter ? 214 : 228}" fill="#ffffff" font-family="Unbounded" font-weight="900" font-size="22" text-anchor="middle">${n}</text>`;
      })
      .join("");
    const gx1 = x0 + 2 * step;
    const gx2 = x0 + 8 * step + 42;
    const gc = (gx1 + gx2) / 2;
    return `
      <defs>
        <linearGradient id="hlMonG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8be3a8"/><stop offset="1" stop-color="#2f9d5c"/></linearGradient>
        <linearGradient id="hlWinG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd0ff"/><stop offset="1" stop-color="#3a6fc4"/></linearGradient>
        <linearGradient id="hlLampG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9fe6" stop-opacity=".7"/><stop offset="1" stop-color="#b48cff" stop-opacity="0"/></linearGradient>
      </defs>
      ${pointer(2.4, `M${gx1 + 4} 150 L ${gx1 + 4} 136 L ${gx2 - 4} 136 L ${gx2 - 4} 150`, "#8be3a8")}
      ${label(gc, 118, "раз в 2–4 недели", "#8be3a8", 2.6, 24)}
      ${tiles}
      ${potted(gc - 20, 540, 0.95, 1.6, "leafy")}
      ${[0, 1, 2].map((i) => `<path class="drop" style="--d:${3 + i * 0.37}" d="${dropPath(gc - 50 + i * 30, 286, 1)}" fill="#c6e86a"/>`).join("")}
      ${label(gc - 20, 580, "сезон роста", "#8be3a8", 2.2, 22)}
      <g transform="translate(${x0 + 10 * step + 44} 0)">
        ${pointer(3.1, "M0 272 L 0 330", "#b4dcff")}
        <g class="pop" style="--d:3.3">
          <rect x="-56" y="328" width="112" height="22" rx="11" fill="#e9e1d2"/>
          <rect x="-48" y="346" width="96" height="10" rx="5" fill="#ff8fe0" filter="url(#glow)"/>
        </g>
        <g class="fade" style="--d:3.6"><path class="pulse" d="M-48 356 L 48 356 L 80 520 L -80 520 Z" fill="url(#hlLampG)"/></g>
        ${potted(0, 530, 0.62, 3.5, "leafy")}
      </g>
      ${label(470, 590, "кроме фитолампы", "#ffb3f0", 4, 22)}
      ${label(66, 330, "зимой", "#b4dcff", 3.2, 22)}
      ${label(66, 358, "пауза", "#b4dcff", 3.3, 22)}`;
  },

  halfDose: `
    <defs>
      <clipPath id="hlCupClip"><path d="M172 210 L 428 210 L 398 470 L 202 470 Z"/></clipPath>
      <linearGradient id="hlDoseG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2f59a"/><stop offset="1" stop-color="#7fbf2e"/></linearGradient>
    </defs>
    <g class="fade" style="--d:.5">${bottle(246, 120, 120, 0.8)}</g>
    <g class="fade" style="--d:.9"><g class="hl-stop" style="--d:3.4">
      <path class="hl-stream" d="M248 130 L 248 360" stroke="#c6e86a" stroke-width="10" stroke-linecap="round" fill="none"/>
    </g></g>
    <g class="rise" style="--d:.2">
      <ellipse cx="300" cy="490" rx="150" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="M172 210 L 428 210 L 398 470 L 202 470 Z" fill="#ffffff" opacity=".1"/>
    </g>
    <g clip-path="url(#hlCupClip)">
      <g class="grow" style="--d:1;animation-duration:2.4s"><rect x="160" y="340" width="280" height="140" fill="url(#hlDoseG)"/></g>
      <g class="fade" style="--d:3.2"><ellipse class="pulse" cx="300" cy="340" rx="140" ry="8" fill="#f4ffc8" opacity=".8"/></g>
    </g>
    <g class="rise" style="--d:.2">
      <path d="M172 210 L 428 210 L 398 470 L 202 470 Z" fill="url(#glassG)" stroke="#e8f5ff" stroke-opacity=".8" stroke-width="5" stroke-linejoin="round"/>
      ${[0, 1, 2, 3, 4, 5].map((k) => `<path d="M${410 - k * 4.4} ${250 + k * 40} L ${388 - k * 4.4} ${250 + k * 40}" stroke="#e8f5ff" stroke-opacity=".7" stroke-width="3"/>`).join("")}
      <rect x="188" y="222" width="12" height="230" rx="6" fill="#ffffff" opacity=".28"/>
    </g>
    <g class="fade" style="--d:1.6">
      <path d="M150 226 L 450 226" stroke="#ffffff" stroke-width="3" stroke-dasharray="12 10" opacity=".8"/>
    </g>
    ${label(460, 210, "полная доза", "#ffffff", 1.8, 22, "start")}
    <g class="fade" style="--d:3.2"><path d="M448 340 L 470 340" stroke="#ffd36e" stroke-width="5" stroke-linecap="round"/></g>
    ${label(480, 350, "50%", "#ffd36e", 3.3, 28, "start")}
    <g class="pop" style="--d:3.6">
      <text x="300" y="428" fill="#ffffff" font-family="Unbounded" font-weight="900" font-size="34" text-anchor="middle" filter="url(#glow)">½ дозы</text>
    </g>
    ${sparkles(
      [
        [470, 300, 3.8],
        [140, 420, 4.2],
      ],
      "#ffd36e",
    )}
    ${chip(300, 600, "для комнатных — норма", "#ffd36e", 4.2)}`,

  order: `
    ${[
      [30, "1", "полив водой", 0.1],
      [310, "2", "удобрение", 1.6],
    ]
      .map(
        ([x, n, t, d]) => `
      <g class="rise" style="--d:${d}">
        <rect x="${x}" y="40" width="260" height="320" rx="26" fill="#ffffff" opacity=".07"/>
        <rect x="${x}" y="40" width="260" height="320" rx="26" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>
        <circle cx="${x + 36}" cy="76" r="20" fill="#7cc4ff"/>
        <text x="${x + 36}" y="84" fill="#0b2a44" font-family="Unbounded" font-weight="900" font-size="20" text-anchor="middle">${n}</text>
        <text x="${x + 66}" y="84" fill="#ffffff" font-family="Manrope" font-weight="800" font-size="22">${t}</text>
      </g>`,
      )
      .join("")}
    ${cutPot(160, 262, 150, 86, "url(#dryG)", 0.3)}
    <g class="fade" style="--d:1.9"><path d="M100 280 L 220 280 L 208 336 L 112 336 Z" fill="url(#soilG)"/>
      <ellipse cx="140" cy="292" rx="18" ry="4" fill="#9fd6ff" opacity=".5"/><ellipse cx="186" cy="302" rx="12" ry="3" fill="#9fd6ff" opacity=".5"/></g>
    <g class="rise" style="--d:.6">${can(170, 190, -30, 0.8)}</g>
    ${[0, 1, 2].map((i) => `<path class="drip" style="--d:${1 + i * 0.6}" d="${dropPath(166 + i * 6, 198, 0.9)}" fill="#7cc4ff"/>`).join("")}
    ${cutPot(440, 262, 150, 86, "url(#soilG)", 1.8)}
    <g class="fade" style="--d:2.2">${bottle(436, 192, -150, 0.5)}</g>
    ${[0, 1].map((i) => `<path class="drip" style="--d:${2.6 + i * 0.9}" d="${dropPath(436, 198, 0.9)}" fill="#c6e86a"/>`).join("")}
    <g class="fade" style="--d:1.5"><path d="M286 210 L 318 210 M306 198 L 320 210 L 306 222" stroke="#7cc4ff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${badge(256, 330, true, 2.4, 22)}${badge(536, 330, true, 3.2, 22)}
    <g class="rise" style="--d:3.6">
      <rect x="30" y="392" width="540" height="150" rx="26" fill="#e5484d" opacity=".12"/>
      <rect x="30" y="392" width="540" height="150" rx="26" fill="none" stroke="#ff8a8f" stroke-opacity=".55" stroke-width="2"/>
    </g>
    ${cutPot(120, 476, 110, 50, "url(#dryG)", 3.8)}
    <g class="fade" style="--d:3.9"><path d="M98 494 l 5 7 l -4 6 l 5 7 M138 494 l -5 7 l 4 6 l -5 7" stroke="#6b4429" stroke-width="2.5" fill="none"/></g>
    ${label(205, 486, "+", "#ffffff", 4, 44)}
    <g class="fade" style="--d:4.1">${bottle(270, 420, 0, 0.42)}</g>
    ${label(335, 486, "=", "#ffffff", 4.3, 44)}
    ${badge(400, 470, false, 4.5, 30)}
    <g class="fade" style="--d:4.6"><g class="hl-burn">
      <text x="440" y="482" fill="#ff3b30" font-family="Unbounded" font-weight="900" font-size="32" filter="url(#glow)">ожог</text>
    </g>
      <text x="440" y="482" fill="#ff8a8f" font-family="Unbounded" font-weight="900" font-size="32">ожог</text></g>
    ${label(120, 432, "сухо", "#e2c08f", 3.9, 18)}
    ${chip(300, 606, "сначала вода, потом корм", "#7cc4ff", 5)}`,

  crust: `
    <defs>${LEAF_CLIP}<linearGradient id="hlSoakG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f80ed" stop-opacity=".1"/><stop offset=".85" stop-color="#2f80ed" stop-opacity=".28"/><stop offset="1" stop-color="#9fd6ff" stop-opacity=".55"/></linearGradient></defs>
    <g class="rise" style="--d:2.2">${can(476, 196, -30, 0.78)}</g>
    ${Array.from(
      { length: 10 },
      (_, i) =>
        `<path class="hl-fall" style="--d:${2.6 + (i % 5) * 0.18 + Math.floor(i / 5) * 0.5};--dx:${-40 - ((i * 23) % 50)}px;--dy:${150 + (i % 3) * 10}px" d="${dropPath(472 - (i % 3) * 4, 204, 0.8)}" fill="#9fd6ff"/>`,
    ).join("")}
    ${stem("M300 340 C 296 290 306 230 300 160", 0.2, 9)}
    ${[
      [300, 168, 0.56, 4, 0.5, "leafG"],
      [296, 270, 0.46, -54, 0.7, "leafG2"],
      [304, 232, 0.46, 52, 0.9, "leafG"],
    ]
      .map(([x, y, s, r, d, g]) =>
        leafWith(
          x,
          y,
          s,
          r,
          d,
          g,
          `<g class="fade" style="--d:${d + 0.8}"><g clip-path="url(#hlLeafClip)"><path d="M-80 -170 L 80 -170 L 80 -122 Q 40 -108 20 -124 Q 0 -110 -20 -126 Q -44 -110 -80 -122 Z" fill="#b8843f"/><path d="M-80 -122 Q -44 -110 -20 -126 Q 0 -110 20 -124 Q 40 -108 80 -122" stroke="#6e4519" stroke-width="4" fill="none"/></g></g>`,
        ),
      )
      .join("")}
    <g class="rise" style="--d:.1">
      <ellipse cx="300" cy="500" rx="170" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <path d="M160 330 L 440 330 L 410 488 L 190 488 Z" fill="url(#potG)"/>
      <path d="M174 350 L 426 350 L 400 474 L 200 474 Z" fill="url(#soilG)"/>
    </g>
    <path class="hl-soak" style="--d:3.2" d="M176 352 L 424 352 L 400 474 L 200 474 Z" fill="url(#hlSoakG)"/>
    ${[
      [220, 400],
      [300, 430],
      [370, 395],
      [260, 455],
      [345, 452],
    ]
      .map(
        ([x, y], i) =>
          `<g class="fade" style="--d:${3.6 + i * 0.2}"><ellipse class="hl-glint" style="--o:${i * 0.4}" cx="${x}" cy="${y}" rx="12" ry="3" fill="#9fd6ff"/></g>`,
      )
      .join("")}
    <g class="hl-melt" style="--d:3.8">
      <g class="fade" style="--d:.6">
        <path d="M176 350 L 424 350 L 421 368 Q 404 380 386 368 Q 366 382 346 370 Q 326 384 304 370 Q 284 382 262 370 Q 242 384 222 370 Q 200 382 179 368 Z" fill="#f4f1e6"/>
        <path d="M190 376 l 3 6 M232 380 l -2 7 M276 378 l 2 6 M318 380 l -2 6 M360 378 l 3 6 M400 376 l -2 6" stroke="#f4f1e6" stroke-width="3" stroke-linecap="round"/>
        ${[
          [200, 360],
          [252, 366],
          [318, 362],
          [372, 368],
          [410, 358],
        ]
          .map(
            ([x, y]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="1.5" transform="rotate(45 ${x} ${y})" fill="#ffffff"/>`,
          )
          .join("")}
      </g>
      ${label2(78, 390, ["белая", "корка"], "#f4f1e6", 1.2, 22)}
      ${pointer(1.2, "M112 384 L 182 358", "#f4f1e6")}
    </g>
    <g class="rise" style="--d:.1"><rect x="148" y="314" width="304" height="34" rx="10" fill="#c4643a"/><rect x="148" y="314" width="304" height="8" rx="4" fill="#f0a072" opacity=".6"/></g>
    ${label2(106, 108, ["сухие", "кончики"], "#e8b46a", 1.6, 22)}
    ${pointer(1.6, "M156 142 L 230 218", "#e8b46a")}
    <rect x="288" y="486" width="24" height="8" rx="3" fill="#2b1a0f"/>
    ${[0, 1, 2].map((i) => `<path class="drip" style="--d:${4.4 + i * 0.6}" d="${dropPath(300, 496, 0.9)}" fill="#7cc4ff"/>`).join("")}
    ${label(478, 474, "насквозь", "#7cc4ff", 4.4, 22, "start")}
    ${pointer(4.4, "M470 466 Q 440 466 420 450", "#7cc4ff")}
    ${chip(300, 612, "пролить и пропустить подкормки", "#ffb38a", 4.8)}`,

  // ---- Урок 14: вредители ----
  bugs: () => {
    const base = [140, 585];
    const ang = (45 * Math.PI) / 180;
    const dir = [Math.sin(ang), -Math.cos(ang)];
    const perp = [Math.cos(ang), Math.sin(ang)];
    const at = (t, s) => [Math.round(base[0] + t * dir[0] + s * perp[0]), Math.round(base[1] + t * dir[1] + s * perp[1])];
    const pests = [
      [150, -40],
      [240, 50],
      [300, -30],
      [200, 70],
      [260, -80],
      [340, 20],
      [180, 10],
    ].map(([t, s]) => at(t, s));
    const veins = [-126, -100, -74, -48, -24]
      .map(
        (y) =>
          `<path d="M0 ${y} Q -30 ${y + 4} -60 ${y + 28} M0 ${y} Q 30 ${y + 4} 60 ${y + 28}" stroke="#eef9ea" stroke-opacity=".6" stroke-width="2.4" fill="none"/>`,
      )
      .join("");
    return `
      <defs>
        <linearGradient id="hlUnderG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6f2d0"/><stop offset=".55" stop-color="#8ccb92"/><stop offset="1" stop-color="#3f7e4f"/></linearGradient>
        ${LEAF_CLIP}
      </defs>
      <g transform="translate(${base[0]} ${base[1]}) rotate(45) scale(2.6)"><g class="pop" style="--d:.2">
        <path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z" fill="url(#hlUnderG)"/>
        <g clip-path="url(#hlLeafClip)">${veins}</g>
        <path d="M0 -4 C -3 -60 -2 -112 0 -150" stroke="#f4fbf0" stroke-opacity=".85" stroke-width="4" fill="none"/>
      </g></g>
      ${label(480, 572, "изнанка листа", "#ffffff", 1.2, 22)}
      ${pests
        .map(
          ([x, y], i) =>
            `<g transform="translate(${x} ${y}) rotate(${(i * 67) % 360})"><g class="pop" style="--d:${2 + i * 0.3}"><g class="hl-crawl" style="--o:${i * 0.7}">${bug(i % 2 ? "#e0a04a" : "#e5604f", 1)}</g></g></g>`,
        )
        .join("")}
      <g class="hl-scan">
        <circle r="74" fill="url(#glassG)" stroke="#ffe0e1" stroke-width="11"/>
        <path d="M-40 -40 A 56 56 0 0 1 10 -54" stroke="#ffffff" stroke-opacity=".6" stroke-width="6" fill="none" stroke-linecap="round"/>
        <g transform="rotate(-45)"><rect x="-14" y="80" width="28" height="104" rx="12" fill="#ff8a8f"/></g>
      </g>
      <g class="rise" style="--d:.4">
        ${["П", "В", "С", "Ч", "П", "С", "В"]
          .map(
            (n, i) =>
              `<circle cx="${108 + i * 64}" cy="84" r="26" fill="${i === 6 ? "#ff8a8f" : "#ffffff"}" opacity="${i === 6 ? 1 : 0.12}"/><text x="${108 + i * 64}" y="93" fill="${i === 6 ? "#3a0f12" : "#ffffffb0"}" font-family="Manrope" font-weight="800" font-size="24" text-anchor="middle">${n}</text>`,
          )
          .join("")}
      </g>
      <circle class="hl-ring" style="--d:1.2" cx="492" cy="84" r="26" fill="none" stroke="#ff8a8f" stroke-width="4"/>
      ${chip(300, 168, "раз в неделю — осмотр", "#ff8a8f", 1.6)}`;
  },

  mite: () => {
    const dots = leafPoints(26, 2)
      .map(([x, y], i) => `<circle class="pop" style="--d:${1 + i * 0.05}" cx="${x}" cy="${y}" r="${2.4 + (i % 3) * 0.7}" fill="#f6f9dc"/>`)
      .join("");
    const web = `<g class="fade" style="--d:2.2"><g opacity=".75">
      ${[
        "M-52 -96 Q -10 -108 34 -138",
        "M-56 -70 Q 0 -86 50 -104",
        "M-46 -44 Q 4 -60 54 -66",
        "M-30 -128 Q -20 -80 -40 -30",
        "M20 -146 Q 30 -90 56 -50",
        "M-58 -84 L 60 -84",
      ]
        .map((p) => `<path d="${p}" stroke="#ffffff" stroke-width="1.4" fill="none"/>`)
        .join("")}
    </g></g>`;
    const silver = [
      [-20, -110, 20, 9, -30],
      [18, -84, 24, 10, 20],
      [-16, -62, 22, 8, -10],
      [22, -40, 16, 7, 30],
      [-4, -130, 12, 6, 0],
    ]
      .map(
        ([x, y, rx, ry, r], i) =>
          `<g class="fade" style="--d:${1.2 + i * 0.2}"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})" fill="url(#hlSilverG)" opacity=".92"/></g>`,
      )
      .join("");
    const black = leafPoints(14, 5)
      .map(([x, y], i) => `<circle class="pop" style="--d:${2 + i * 0.07}" cx="${x * 0.9}" cy="${y}" r="2.6" fill="#141414"/>`)
      .join("");
    const mite = `
      <path d="M-10 -4 L -22 -14 M-11 0 L -24 -2 M-11 4 L -23 10 M-9 8 L -18 20 M10 -4 L 22 -14 M11 0 L 24 -2 M11 4 L 23 10 M9 8 L 18 20" stroke="#7a2a12" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="0" cy="2" rx="13" ry="15" fill="#e8603a"/>
      <circle cx="-5" cy="-1" r="3" fill="#3a1206"/><circle cx="5" cy="-1" r="3" fill="#3a1206"/>
      <ellipse cx="-4" cy="-6" rx="4" ry="3" fill="#ffffff" opacity=".5"/>`;
    const thrips = `
      <path d="M-4 -16 L -14 -30 M4 -16 L 14 -30 M-4 0 L -16 6 M4 0 L 16 6 M-4 10 L -14 20 M4 10 L 14 20" stroke="#2b2b2b" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M0 -6 L -26 26 M0 -6 L 26 26" stroke="#d8dde0" stroke-width="6" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="0" cy="6" rx="6" ry="28" fill="#3b3226"/>
      <circle cx="0" cy="-24" r="5" fill="#3b3226"/>`;
    return `
      <defs>
        <linearGradient id="hlSilverG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#dfe8ec"/><stop offset="1" stop-color="#9fb0b8"/></linearGradient>
      </defs>
      ${leafWith(160, 520, 1.4, -8, 0.2, "leafG", `${dots}${web}`)}
      ${leafWith(440, 520, 1.4, 8, 0.5, "leafG2", `${silver}${black}`)}
      ${pointer(2.6, "M110 214 L 140 300")}
      ${pointer(2.9, "M490 214 L 460 300")}
      <g transform="translate(96 150)"><g class="pop" style="--d:2.6">
        <circle r="62" fill="#0d2418" stroke="#ff8a8f" stroke-width="4"/>
        <circle r="62" fill="url(#glassG)"/>
        <path d="M-40 -30 Q 0 -50 40 -20" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.5" fill="none"/>
        <g class="hl-crawl" style="--o:.4">${mite}</g>
      </g></g>
      <g transform="translate(504 150)"><g class="pop" style="--d:2.9">
        <circle r="62" fill="#0d2418" stroke="#ff8a8f" stroke-width="4"/>
        <circle r="62" fill="url(#glassG)"/>
        <g transform="rotate(25)"><g class="hl-crawl" style="--o:1.3">${thrips}</g></g>
      </g></g>
      ${sparkles(
        [
          [140, 330, 3.2],
          [190, 390, 3.8],
        ],
        "#ffffff",
      )}
      ${label(160, 568, "паутинный клещ", "#ffffff", 1.6, 26)}
      ${label(160, 600, "точки и паутинка", "#ff8a8f", 1.9, 19)}
      ${label(440, 568, "трипсы", "#ffffff", 1.9, 26)}
      ${label(440, 600, "серебро и чёрные точки", "#ff8a8f", 2.2, 19)}`;
  },

  scale: () => {
    const plaques = [
      [298, 520, 0.9],
      [304, 478, 1.1],
      [296, 446, 1.3],
      [302, 352, 1.5],
      [297, 318, 1.7],
      [303, 196, 1.9],
    ];
    const drops = [
      [262, 548],
      [340, 500],
      [252, 470],
      [348, 380],
    ];
    const cotton = (x, y, d) => `
      <g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}"><g class="pulse">
        ${[
          [0, 0, 11],
          [12, -6, 9],
          [-10, -8, 8],
          [6, 9, 8],
          [-6, 8, 7],
          [16, 6, 6],
        ]
          .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fbfaf4"/>`)
          .join("")}
        <path d="M-14 4 L -24 10 M18 0 L 28 4 M-4 12 L -6 22 M10 12 L 14 22" stroke="#fbfaf4" stroke-width="2" stroke-linecap="round"/>
        <circle cx="-3" cy="-4" r="4" fill="#ffffff"/>
      </g></g></g>`;
    return `
      <defs>
        <linearGradient id="hlStemG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f6e35"/><stop offset=".45" stop-color="#6fbf62"/><stop offset="1" stop-color="#2f6e35"/></linearGradient>
        <radialGradient id="hlScaleG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d9a066"/><stop offset=".6" stop-color="#8a5228"/><stop offset="1" stop-color="#4a2a12"/></radialGradient>
        <radialGradient id="hlStickyG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#e0b040" stop-opacity=".6"/></radialGradient>
      </defs>
      <g class="grow" style="--d:.1"><rect x="288" y="80" width="24" height="520" rx="12" fill="url(#hlStemG)"/></g>
      ${stem("M300 420 C 330 400 350 380 368 356", 0.6, 9)}
      ${stem("M300 262 C 270 244 250 226 236 200", 0.8, 9)}
      ${leaf(366, 360, 0.72, 58, 0.9)}${leaf(238, 206, 0.72, -58, 1.1, "leafG2")}${leaf(300, 96, 0.5, 2, 1.2)}
      ${plaques
        .map(
          ([x, y, d]) =>
            `<g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}"><ellipse rx="12" ry="15" fill="url(#hlScaleG)"/><ellipse cx="-3" cy="-5" rx="4" ry="5" fill="#f4d3a8" opacity=".6"/><ellipse rx="12" ry="15" fill="none" stroke="#3a1f0a" stroke-width="1.5" opacity=".6"/></g></g>`,
        )
        .join("")}
      ${drops
        .map(
          ([x, y], i) =>
            `<g transform="translate(${x} ${y})"><g class="pop" style="--d:${2.2 + i * 0.25}"><g class="hl-glint" style="--o:${i * 0.5}"><path d="M0 -12 C 8 -2 10 4 0 10 C -10 4 -8 -2 0 -12 Z" fill="url(#hlStickyG)"/><circle cx="-2" cy="-2" r="2.5" fill="#ffffff"/></g></g></g>`,
        )
        .join("")}
      <path class="drip" style="--d:3.2" d="${dropPath(340, 512, 0.6)}" fill="#ffe9a8"/>
      ${cotton(318, 410, 2.6)}${cotton(282, 254, 3)}
      ${label(118, 470, "щитовка", "#ffb38a", 1.8, 26)}
      ${pointer(1.8, "M172 462 L 284 474", "#ffb38a")}
      ${label(118, 556, "липкий налёт", "#ffe9a8", 2.6, 22)}
      ${pointer(2.6, "M186 548 L 248 548", "#ffe9a8")}
      ${label2(476, 470, ["мучнистый", "червец"], "#ffffff", 3, 24)}
      ${pointer(3, "M420 456 L 336 416")}
      ${pointer(3.2, "M150 300 L 270 258")}
      ${label(100, 306, "в пазухах", "#ffffff", 3.2, 20)}`;
  },

  gnats: () => {
    const gnat = `<path d="M0 -2 L -9 -9 L -2 1 Z M0 -2 L 9 -9 L 2 1 Z" fill="#dfe8ff" opacity=".7" class="hl-flap"/><ellipse cx="0" cy="2" rx="2.6" ry="4.6" fill="#141414"/>`;
    const flyers = [
      [120, 300, 2.2, 0],
      [170, 270, 2.8, 0.7],
      [90, 340, 2.5, 1.3],
      [210, 320, 3.1, 0.3],
      [140, 240, 2.6, 1.9],
      [60, 290, 3.4, 1.1],
    ]
      .map(
        ([x, y, t, o], i) =>
          `<g transform="translate(${x} ${y}) scale(1.5)"><g class="fade" style="--d:${0.8 + i * 0.15}"><g class="hl-fly" style="--t:${t}s;--o:${o}">${gnat}</g></g></g>`,
      )
      .join("");
    const stuck = [
      [236, 196],
      [262, 222],
      [218, 238],
      [276, 186],
      [248, 252],
    ]
      .map(
        ([x, y], i) =>
          `<g transform="translate(${x} ${y}) rotate(${i * 50})"><g class="pop" style="--d:${2.4 + i * 0.5}"><path d="M0 -2 L -7 -7 L -2 1 Z M0 -2 L 7 -7 L 2 1 Z" fill="#6b6b5a" opacity=".7"/><ellipse cx="0" cy="2" rx="2.4" ry="4" fill="#141414"/></g></g>`,
      )
      .join("");
    const aphids = [
      [452, 230, -20],
      [438, 254, 15],
      [456, 278, -10],
      [440, 300, 25],
      [458, 322, -25],
      [444, 206, 10],
      [462, 252, 30],
      [436, 330, -5],
      [452, 352, 20],
    ]
      .map(
        ([x, y, r], i) =>
          `<g transform="translate(${x} ${y}) rotate(${r})"><g class="pop" style="--d:${1.6 + i * 0.15}"><g class="hl-crawl" style="--o:${i * 0.4}">
          <path d="M-5 -2 L -11 -6 M-5 2 L -12 3 M-4 5 L -10 10 M5 -2 L 11 -6 M5 2 L 12 3 M4 5 L 10 10" stroke="#3b5a1c" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M0 -10 C 7 -8 8 4 6 8 C 3 12 -3 12 -6 8 C -8 4 -7 -8 0 -10 Z" fill="${i % 3 ? "#a8d65a" : "#8cc240"}"/>
          <circle cx="-2" cy="-4" r="2" fill="#ffffff" opacity=".6"/></g></g></g>`,
      )
      .join("");
    return `
      ${cutPot(150, 420, 220, 110, "url(#hlWetG)", 0.1)}
      <defs><linearGradient id="hlWetG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2416"/><stop offset="1" stop-color="#170d06"/></linearGradient></defs>
      ${[
        [100, 452],
        [170, 470],
        [130, 500],
        [196, 450],
      ]
        .map(
          ([x, y], i) =>
            `<ellipse class="hl-glint" style="--o:${i * 0.6}" cx="${x}" cy="${y}" rx="${10 - i}" ry="3" fill="#9fd6ff" opacity=".7"/>`,
        )
        .join("")}
      ${stem("M240 404 L 240 280", 0.6, 6).replace("#4f9a4a", "#c9b48a")}
      <g transform="translate(246 218) rotate(6)"><g class="pop" style="--d:1">
        <rect x="-58" y="-56" width="116" height="104" rx="10" fill="#ffd23a"/>
        <rect x="-58" y="-56" width="116" height="104" rx="10" fill="none" stroke="#fff3a0" stroke-width="3"/>
        <path d="M-58 -22 H58 M-58 12 H58 M-20 -56 V48 M20 -56 V48" stroke="#e0a800" stroke-width="1.5" opacity=".6"/>
        <rect x="-44" y="-48" width="16" height="88" rx="8" fill="#ffffff" opacity=".3"/>
      </g></g>
      ${stuck}
      ${flyers}
      ${label(150, 572, "мошки — грунт сырой", "#ffffff", 1.4, 22)}
      ${label(150, 604, "подсушить, ловушки", "#ffd36e", 2.2, 20)}
      ${stem("M450 560 C 420 480 470 420 450 330 C 440 280 452 230 448 160", 0.4, 9)}
      ${leaf(448, 168, 0.38, 4, 0.9, "leafG2")}${leaf(446, 200, 0.3, -48, 1.1, "leafG2")}${leaf(452, 190, 0.3, 46, 1.2, "leafG2")}
      ${leaf(440, 440, 0.5, 64, 0.7)}${leaf(452, 400, 0.46, -60, 0.8)}
      ${aphids}
      ${label(450, 572, "тля — колонией", "#ffffff", 2.4, 22)}
      ${label(450, 604, "на молодых побегах", "#ffd36e", 2.6, 20)}`;
  },

  spray: `
    ${chip(300, 50, "от клеща — акарицид", "#c2a8ff", 2.2)}${chip(300, 104, "от насекомых — инсектицид", "#c2a8ff", 2.6)}
    <g class="rise" style="--d:.1"><g class="hl-press" style="--d:1">
      <ellipse cx="150" cy="412" rx="76" ry="10" fill="#000" opacity=".4" filter="url(#soft)"/>
      <rect x="96" y="250" width="108" height="156" rx="22" fill="#c2a8ff"/>
      <rect x="108" y="262" width="14" height="132" rx="7" fill="#ffffff" opacity=".4"/>
      <rect x="110" y="300" width="80" height="62" rx="10" fill="#f6f1ff"/>
      <text x="150" y="338" fill="#5a3fa0" font-family="Manrope" font-weight="800" font-size="16" text-anchor="middle">средство</text>
      <rect x="132" y="222" width="36" height="32" rx="6" fill="#ece6ff"/>
      <path d="M120 186 L 214 186 L 222 206 L 132 214 Z" fill="#5a3fa0"/>
      <rect x="214" y="190" width="18" height="12" rx="3" fill="#3b2a70"/>
      <path d="M156 212 Q 150 240 166 254" stroke="#3b2a70" stroke-width="10" fill="none" stroke-linecap="round"/>
    </g></g>
    <g transform="translate(234 196)">
      ${[0, 1]
        .map(
          (k) => `<g class="hl-puff" style="--d:${1 + k * 0.75}">
        <path d="M0 0 L 170 -60 Q 190 0 170 60 Z" fill="#e6dcff" opacity=".3"/>
        ${Array.from({ length: 16 }, (_, i) => `<circle cx="${30 + ((i * 47) % 140)}" cy="${(((i * 31) % 90) - 45) * (0.3 + ((i * 47) % 140) / 200)}" r="${3 + (i % 3) * 1.5}" fill="#f2ecff"/>`).join("")}
      </g>`,
        )
        .join("")}
    </g>
    ${potted(470, 420, 0.95, 0.5, "leafy")}
    ${sparkles(
      [
        [420, 200, 2.2],
        [500, 280, 2.8],
      ],
      "#e6dcff",
    )}
    ${label(300, 452, "×3 через 5–7 дней", "#c2a8ff", 2.6, 28)}
    ${[120, 300, 480]
      .map(
        (x, i) => `
      <g class="rise" style="--d:${2.8 + i * 0.3}">
        <rect x="${x - 50}" y="476" width="100" height="96" rx="18" fill="#f7f4ec"/>
        <rect x="${x - 50}" y="476" width="100" height="28" rx="14" fill="#c2a8ff"/>
        <rect x="${x - 50}" y="490" width="100" height="14" fill="#c2a8ff"/>
        <text x="${x}" y="556" fill="#2a1f4a" font-family="Unbounded" font-weight="900" font-size="38" text-anchor="middle">${i + 1}</text>
      </g>
      ${badge(x + 44, 480, true, 3.4 + i * 0.6, 17)}`,
      )
      .join("")}
    ${[210, 390]
      .map(
        (x, i) =>
          `<g class="fade" style="--d:${3.2 + i * 0.3}"><path d="M${x - 26} 524 L ${x + 24} 524 M${x + 12} 514 L ${x + 26} 524 L ${x + 12} 534" stroke="#c2a8ff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>${label(x, 598, "5–7 дн", "#ffffff", 3.4 + i * 0.3, 18)}`,
      )
      .join("")}`,

  safety: () => {
    const cardBox = (x, y, d) =>
      `<g class="rise" style="--d:${d}"><rect x="${x}" y="${y}" width="260" height="250" rx="28" fill="#ffffff" opacity=".07"/><rect x="${x}" y="${y}" width="260" height="250" rx="28" fill="none" stroke="#ffd36e" stroke-opacity=".35" stroke-width="2"/></g>`;
    const glove = `
      <path d="M-34 60 L -34 0 Q -50 -14 -54 -30 Q -56 -42 -44 -40 Q -34 -36 -28 -18 L -28 -58 Q -28 -68 -19 -68 Q -10 -68 -10 -58 L -10 -72 Q -10 -82 -1 -82 Q 8 -82 8 -72 L 8 -64 Q 8 -74 17 -74 Q 26 -74 26 -64 L 26 -50 Q 26 -58 34 -58 Q 42 -58 42 -48 L 42 10 Q 42 40 30 60 Z" fill="#7cc4ff"/>
      <rect x="-40" y="56" width="88" height="22" rx="8" fill="#4a98e6"/>
      <path d="M-20 -50 L -20 -10 M-1 -62 L -1 -10" stroke="#ffffff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>`;
    const sign = `
      <circle r="62" fill="#ffffff"/>
      <circle cx="-22" cy="-26" r="13" fill="#2a3a33"/>
      <path d="M-40 26 Q -40 -8 -22 -8 Q -4 -8 -4 26 Z" fill="#2a3a33"/>
      <g transform="translate(24 10)">
        <ellipse cx="0" cy="10" rx="13" ry="11" fill="#2a3a33"/>
        <ellipse cx="-14" cy="-6" rx="5" ry="7" fill="#2a3a33"/><ellipse cx="-5" cy="-14" rx="5" ry="7" fill="#2a3a33"/>
        <ellipse cx="6" cy="-14" rx="5" ry="7" fill="#2a3a33"/><ellipse cx="15" cy="-6" rx="5" ry="7" fill="#2a3a33"/>
      </g>
      <circle r="58" fill="none" stroke="#e5484d" stroke-width="12"/>
      <path d="M-41 -41 L 41 41" stroke="#e5484d" stroke-width="12" stroke-linecap="round"/>`;
    return `
      ${cardBox(30, 40, 0.1)}${cardBox(310, 40, 0.6)}${cardBox(30, 312, 1.1)}${cardBox(310, 312, 1.6)}
      <g transform="translate(160 150)"><g class="pop" style="--d:.4"><g class="hl-wave">${glove}</g></g></g>
      ${label(160, 262, "перчатки", "#ffffff", 0.7, 22)}
      <g class="fade" style="--d:.8">
        <rect x="380" y="74" width="120" height="146" rx="8" fill="url(#skyDawn)"/>
        <rect x="380" y="74" width="120" height="146" rx="8" fill="none" stroke="#e9e1d2" stroke-width="8"/>
        <path d="M500 78 L 540 96 L 540 236 L 500 216 Z" fill="#cfe9ff" opacity=".35" stroke="#e9e1d2" stroke-width="6" stroke-linejoin="round"/>
      </g>
      ${[0, 1, 2]
        .map(
          (i) =>
            `<g class="fade" style="--d:${1.2 + i * 0.2}"><path class="hl-wind" style="animation-delay:${-i * 0.4}s" d="M330 ${110 + i * 40} Q 380 ${96 + i * 40} 420 ${110 + i * 40} T 520 ${110 + i * 40}" stroke="#b4dcff" stroke-width="5" fill="none" stroke-linecap="round"/></g>`,
        )
        .join("")}
      ${label(440, 262, "открытое окно", "#ffffff", 1.2, 22)}
      <g transform="translate(160 414)"><g class="pop" style="--d:1.4"><g class="pulse">${sign}</g></g></g>
      ${label(160, 522, "не для детей", "#ffffff", 1.7, 20)}
      ${label(160, 546, "и животных", "#ffffff", 1.8, 20)}
      <g transform="translate(440 410) rotate(-4)"><g class="rise" style="--d:1.9">
        <rect x="-62" y="-74" width="124" height="150" rx="10" fill="#f7f4ec"/>
        <rect x="-62" y="-74" width="124" height="30" rx="10" fill="#ffd36e"/>
        <rect x="-62" y="-56" width="124" height="12" fill="#ffd36e"/>
        ${[0, 1, 2, 3]
          .map(
            (k) =>
              `<path class="draw" style="--d:${2.3 + k * 0.3}" pathLength="1" d="M-24 ${-22 + k * 26} L 44 ${-22 + k * 26}" stroke="#b9b2a2" stroke-width="7" stroke-linecap="round"/><path class="draw" style="--d:${2.5 + k * 0.3}" pathLength="1" d="M-48 ${-22 + k * 26} L -42 ${-16 + k * 26} L -32 ${-30 + k * 26}" stroke="#2f9d5c" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
          )
          .join("")}
      </g></g>
      ${label(440, 534, "по инструкции", "#ffffff", 2.2, 22)}
      ${chip(300, 612, "химия — только так", "#ffd36e", 3.4)}`;
  },

  // ---- Урок 15: болезни ----
  wilt: `
    <defs>
      <linearGradient id="hlWiltG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b7c97a"/><stop offset=".6" stop-color="#6f8a3a"/><stop offset="1" stop-color="#3f5320"/></linearGradient>
    </defs>
    <g class="fade" style="--d:1"><ellipse cx="300" cy="584" rx="160" ry="13" fill="#3f86d0" opacity=".45"/></g>
    <ellipse class="hl-ring" style="--d:1.4" cx="300" cy="584" rx="60" ry="6" fill="none" stroke="#9fd6ff" stroke-width="3"/>
    ${pot(300, 436, 200, 130, 0.1)}
    <g class="fade" style="--d:.6">
      <ellipse cx="300" cy="416" rx="100" ry="9" fill="#170d06"/>
      ${[
        [254, 416, 0],
        [318, 418, 0.8],
        [352, 414, 1.4],
      ]
        .map(([x, y, o]) => `<ellipse class="hl-glint" style="--o:${o}" cx="${x}" cy="${y}" rx="14" ry="3" fill="#9fd6ff" opacity=".8"/>`)
        .join("")}
    </g>
    <g class="hl-droop" style="transform-origin:300px 416px">
      ${stem("M300 416 C 298 350 304 290 300 240 C 297 206 330 184 360 202", 0.3, 10)}
      ${leaf(360, 200, 0.56, 168, 0.8, "hlWiltG")}
      ${leaf(300, 258, 0.6, -150, 0.9, "hlWiltG")}
      ${leaf(302, 300, 0.58, 145, 1.0, "hlWiltG")}
      ${leaf(298, 346, 0.55, -122, 1.3, "leafY")}
      ${leaf(302, 378, 0.52, 118, 1.5, "leafY")}
    </g>
    <g class="fade" style="--d:2"><path d="M300 418 C 299 404 301 392 300 380" stroke="#3a2414" stroke-width="13" stroke-linecap="round" fill="none"/></g>
    <circle class="hl-ring" style="--d:2.2" cx="300" cy="398" r="24" fill="none" stroke="#c2a8ff" stroke-width="3"/>
    ${label2(96, 318, ["основание", "темнеет"], "#c2a8ff", 2.2, 22)}
    ${pointer(2.2, "M150 346 L 284 394", "#c2a8ff")}
    ${label2(96, 470, ["мокрый", "грунт"], "#9fd6ff", 1.2, 22)}
    ${pointer(1.2, "M140 470 L 220 420", "#9fd6ff")}
    ${label2(508, 486, ["нижние", "желтеют"], "#ffe08a", 1.8, 22)}
    ${pointer(1.8, "M470 478 L 378 414", "#ffe08a")}
    ${[230, 300, 370]
      .map(
        (x, i) =>
          `<g class="fade" style="--d:2.6"><path class="hl-waft" style="--d:${2.6 + i * 0.7}" d="M${x} 236 q 12 -14 0 -28 q -12 -14 0 -28 q 12 -14 0 -28" stroke="#c8d68a" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/></g>`,
      )
      .join("")}
    ${label(300, 100, "кислый запах", "#c8d68a", 3, 26)}`,

  shield: () => {
    const icons = [
      [
        105,
        120,
        ["полив", "по грунту"],
        "#7cc4ff",
        `<rect x="-30" y="22" width="60" height="10" rx="5" fill="#8a5a2b"/>${can(-4, -6, -30, 0.36)}${[0, 1].map((i) => `<path class="hl-glint" style="--o:${i}" d="${dropPath(-8 + i * 8, -2 + i * 10, 0.6)}" fill="#7cc4ff"/>`).join("")}`,
      ],
      [
        495,
        120,
        ["рыхлая", "земля"],
        "#ffb38a",
        `<path d="M-34 24 Q -20 -18 0 -20 Q 20 -18 34 24 Z" fill="#8a5a2b"/>${[
          [-14, 6],
          [6, -4],
          [16, 12],
          [-2, 14],
          [-20, 18],
        ]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#d9a066"/>`)
          .join("")}`,
      ],
      [
        105,
        410,
        ["свежий", "воздух"],
        "#b4dcff",
        [0, 1, 2]
          .map(
            (i) =>
              `<path class="hl-wind" style="animation-delay:${-i * 0.5}s" d="M-34 ${-16 + i * 16} Q -10 ${-26 + i * 16} 6 ${-16 + i * 16} T 34 ${-16 + i * 16}" stroke="#b4dcff" stroke-width="5" fill="none" stroke-linecap="round"/>`,
          )
          .join(""),
      ],
      [
        495,
        410,
        ["чистые", "инструменты"],
        "#ffd36e",
        `<g transform="rotate(-30)"><circle cx="-14" cy="20" r="10" fill="none" stroke="#ffd36e" stroke-width="5"/><circle cx="14" cy="20" r="10" fill="none" stroke="#ffd36e" stroke-width="5"/><path d="M-8 12 L 10 -30 M8 12 L -10 -30" stroke="#e9e1d2" stroke-width="6" stroke-linecap="round"/></g><path d="M24 -24 L 27 -15 L 36 -12 L 27 -9 L 24 0 L 21 -9 L 12 -12 L 21 -15 Z" fill="#ffffff"/>`,
      ],
    ];
    return `
      <defs>
        <linearGradient id="hlShieldG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8be3a8"/><stop offset=".55" stop-color="#2f9d5c"/><stop offset="1" stop-color="#14512f"/></linearGradient>
      </defs>
      ${icons.map(([x, y], i) => pointer(1.4 + i * 0.3, `M${x < 300 ? x + 60 : x - 60} ${y + (y < 300 ? 30 : -10)} L ${x < 300 ? 220 : 380} ${y < 300 ? 230 : 330}`, "#8be3a8")).join("")}
      <g transform="translate(300 280)">
        <circle class="hl-ring" style="--d:1.6" r="110" fill="none" stroke="#8be3a8" stroke-width="4"/>
        <circle class="hl-ring" style="--d:2.6" r="110" fill="none" stroke="#8be3a8" stroke-width="4"/>
        <g class="pop" style="--d:.2">
          <path d="M0 -130 L 100 -96 L 100 -10 Q 100 80 0 130 Q -100 80 -100 -10 L -100 -96 Z" fill="url(#hlShieldG)" filter="url(#glow)"/>
          <path d="M0 -112 L 84 -84 L 84 -12 Q 84 66 0 110 Q -84 66 -84 -12 L -84 -84 Z" fill="none" stroke="#e8ffe9" stroke-opacity=".5" stroke-width="4"/>
          <path d="M-60 -90 L 0 -110 L 0 100 Q -70 60 -70 -10 Z" fill="#ffffff" opacity=".12"/>
        </g>
      </g>
      ${leaf(300, 360, 0.95, 0, 0.7, "leafG2")}
      ${icons
        .map(
          ([x, y, txt, color, icon], i) => `
        <g transform="translate(${x} ${y})"><g class="pop" style="--d:${1.2 + i * 0.3}">
          <circle r="54" fill="#0d2418"/><circle r="54" fill="${color}" opacity=".14"/><circle r="54" fill="none" stroke="${color}" stroke-width="4"/>${icon}
        </g></g>
        ${label2(x, y + 86, txt, "#ffffff", 1.5 + i * 0.3, 21)}`,
        )
        .join("")}
      ${sparkles(
        [
          [210, 140, 2.6],
          [400, 150, 3],
          [300, 470, 3.4],
        ],
        "#8be3a8",
      )}
      ${chip(300, 612, "без сквозняков", "#8be3a8", 3)}`;
  },

  // ---- Урок 21: питомцы ----
  vet: `
    <g transform="translate(130 140)">
      <circle class="hl-ring" style="--d:1.2" r="58" fill="none" stroke="#ff8a8f" stroke-width="4"/>
      <circle class="hl-ring" style="--d:2.2" r="58" fill="none" stroke="#ff8a8f" stroke-width="4"/>
      <g class="pop" style="--d:.6"><g class="pulse">
        <circle r="60" fill="#ffffff" filter="url(#glow)"/>
        <path d="M-14 -40 H14 V-14 H40 V14 H14 V40 H-14 V14 H-40 V-14 H-14 Z" fill="#e5484d"/>
      </g></g>
    </g>
    ${label(130, 240, "ветеринар", "#ff8a8f", 1, 24)}
    <g transform="translate(150 560)"><g class="rise" style="--d:.2">${cat(`<path class="pulse" d="M44 -214 q 8 14 0 22 q -8 -8 0 -22 Z" fill="#9fd6ff"/>`)}</g></g>
    <g class="rise" style="--d:1.4">
      <ellipse cx="440" cy="532" rx="110" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
      <rect x="340" y="90" width="200" height="420" rx="32" fill="#0d1f17" stroke="#ffffff40" stroke-width="3"/>
      <rect x="350" y="100" width="180" height="400" rx="24" fill="#f4f1e8"/>
      <rect x="410" y="110" width="60" height="12" rx="6" fill="#0d1f17"/>
      <text x="440" y="156" fill="#14512f" font-family="Manrope" font-weight="800" font-size="17" text-anchor="middle">Фото растения</text>
      <rect x="362" y="172" width="156" height="210" rx="16" fill="#cfe9d8"/>
      <rect x="362" y="320" width="156" height="62" fill="#b7dcc4"/>
    </g>
    ${potted(440, 372, 0.68, 2, "leafy")}
    <rect class="hl-flash" style="--d:2.9" x="362" y="172" width="156" height="210" rx="16" fill="#ffffff"/>
    <g class="fade" style="--d:2">
      <rect x="370" y="398" width="140" height="22" rx="11" fill="#e3ddd0"/>
      <text x="440" y="414" fill="#5f6f66" font-family="Manrope" font-weight="700" font-size="13" text-anchor="middle">название вида</text>
      <circle cx="440" cy="458" r="26" fill="#ffffff" stroke="#2f9d5c" stroke-width="5"/>
      <circle cx="440" cy="458" r="18" fill="#2f9d5c"/>
    </g>
    <circle class="hl-ring" style="--d:2.7" cx="440" cy="458" r="26" fill="none" stroke="#2f9d5c" stroke-width="4"/>
    ${badge(520, 180, true, 3.2, 22)}
    <g class="fade" style="--d:1.8"><path class="hl-stream" d="M220 330 Q 280 300 330 300" stroke="#ff8a8f" stroke-width="5" fill="none" stroke-linecap="round"/></g>
    ${chip(300, 612, "захватите фото растения", "#ff8a8f", 3.4)}`,
};

/** Акцентные цвета сцен. */
export const accent = {
  calendar: "#ffd36e",
  fert: "#ff9f6e",
  months: "#8be3a8",
  halfDose: "#ffd36e",
  order: "#7cc4ff",
  crust: "#ffb38a",
  bugs: "#ff8a8f",
  mite: "#ff8a8f",
  scale: "#ffb38a",
  gnats: "#ffd36e",
  spray: "#c2a8ff",
  safety: "#ffd36e",
  wilt: "#c2a8ff",
  shield: "#8be3a8",
  vet: "#ff8a8f",
};

/** CSS-анимации сцен этого файла (префикс hl-). */
export const css = `
  .hl-burn { animation: hl-burn 1.4s ease-in-out infinite both; }
  @keyframes hl-burn { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
  .hl-fly { animation: hl-fly var(--t, 2.4s) ease-in-out infinite; animation-delay: calc(var(--o, 0) * -1s); }
  @keyframes hl-fly { 0%,100% { transform: translate(0, 0); } 25% { transform: translate(34px, -22px); } 50% { transform: translate(6px, -44px); } 75% { transform: translate(-30px, -14px); } }
  .hl-flap { transform-box: fill-box; transform-origin: 50% 100%; animation: hl-flap .16s linear infinite alternate; }
  @keyframes hl-flap { from { transform: scaleY(1); } to { transform: scaleY(.3); } }
  .hl-crawl { animation: hl-crawl 3s ease-in-out infinite; animation-delay: calc(var(--o, 0) * -1s); }
  @keyframes hl-crawl { 0%,100% { transform: translate(0, 0) rotate(0); } 50% { transform: translate(5px, -4px) rotate(12deg); } }
  .hl-scan { animation: hl-scan 6s cubic-bezier(.45,0,.55,1) both; animation-delay: .6s; }
  @keyframes hl-scan { 0% { transform: translate(520px, 580px); opacity: 0; } 12% { opacity: 1; } 35% { transform: translate(240px, 445px); } 65% { transform: translate(340px, 365px); } 85% { transform: translate(370px, 455px); } 100% { transform: translate(330px, 405px); opacity: 1; } }
  .hl-melt { animation: hl-melt 1.6s ease both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-melt { to { opacity: 0; } }
  .hl-stop { animation: hl-melt .5s ease both; animation-delay: calc(var(--d) * 1s); }
  .hl-soak { transform-box: fill-box; transform-origin: 50% 0%; animation: hl-soak 1.8s ease-in both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-soak { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .hl-fall { animation: hl-fall 1s cubic-bezier(.5,0,1,1) infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-fall { from { transform: translate(0, 0); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } to { transform: translate(var(--dx), var(--dy, 150px)); opacity: 0; } }
  .hl-stream { stroke-dasharray: 14 8; animation: hl-stream .45s linear infinite; }
  @keyframes hl-stream { to { stroke-dashoffset: -22; } }
  .hl-puff { animation: hl-puff 1.5s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-puff { from { transform: scale(.15); opacity: 0; } 20% { opacity: 1; } to { transform: scale(1.05); opacity: 0; } }
  .hl-press { animation: hl-press 1.5s ease-in-out infinite; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-press { 0%,40%,100% { transform: translateX(0); } 10% { transform: translateX(-6px); } }
  .hl-waft { animation: hl-waft 2.4s ease-in-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-waft { from { transform: translateY(20px); opacity: 0; } 35% { opacity: 1; } to { transform: translateY(-60px); opacity: 0; } }
  .hl-droop { animation: hl-droop 5s ease-in-out infinite; }
  @keyframes hl-droop { 0%,100% { transform: rotate(-1deg); } 50% { transform: rotate(3deg); } }
  .hl-ring { transform-box: fill-box; transform-origin: center; animation: hl-ring 2s ease-out infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-ring { from { transform: scale(1); opacity: 0; } 10% { opacity: .9; } to { transform: scale(1.8); opacity: 0; } }
  .hl-spin { animation: hl-spin 8s linear infinite; }
  @keyframes hl-spin { to { transform: rotate(360deg); } }
  .hl-tear { transform-box: fill-box; transform-origin: 0% 0%; animation: hl-tear .9s ease-in both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-tear { 0% { transform: none; opacity: 0; } 12% { transform: none; opacity: 1; } 100% { transform: translate(70px, 140px) rotate(28deg); opacity: 0; } }
  .hl-flash { animation: hl-flash .9s ease-out both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-flash { 0% { opacity: 0; } 15% { opacity: .95; } 100% { opacity: 0; } }
  .hl-bubble { animation: hl-bubble 2.4s ease-in infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes hl-bubble { from { transform: translateY(0); opacity: 0; } 20% { opacity: .9; } to { transform: translateY(-140px); opacity: 0; } }
  .hl-wind { stroke-dasharray: 40 30; animation: hl-wind 1.4s linear infinite; }
  @keyframes hl-wind { to { stroke-dashoffset: -70; } }
  .hl-wave { transform-box: fill-box; transform-origin: 50% 100%; animation: hl-wave 1.8s ease-in-out infinite; }
  @keyframes hl-wave { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
  .hl-glint { animation: hl-glint 2s ease-in-out infinite; animation-delay: calc(var(--o, 0) * -1s); }
  @keyframes hl-glint { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
`;
