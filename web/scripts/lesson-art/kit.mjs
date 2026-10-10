/**
 * Детали для сцен видеоуроков (scripts/build-lessons.mjs): листья, стебли, горшки, подписи, чипы,
 * телефон с карточками. Всё рисуется в SVG 600×600; анимации — классы из ANIM_CSS (.pop, .rise, .fade,
 * .draw, .grow) с задержкой --d в секундах.
 */

/** Сердцевидный лист с бликом и жилкой (рисуется вверх от точки крепления). */
export const leaf = (x, y, s, r, d, g = "leafG") => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><g class="pop" style="--d:${d}">
    <path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z" fill="url(#${g})"/>
    <path d="M0 -6 C -3 -60 -2 -112 0 -148" stroke="#0f3f23" stroke-opacity=".55" stroke-width="4" fill="none"/>
    <path d="M-22 -118 C -40 -96 -44 -70 -36 -50" stroke="#ffffff" stroke-opacity=".35" stroke-width="7" stroke-linecap="round" fill="none"/>
  </g></g>`;

export const stem = (d, delay, w = 9) =>
  `<path class="draw" style="--d:${delay}" pathLength="1" d="${d}" stroke="#4f9a4a" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

export const pot = (x, y, w = 190, h = 150, d = 0) => `
  <g class="rise" style="--d:${d}">
    <ellipse cx="${x}" cy="${y + h + 14}" rx="${w * 0.62}" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
    <path d="M${x - w / 2} ${y} L ${x + w / 2} ${y} L ${x + w * 0.38} ${y + h} L ${x - w * 0.38} ${y + h} Z" fill="url(#potG)"/>
    <rect x="${x - w / 2 - 12}" y="${y - 26}" width="${w + 24}" height="38" rx="10" fill="#c4643a"/>
    <rect x="${x - w / 2 - 12}" y="${y - 26}" width="${w + 24}" height="8" rx="4" fill="#f0a072" opacity=".6"/>
    <ellipse cx="${x}" cy="${y - 20}" rx="${w / 2}" ry="9" fill="#3b2516"/>
  </g>`;

export const label = (x, y, text, color, d, size = 30, anchor = "middle") =>
  `<text class="fade" style="--d:${d}" x="${x}" y="${y}" fill="${color}" font-family="Manrope" font-weight="800" font-size="${size}" text-anchor="${anchor}">${text}</text>`;

export const chip = (x, y, text, color, d) => `
  <g class="pop" style="--d:${d}">
    <rect x="${x - text.length * 9 - 22}" y="${y - 30}" width="${text.length * 18 + 44}" height="46" rx="23" fill="${color}" opacity=".16" stroke="${color}" stroke-opacity=".6" stroke-width="2"/>
    <text x="${x}" y="${y + 1}" fill="${color}" font-family="Manrope" font-weight="800" font-size="24" text-anchor="middle">${text}</text>
  </g>`;

export const sparkles = (pts, color) =>
  pts
    .map(
      ([x, y, d], i) =>
        `<g transform="translate(${x} ${y})"><path class="twinkle" style="--d:${d};--i:${i}" d="M0 -14 L 3 -3 L 14 0 L 3 3 L 0 14 L -3 3 L -14 0 L -3 -3 Z" fill="${color}"/></g>`,
    )
    .join("");

/** Ростки для горшка pot(0, -60, 90, 60): растут вверх от грунта (0, -78). */
const SPROUT = {
  leafy: (d) =>
    `${stem("M0 -78 C -4 -120 6 -160 0 -200", d + 0.3, 8)}${leaf(0, -192, 0.42, 4, d + 0.6)}${leaf(2, -120, 0.36, 46, d + 0.8, "leafG2")}${leaf(-2, -150, 0.38, -44, d + 1)}`,
  snake: (d) =>
    [-18, 0, 18]
      .map(
        (dx, i) =>
          `<path class="grow" style="--d:${d + 0.3 + i * 0.12}" d="M${dx - 12} -78 Q ${dx - 14} -150 ${dx} ${-220 + (i % 2) * 34} Q ${dx + 14} -150 ${dx + 12} -78 Z" fill="url(#leafG)" stroke="#d8e88a" stroke-width="3"/>`,
      )
      .join(""),
  zz: (d) =>
    [-22, 0, 22]
      .map(
        (dx, i) =>
          stem(`M0 -78 C ${dx * 0.4} -120 ${dx} -160 ${dx * 1.1} -205`, d + 0.3 + i * 0.1, 6) +
          [0, 1, 2, 3]
            .map((j) => {
              const cx = dx * (0.5 + j * 0.18) + (j % 2 ? 10 : -10);
              const cy = -105 - j * 30;
              return `<g transform="rotate(${j % 2 ? 30 : -30} ${cx} ${cy})"><ellipse class="pop" style="--d:${d + 0.7 + j * 0.1}" cx="${cx}" cy="${cy}" rx="9" ry="17" fill="url(#leafG)"/></g>`;
            })
            .join(""),
      )
      .join(""),
  aspid: (d) =>
    [-26, -9, 9, 26]
      .map(
        (r, i) =>
          `<g transform="translate(0 -78) rotate(${r})"><path class="grow" style="--d:${d + 0.3 + i * 0.12}" d="M0 0 C -24 -60 -22 -160 0 -215 C 22 -160 24 -60 0 0 Z" fill="url(#leafG)"/></g>`,
      )
      .join(""),
  chloro: (d) =>
    [-70, -40, -14, 14, 40, 70]
      .map((dx, i) => {
        const path = `M0 -78 Q ${dx * 0.5} -190 ${dx * 1.4} ${-60 - Math.abs(dx) * 0.6}`;
        const delay = d + 0.3 + i * 0.1;
        return `<path class="draw" style="--d:${delay}" pathLength="1" d="${path}" stroke="#4fbf74" stroke-width="11" fill="none" stroke-linecap="round"/><path class="draw" style="--d:${delay}" pathLength="1" d="${path}" stroke="#e8f7c8" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      })
      .join(""),
};

/** Растение в горшке; (x, y) — середина дна горшка. */
export const potted = (x, y, s, d, kind = "leafy") =>
  `<g transform="translate(${x} ${y}) scale(${s})">${pot(0, -60, 90, 60, d)}${SPROUT[kind](d)}</g>`;

/** Точка на кубической кривой Безье — для листьев вдоль лианы. */
const bez = (t, [x0, y0], [x1, y1], [x2, y2], [x3, y3]) => {
  const u = 1 - t;
  return [
    u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
    u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
  ];
};

/** Лиана: стебель прорисовывается за dur секунд, листья появляются вслед за ним. */
export const vine = (pts, d, dur, n) =>
  `<path class="draw" style="--d:${d};animation-duration:${dur}s" pathLength="1" d="M${pts[0]} C ${pts[1]} ${pts[2]} ${pts[3]}" stroke="#4f9a4a" stroke-width="7" fill="none" stroke-linecap="round"/>` +
  Array.from({ length: n }, (_, k) => {
    const t = (k + 1) / n;
    const [x, y] = bez(t, ...pts);
    return leaf(x.toFixed(0), y.toFixed(0), 0.3, k % 2 ? 70 : -110, d + t * dur * 0.9, k % 2 ? "leafG2" : "leafG");
  }).join("");

/** Телефон с экраном приложения; inner — в координатах от середины верхнего края. */
export const phone = (x, y, inner, d = 0) => `
  <g transform="translate(${x} ${y})"><g class="rise" style="--d:${d}">
    <rect x="-130" y="0" width="260" height="500" rx="38" fill="#0d1f17" stroke="#ffffff40" stroke-width="3"/>
    <rect x="-118" y="12" width="236" height="476" rx="30" fill="#f4f1e8"/>
    <rect x="-40" y="22" width="80" height="16" rx="8" fill="#0d1f17"/>
    <text x="-96" y="76" fill="#14512f" font-family="Unbounded" font-weight="900" font-size="20">Подоконник</text>
    ${inner}
  </g></g>`;

/** Карточка в телефоне: иконка-лист, заголовок и подпись. */
export const card = (y, title, sub, d) => `
  <g class="rise" style="--d:${d}">
    <rect x="-104" y="${y}" width="208" height="76" rx="18" fill="#ffffff"/>
    <circle cx="-70" cy="${y + 38}" r="22" fill="#d6f2df"/>
    <path d="M0 10 C -12 4 -14 -14 0 -22 C 14 -14 12 4 0 10 Z" fill="#2f9d5c" transform="translate(-70 ${y + 42})"/>
    <text x="-38" y="${y + 34}" fill="#15241b" font-family="Manrope" font-weight="800" font-size="17">${title}</text>
    <text x="-38" y="${y + 58}" fill="#5f6f66" font-family="Manrope" font-weight="600" font-size="14">${sub}</text>
  </g>`;

/** Галочка или крестик в кружке. */
export const badge = (x, y, ok, d, r = 34) => `
  <g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}">
    <circle r="${r}" fill="${ok ? "#2e9d5c" : "#e5484d"}"/>
    <g transform="scale(${r / 38})"><path d="${ok ? "M-16 0 L -4 13 L 18 -12" : "M-13 -13 L 13 13 M13 -13 L -13 13"}" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/></g>
  </g></g>`;

/** Круглый значок с иконкой и подписью. */
export const roundel = (x, y, icon, text, color, d) => `
  <g transform="translate(${x} ${y})"><g class="pop" style="--d:${d}">
    <circle r="54" fill="#ffffff14" stroke="${color}" stroke-width="4"/>${icon}
  </g></g>${label(x, y + 86, text, "#ffffff", d + 0.3, 22)}`;
