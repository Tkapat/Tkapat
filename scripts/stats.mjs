import { THEMES, SANS, esc, fmt, svg, card, ring, writeAtomic } from "./lib.mjs";

/* ------------------------------ data ------------------------------ */
const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;
async function gql(query, variables) {
  if (!TOKEN) throw new Error("No GITHUB_TOKEN or GH_PAT");
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-stats" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error("GitHub API error: " + JSON.stringify(json.errors || json.message));
  return json.data;
}

const PROFILE_Q = `query($login:String!,$cursor:String){user(login:$login){
  name login createdAt followers{totalCount} pullRequests{totalCount} issues{totalCount}
  contributionsCollection{totalCommitContributions contributionYears contributionCalendar{totalContributions weeks{contributionDays{date contributionCount weekday}}}}
  repositories(ownerAffiliations:OWNER,isFork:false,first:100,after:$cursor){
    pageInfo{hasNextPage endCursor}
    nodes{stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}
  }}}`;
const YEAR_Q = `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;

// streaks over ALL days ascending: [{date:"YYYY-MM-DD", count}]
function streaks(days, todayIso) {
  let longest = { count: 0, start: null, end: null }, run = 0, runStart = null;
  for (const d of days) {
    if (d.count > 0) { if (run === 0) runStart = d.date; run++; if (run > longest.count) longest = { count: run, start: runStart, end: d.date }; }
    else run = 0;
  }
  // current streak: walk back from the last day; a zero today does not break it yet
  let i = days.length - 1;
  if (i >= 0 && days[i].date === todayIso && days[i].count === 0) i--;
  let cur = 0, start = null;
  const end = i >= 0 ? days[i].date : null;
  while (i >= 0 && days[i].count > 0) { cur++; start = days[i].date; i--; }
  return { longest, current: { count: cur, start: cur ? start : null, end: cur ? end : null } };
}
const short = (iso) => iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

async function collect() {
  const login = process.env.GH_LOGIN || "Tkapat";
  let cursor = null, first = null;
  const repos = [];
  do {
    const u = (await gql(PROFILE_Q, { login, cursor })).user;
    first ??= u;
    repos.push(...u.repositories.nodes);
    cursor = u.repositories.pageInfo.hasNextPage ? u.repositories.pageInfo.endCursor : null;
  } while (cursor);

  const langMap = new Map();
  for (const r of repos) for (const e of r.languages.edges) {
    const cur = langMap.get(e.node.name) || { name: e.node.name, color: e.node.color, size: 0 };
    cur.size += e.size; langMap.set(e.node.name, cur);
  }
  const languages = [...langMap.values()].sort((a, b) => b.size - a.size);

  // all-time days: one query per calendar year (the API limits a range to one year)
  const all = new Map();
  for (const y of first.contributionsCollection.contributionYears) {
    const d = await gql(YEAR_Q, { login, from: `${y}-01-01T00:00:00Z`, to: `${y}-12-31T23:59:59Z` });
    for (const w of d.user.contributionsCollection.contributionCalendar.weeks)
      for (const day of w.contributionDays) all.set(day.date, day.contributionCount);
  }
  const days = [...all.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, count]) => ({ date, count }));
  const cal = first.contributionsCollection.contributionCalendar;
  return {
    name: first.name || first.login,
    stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
    commits: first.contributionsCollection.totalCommitContributions,
    prs: first.pullRequests.totalCount, issues: first.issues.totalCount, followers: first.followers.totalCount,
    activeDays: cal.weeks.flatMap((w) => w.contributionDays).filter((d) => d.contributionCount > 0).length,
    languages,
    total: days.reduce((a, d) => a + d.count, 0),
    since: days.find((d) => d.count > 0)?.date ?? first.createdAt.slice(0, 10),
    ...streaks(days, new Date().toISOString().slice(0, 10)),
    lastYearTotal: cal.totalContributions,
    weeks: cal.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, weekday: d.weekday }))),
  };
}

function mock() {
  const days = Array.from({ length: 400 }, (_, i) => ({ date: new Date(Date.UTC(2025, 9, 1) + i * 864e5).toISOString().slice(0, 10), count: i % 9 < 5 ? 2 : 0 }));
  const weeks = Array.from({ length: 53 }, (_, w) => Array.from({ length: 7 }, (_, d) => ({
    date: new Date(Date.UTC(2025, 10, 16) + (w * 7 + d) * 864e5).toISOString().slice(0, 10), weekday: d,
    count: ((w * 7 + d) * 7919) % 11 < 4 ? ((w * d) % 9) + 1 : 0 })));
  return { name: "Tirthadeep Kapat", stars: 4, commits: 188, prs: 6, issues: 1, followers: 9, activeDays: 142,
    languages: [{ name: "TypeScript", color: "#3178c6", size: 520 }, { name: "Python", color: "#3572A5", size: 300 }, { name: "JavaScript", color: "#f1e05a", size: 180 }, { name: "C++", color: "#f34b7d", size: 120 }, { name: "CSS", color: "#663399", size: 60 }, { name: "HTML", color: "#e34c26", size: 50 }, { name: "C", color: "#555555", size: 30 }],
    total: 802, since: "2024-08-08", lastYearTotal: 563, weeks, ...streaks(days, "2026-11-21") };
}

/* --------------------------- card 1 + 2: statistics and languages --------------------------- */
function renderStats(t, s) {
  const W = 1000, H = 240, CW = 488;
  const rows = [["Total stars", s.stars], ["Commits (last year)", s.commits], ["Pull requests", s.prs], ["Issues", s.issues], ["Followers", s.followers]];
  let left = `<text x="28" y="44" font-family="${SANS}" font-size="17" font-weight="700" fill="${t.accent}">${esc(s.name)}'s GitHub statistics</text>`;
  rows.forEach(([k, v], i) => {
    const y = 84 + i * 30;
    left += `<text x="28" y="${y}" font-family="${SANS}" font-size="14" fill="${t.muted}">${k}</text><text x="230" y="${y}" font-family="${SANS}" font-size="14" font-weight="600" fill="${t.ink}">${fmt(v)}</text>`;
  });
  left += ring(t, 390, 128, 46, s.activeDays / 365, String(s.activeDays), "active days");

  const total = s.languages.reduce((a, l) => a + l.size, 0) || 1;
  const top = s.languages.slice(0, 6);
  const other = total - top.reduce((a, l) => a + l.size, 0);
  const list = other > 0 ? [...top, { name: "Other", color: "#6e7681", size: other }] : top;
  const X0 = CW + 48, BW = CW - 48;
  let x = X0, bar = "", legend = "";
  list.forEach((l, i) => {
    const w = (l.size / total) * BW;
    bar += `<rect x="${x.toFixed(2)}" y="64" width="${w.toFixed(2)}" height="10" fill="${l.color || "#8b949e"}"/>`;
    x += w;
    const lx = X0 + (i % 2) * (BW / 2), ly = 112 + Math.floor(i / 2) * 28;
    legend += `<circle cx="${lx + 5}" cy="${ly - 5}" r="5" fill="${l.color || "#8b949e"}"/><text x="${lx + 18}" y="${ly}" font-family="${SANS}" font-size="13" fill="${t.ink}">${esc(l.name)}</text><text x="${lx + BW / 2 - 14}" y="${ly}" text-anchor="end" font-family="${SANS}" font-size="13" fill="${t.muted}">${((l.size / total) * 100).toFixed(1)}%</text>`;
  });
  const right = `<text x="${X0}" y="44" font-family="${SANS}" font-size="17" font-weight="700" fill="${t.accent}">Most used languages</text>
<clipPath id="lc"><rect x="${X0}" y="64" width="${BW}" height="10" rx="5"/></clipPath><g clip-path="url(#lc)">${bar}</g>${legend}`;
  return svg(W, H, `GitHub statistics for ${s.name}`, `${card(t, 0, 0, CW, H)}${left}${card(t, CW + 24, 0, CW, H)}${right}`);
}

/* --------------------------- activity: total, current streak, longest streak --------------------------- */
function renderActivity(t, s) {
  const W = 1000, H = 190;
  const col = (cx, big, label, sub) => `<text x="${cx}" y="84" text-anchor="middle" font-family="${SANS}" font-size="36" font-weight="700" fill="${t.ink}">${esc(big)}</text><text x="${cx}" y="116" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="600" fill="${t.accent}">${esc(label)}</text><text x="${cx}" y="142" text-anchor="middle" font-family="${SANS}" font-size="12" fill="${t.muted}">${esc(sub)}</text>`;
  const frac = s.longest.count ? s.current.count / s.longest.count : 0;
  const mid = `${ring(t, 500, 70, 40, frac, String(s.current.count), "")}<text x="500" y="136" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="600" fill="${t.accent}">Current streak</text><text x="500" y="160" text-anchor="middle" font-family="${SANS}" font-size="12" fill="${t.muted}">${s.current.count ? esc(short(s.current.start) + " - " + short(s.current.end)) : "No active streak"}</text>`;
  return svg(W, H, "Contribution totals and streaks", `${card(t, 0, 0, W, H)}
${col(166, fmt(s.total), "Total contributions", `${short(s.since)} - Present`)}
<line x1="333" y1="36" x2="333" y2="154" stroke="${t.line}"/>${mid}<line x1="667" y1="36" x2="667" y2="154" stroke="${t.line}"/>
${col(834, String(s.longest.count), "Longest streak", `${short(s.longest.start)} - ${short(s.longest.end)}`)}`);
}

/* --------------------------- contribution graph: rounded cells + one soft sweep (space touch 2) --------------------------- */
function renderHeat(t, s) {
  const weeks = s.weeks;
  const CELL = 13, STEP = 17, X0 = 56, Y0 = 52, W = 1000, H = 190;
  const nz = weeks.flatMap((w) => w.map((d) => d.count)).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => (nz.length ? nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] : 1);
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  const lv = (c) => (c === 0 ? 0 : c <= q1 ? 1 : c <= q2 ? 2 : c <= q3 ? 3 : 4);
  const OP = [0, 0.28, 0.5, 0.75, 1];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let cells = "", months = "", prev = -1;
  weeks.forEach((w, wi) => {
    const m = new Date(w[0].date + "T00:00:00Z").getUTCMonth();
    if (m !== prev) { months += `<text x="${X0 + wi * STEP}" y="40" font-family="${SANS}" font-size="11" fill="${t.muted}">${MON[m]}</text>`; prev = m; }
    w.forEach((d) => {
      const x = X0 + wi * STEP, y = Y0 + d.weekday * STEP, l = lv(d.count);
      cells += l === 0
        ? `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" fill="${t.track}" opacity="0.55"/>`
        : `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" fill="${t.accent}" opacity="${OP[l]}"/>`;
    });
  });
  const dayLabels = ["Mon", "Wed", "Fri"].map((d, i) => `<text x="${X0 - 10}" y="${Y0 + (i * 2 + 1) * STEP + 10}" text-anchor="end" font-family="${SANS}" font-size="11" fill="${t.muted}">${d}</text>`).join("");
  const gw = weeks.length * STEP;
  return svg(W, H, `Contribution graph, ${fmt(s.lastYearTotal)} contributions in the last year`,
    `<defs><linearGradient id="sw" x1="0" x2="1"><stop offset="0" stop-color="${t.sweep}" stop-opacity="0"/><stop offset="0.5" stop-color="${t.sweep}" stop-opacity="0.16"/><stop offset="1" stop-color="${t.sweep}" stop-opacity="0"/></linearGradient><clipPath id="g"><rect x="${X0}" y="${Y0}" width="${gw}" height="${7 * STEP}"/></clipPath></defs>
${card(t, 0, 0, W, H)}<text x="28" y="26" font-family="${SANS}" font-size="14" font-weight="600" fill="${t.ink}">${fmt(s.lastYearTotal)} contributions in the last year</text>${months}${dayLabels}${cells}
<g clip-path="url(#g)"><rect x="${X0 - 120}" y="${Y0 - 4}" width="120" height="${7 * STEP + 8}" fill="url(#sw)"><animate attributeName="x" from="${X0 - 120}" to="${X0 + gw}" dur="9s" repeatCount="indefinite"/></rect></g>`);
}

/* ------------------------------ main ------------------------------ */
try {
  const s = process.env.MOCK ? mock() : await collect();
  for (const t of Object.values(THEMES)) {
    writeAtomic(`assets/generated/stats-${t.name}.svg`, renderStats(t, s));
    writeAtomic(`assets/generated/activity-${t.name}.svg`, renderActivity(t, s));
    writeAtomic(`assets/generated/heat-${t.name}.svg`, renderHeat(t, s));
  }
  console.log(`Wrote stats, activity and heat graphics (${s.total} total contributions)`);
} catch (err) {
  console.error(String(err.message || err));
  process.exit(1);
}
