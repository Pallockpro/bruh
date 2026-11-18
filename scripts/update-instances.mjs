// Refreshes instances.json with Invidious instances that are currently up
// and answer API requests. Run by .github/workflows/update.yml on a schedule.
import { readFile, writeFile } from "node:fs/promises";

const LIST_URL = "https://api.invidious.io/instances.json?sort_by=health";
const OUT = new URL("../instances.json", import.meta.url);
const TIMEOUT_MS = 10000;
const MAX = 12;

async function get(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "bruh-instance-updater" },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function works(base) {
  try {
    const data = await get(`${base}/api/v1/search?q=music&type=video`);
    return Array.isArray(data) && data.some((v) => v.videoId);
  } catch {
    return false;
  }
}

const old = JSON.parse(await readFile(OUT, "utf8"));
let candidates = [];
try {
  const list = await get(LIST_URL);
  candidates = list
    .map(([, info]) => info)
    .filter((i) => i && i.type === "https" && i.api !== false && i.uri)
    .map((i) => i.uri.replace(/\/+$/, ""));
} catch (e) {
  console.warn("Could not fetch public instance list:", e.message);
}
// Also re-check the ones we already have.
candidates = [...new Set([...candidates, ...old.instances])];

const checks = await Promise.all(candidates.map(async (c) => [c, await works(c)]));
const good = checks.filter(([, ok]) => ok).map(([c]) => c).slice(0, MAX);
console.log(`${good.length}/${candidates.length} instances working:`, good);

if (good.length === 0) {
  console.log("Nothing working right now; keeping the existing list.");
} else if (JSON.stringify(good) !== JSON.stringify(old.instances)) {
  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), instances: good }, null, 2) + "\n");
  console.log("instances.json updated.");
} else {
  console.log("No change.");
}
