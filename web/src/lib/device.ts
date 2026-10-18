/** Что за устройство: iPhone/iPad и запуск с экрана «Домой». */

/** iPhone или iPad (iPadOS представляется Mac-ом, но с сенсорным экраном). */
export const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Сайт открыт как приложение с экрана «Домой». */
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
