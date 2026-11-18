// Refreshes instances.json:
//   piped / invidious      - API servers that answer searches and allow browser (CORS) requests
//   pipedFrontends         - Piped websites whose /embed/ player loads and may be framed
//   invidiousEmbed         - Invidious servers whose /embed/ player loads and may be framed
//   ytFrontends            - other YouTube front-ends (Poketube, CloudTube, ViewTube) whose watch page may be framed
//   proxitok               - ProxiTok (TikTok front-end) servers whose video page loads and may be framed
//   tikwm                  - tikwm API hosts that answer TikTok searches with CORS (used by /bruhtok)
// Run by .github/workflows/update.yml on a schedule.
import { readFile, writeFile } from "node:fs/promises";

const OUT = new URL("../instances.json", import.meta.url);
const MAX = 10;
const SOURCES = {
  invidious: "https://api.invidious.io/instances.json?sort_by=health",
  piped: [
    "https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md",
    "https://piped-instances.kavin.rocks/",
  ],
};

async function get(url, type = "json") {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "user-agent": "bruhtube-instance-checker", origin: "https://example.github.io" },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return { body: type === "json" ? await res.json() : await res.text(), cors: res.headers.get("access-control-allow-origin") };
}

// Known piped.video mirrors (from the Piped README); dead ones get dropped by the check.
const PIPED_FRONTENDS = [
  "https://piped.ducks.party", "https://piped.private.coffee", "https://piped.video", "https://cf.piped.video", "https://vc.piped.video", "https://re.piped.video",
  "https://fl.piped.video", "https://do.piped.video", "https://nf.piped.video", "https://az.piped.video",
];
const TEST_ID = "jNQXAC9IVRw";
const TEST_TIKTOK = "6718335390845095173"; // @scout2015, TikTok's own docs example
const PROXITOK_LIST = "https://raw.githubusercontent.com/pablouser1/ProxiTok/master/instances.json";
const POKE_LISTS = [
  "https://codeberg.org/ashley/poke/raw/branch/main/instances.json",
  "https://raw.githubusercontent.com/ashley0143/poke/main/instances.json",
];
const YT_FRONTENDS = ["https://poketube.fun", "https://tube.cadence.moe", "https://viewtube.io"];
const TIKWM = ["https://www.tikwm.com", "https://tikwm.com"]; // "Me at the zoo", the first YouTube video

const clean = (u) => u.trim().replace(/\/+$/, "");

async function invidiousList() {
  const { body } = await get(SOURCES.invidious);
  return body.map(([, i]) => i)
    .filter((i) => i && i.type === "https" && i.api !== false && i.uri)
    .map((i) => clean(i.uri));
}

async function pipedList() {
  const found = [];
  try {
    const { body } = await get(SOURCES.piped[0], "text");
    for (const line of body.split("\n")) {
      const m = line.match(/^[^|]+\|\s*(https:\/\/[^\s|]+)\s*\|/);
      if (m) found.push(clean(m[1]));
    }
  } catch (e) { console.warn("piped docs list:", e.message); }
  try {
    const { body } = await get(SOURCES.piped[1]);
    for (const i of body) if (i.api_url) found.push(clean(i.api_url));
  } catch (e) { console.warn("piped instances api:", e.message); }
  return found;
}

async function check(kind, base) {
  const start = Date.now();
  try {
    if (kind === "piped") {
      const { body, cors } = await get(`${base}/search?q=music&filter=videos`);
      if (!cors || !body.items?.some((i) => i.url?.includes("watch?v="))) return null;
    } else {
      const { body, cors } = await get(`${base}/api/v1/search?q=music&type=video`);
      if (!cors || !Array.isArray(body) || !body.some((v) => v.videoId)) return null;
    }
    return { base, ms: Date.now() - start };
  } catch {
    return null;
  }
}

async function refresh(kind, listFn, old) {
  let candidates = [];
  try { candidates = await listFn(); } catch (e) { console.warn(`${kind} list:`, e.message); }
  candidates = [...new Set([...candidates, ...old])];
  const ok = (await Promise.all(candidates.map((c) => check(kind, c)))).filter(Boolean);
  ok.sort((a, b) => a.ms - b.ms); // fastest first
  const good = ok.slice(0, MAX).map((x) => x.base);
  console.log(`${kind}: ${good.length}/${candidates.length} working`, good);
  return good.length ? good : old; // never wipe the list if the check itself failed
}

// Can this page be shown inside an <iframe> on another site?
function frameable(headers) {
  const xfo = (headers.get("x-frame-options") || "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const fa = (headers.get("content-security-policy") || "").match(/frame-ancestors([^;]*)/i);
  if (fa && !/\*|https:/.test(fa[1])) return false;
  return true;
}

async function embedWorks(base, kind) {
  try {
    const res = await fetch(`${base}/embed/${TEST_ID}`, {
      signal: AbortSignal.timeout(12000),
      headers: { "user-agent": "Mozilla/5.0 (bruhtube instance checker)" },
    });
    if (!res.ok || !frameable(res.headers)) return null;
    const html = (await res.text()).toLowerCase();
    if (kind === "piped" ? !html.includes("piped") : !(html.includes("invidious") || html.includes("<video"))) return null;
    return base;
  } catch {
    return null;
  }
}

// Generic "does this page load and allow framing" check, with a required marker in the HTML.
async function pageWorks(base, path, marker) {
  try {
    const res = await fetch(base + path, {
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 (bruhtube instance checker)" },
    });
    if (!res.ok || !frameable(res.headers)) return null;
    const html = (await res.text()).toLowerCase();
    return marker.test(html) ? base : null;
  } catch {
    return null;
  }
}

async function refreshPages(name, candidates, old, path, marker, max = 15) {
  candidates = [...new Set([...candidates, ...old].map(clean))];
  const good = (await Promise.all(candidates.map((c) => pageWorks(c, path, marker)))).filter(Boolean).slice(0, max);
  console.log(`${name}: ${good.length}/${candidates.length} working`, good);
  return good.length ? good : old;
}

async function urlsFrom(url) {
  try {
    const text = (await get(url, "text")).body;
    return [...text.matchAll(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi)].map((m) => m[0])
      .filter((u) => !/github|codeberg|gitlab|sudovanilla\.org\/korbs/i.test(u));
  } catch (e) {
    console.warn("list", url, e.message);
    return [];
  }
}

async function tikwmWorks(base) {
  try {
    const { body, cors } = await get(`${base}/api/feed/search?keywords=cat&count=3&cursor=0`);
    const list = Array.isArray(body.data) ? body.data : body.data?.videos || [];
    return cors && body.code === 0 && list.length ? base : null;
  } catch {
    return null;
  }
}

// Guess Piped website URLs from API URLs: pipedapi.example.com -> piped.example.com
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

async function refreshEmbeds(kind, candidates, old) {
  candidates = [...new Set([...candidates, ...old])];
  const good = (await Promise.all(candidates.map((c) => embedWorks(c, kind)))).filter(Boolean).slice(0, 15);
  console.log(`${kind} embeds: ${good.length}/${candidates.length} working`, good);
  return good.length ? good : old;
}

const old = JSON.parse(await readFile(OUT, "utf8"));
let pipedApiCandidates = [];
try { pipedApiCandidates = await pipedList(); } catch {}
let invCandidates = [];
try { invCandidates = await invidiousList(); } catch {}

const next = {
  piped: await refresh("piped", async () => pipedApiCandidates, old.piped || []),
  invidious: await refresh("invidious", async () => invCandidates, old.invidious || old.instances || []),
};
next.pipedFrontends = await refreshEmbeds("piped",
  [...PIPED_FRONTENDS, ...frontendGuesses([...pipedApiCandidates, ...next.piped])], old.pipedFrontends || []);
next.invidiousEmbed = await refreshEmbeds("invidious",
  [...invCandidates, ...next.invidious, "https://invidious.ducks.party"], old.invidiousEmbed || []);

// ----- extra YouTube front-ends (watch page in a frame) -----
const pokeCandidates = (await Promise.all(POKE_LISTS.map(urlsFrom))).flat();
next.ytFrontends = await refreshPages("yt front-ends", [...YT_FRONTENDS, ...pokeCandidates], old.ytFrontends || [],
  `/watch?v=${TEST_ID}`, /<video|poke|cloudtube|viewtube|iframe/);

// ----- TikTok -----
let proxitokCandidates = [];
try {
  proxitokCandidates = (await get(PROXITOK_LIST)).body.map((i) => i.clearnet).filter(Boolean);
} catch (e) { console.warn("proxitok list:", e.message); }
next.proxitok = await refreshPages("proxitok", proxitokCandidates, old.proxitok || [],
  `/@scout2015/video/${TEST_TIKTOK}`, /<video/);
const tikwmOk = (await Promise.all(TIKWM.map(tikwmWorks))).filter(Boolean);
console.log("tikwm:", tikwmOk);
next.tikwm = tikwmOk.length ? tikwmOk : (old.tikwm || []);

const same = (a, b) => [...a].sort().join() === [...(b || [])].sort().join();
if (Object.keys(next).every((k) => same(next[k], old[k]))) {
  console.log("No change.");
} else {
  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), ...next }, null, 2) + "\n");
  console.log("instances.json updated.");
}
