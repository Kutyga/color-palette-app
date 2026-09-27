/**
 * Склейка CSS-классов с пропуском пустых: cx("a", ok && "b").
 */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
