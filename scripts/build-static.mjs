import { readFileSync, writeFileSync } from "node:fs";
import * as si from "simple-icons";
import { THEMES, SANS, esc, svg, card, iconColor, textW, writeAtomic } from "./lib.mjs";

const ICONS = Object.fromEntries(Object.values(si).filter((v) => v && v.slug).map((i) => [i.slug, i]));

// 16x16 logo at (x, y); monogram tile if the logo is not in simple-icons
function glyph(t, it, x, y) {
  const icon = ICONS[it.slug];
  if (icon) {
    return `<g transform="translate(${x} ${y}) scale(${16 / 24})"><path d="${icon.path}" fill="${iconColor(icon.hex, t)}"/></g>`;
  }
  const mono = esc(it.mono ?? it.label.slice(0, 2));
  return `<rect x="${x}" y="${y}" width="16" height="16" rx="4" fill="none" stroke="${t.muted}" stroke-opacity="0.7"/><text x="${x + 8}" y="${y + 11.5}" text-anchor="middle" font-family="${SANS}" font-size="8" font-weight="700" fill="${t.muted}">${mono}</text>`;
}

/* ---------- skills panel: category label on the left, wrapping pills on the right ---------- */
function renderSkills(t, groups) {
  const W = 1000, PAD = 32, LABELW = 200, X0 = PAD + LABELW, XMAX = W - PAD;
  const PH = 34, GAP = 10, ROWPAD = 18;
  let y = 24, body = "";
  for (const g of groups) {
    let x = X0, line = 0, pills = "";
    for (const it of g.items) {
      const w = 12 + 16 + 8 + textW(it.label, 14) + 14;
      if (x + w > XMAX) { x = X0; line++; }
      const py = y + line * (PH + GAP);
      pills += `<rect x="${x}" y="${py}" width="${w.toFixed(1)}" height="${PH}" rx="8" fill="${t.chip}" stroke="${t.line}"/>${glyph(t, it, x + 12, py + 9)}<text x="${x + 36}" y="${py + 22}" font-family="${SANS}" font-size="14" fill="${t.ink}">${esc(it.label)}</text>`;
      x += w + GAP;
    }
    const rowH = (line + 1) * PH + line * GAP;
    body += `<text x="${PAD}" y="${y + 22}" font-family="${SANS}" font-size="15" font-weight="600" fill="${t.ink}">${esc(g.title)}</text>${pills}`;
    y += rowH + ROWPAD;
    body += `<line x1="${PAD}" y1="${y - ROWPAD / 2}" x2="${W - PAD}" y2="${y - ROWPAD / 2}" stroke="${t.line}"/>`;
  }
  const H = y + 6;
  return svg(W, H, "Skills grouped by category", card(t, 0, 0, W, H) + body);
}

const toItems = (arr) => arr.map(([slug, label, mono]) => ({ slug, label, mono }));
const GROUPS = [
  { title: "Frontend",           items: toItems([["nextdotjs", "Next.js"], ["react", "React"], ["typescript", "TypeScript"], ["javascript", "JavaScript"], ["threedotjs", "Three.js"], ["gsap", "GSAP"]]) },
  { title: "Backend and deploy", items: toItems([["supabase", "Supabase"], ["mongodb", "MongoDB"], ["vercel", "Vercel"]]) },
  { title: "Languages",          items: toItems([["python", "Python"], ["c", "C"], ["typescript", "TypeScript"], ["javascript", "JavaScript"]]) },
  { title: "Desktop and mobile", items: toItems([["electron", "Electron"], ["nextron", "Nextron", "Nx"], ["tauri", "Tauri"], ["react", "React Native"]]) },
  { title: "Tools and platform", items: toItems([["git", "Git"], ["fedora", "Fedora"], ["hyprland", "Hyprland"], ["caelestia", "Caelestia", "Ca"]]) },
];

/* ---------- social pills (one small SVG each, so each can be its own link) ---------- */
function socialPill(t, it) {
  const w = Math.ceil(12 + 16 + 8 + textW(it.label, 14) + 14), H = 34;
  return svg(w, H, it.label,
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${H - 1}" rx="8" fill="${t.chip}" stroke="${t.line}"/>${glyph(t, it, 12, 9)}<text x="36" y="22" font-family="${SANS}" font-size="14" fill="${t.ink}">${esc(it.label)}</text>`);
}
const SOCIALS = [
  { id: "linkedin",  slug: "linkedin",  label: "LinkedIn",  mono: "in" },
  { id: "instagram", slug: "instagram", label: "Instagram" },
  { id: "email",     slug: "gmail",     label: "Email" },
  { id: "github",    slug: "github",    label: "GitHub" },
];

/* ---------- header: one of the three allowed space touches (orbit arcs) ---------- */
function header(t) {
  const W = 1000, H = 220;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Tirthadeep Kapat, full-stack developer working in space technology and computer science">
<defs><clipPath id="c"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs>
<g clip-path="url(#c)">
<rect width="${W}" height="${H}" fill="${t.card}"/>
<g fill="none" stroke="${t.accent}" stroke-opacity="0.16">
<circle cx="860" cy="110" r="60"/><circle cx="860" cy="110" r="100"/><circle cx="860" cy="110" r="140"/><circle cx="860" cy="110" r="190"/>
</g>
<circle r="3.2" fill="${t.accent}"><animateMotion dur="40s" repeatCount="indefinite" path="M 760,110 a 100,100 0 1,1 200,0 a 100,100 0 1,1 -200,0"/></circle>
<circle r="2.2" fill="${t.muted}"><animateMotion dur="70s" repeatCount="indefinite" path="M 670,110 a 190,190 0 1,0 380,0 a 190,190 0 1,0 -380,0"/></circle>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${t.line}"/>
<text x="40" y="96" font-family="${SANS}" font-size="46" font-weight="700" fill="${t.ink}">Tirthadeep Kapat</text>
<text x="40" y="136" font-family="${SANS}" font-size="18" fill="${t.accent}">Full-stack developer</text>
<text x="40" y="168" font-family="${SANS}" font-size="15" fill="${t.muted}">Space technology and computer science. Interfaces, automation and local AI.</text>
</svg>`;
}

/* ---------- write files ---------- */
for (const t of Object.values(THEMES)) {
  writeAtomic(`assets/static/header-${t.name}.svg`, header(t));
  writeAtomic(`assets/static/skills-${t.name}.svg`, renderSkills(t, GROUPS));
  for (const s of SOCIALS) writeAtomic(`assets/static/social-${s.id}-${t.name}.svg`, socialPill(t, s));
}

/* ---------- README from template ---------- */
const FOLDER = { header: "static", skills: "static", stats: "generated", activity: "generated", heat: "generated" };
const picture = (base, alt, size = ' width="100%"') => `<picture>
<source media="(prefers-color-scheme: dark)" srcset="${base}-dark.svg">
<source media="(prefers-color-scheme: light)" srcset="${base}-light.svg">
<img src="${base}-dark.svg"${size} alt="${alt}">
</picture>`;

let md = readFileSync("README.template.md", "utf8");
md = md.replace(/\{\{img:([a-z]+)\|([^}]*)\}\}/g, (_, name, alt) => {
  if (!FOLDER[name]) throw new Error("Unknown image token: " + name);
  return picture(`assets/${FOLDER[name]}/${name}`, alt);
});
md = md.replace(/\{\{social:([a-z]+)\|([^|}]+)\|([^}]*)\}\}/g, (_, id, url, alt) =>
  `<a href="${url}">${picture(`assets/static/social-${id}`, alt, ' height="34"')}</a>`);
writeFileSync("README.md", md);
console.log("Built static assets and README.md");
