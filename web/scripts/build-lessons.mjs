/**
 * Видеоуроки курса «Новичкам»: из src/data/lessons.json собирает вертикальные ролики
 * 1080×1920 (public/lessons/<guide>.mp4) и обложки (<guide>.jpg).
 *
 * Звук — scripts/lessons-audio.py: голос Vosk TTS («Наташа», SOVA — Apache 2.0, коммерческое
 * использование разрешено), каждое предложение отдельно (точные субтитры), и своя
 * сгенерированная музыка — без чужих прав. Картинка — анимированные сцены HTML/SVG/CSS:
 * браузер (Playwright) останавливает все анимации на нужном моменте и снимает кадр за кадром,
 * поэтому видео плавное и точно совпадает с голосом. ffmpeg собирает кадры и звук.
 *
 * Запуск (что установить — в scripts/LESSONS.md):
 *   PYTHON=…/venv/bin/python VOSK_MODEL=…/vosk-tts-ru FFMPEG=…/ffmpeg node scripts/build-lessons.mjs [guide]
 *   AUDIO_DIR=… — взять уже готовый звук (timeline.json + audio.wav) и только перерисовать картинку.
 */

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "scripts/lesson-assets");
const OUT = join(ROOT, "public/lessons");
const { PYTHON = "python3", VOSK_MODEL, SPEAKER = "1", FFMPEG = "ffmpeg", CHROMIUM, AUDIO_DIR, PREVIEW } = process.env;

const W = 720;
const H = 1280;
const SCALE = 1.5; // кадр 1080×1920
const FPS = 30;

const lessons = JSON.parse(readFileSync(join(ROOT, "src/data/lessons.json"), "utf8"));
const only = process.argv[2];

// ---------------------------------------------------------------------------
// Шрифты (OFL): Unbounded — заголовки, Manrope — текст. Встраиваем в страницу — без сети.
// ---------------------------------------------------------------------------

const FONTS = readFileSync(join(ASSETS, "fonts.txt"), "utf8")
  .trim()
  .split("\n")
  .map((line) => {
    const [family, weight, subset, file] = line.split("|");
    const range =
      subset === "cyrillic" ? "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" : "U+0000-00FF, U+2000-206F, U+20AC, U+2212";
    const data = readFileSync(join(ASSETS, file)).toString("base64");
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range}}`;
  })
  .join("\n");

// ---------------------------------------------------------------------------
// Сцены: у каждой свой акцентный цвет и рисунок 600×600 с анимациями.
// Классы анимаций: .draw — линия прорисовывается, .pop — вырастает, .rise — всплывает,
// .fade — проявляется; задержка — переменная --d (в секундах).
// ---------------------------------------------------------------------------

const ACCENT = {
  intro: "#8be3a8",
  light: "#ffd36e",
  water: "#7cc4ff",
  pot: "#ff9f6e",
  easy: "#8be3a8",
  quarantine: "#c2a8ff",
  wait: "#62e3d3",
  winter: "#b4dcff",
  outro: "#8be3a8",
};

const DEFS = `<defs>
  <linearGradient id="leafG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ee6a0"/><stop offset=".55" stop-color="#2f9d5c"/><stop offset="1" stop-color="#14512f"/></linearGradient>
  <linearGradient id="leafG2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6f0bd"/><stop offset=".6" stop-color="#3fae6b"/><stop offset="1" stop-color="#1b5e37"/></linearGradient>
  <linearGradient id="potG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a94f2c"/><stop offset=".45" stop-color="#e07a4a"/><stop offset="1" stop-color="#8e3f22"/></linearGradient>
  <linearGradient id="soilG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4429"/><stop offset="1" stop-color="#2e1c10"/></linearGradient>
  <linearGradient id="dryG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c79a6a"/><stop offset="1" stop-color="#9c7148"/></linearGradient>
  <linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd6ff" stop-opacity=".9"/><stop offset="1" stop-color="#2f80ed" stop-opacity=".75"/></linearGradient>
  <linearGradient id="skyDawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a5a"/><stop offset=".55" stop-color="#e87d5d"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
  <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050b22"/><stop offset="1" stop-color="#1b2f5e"/></linearGradient>
  <linearGradient id="beamG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2c4" stop-opacity=".85"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></linearGradient>
  <radialGradient id="glassG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".6" stop-color="#cfe9ff" stop-opacity=".12"/><stop offset="1" stop-color="#ffffff" stop-opacity=".05"/></radialGradient>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
</defs>`;

/** Сердцевидный лист с бликом и жилкой (рисуется вверх от точки крепления). */
const leaf = (x, y, s, r, d, g = "leafG") => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><g class="pop" style="--d:${d}">
    <path d="M0 0 C -62 -28 -74 -112 0 -156 C 74 -112 62 -28 0 0 Z" fill="url(#${g})"/>
    <path d="M0 -6 C -3 -60 -2 -112 0 -148" stroke="#0f3f23" stroke-opacity=".55" stroke-width="4" fill="none"/>
    <path d="M-22 -118 C -40 -96 -44 -70 -36 -50" stroke="#ffffff" stroke-opacity=".35" stroke-width="7" stroke-linecap="round" fill="none"/>
  </g></g>`;

const stem = (d, delay, w = 9) =>
  `<path class="draw" style="--d:${delay}" pathLength="1" d="${d}" stroke="#4f9a4a" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

const pot = (x, y, w = 190, h = 150, d = 0) => `
  <g class="rise" style="--d:${d}">
    <ellipse cx="${x}" cy="${y + h + 14}" rx="${w * 0.62}" ry="14" fill="#000" opacity=".45" filter="url(#soft)"/>
    <path d="M${x - w / 2} ${y} L ${x + w / 2} ${y} L ${x + w * 0.38} ${y + h} L ${x - w * 0.38} ${y + h} Z" fill="url(#potG)"/>
    <rect x="${x - w / 2 - 12}" y="${y - 26}" width="${w + 24}" height="38" rx="10" fill="#c4643a"/>
    <rect x="${x - w / 2 - 12}" y="${y - 26}" width="${w + 24}" height="8" rx="4" fill="#f0a072" opacity=".6"/>
    <ellipse cx="${x}" cy="${y - 20}" rx="${w / 2}" ry="9" fill="#3b2516"/>
  </g>`;

const label = (x, y, text, color, d, size = 30, anchor = "middle") =>
  `<text class="fade" style="--d:${d}" x="${x}" y="${y}" fill="${color}" font-family="Manrope" font-weight="800" font-size="${size}" text-anchor="${anchor}">${text}</text>`;

const chip = (x, y, text, color, d) => `
  <g class="pop" style="--d:${d}">
    <rect x="${x - text.length * 9 - 22}" y="${y - 30}" width="${text.length * 18 + 44}" height="46" rx="23" fill="${color}" opacity=".16" stroke="${color}" stroke-opacity=".6" stroke-width="2"/>
    <text x="${x}" y="${y + 1}" fill="${color}" font-family="Manrope" font-weight="800" font-size="24" text-anchor="middle">${text}</text>
  </g>`;

const sparkles = (pts, color) =>
  pts
    .map(
      ([x, y, d], i) =>
        `<g transform="translate(${x} ${y})"><path class="twinkle" style="--d:${d};--i:${i}" d="M0 -14 L 3 -3 L 14 0 L 3 3 L 0 14 L -3 3 L -14 0 L -3 -3 Z" fill="${color}"/></g>`,
    )
    .join("");

const ART = {
  intro: `
    <g class="fade" style="--d:0">
      <path d="M120 560 L120 210 Q120 90 300 90 Q480 90 480 210 L480 560 Z" fill="url(#skyDawn)"/>
      <circle class="sunrise" cx="300" cy="420" r="58" fill="#fff3c2" filter="url(#glow)"/>
      <path d="M120 560 L120 210 Q120 90 300 90 Q480 90 480 210 L480 560" fill="none" stroke="#e9e1d2" stroke-width="16"/>
      <path d="M300 96 L300 560 M124 330 L476 330" stroke="#e9e1d2" stroke-width="9"/>
    </g>
    <rect class="rise" style="--d:.2" x="70" y="548" width="460" height="30" rx="8" fill="#d9cdb8"/>
    ${pot(300, 446, 150, 102, 0.4)}
    ${stem("M300 430 C 296 380 306 330 300 250", 0.9)}
    ${stem("M300 360 C 340 340 360 320 372 296", 1.4, 7)}
    ${stem("M300 330 C 262 312 246 292 236 270", 1.7, 7)}
    ${leaf(300, 256, 0.62, 4, 1.6)}${leaf(370, 300, 0.5, 38, 2.0, "leafG2")}${leaf(238, 274, 0.52, -40, 2.3)}
    ${sparkles(
      [
        [170, 170, 2.6],
        [430, 220, 3.0],
        [400, 140, 3.4],
      ],
      "#fff3c2",
    )}`,
  light: `
    <g class="fade" style="--d:0">
      <rect x="40" y="70" width="110" height="420" rx="14" fill="#fff4cf" filter="url(#glow)"/>
      <path d="M95 70 L95 490 M40 280 L150 280" stroke="#d8c9a3" stroke-width="7"/>
    </g>
    <path class="beam" d="M150 80 L 590 300 L 590 520 L 150 490 Z" fill="url(#beamG)" opacity=".55"/>
    <rect x="30" y="520" width="560" height="10" rx="5" fill="#ffffff" opacity=".12"/>
    ${[
      [230, 1.0, 1, "100%", "0,5 м", 0.6],
      [380, 0.82, 0.62, "50%", "1 м", 1.6],
      [520, 0.66, 0.36, "25%", "2 м", 2.6],
    ]
      .map(
        ([x, s, o, pct, dist, d]) => `
      <g style="opacity:${o}">
        <g transform="translate(${x} 470) scale(${s})">
          ${pot(0, 0, 110, 70, d)}
          ${stem("M0 -16 C -4 -60 6 -100 0 -150", d + 0.3, 8)}
          ${leaf(0, -140, 0.45, 6, d + 0.6)}${leaf(4, -70, 0.38, 46, d + 0.8, "leafG2")}${leaf(-2, -100, 0.4, -44, d + 1)}
        </g>
      </g>
      ${label(x, 590, dist, "#ffffff", d + 0.4, 26)}
      ${label(x, 250 - (x - 230) * 0.15, pct, "#ffd36e", d + 0.9, 40)}`,
      )
      .join("")}`,
  water: `
    <g class="rise" style="--d:0">
      <path d="M140 170 L 460 170 L 420 560 L 180 560 Z" fill="url(#potG)" opacity=".95"/>
      <path d="M156 196 L 444 196 L 410 540 L 190 540 Z" fill="url(#soilG)"/>
      <path class="dry" d="M156 196 L 444 196 L 438 256 L 162 256 Z" fill="url(#dryG)"/>
      <rect x="128" y="150" width="344" height="34" rx="10" fill="#c4643a"/>
    </g>
    <g class="fade" style="--d:1.2">
      <path d="M470 198 L 490 198 L 490 256 L 470 256" stroke="#ffffff" stroke-width="4" fill="none"/>
      ${label(500, 238, "2–3 см", "#ffffff", 1.2, 28, "start")}
    </g>
    <g class="finger">
      <rect x="276" y="-60" width="48" height="230" rx="24" fill="#f2c6a6"/>
      <rect x="282" y="-60" width="36" height="40" rx="14" fill="#ffffff" opacity=".35"/>
    </g>
    ${[0, 1, 2, 3, 4]
      .map(
        (i) => `<path class="drop" style="--d:${4.2 + i * 0.35}" d="M${220 + i * 40} 40 q 10 18 0 28 q -10 -10 0 -28 Z" fill="#7cc4ff"/>`,
      )
      .join("")}
    ${chip(300, 615, "Сухо — поливаем", "#7cc4ff", 3.4)}`,
  pot: `
    ${[
      [170, false, 0],
      [430, true, 0.5],
    ]
      .map(
        ([x, hole, d]) => `
      <g class="rise" style="--d:${d}">
        <path d="M${x - 120} 210 L ${x + 120} 210 L ${x + 92} 480 L ${x - 92} 480 Z" fill="url(#potG)"/>
        <path d="M${x - 106} 230 L ${x + 106} 230 L ${x + 82} 466 L ${x - 82} 466 Z" fill="url(#soilG)"/>
        <rect class="flood" style="--d:${d + 1}" x="${x - 88}" y="${hole ? 452 : 380}" width="176" height="${hole ? 14 : 86}" fill="url(#waterG)"/>
        <path d="M${x} 300 q -30 60 -20 140 M${x} 300 q 30 50 26 130" stroke="${hole ? "#f3ead8" : "#5a3a24"}" stroke-width="7" fill="none" stroke-linecap="round" class="draw" style="--d:${d + 0.6}" pathLength="1"/>
        ${hole ? `<rect x="${x - 14}" y="476" width="28" height="8" rx="3" fill="#2b1a0f"/>` : ""}
      </g>
      ${hole ? [0, 1, 2].map((i) => `<path class="drip" style="--d:${2 + i * 0.6}" d="M${x} 492 q 10 18 0 28 q -10 -10 0 -28 Z" fill="#7cc4ff"/>`).join("") : ""}
      ${label(x, 580, hole ? "с отверстием" : "без отверстия", "#ffffff", d + 0.8, 26)}
      <g transform="translate(${x} 140)"><g class="pop" style="--d:${d + 2.4}">
        <circle r="38" fill="${hole ? "#2e9d5c" : "#e5484d"}"/>
        <path d="${hole ? "M-16 0 L -4 13 L 18 -12" : "M-13 -13 L 13 13 M13 -13 L -13 13"}" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/>
      </g></g>`,
      )
      .join("")}`,
  easy: `
    ${[
      [120, "Замиокулькас", 0.2, "zz"],
      [300, "Сансевиерия", 0.8, "snake"],
      [480, "Эпипремнум", 1.4, "pothos"],
    ]
      .map(([x, name, d, kind]) => {
        const plant =
          kind === "zz"
            ? [-34, -12, 12, 34]
                .map(
                  (dx, i) =>
                    `${stem(`M${x} 400 C ${x + dx * 0.4} 330 ${x + dx} 270 ${x + dx * 1.1} 200`, d + 0.4 + i * 0.1, 7)}` +
                    [0, 1, 2, 3]
                      .map(
                        (j) =>
                          `<ellipse class="pop" style="--d:${d + 0.8 + j * 0.1}" cx="${x + dx * (0.5 + j * 0.18) + (j % 2 ? 12 : -12)}" cy="${380 - j * 48}" rx="13" ry="24" fill="url(#leafG)" transform="rotate(${j % 2 ? 30 : -30} ${x + dx * (0.5 + j * 0.18) + (j % 2 ? 12 : -12)} ${380 - j * 48})"/>`,
                      )
                      .join(""),
                )
                .join("")
            : kind === "snake"
              ? [-40, -14, 12, 38]
                  .map(
                    (dx, i) =>
                      `<path class="grow" style="--d:${d + 0.3 + i * 0.12}" d="M${x + dx - 16} 402 Q ${x + dx - 18} ${300 - i * 10} ${x + dx} ${170 + (i % 2) * 40} Q ${x + dx + 18} ${300 - i * 10} ${x + dx + 16} 402 Z" fill="url(#leafG)" stroke="#d8e88a" stroke-width="4"/>`,
                  )
                  .join("")
              : `${stem(`M${x} 396 C ${x + 40} 360 ${x + 70} 300 ${x + 40} 230`, d + 0.3, 7)}${stem(`M${x} 396 C ${x - 50} 420 ${x - 60} 470 ${x - 40} 520`, d + 0.5, 7)}
                 ${leaf(x + 40, 236, 0.4, 10, d + 0.8)}${leaf(x + 64, 300, 0.36, 60, d + 1, "leafG2")}${leaf(x - 50, 470, 0.34, -150, d + 1.2)}${leaf(x - 30, 520, 0.3, -170, d + 1.3, "leafG2")}`;
        return `<g>${pot(x, 400, 130, 90, d)}${plant}${label(x, 590, name, "#ffffff", d + 1.2, 20)}</g>`;
      })
      .join("")}
    ${sparkles(
      [
        [110, 150, 2.6],
        [300, 110, 3.1],
        [500, 170, 3.5],
      ],
      "#8be3a8",
    )}`,
  quarantine: `
    <g transform="translate(300 520) rotate(-12)">${leaf(0, 0, 2.3, 0, 0.2)}</g>
    ${[
      [250, 300],
      [330, 240],
      [290, 370],
      [356, 330],
    ]
      .map(([x, y], i) => `<circle class="pop" style="--d:${2.2 + i * 0.5}" cx="${x}" cy="${y}" r="7" fill="#ff5a5f"/>`)
      .join("")}
    <g class="scan">
      <circle cx="0" cy="0" r="86" fill="url(#glassG)" stroke="#e8e2ff" stroke-width="12"/>
      <rect x="54" y="54" width="28" height="120" rx="12" fill="#c2a8ff" transform="rotate(-45 54 54)"/>
    </g>
    ${chip(300, 90, "14 дней отдельно", "#c2a8ff", 1)}
    ${label(300, 590, "осмотр с изнанки листа", "#ffffff", 3.6, 26)}`,
  wait: `
    <g class="rise" style="--d:.1">
      <rect x="90" y="130" width="250" height="280" rx="34" fill="#f7f4ec"/>
      <rect x="90" y="130" width="250" height="78" rx="34" fill="#62e3d3"/>
      <rect x="90" y="176" width="250" height="32" fill="#62e3d3"/>
      <circle cx="150" cy="130" r="12" fill="#2a6a62"/><circle cx="280" cy="130" r="12" fill="#2a6a62"/>
      <text data-count="30" data-start=".8" data-dur="4.5" x="215" y="350" fill="#163d39" font-family="Unbounded" font-weight="900" font-size="120" text-anchor="middle">1</text>
      <text x="215" y="190" fill="#0f2e2a" font-family="Manrope" font-weight="800" font-size="26" text-anchor="middle">ДНЕЙ</text>
    </g>
    <g transform="translate(470 470)">${pot(0, 0, 130, 90, 0.4)}${stem("M0 -16 C -6 -70 8 -120 0 -190", 0.7, 8)}${leaf(0, -180, 0.48, 0, 1)}${leaf(2, -100, 0.42, 48, 1.2, "leafG2")}</g>
    <g class="falling">${leaf(0, 0, 0.32, 0, 0, "leafG2")}</g>
    ${label(215, 470, "без пересадки", "#ffffff", 1.4, 26)}
    ${label(215, 510, "и подкормок", "#ffffff", 1.6, 26)}`,
  winter: `
    <g class="fade" style="--d:0">
      <rect x="110" y="70" width="380" height="420" rx="24" fill="url(#skyNight)"/>
      <circle cx="390" cy="160" r="44" fill="#f4f1d8" filter="url(#glow)"/>
      <circle cx="406" cy="148" r="40" fill="#0b1636"/>
      ${Array.from({ length: 34 }, (_, i) => `<circle class="snow" style="--i:${i};--x:${130 + ((i * 53) % 340)}px;--s:${4 + (i % 4) * 1.6}s" cx="0" cy="0" r="${2 + (i % 3)}" fill="#ffffff"/>`).join("")}
      <rect x="110" y="70" width="380" height="420" rx="24" fill="none" stroke="#e9e1d2" stroke-width="14"/>
      <path d="M300 74 L300 486 M114 280 L486 280" stroke="#e9e1d2" stroke-width="8"/>
    </g>
    <rect x="70" y="480" width="460" height="26" rx="8" fill="#d9cdb8"/>
    <g transform="translate(220 394)">${pot(0, 0, 120, 82, 0.3)}${stem("M0 -16 C -4 -50 6 -80 0 -120", 0.6, 7)}${leaf(0, -110, 0.36, 0, 0.9)}${leaf(2, -60, 0.3, 50, 1.1, "leafG2")}</g>
    ${chip(300, 560, "поливать реже", "#b4dcff", 1.8)}
    ${chip(300, 618, "без подкормок", "#b4dcff", 2.4)}`,
  outro: `
    <g class="tilt">
      <path d="M150 300 L 330 300 L 310 430 L 170 430 Z" fill="#62b3ff"/>
      <path d="M330 320 L 450 250 L 462 268 L 342 344 Z" fill="#4a98e6"/>
      <path d="M182 300 Q 240 220 300 300" stroke="#4a98e6" stroke-width="14" fill="none"/>
    </g>
    ${[0, 1, 2, 3].map((i) => `<path class="drop" style="--d:${1 + i * 0.3}" d="M${462 + i * 8} 280 q 9 16 0 25 q -9 -9 0 -25 Z" fill="#7cc4ff"/>`).join("")}
    <g transform="translate(470 520)">${pot(0, 0, 120, 70, 0.2)}${stem("M0 -16 C -6 -50 6 -80 0 -110", 0.5, 7)}${leaf(0, -100, 0.36, 0, 0.8)}${leaf(2, -50, 0.3, 50, 1, "leafG2")}</g>
    <g class="pulse" transform="translate(190 120)"><circle r="60" fill="#8be3a8" opacity=".18"/><path d="M0 34 C -40 10 -44 -34 0 -54 C 44 -34 40 10 0 34 Z" fill="url(#leafG)"/></g>`,
};

const ANIM_CSS = `
  .draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.6s cubic-bezier(.4,0,.2,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .pop { transform-box: fill-box; transform-origin: 50% 100%; animation: pop .9s cubic-bezier(.2,1.4,.4,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .grow { transform-box: fill-box; transform-origin: 50% 100%; animation: grow 1.2s cubic-bezier(.2,1,.3,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .rise { animation: rise 1s cubic-bezier(.2,1,.3,1) both; animation-delay: calc(var(--d) * 1s); }
  @keyframes rise { from { transform: translateY(60px); opacity: 0; } to { transform: none; opacity: 1; } }
  .fade { animation: fade 1s ease both; animation-delay: calc(var(--d) * 1s); }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .twinkle { animation: twinkle 2.4s ease-in-out infinite both; animation-delay: calc(var(--d) * 1s); transform-box: fill-box; transform-origin: center; }
  @keyframes twinkle { 0%,100% { opacity: 0; transform: scale(.3) rotate(0); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
  .sunrise { animation: sunrise 6s cubic-bezier(.3,.6,.3,1) both; }
  @keyframes sunrise { from { transform: translateY(150px); opacity: .3; } to { transform: translateY(-150px); opacity: 1; } }
  .beam { animation: beam 4s ease-in-out infinite alternate; transform-origin: 150px 280px; }
  @keyframes beam { from { opacity: .35; transform: rotate(-2deg); } to { opacity: .65; transform: rotate(2deg); } }
  .dry { animation: wet 1.2s ease both; animation-delay: 5.6s; }
  @keyframes wet { to { fill: #5a3a24; } }
  .finger { animation: finger 3.2s cubic-bezier(.4,0,.2,1) both; animation-delay: .8s; }
  @keyframes finger { 0% { transform: translateY(-120px); opacity: 0; } 25% { opacity: 1; transform: translateY(-40px); } 55% { transform: translateY(70px); } 80% { transform: translateY(70px); opacity: 1; } 100% { transform: translateY(-160px); opacity: 0; } }
  .drop { animation: drop 1.1s cubic-bezier(.5,0,1,1) infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes drop { from { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } to { transform: translateY(170px); opacity: 0; } }
  .drip { animation: drip 1.8s cubic-bezier(.5,0,1,1) infinite both; animation-delay: calc(var(--d) * 1s); }
  @keyframes drip { from { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } to { transform: translateY(70px); opacity: 0; } }
  .flood { transform-box: fill-box; transform-origin: 50% 100%; animation: grow 2.4s ease both; animation-delay: calc(var(--d) * 1s); }
  .scan { animation: scan 6s cubic-bezier(.45,0,.55,1) both; animation-delay: .8s; }
  @keyframes scan { 0% { transform: translate(140px, 460px); opacity: 0; } 12% { opacity: 1; } 40% { transform: translate(250px, 300px); } 70% { transform: translate(360px, 330px); } 100% { transform: translate(300px, 250px); opacity: 1; } }
  .falling { animation: falling 5s ease-in-out both; animation-delay: 2.5s; }
  @keyframes falling { from { transform: translate(470px, 330px) rotate(0); opacity: 0; } 10% { opacity: 1; } to { transform: translate(420px, 560px) rotate(160deg); opacity: .9; } }
  .snow { animation: snow var(--s) linear infinite both; animation-delay: calc(var(--i) * -0.37s); }
  @keyframes snow { from { transform: translate(var(--x), 60px); } to { transform: translate(calc(var(--x) + 30px), 500px); } }
  .tilt { transform-origin: 240px 380px; animation: tilt 2s cubic-bezier(.3,0,.2,1) both; animation-delay: .4s; }
  @keyframes tilt { from { transform: rotate(0); opacity: 0; } 30% { opacity: 1; } to { transform: rotate(-18deg); opacity: 1; } }
  .pulse { animation: pulse 2.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: .8; } 50% { opacity: 1; } }
`;

// Частицы-«боке» в воздухе: одинаковые для всех кадров (детерминированно от номера).
const BOKEH = Array.from({ length: 26 }, (_, i) => {
  const x = (i * 137) % 720;
  const y = 180 + ((i * 251) % 1000);
  const s = 6 + ((i * 7) % 34);
  const dur = 9 + (i % 7) * 2;
  return `<i style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;filter:blur(${1 + (s % 10)}px);animation-duration:${dur}s;animation-delay:${-i * 1.3}s;opacity:${0.15 + (i % 5) * 0.08}"></i>`;
}).join("");

const GRAIN = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
).toString("base64")}`;

function sceneHtml(lesson, scene, i) {
  const accent = ACCENT[scene.art] ?? "#8be3a8";
  const words = scene.title
    .split(" ")
    .map((w, k) => `<span class="w" style="animation-delay:${0.35 + k * 0.09}s">${w}</span>`)
    .join(" ");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #04110b; }
    body { font-family: Manrope, sans-serif; color: #fff; }
    .bg { position: absolute; inset: -80px; background:
            radial-gradient(60% 40% at 30% 30%, ${accent}33 0%, transparent 70%),
            radial-gradient(70% 45% at 75% 70%, #1d7a4a40 0%, transparent 70%),
            linear-gradient(180deg, #06170f 0%, #04110b 55%, #020806 100%);
          animation: drift 14s ease-in-out infinite alternate; }
    @keyframes drift { from { transform: translate(-30px, -20px) scale(1); } to { transform: translate(30px, 20px) scale(1.08); } }
    .rays { position: absolute; left: 50%; top: 22%; width: 1600px; height: 1600px; margin: -800px 0 0 -800px;
            background: repeating-conic-gradient(from 0deg, #ffffff12 0deg 4deg, transparent 4deg 16deg);
            -webkit-mask: radial-gradient(circle, #000 0%, transparent 55%); mix-blend-mode: screen; animation: spin 60s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .bokeh i { position: absolute; border-radius: 50%; background: ${accent}; animation: float linear infinite; }
    @keyframes float { from { transform: translateY(0); } to { transform: translateY(-260px); } }
    .stage { position: absolute; inset: 0; animation: push 12s linear both; }
    @keyframes push { from { transform: scale(1); } to { transform: scale(1.05); } }
    .art { position: absolute; left: 60px; top: 360px; width: 600px; height: 600px; overflow: visible; }
    .art-glow { position: absolute; left: 160px; top: 480px; width: 400px; height: 400px; border-radius: 50%; background: ${accent}; filter: blur(120px); opacity: .22; }
    header { position: absolute; top: 58px; left: 52px; right: 52px; display: flex; justify-content: space-between; align-items: center;
             font-weight: 800; font-size: 19px; letter-spacing: .22em; color: #ffffffb3; }
    header b { color: ${accent}; }
    .kicker { position: absolute; top: 150px; left: 52px; display: flex; align-items: center; gap: 14px; font-weight: 800;
              font-size: 22px; letter-spacing: .3em; color: ${accent}; text-transform: uppercase; animation: fadein .8s ease both .1s; }
    .kicker::before { content: ""; width: 44px; height: 3px; background: ${accent}; border-radius: 2px; }
    h1 { position: absolute; top: 196px; left: 52px; right: 52px; font-family: Unbounded, sans-serif; font-weight: 900;
         font-size: ${scene.title.length > 26 ? 44 : 54}px; line-height: 1.12; letter-spacing: -.01em; text-shadow: 0 6px 40px ${accent}55; }
    .w { display: inline-block; animation: word .9s cubic-bezier(.2,1,.3,1) both; }
    @keyframes word { from { opacity: 0; transform: translateY(26px); filter: blur(12px); } to { opacity: 1; transform: none; filter: blur(0); } }
    @keyframes fadein { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }
    .cap { position: absolute; left: 40px; right: 40px; bottom: 96px; min-height: 120px; display: flex; align-items: center; justify-content: center; }
    .cap span { display: inline-block; padding: 18px 28px; border-radius: 26px; background: #04110bb3; backdrop-filter: blur(10px);
                border: 1px solid #ffffff1f; font-weight: 700; font-size: 29px; line-height: 1.32; text-align: center; color: #fff; }
    .bar { position: absolute; left: 52px; right: 52px; bottom: 54px; display: flex; gap: 8px; }
    .bar i { flex: 1; height: 5px; border-radius: 3px; background: #ffffff26; overflow: hidden; }
    .bar i b { display: block; height: 100%; background: ${accent}; }
    .grain { position: absolute; inset: 0; background-image: url(${GRAIN}); opacity: .06; mix-blend-mode: overlay; animation: grain .5s steps(5) infinite; }
    @keyframes grain { 0% { background-position: 0 0; } 20% { background-position: 40px 80px; } 40% { background-position: -60px 20px; } 60% { background-position: 90px -50px; } 80% { background-position: -30px -90px; } }
    .vignette { position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 45%, transparent 55%, #000000c0 100%); }
    .fadeall { position: absolute; inset: 0; background: #000; opacity: 0; }
    ${ANIM_CSS}
  </style></head><body>
    <div class="bg"></div><div class="rays"></div><div class="bokeh">${BOKEH}</div>
    <div class="stage">
      <div class="art-glow"></div>
      <svg class="art" viewBox="0 0 600 600">${DEFS}${ART[scene.art] ?? ""}</svg>
    </div>
    <header><span><b>●</b> ПОДОКОННИК · КУРС ДЛЯ НОВИЧКОВ</span><span>УРОК ${lesson.number}</span></header>
    <div class="kicker">${scene.kicker}</div>
    <h1>${words}</h1>
    <div class="cap"><span id="cap" style="opacity:0"></span></div>
    <div class="bar">${lesson.scenes.map((_, k) => `<i><b id="b${k}" style="width:${k < i ? 100 : 0}%"></b></i>`).join("")}</div>
    <div class="grain"></div><div class="vignette"></div><div class="fadeall" id="fade"></div>
  </body></html>`;
}

// ---------------------------------------------------------------------------

async function renderVideo(lesson, timeline, audio, outFile, browser) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();
  if (PREVIEW) mkdirSync(PREVIEW, { recursive: true });
  const ff = PREVIEW
    ? null
    : spawn(
        FFMPEG,
        [
          "-y",
          "-loglevel",
          "error",
          "-f",
          "image2pipe",
          "-framerate",
          String(FPS),
          "-c:v",
          "mjpeg",
          "-i",
          "-",
          "-i",
          audio,
          "-c:v",
          "libx264",
          "-preset",
          "slow",
          "-crf",
          "27",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-shortest",
          "-movflags",
          "+faststart",
          outFile,
        ],
        { stdio: ["pipe", "inherit", "inherit"] },
      );
  const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once("drain", res)));
  const total = Math.ceil(timeline.total * FPS);
  let frame = 0;
  for (const [i, scene] of lesson.scenes.entries()) {
    const span = timeline.scenes[i];
    const sceneStart = i === 0 ? 0 : span.start;
    const sceneEnd = i === lesson.scenes.length - 1 ? timeline.total : timeline.scenes[i + 1].start;
    await page.setContent(sceneHtml(lesson, scene, i), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    let shown = "";
    while (frame / FPS < sceneEnd && frame < total) {
      const t = frame / FPS;
      const local = t - sceneStart;
      const line = span.lines.find((l) => t >= l.start - 0.15 && t <= l.end + 0.25);
      const text = line ? line.text : "";
      const fade = Math.max(0, 1 - local / 0.45, 1 - (sceneEnd - t) / 0.4);
      const progress = Math.min(100, (local / (sceneEnd - sceneStart)) * 100);
      await page.evaluate(
        ({ ms, text, changed, fade, i, progress }) => {
          for (const a of document.getAnimations()) a.currentTime = ms;
          // Счётчики (data-count): число растёт от 1 до цели с плавным замедлением.
          for (const el of document.querySelectorAll("[data-count]")) {
            const p = Math.min(1, Math.max(0, (ms / 1000 - Number(el.dataset.start)) / Number(el.dataset.dur)));
            el.textContent = String(Math.max(1, Math.round(1 + (Number(el.dataset.count) - 1) * (1 - (1 - p) ** 3))));
          }
          const cap = document.getElementById("cap");
          if (changed) cap.textContent = text;
          cap.style.opacity = text ? "1" : "0";
          document.getElementById("fade").style.opacity = String(fade);
          document.getElementById(`b${i}`).style.width = `${progress}%`;
        },
        { ms: local * 1000, text, changed: text !== shown, fade, i, progress },
      );
      shown = text;
      if (PREVIEW) {
        // Проверка картинки без видео: по кадру на 2-й и 7-й секунде каждой сцены.
        if ([2, 7].some((s) => Math.round(local * FPS) === s * FPS))
          await page.screenshot({ path: join(PREVIEW, `s${i}-${Math.round(local)}.jpg`), type: "jpeg", quality: 80 });
      } else await write(await page.screenshot({ type: "jpeg", quality: 92 }));
      frame++;
    }
    console.log(`  сцена ${i + 1}/${lesson.scenes.length} готова (${frame} кадров)`);
  }
  if (ff) {
    ff.stdin.end();
    await new Promise((res, rej) => ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg: ${code}`)))));
  }
  await ctx.close();
}

async function build(lesson, browser) {
  const work = AUDIO_DIR ?? join(ROOT, ".lessons-tmp", lesson.guide);
  if (!AUDIO_DIR) {
    if (!VOSK_MODEL) throw new Error("Нужна переменная VOSK_MODEL (или AUDIO_DIR с готовым звуком) — см. scripts/LESSONS.md");
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, "spec.json"), JSON.stringify({ scenes: lesson.scenes.map((s) => ({ voice: s.voice })), out: work }));
    execFileSync(PYTHON, ["-I", join(ROOT, "scripts/lessons-audio.py"), VOSK_MODEL, join(work, "spec.json"), SPEAKER], {
      stdio: "inherit",
    });
  }
  const timeline = JSON.parse(readFileSync(join(work, "timeline.json"), "utf8"));
  const mp4 = join(OUT, `${lesson.guide}.mp4`);
  await renderVideo(lesson, timeline, join(work, "audio.wav"), mp4, browser);
  if (PREVIEW) return;
  // Обложка — кадр из начала урока (растение уже выросло).
  execFileSync(FFMPEG, [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    "4.5",
    "-i",
    mp4,
    "-frames:v",
    "1",
    "-vf",
    "scale=720:-1",
    "-q:v",
    "4",
    join(OUT, `${lesson.guide}.jpg`),
  ]);
  const mb = (statSync(mp4).size / 1048576).toFixed(1);
  console.log(`${lesson.guide}: ${timeline.total.toFixed(0)} с, ${mb} МБ`);
  if (!AUDIO_DIR) rmSync(work, { recursive: true, force: true });
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
try {
  for (const lesson of lessons) if (!only || lesson.guide === only) await build(lesson, browser);
} finally {
  await browser.close();
}
