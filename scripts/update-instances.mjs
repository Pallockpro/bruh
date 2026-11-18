// Refreshes instances.json and bruhtok/feed.json. Run by .github/workflows/update.yml.
//
// instances.json
//   piped / invidious        API servers that answer searches with CORS (browse + search)
//   pipedStreams             Piped servers that can actually play a video (/streams works)
//   invidiousStreams         Invidious servers whose /api/v1/videos returns playable files
//   pipedFrontends           Piped sites whose /embed/ player loads and may be framed
//   invidiousEmbed           Invidious servers whose /embed/ player loads and may be framed
//   ytFrontends              Poketube / CloudTube / ViewTube servers that load and may be framed
//   ytChallenge              servers that may be framed but show a "not a bot" check first
//   proxitok                 ProxiTok servers whose video page loads and may be framed
//   tikwm                    tikwm hosts whose feed + video lookup answer with CORS
// bruhtok/feed.json          a pool of TikTok clips gathered here (no CORS needed), used when
//                            the live tikwm feed is down and for searching on the page
import { readFile, writeFile } from "node:fs/promises";

const OUT = new URL("../instances.json", import.meta.url);
const FEED = new URL("../bruhtok/feed.json", import.meta.url);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const TEST_ID = "jNQXAC9IVRw"; // "Me at the zoo"
const TEST_TIKTOK = "6718335390845095173"; // @scout2015, from TikTok's own docs

const SOURCES = {
  invidious: "https://api.invidious.io/instances.json?sort_by=health",
  pipedDocs: "https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md",
  pipedApi: "https://piped-instances.kavin.rocks/",
  proxitok: "https://raw.githubusercontent.com/pablouser1/ProxiTok/master/instances.json",
  poke: ["https://codeberg.org/ashley/poke/raw/branch/main/instances.json", "https://raw.githubusercontent.com/ashley0143/poke/main/instances.json"],
};
const PIPED_FRONTENDS = [
  "https://piped.ducks.party", "https://piped.private.coffee", "https://piped.video", "https://cf.piped.video",
  "https://vc.piped.video", "https://re.piped.video", "https://fl.piped.video", "https://do.piped.video",
  "https://nf.piped.video", "https://az.piped.video", "https://piped.kavin.rocks",
];
const YT_FRONTENDS = ["https://poketube.fun", "https://tube.cadence.moe", "https://viewtube.io"];
const EXTRA_INVIDIOUS = ["https://invidious.ducks.party", "https://yewtu.be", "https://inv.nadeko.net", "https://invidious.nerdvpn.de"];
const TIKWM = ["https://www.tikwm.com", "https://tikwm.com"];
// Big public accounts whose TikTok profile embeds list their latest clips.
const CREATORS = [
  "khaby.lame", "mrbeast", "zachking", "charlidamelio", "bellapoarch", "addisonre", "scout2015", "tiktok",
  "nba", "nfl", "espn", "natgeo", "nasa", "gordonramsayofficial", "washingtonpost", "jimmyfallon",
  "willsmith", "dualipa", "selenagomez", "jasonderulo", "brentrivera", "spencerx", "daviddobrik", "lorengray",
];

/* ---------- small helpers ---------- */

const clean = (u) => String(u).trim().replace(/\/+$/, "");
const uniq = (a) => [...new Set(a.map(clean))];

async function get(url, { type = "json", method = "GET", ms = 15000 } = {}) {
  const res = await fetch(url, {
    method, redirect: "follow", signal: AbortSignal.timeout(ms),
    headers: { "user-agent": UA, origin: "https://pallockpro.github.io", referer: "https://pallockpro.github.io/" },
  });
  const body = type === "json" ? await res.json().catch(() => null) : type === "text" ? await res.text() : null;
  return { ok: res.ok, status: res.status, body, headers: res.headers, cors: res.headers.get("access-control-allow-origin") };
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// Can this page be shown inside an <iframe> on another site?
function frameable(h) {
  const xfo = (h.get("x-frame-options") || "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const fa = (h.get("content-security-policy") || "").match(/frame-ancestors([^;]*)/i);
  return !(fa && !/\*|https:/.test(fa[1]));
}
const CHALLENGE = /not a bot|verifying your browser|checking you are not|just a moment|anubis|captcha/i;

// "ok" = loads and can be framed; "challenge" = can be framed but shows an anti-bot check; null = no.
async function pageState(url, marker) {
  try {
    const r = await get(url, { type: "text" });
    if (!frameable(r.headers)) return null;
    if (CHALLENGE.test(r.body.slice(0, 3000))) return r.status < 500 ? "challenge" : null;
    return r.ok && marker.test(r.body) ? "ok" : null;
  } catch { return null; }
}

/* ---------- candidate lists ---------- */

async function candidates() {
  const inv = [], piped = [], proxi = [], poke = [];
  try {
    const { body } = await get(SOURCES.invidious);
    for (const [, i] of body) if (i?.type === "https" && i.uri) inv.push(i.uri);
  } catch (e) { console.warn("invidious list:", e.message); }
  try {
    const { body } = await get(SOURCES.pipedDocs, { type: "text" });
    for (const line of body.split("\n")) { const m = line.match(/^[^|]+\|\s*(https:\/\/[^\s|]+)\s*\|/); if (m) piped.push(m[1]); }
  } catch (e) { console.warn("piped docs:", e.message); }
  try { for (const i of (await get(SOURCES.pipedApi)).body || []) if (i.api_url) piped.push(i.api_url); } catch {}
  try { for (const i of (await get(SOURCES.proxitok)).body || []) if (i.clearnet) proxi.push(i.clearnet); } catch (e) { console.warn("proxitok list:", e.message); }
  for (const u of SOURCES.poke) {
    try {
      const { ok, body } = await get(u, { type: "text" });
      if (ok) poke.push(...[...body.matchAll(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi)].map((m) => m[0]).filter((x) => !/github|codeberg|gitlab|sudovanilla/i.test(x)));
    } catch {}
  }
  return { inv: uniq(inv), piped: uniq(piped), proxi: uniq(proxi), poke: uniq(poke) };
}

function frontendGuesses(apis) {
  const out = [];
  for (const a of apis) {
    const h = new URL(a).hostname;
    if (h.startsWith("pipedapi.")) out.push("https://piped." + h.slice(9));
    if (h.startsWith("piped-api.")) out.push("https://piped." + h.slice(10));
    if (h.startsWith("api.piped.")) out.push("https://" + h.slice(4));
  }
  return out;
}

/* ---------- checks ---------- */

async function timed(fn) { const t = Date.now(); const ok = await fn().catch(() => false); return ok ? Date.now() - t : null; }
async function rank(list, fn, max = 10) {
  const r = await pool(list, 10, async (b) => ({ b, ms: await timed(() => fn(b)) }));
  return r.filter((x) => x.ms != null).sort((a, b) => a.ms - b.ms).slice(0, max).map((x) => x.b);
}

const checks = {
  pipedSearch: async (b) => { const r = await get(`${b}/search?q=music&filter=videos`); return r.cors && r.body?.items?.some((i) => i.url?.includes("watch?v=")); },
  pipedStream: async (b) => { const r = await get(`${b}/streams/${TEST_ID}`); return r.cors && r.body?.videoStreams?.length > 0; },
  invSearch: async (b) => { const r = await get(`${b}/api/v1/search?q=music&type=video`); return r.cors && Array.isArray(r.body) && r.body.some((v) => v.videoId); },
  invStream: async (b) => { const r = await get(`${b}/api/v1/videos/${TEST_ID}?local=true`); return r.cors && (r.body?.formatStreams?.length > 0 || !!r.body?.hlsUrl); },
  tikwm: async (b) => {
    const f = await get(`${b}/api/feed/list?region=US&count=3`);
    const one = await get(`${b}/api/?url=${encodeURIComponent(`https://www.tiktok.com/@scout2015/video/${TEST_TIKTOK}`)}&hd=1`);
    return f.cors && f.body?.code === 0 && one.body?.code === 0;
  },
};

/* ---------- TikTok clip pool for bruhtok ---------- */

async function tikwmFeed(base) {
  const items = [];
  for (const region of ["US", "GB", "CA", "AU", "US", "US"]) {
    try {
      const r = await get(`${base}/api/feed/list?region=${region}&count=20`);
      for (const v of r.body?.data || []) {
        const a = v.author || {}, m = v.music_info || {};
        items.push({
          id: String(v.video_id), desc: v.title || "", user: a.unique_id, author: a.nickname || a.unique_id, avatar: a.avatar,
          cover: v.cover, likes: v.digg_count, comments: v.comment_count, shares: v.share_count,
          music: m.title ? `${m.title}${m.author ? " · " + m.author : ""}` : "", from: "feed",
        });
      }
    } catch {}
  }
  return items;
}

async function creatorClips() {
  const found = await pool(CREATORS, 6, async (user) => {
    try {
      const r = await get(`https://www.tiktok.com/embed/@${user}`, { type: "text" });
      const ids = [...new Set([...r.body.matchAll(/video\/(\d{18,20})/g)].map((m) => m[1]))].slice(0, 8);
      return ids.map((id) => ({ id, user }));
    } catch { return []; }
  });
  const flat = found.flat();
  // Fill in captions and covers from TikTok's oEmbed.
  return (await pool(flat, 8, async ({ id, user }) => {
    try {
      const r = await get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@${user}/video/${id}`)}`);
      if (!r.body?.title && !r.body?.thumbnail_url) return { id, user, author: user, from: "creator" };
      return { id, user, author: r.body.author_name || user, desc: r.body.title || "", cover: r.body.thumbnail_url, from: "creator" };
    } catch { return { id, user, author: user, from: "creator" }; }
  }));
}

/* ---------- run ---------- */

const old = JSON.parse(await readFile(OUT, "utf8"));
const c = await candidates();

const pipedApis = uniq([...c.piped, ...(old.piped || []), ...(old.pipedStreams || [])]);
const invApis = uniq([...c.inv, ...(old.invidious || []), ...(old.invidiousStreams || []), ...EXTRA_INVIDIOUS]);

const next = {};
next.piped = await rank(pipedApis, checks.pipedSearch);
next.pipedStreams = await rank(pipedApis, checks.pipedStream);
next.invidious = await rank(invApis, checks.invSearch);
next.invidiousStreams = await rank(invApis, checks.invStream);
// If nothing at all answered, the checker's own network is probably broken: keep the old list.
const healthy = next.piped.length + next.invidious.length + next.pipedStreams.length > 0;
console.log("network healthy:", healthy);

const challenge = [];
async function pages(name, list, path, marker) {
  const r = await pool(uniq(list), 10, async (b) => ({ b, s: await pageState(b + path, marker) }));
  for (const x of r) if (x.s === "challenge") challenge.push(x.b);
  return r.filter((x) => x.s === "ok").map((x) => x.b).slice(0, 15);
}
next.pipedFrontends = await pages("piped", [...PIPED_FRONTENDS, ...frontendGuesses([...pipedApis, ...next.piped]), ...(old.pipedFrontends || [])],
  `/embed/${TEST_ID}`, /piped/i);
next.invidiousEmbed = await pages("invidious", [...invApis, ...(old.invidiousEmbed || [])], `/embed/${TEST_ID}`, /invidious|<video/i);
next.ytFrontends = await pages("yt", [...YT_FRONTENDS, ...c.poke, ...(old.ytFrontends || [])], `/watch?v=${TEST_ID}`, /<video|poke|cloudtube|viewtube/i);
next.ytChallenge = uniq(challenge).filter((b) => !/proxitok/i.test(b)).slice(0, 10);
next.proxitok = await pages("proxitok", [...c.proxi, ...(old.proxitok || [])], `/@scout2015/video/${TEST_TIKTOK}`, /<video/i);
next.tikwm = await rank(TIKWM, checks.tikwm, 2);

for (const [k, v] of Object.entries(next)) console.log(`${k}: ${v.length}`, v);

if (!healthy) {
  console.log("Checker network looks down; keeping the old instances.json.");
} else {
  const same = (a, b) => [...a].sort().join() === [...(b || [])].sort().join();
  if (Object.keys(next).every((k) => same(next[k], old[k])) && Object.keys(old).every((k) => k === "updated" || k in next)) {
    console.log("instances.json: no change.");
  } else {
    await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), ...next }, null, 2) + "\n");
    console.log("instances.json updated.");
  }
}

// TikTok pool: live feed + creators, deduped. Always rewritten when we got clips.
let feedItems = [];
for (const b of next.tikwm.length ? next.tikwm : TIKWM) { feedItems = await tikwmFeed(b); if (feedItems.length) break; }
const creator = await creatorClips();
const seen = new Set();
const items = [...feedItems, ...creator].filter((i) => i.id && !seen.has(i.id) && seen.add(i.id));
console.log(`bruhtok pool: ${feedItems.length} from feed, ${creator.length} from creators, ${items.length} total`);
if (items.length >= 10) {
  await writeFile(FEED, JSON.stringify({ updated: new Date().toISOString(), items }, null, 1) + "\n");
  console.log("bruhtok/feed.json written.");
}
