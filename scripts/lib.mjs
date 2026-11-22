import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const THEMES = {
  dark:  { name: "dark",  card: "#151b23", line: "#262d37", ink: "#e6edf3", muted: "#8b949e", accent: "#8ab4ff", track: "#262d37", chip: "#1c232d", sweep: "#ffffff" },
  light: { name: "light", card: "#f6f8fa", line: "#d0d7de", ink: "#1f2328", muted: "#59636e", accent: "#0969da", track: "#d8dee4", chip: "#ffffff", sweep: "#0969da" },
};
export const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const fmt = (n) => Number(n).toLocaleString("en-US");
export const svg = (W, H, label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
export const card = (t, x, y, w, h) =>
  `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="12" fill="${t.card}" stroke="${t.line}"/>`;

// rough sans-serif text width, used for pill layout
export const textW = (s, size) => s.length * size * 0.56;

// relative luminance of a hex color without "#"  (0..1)
export function lum(hex) {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
// Brand color, or neutral ink when the brand color would be unreadable on this theme
// (for example Next.js and Vercel are pure black).
export function iconColor(hex, t) {
  const L = lum(hex);
  if (t.name === "dark" && L < 0.12) return t.ink;
  if (t.name === "light" && L > 0.35) return t.ink;
  return "#" + hex;
}

// Progress ring starting at 12 o'clock. The arc is drawn with stroke-dasharray.
export function ring(t, cx, cy, r, frac, centerText, sub) {
  const C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.track}" stroke-width="7"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.accent}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="${SANS}" font-size="26" font-weight="700" fill="${t.ink}">${esc(centerText)}</text>
${sub ? `<text x="${cx}" y="${cy + 26}" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${t.muted}">${esc(sub)}</text>` : ""}`;
}

// Write atomically so a failed run never leaves a half-written SVG.
export function writeAtomic(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path + ".tmp", data);
  renameSync(path + ".tmp", path);
}
