// Refreshes instances.json with Piped and Invidious servers that are up right
// now, answer searches, and allow browser (CORS) requests.
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

const old = JSON.parse(await readFile(OUT, "utf8"));
const next = {
  piped: await refresh("piped", pipedList, old.piped || []),
  invidious: await refresh("invidious", invidiousList, old.invidious || old.instances || []),
};

const same = (a, b) => [...a].sort().join() === [...b].sort().join();
if (same(next.piped, old.piped || []) && same(next.invidious, old.invidious || [])) {
  console.log("No change.");
} else {
  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), ...next }, null, 2) + "\n");
  console.log("instances.json updated.");
}
